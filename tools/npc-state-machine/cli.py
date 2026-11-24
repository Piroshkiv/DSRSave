"""
Console test tool for the generic NPC state-machine schema (npc_state_machine.json, v2).

Usage:
    python cli.py status   --save <path> --slot <n> --npc solaire
    python cli.py rollback --save <path> --slot <n> --npc solaire --stage anor_londo
    python cli.py revive   --save <path> --slot <n> --npc solaire [--stage demon_ruins]
    python cli.py kill     --save <path> --slot <n> --npc solaire
    python cli.py aggro    --save <path> --slot <n> --npc solaire
    python cli.py calm     --save <path> --slot <n> --npc solaire

Bosses (no "key_stages") just use the "default" pseudo-stage automatically.
All write actions require the game at the main menu -- the tool prompts you
to confirm. Every write makes a timestamped backup and verifies MD5 after.
"""
import sys
import os
import json
import struct
import hashlib
import shutil
import datetime
import argparse

sys.path.insert(0, r"C:\Users\Iho\source\repos\DSRSave\tools\ds1-gesture-sweeper")
import constants as C
import sl2
from Crypto.Cipher import AES

SCHEMA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "npc_state_machine.json")


def load_schema():
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


class FlagAddr:
    def __init__(self, schema, p1):
        self.p1 = p1
        f = schema["flag_address_formula"]
        self.buffer_start = p1 + int(f["buffer_start_offset"], 16)
        self.k_table = f["k_table_by_map"]
        self.megabank = {int(k): v for k, v in f["megabank_by_region"].items()}

    def addr(self, flag_id):
        flag_id = int(flag_id)
        region = (flag_id // 10_000_000) % 10
        area = (flag_id // 100_000) % 100
        group = (flag_id // 10_000) % 10
        zone = (flag_id // 1_000) % 10
        local = flag_id % 1_000
        word = local // 32
        bit = 31 - (local % 32)
        byte_in_word = bit // 8
        bit_in_byte = bit % 8
        if region == 0 or (area == 0 and group == 0 and region not in self.megabank):
            block = 0
        elif area == 0 and group == 0:
            block = 1 + self.megabank[region] * 18 + 0
        else:
            mapname = f"m{area:02d}_{group:02d}"
            if mapname not in self.k_table:
                raise ValueError(f"no k_table entry for {mapname} (flag {flag_id})")
            block = 1 + self.megabank[region] * 18 + self.k_table[mapname]
        word_start = self.buffer_start + block * 1280 + zone * 128 + word * 4
        return word_start + byte_in_word, bit_in_byte


class ChrBlob:
    def __init__(self, schema, p1, buf):
        self.p1 = p1
        self.buf = buf
        self.off = p1 + int(schema["chr_blob"]["offset_from_pattern1"], 16)

    def entries(self):
        p = self.off + 4 + 4 + 4
        out = []
        while True:
            map_id = struct.unpack_from("<I", self.buf, p)[0]
            if map_id == 0xFFFFFFFF:
                break
            entry_size = struct.unpack_from("<I", self.buf, p + 4)[0]
            chr_count = struct.unpack_from("<I", self.buf, p + 8)[0]
            b4 = struct.pack("<I", map_id)
            mapname = f"m{b4[3]:02d}_{b4[2]:02d}_00_00"
            out.append({"map": mapname, "map_id": map_id, "pos": p, "entry_size": entry_size, "chr_count": chr_count})
            p += entry_size
        return out

    def defang_map(self, map_short_name):
        if not map_short_name:
            return False
        target_full = f"{map_short_name}_00_00"
        changed = False
        for e in self.entries():
            if e["map"] == target_full:
                struct.pack_into("<I", self.buf, e["pos"] + 8, 0xFFFFFFFF)
                print(f"  CHR blob: defanged {e['map']} entry (chr_count {e['chr_count']} -> 0xFFFFFFFF)")
                changed = True
        return changed

    def set_bits(self, map_short_name, msb_indices, value):
        """Precise per-character edit: flip specific MSB-index bits within one map's
        bitmask, instead of corrupting chr_count for the whole map. Use this when
        other characters in the same map must keep their own forced-kill state
        untouched (e.g. one enemy among several sharing a map entry)."""
        if not map_short_name:
            return False
        target_full = f"{map_short_name}_00_00"
        changed = False
        for e in self.entries():
            if e["map"] == target_full:
                bitmask_start = e["pos"] + 12
                for idx in msb_indices:
                    set_bit(self.buf, bitmask_start + idx // 8, idx % 8, value)
                print(f"  CHR blob: set bits {msb_indices} to {value} in {e['map']} entry (chr_count={e['chr_count']})")
                changed = True
        if not changed:
            print(f"  CHR blob: no entry for {target_full} present in this save -- nothing to edit")
        return changed

    def get_bit(self, map_short_name, msb_index):
        """Read-only: current forced-dead bit for one character at one map
        placement. Returns 0 if that map has no CHR-blob entry yet (never
        backread this session) -- same as 'not forced dead', the safe default."""
        if not map_short_name:
            return 0
        target_full = f"{map_short_name}_00_00"
        for e in self.entries():
            if e["map"] == target_full:
                bitmask_start = e["pos"] + 12
                return get_bit(self.buf, bitmask_start + msb_index // 8, msb_index % 8)
        return 0


class ObjBlob:
    """Sibling of ChrBlob for the 'OBJ ' section that immediately follows the
    'CHR ' section in the save (same format, applies to MSB Objects instead of
    Characters -- see project memory project_ds1_npc_engine.md, 2026-11-19).
    Its position is NOT a fixed pattern1 offset: it sits right after CHR's own
    body, whose length varies per-save (depends how many maps are in the
    live CHR blob), so it must be located dynamically every time."""

    def __init__(self, schema, p1, buf):
        self.p1 = p1
        self.buf = buf
        chr_off = p1 + int(schema["chr_blob"]["offset_from_pattern1"], 16)
        chr_body_size = struct.unpack_from("<I", buf, chr_off)[0]
        self.off = chr_off + 4 + chr_body_size  # position of OBJ's own size field

    def entries(self):
        p = self.off + 4 + 8
        out = []
        while True:
            map_id = struct.unpack_from("<I", self.buf, p)[0]
            if map_id == 0xFFFFFFFF:
                break
            entry_size = struct.unpack_from("<I", self.buf, p + 4)[0]
            count = struct.unpack_from("<I", self.buf, p + 8)[0]
            b4 = struct.pack("<I", map_id)
            mapname = f"m{b4[3]:02d}_{b4[2]:02d}_00_00"
            out.append({"map": mapname, "map_id": map_id, "pos": p, "entry_size": entry_size, "count": count})
            p += entry_size
        return out

    def set_bits(self, map_short_name, indices, value):
        """Precise per-object edit: flip specific indices within one map's OBJ
        bitmask (e.g. Andre's anvil props, indices 460/461 in m10_01). Not a
        passive flag -- on next load this triggers the real native
        destroy/restore routine (FUN_1402fce20), confirmed by decompile."""
        if not map_short_name:
            return False
        target_full = f"{map_short_name}_00_00"
        changed = False
        for e in self.entries():
            if e["map"] == target_full:
                bitmask_start = e["pos"] + 12
                for idx in indices:
                    set_bit(self.buf, bitmask_start + idx // 8, idx % 8, value)
                print(f"  OBJ blob: set bits {indices} to {value} in {e['map']} entry (count={e['count']})")
                changed = True
        if not changed:
            print(f"  OBJ blob: no entry for {target_full} present in this save -- nothing to edit")
        return changed


def apply_chr_obj_bits(schema, p1, buf, axis_cfg, target_true):
    """Shared by both the stage-rollback path and the plain revive/kill path
    (previously this logic was duplicated and the plain path forgot chr_bit
    entirely -- see project memory, 'axisAction chr_bit gap'). Bidirectional:
    revive clears the bit (0, 'not forced-dead'), kill sets it (1, 'forced-dead'
    -- triggers the real native kill/destroy routine on next load, matching
    what a genuine kill does). chr_map blunt-defang is revive-only (no sane
    'force the whole map dead' counterpart)."""
    chr_blob = ChrBlob(schema, p1, buf)
    chr_bit = axis_cfg.get("chr_bit")
    if target_true:
        chr_blob.defang_map(axis_cfg.get("chr_map"))
        if chr_bit:
            chr_blob.set_bits(chr_bit["map"], [chr_bit["msb_index"]], 0)
    elif chr_bit:
        chr_blob.set_bits(chr_bit["map"], [chr_bit["msb_index"]], 1)

    obj_bits = axis_cfg.get("obj_bits")
    if obj_bits:
        obj_blob = ObjBlob(schema, p1, buf)
        obj_blob.set_bits(obj_bits["map"], obj_bits["indices"], 0 if target_true else 1)


def sweep_sibling_chr_bits_alive(schema, p1, buf, npc):
    """Revive-only safety net for multi-placement NPCs that can end up with a
    STALE duplicate body left over from a native engine race (e.g. trusty_patches
    + Rhea's flag 1173, see project memory) -- if the player killed one of the
    two simultaneously-visible copies, only ITS OWN chr_bit gets forced-dead by
    the native kill; a plain revive only clears the chr_bit for whichever single
    stage flags currently point to, leaving the OTHER placement's chr_bit stuck
    forced-dead. This sweeps EVERY chr_bit listed across all of this NPC's
    alive.per_stage entries to 'not forced-dead' on every revive, regardless of
    which one is the currently-active stage. Safe and NOT the reverted
    'enforce_sibling_exclusivity' idea: this only ever CLEARS chr_bit (never
    forces one on), so it can't fake-kill a placement the way that did."""
    chr_blob = ChrBlob(schema, p1, buf)
    seen = set()
    per_stage = npc.get("status_axes", {}).get("alive", {}).get("per_stage", {})
    for cfg in per_stage.values():
        cb = cfg.get("chr_bit")
        if not cb:
            continue
        key = (cb["map"], cb["msb_index"])
        if key in seen:
            continue
        seen.add(key)
        chr_blob.set_bits(cb["map"], [cb["msb_index"]], 0)


def get_bit(buf, byte_off, bit):
    return (buf[byte_off] >> bit) & 1


def set_bit(buf, byte_off, bit, value):
    b = buf[byte_off]
    if value:
        b |= (1 << bit)
    else:
        b &= ~(1 << bit)
    buf[byte_off] = b


def open_slot(save_path, slot):
    raw = sl2.load(save_path)
    off = sl2.slot_offset(slot)
    checksum = raw[off:off + 16]
    plaintext = bytearray(sl2.decrypt_slot(raw, slot))
    p1 = sl2.find_pattern1(plaintext)
    if p1 < 0:
        raise RuntimeError("pattern1 not found -- empty slot or wrong file?")
    return raw, off, checksum, plaintext, p1


def write_slot(save_path, raw, off, checksum, new_plain, slot, label):
    assert new_plain[-12:] == b"\x0c" * 12, "padding corrupted, refusing to write"
    cipher = AES.new(C.AES_KEY, AES.MODE_CBC, bytes(checksum))
    new_encrypted = cipher.encrypt(bytes(new_plain))
    new_checksum = hashlib.md5(new_encrypted).digest()

    backup_path = save_path + f".before_{label}_{datetime.datetime.now():%Y%m%d_%H%M%S}.bak"
    shutil.copy2(save_path, backup_path)
    print(f"backup: {backup_path}")

    new_raw = bytearray(raw)
    new_raw[off:off + 16] = new_checksum
    new_raw[off + 16:off + 16 + C.USER_DATA_SIZE] = new_encrypted
    with open(save_path, "wb") as f:
        f.write(new_raw)
    print("save file written")

    verify_raw = sl2.load(save_path)
    ok = sl2.verify_slot_md5(verify_raw, slot)
    print(f"md5_ok={ok}")
    if not ok:
        print("!!! MD5 verification FAILED -- restore from the backup above !!!")
    return ok


def confirm_main_menu():
    ans = input("Is the game sitting at the main menu right now (no character loaded)? [y/N] ").strip().lower()
    if ans != "y":
        print("Aborting -- go to the main menu first.")
        sys.exit(1)


def resolve_addr(fa, p1, key):
    """A flag key is normally a decimal EventFlag id, resolved via the k-table
    formula (FlagAddr.addr). Some bits (so far: exactly one, Gwynevere's
    0x16D77 bit7) were live-bisected to a real pattern1-relative byte+bit in a
    past session but never resolved to an actual EventFlag id despite
    repeated attempts -- for those, the key is the string "raw:<hex_offset>:
    <bit>" (e.g. "raw:0x16D77:7"), addressed directly as pattern1+offset,
    bypassing the k-table/buffer_start formula entirely. This mirrors how the
    OLD npc_data.json/NpcStatusService system addresses every flag -- use it
    only when a flag id genuinely can't be found, not as a shortcut."""
    if isinstance(key, str) and key.startswith("raw:"):
        _, off_hex, bit_str = key.split(":")
        return p1 + int(off_hex, 16), int(bit_str)
    return fa.addr(key)


def set_flags(fa, buf, flag_value_dict):
    for fid, val in flag_value_dict.items():
        off, bit = resolve_addr(fa, fa.p1, fid)
        set_bit(buf, off, bit, val)


def all_flag_ids(npc):
    ids = set()
    for st in npc.get("key_stages", {}).values():
        ids.update(st.get("flags_on", []))
    for st in npc.get("non_key_stages", {}).values():
        ids.update(st.get("flags_on_add", []))
        ids.update(st.get("flags_off", []))
    for axis in npc.get("status_axes", {}).values():
        for st in axis.get("per_stage", {}).values():
            ids.update(int(k) for k in st.get("set_true", {}) if not str(k).startswith("raw:"))
            ids.update(int(k) for k in st.get("set_false", {}) if not str(k).startswith("raw:"))
            ids.update(st.get("always_clear_traps", []))
    ids.update(npc.get("transition_traps_always_clear", []))
    pfr = npc.get("personal_flag_range")
    if pfr:
        ids.update(range(pfr[0], pfr[1] + 1))
    return sorted(ids)


def cmd_status(schema, args):
    npc = schema["npcs"][args.npc]
    _, _, _, buf, p1 = open_slot(args.save, args.slot)
    fa = FlagAddr(schema, p1)
    print(f"name={sl2.read_name(bytes(buf))!r} level={sl2.read_level(bytes(buf))} pattern1={hex(p1)}\n")

    ids = all_flag_ids(npc)
    vals = {}
    for fid in ids:
        off, bit = fa.addr(fid)
        vals[fid] = get_bit(buf, off, bit)
    print("Flag values:")
    for fid in ids:
        print(f"  {fid:>10} = {vals[fid]}")

    if npc.get("key_stages"):
        children_by_parent = {}
        for nk_id, nk in npc.get("non_key_stages", {}).items():
            children_by_parent.setdefault(nk["parent"], []).append(nk_id)
        print("\nBest-matching key stage (fewest mismatches vs. that stage's flags_on, rest=0;"
              " a hidden non_key_stage's own best match is folded into its parent's count):")
        for stage_id, st in npc["key_stages"].items():
            wanted_on = set(st["flags_on"])
            mism = sum(1 for fid in ids if (fid in wanted_on) != bool(vals.get(fid)))
            for nk_id in children_by_parent.get(stage_id, []):
                nk_flags_on, _ = resolve_stage_flags_on(npc, nk_id)
                nk_wanted = set(nk_flags_on)
                nk_mism = sum(1 for fid in ids if (fid in nk_wanted) != bool(vals.get(fid)))
                mism = min(mism, nk_mism)
            tag = "VERIFIED" if st.get("verified") else "theoretical"
            print(f"  {stage_id:<18} ({tag}): {mism} flags differ")

    chr_blob = ChrBlob(schema, p1, buf)
    print("\nCHR blob entries:")
    for e in chr_blob.entries():
        print(f"  {e}")


def apply_stage_flags_on(fa, buf, ids_universe, flags_on):
    on_set = set(flags_on)
    for fid in ids_universe:
        off, bit = fa.addr(fid)
        set_bit(buf, off, bit, 1 if fid in on_set else 0)


def resolve_stage_flags_on(npc, stage_id):
    """Resolve either a key_stage id or a non_key_stage id into its full flags_on list."""
    key_stages = npc.get("key_stages", {})
    if stage_id in key_stages:
        return key_stages[stage_id]["flags_on"], key_stages[stage_id].get("verified", False)
    non_key = npc.get("non_key_stages", {})
    if stage_id in non_key:
        nk = non_key[stage_id]
        parent = key_stages[nk["parent"]]
        flags_on = set(parent["flags_on"]) | set(nk.get("flags_on_add", []))
        flags_on -= set(nk.get("flags_off", []))
        return sorted(flags_on), parent.get("verified", False)
    raise KeyError(f"'{stage_id}' is not a key_stage or non_key_stage")


def apply_axis_for_stage(fa, buf, npc, axis_name, target_true, stage_id):
    """Normalize one status axis (alive/hostile) to the given target for a
    specific stage, using that stage's own per_stage config. No-op if the
    NPC/stage has no definition for this axis (nothing to normalize)."""
    per_stage = npc.get("status_axes", {}).get(axis_name, {}).get("per_stage", {})
    # fall back to a "default" entry if this NPC's per-stage config doesn't repeat itself
    # per named stage (e.g. an NPC whose hostile flag is the same regardless of which of
    # its several map placements is currently active) -- without this, rollback would
    # silently skip normalizing that axis for any stage id other than "default" itself.
    axis_cfg = per_stage.get(stage_id) or per_stage.get("default")
    if axis_cfg is None:
        return
    to_set = axis_cfg["set_true"] if target_true else axis_cfg["set_false"]
    print(f"  normalizing {axis_name}={target_true}: {to_set}")
    set_flags(fa, buf, to_set)
    traps = axis_cfg.get("always_clear_traps", [])
    if traps:
        set_flags(fa, buf, {t: 0 for t in traps})
    if axis_name == "alive":
        apply_chr_obj_bits(schema_global, fa.p1, buf, axis_cfg, target_true)
        if target_true:
            sweep_sibling_chr_bits_alive(schema_global, fa.p1, buf, npc)


def apply_npc_stage(fa, buf, npc, stage_id):
    """Jump an NPC straight to a quest stage: set its personal flags_on,
    then always normalize it to alive+not-hostile for that stage (so a
    rollback never leaves it stuck dead/aggroed from whatever state it was
    in before -- use the standalone kill/aggro commands afterward if you
    deliberately want it dead or hostile at the new stage). Returns the
    "axis stage id" used for the alive/hostile/dependent_enemies lookup
    (a non_key_stage's parent key_stage id, since those sub-variants don't
    have their own status_axes/dependent_enemies entries)."""
    ids = all_flag_ids(npc)
    flags_on, verified = resolve_stage_flags_on(npc, stage_id)
    if not verified:
        print(f"  WARNING: stage '{stage_id}' is THEORETICAL / not live-verified yet. Proceeding anyway.")
    apply_stage_flags_on(fa, buf, ids, flags_on)
    non_key = npc.get("non_key_stages", {})
    axis_stage_id = non_key[stage_id]["parent"] if stage_id in non_key else stage_id
    apply_axis_for_stage(fa, buf, npc, "alive", True, axis_stage_id)
    apply_axis_for_stage(fa, buf, npc, "hostile", False, axis_stage_id)
    return axis_stage_id


schema_global = None  # set in main() so apply_npc_stage can reach chr_blob config without threading it through every call


def apply_dependent_enemies(fa, buf, p1, npc, stage_id, revive_count):
    """For an NPC whose quest fork depends on OTHER (non-personal-flag) enemies
    being alive/dead -- e.g. Siegmeyer's Lost Izalith Chaos Eaters -- bring those
    enemies' CHR-blob forced-kill bits (and, if the enemy also has its own
    permanent "already died once" EventFlag latch -- see event_slot_flags --
    that flag too) in line with the target stage: revive if the stage is before
    the fork resolves, kill if the stage is an already-resolved ending. Uses
    precise MSB-index bit edits, not whole-map chr_count corruption, so
    unrelated characters sharing the same map entry are left untouched.

    event_slot_flags matter because some enemies are ALSO guarded by their own
    "RelativeToThisEventSlot"-style permanent EventFlag (set once the first time
    they die, independent of the CHR blob): on every later map load, an EMEVD
    event checks that flag and re-force-kills the enemy immediately if it's set
    -- so clearing only the CHR-blob bit has no visible effect, the enemy gets
    killed again before the player ever sees it, and the very next autosave
    just writes the CHR-blob bit back to 1 since the enemy is freshly dead again.
    Confirmed for Siegmeyer's Chaos Eaters (event 11410100, flags 11410100-103)
    by a dedicated RE pass 2026-11-14 -- see project memory."""
    deps = npc.get("dependent_enemies", {})
    if not deps:
        return
    chr_blob = ChrBlob(schema_global, p1, buf)
    for name, cfg in deps.items():
        indices = cfg["msb_indices"]
        chr_map = cfg["chr_map"]
        slot_flags = cfg.get("event_slot_flags")
        if stage_id in cfg.get("revive_at_stages", []):
            n = 1 if revive_count == "one" else len(indices)
            chosen = indices[:n]
            print(f"  dependent enemy group '{name}': reviving {len(chosen)}/{len(indices)} (msb {chosen})")
            chr_blob.set_bits(chr_map, chosen, 0)
            if slot_flags:
                chosen_flags = slot_flags[:n]
                print(f"  dependent enemy group '{name}': clearing permanent-death latch flags {chosen_flags}")
                set_flags(fa, buf, {f: 0 for f in chosen_flags})
        elif stage_id in cfg.get("kill_at_stages", []):
            print(f"  dependent enemy group '{name}': killing all {len(indices)} (msb {indices})")
            chr_blob.set_bits(chr_map, indices, 1)
            if slot_flags:
                print(f"  dependent enemy group '{name}': setting permanent-death latch flags {slot_flags}")
                set_flags(fa, buf, {f: 1 for f in slot_flags})


def cmd_rollback(schema, args):
    global schema_global
    schema_global = schema

    if args.npc in schema.get("npc_groups", {}):
        group = schema["npc_groups"][args.npc]
        combo = group.get("combo_stages", {})

        if args.stage in combo and not args.substage:
            # named preset: apply every member's stage from the combo dict
            plan = combo[args.stage]
            print(f"Group rollback '{args.npc}' -> combo stage '{args.stage}': {plan}")
        else:
            # two-step mode: primary member's stage is required, secondary is optional
            primary = group["primary_member"]
            secondary = group.get("secondary_member")
            plan = {primary: args.stage}
            if args.substage:
                if not secondary:
                    print(f"'{args.npc}' has no secondary_member -- --substage is not applicable.")
                    sys.exit(1)
                plan[secondary] = args.substage
            print(f"Group rollback '{args.npc}': primary {primary} -> '{args.stage}'" +
                  (f", secondary {secondary} -> '{args.substage}'" if args.substage else f" ({secondary} left untouched)" if secondary else ""))

        confirm_main_menu()
        raw, off, checksum, buf, p1 = open_slot(args.save, args.slot)
        fa = FlagAddr(schema, p1)
        for member, member_stage in plan.items():
            print(f"-- applying {member} -> {member_stage}")
            axis_stage_id = apply_npc_stage(fa, buf, schema["npcs"][member], member_stage)
            apply_dependent_enemies(fa, buf, p1, schema["npcs"][member], axis_stage_id, args.revive_count)
        write_slot(args.save, raw, off, checksum, buf, args.slot, f"{args.npc}_rollback_{args.stage}")
        return

    npc = schema["npcs"][args.npc]
    try:
        resolve_stage_flags_on(npc, args.stage)
    except KeyError:
        print(f"Unknown stage '{args.stage}'. Valid: {list(npc.get('key_stages', {}))}")
        sys.exit(1)

    confirm_main_menu()
    raw, off, checksum, buf, p1 = open_slot(args.save, args.slot)
    fa = FlagAddr(schema, p1)
    axis_stage_id = apply_npc_stage(fa, buf, npc, args.stage)
    apply_dependent_enemies(fa, buf, p1, npc, axis_stage_id, args.revive_count)
    write_slot(args.save, raw, off, checksum, buf, args.slot, f"{args.npc}_rollback_{args.stage}")


def detect_current_stage(fa, buf, npc, ids):
    """Picks the key_stage whose flags_on best matches the save's real flags.
    For each key_stage, also tries every HIDDEN non_key_stage that resolves
    to it (a non_key_stage's own flags_on, via resolve_stage_flags_on) and
    keeps whichever variant mismatches least -- this is what makes a hidden
    sub-variant (e.g. trusty_patches' forgiven_awaiting_nito, folded into
    pit_pushed) detect correctly as its PARENT without needing to rely on
    dict insertion order to break a mismatch-count tie. Returns the key_stage
    id, never a non_key_stage id -- a hidden variant is only ever surfaced as
    its parent."""
    stages = npc.get("key_stages")
    if not stages:
        return "default"
    vals = {}
    for fid in ids:
        off, bit = fa.addr(fid)
        vals[fid] = get_bit(buf, off, bit)

    def mism_for(flags_on):
        wanted_on = set(flags_on)
        return sum(1 for fid in ids if (fid in wanted_on) != bool(vals.get(fid)))

    children_by_parent = {}
    for nk_id, nk in npc.get("non_key_stages", {}).items():
        children_by_parent.setdefault(nk["parent"], []).append(nk_id)

    scores = {}
    for stage_id, st in stages.items():
        mism = mism_for(st["flags_on"])
        for nk_id in children_by_parent.get(stage_id, []):
            nk_flags_on, _ = resolve_stage_flags_on(npc, nk_id)
            mism = min(mism, mism_for(nk_flags_on))
        scores[stage_id] = mism
    best_mism = min(scores.values())
    tied = [sid for sid, m in scores.items() if m == best_mism]

    best_id = tied[0]
    if len(tied) > 1:
        # A multi-placement NPC whose native death-watcher wipes its whole
        # personal_flag_range on death (e.g. trusty_patches at Firelink) can
        # leave EVERY key_stage equally mismatched -- EventFlags alone can't
        # say which placement he died at. Break the tie using the CHR blob:
        # whichever tied stage's OWN chr_bit is currently forced-dead is
        # concrete physical evidence he's actually there.
        alive_per_stage = npc.get("status_axes", {}).get("alive", {}).get("per_stage", {})
        chr_blob = ChrBlob(schema_global, fa.p1, buf)
        dead_candidates = []
        for sid in tied:
            cb = alive_per_stage.get(sid, {}).get("chr_bit")
            if cb and chr_blob.get_bit(cb["map"], cb["msb_index"]):
                dead_candidates.append(sid)
        if len(dead_candidates) == 1:
            best_id = dead_candidates[0]
    print(f"Detected current stage: {best_id} ({best_mism} flags differ from its ideal flags_on)")
    return best_id


def cmd_axis_action(schema, args, axis_name, target_true):
    global schema_global
    schema_global = schema

    npc = schema["npcs"][args.npc]
    if axis_name not in npc.get("status_axes", {}):
        print(f"NPC '{args.npc}' has no '{axis_name}' axis.")
        sys.exit(1)

    confirm_main_menu()
    raw, off, checksum, buf, p1 = open_slot(args.save, args.slot)
    fa = FlagAddr(schema, p1)
    ids = all_flag_ids(npc)

    stage_id = args.stage or detect_current_stage(fa, buf, npc, ids)
    per_stage = npc["status_axes"][axis_name]["per_stage"]
    axis_cfg = per_stage.get(stage_id) or per_stage.get("default")
    if axis_cfg is None:
        print(f"Axis '{axis_name}' has no definition for stage '{stage_id}'. Aborting, no changes made.")
        sys.exit(1)
    if not axis_cfg.get("verified", False):
        print(f"WARNING: axis '{axis_name}' at stage '{stage_id}' is UNVERIFIED. Proceeding anyway.")

    if axis_name == "alive" and target_true:
        restore_location_flags_if_wiped(fa, buf, npc, ids, stage_id)

    to_set = axis_cfg["set_true"] if target_true else axis_cfg["set_false"]
    print(f"Setting: {to_set}")
    set_flags(fa, buf, to_set)

    traps = axis_cfg.get("always_clear_traps", [])
    if traps:
        print(f"Clearing traps: {traps}")
        set_flags(fa, buf, {t: 0 for t in traps})

    if axis_name == "alive":
        apply_chr_obj_bits(schema, p1, buf, axis_cfg, target_true)
        if target_true:
            sweep_sibling_chr_bits_alive(schema, p1, buf, npc)

    write_slot(args.save, raw, off, checksum, buf, args.slot, f"{args.npc}_{axis_name}_{target_true}")


def restore_location_flags_if_wiped(fa, buf, npc, ids, stage_id):
    """Some NPCs' native death-watcher wipes their WHOLE personal_flag_range on
    death (e.g. trusty_patches at Firelink: event 11020530 sweeps [1620,1629]
    to 0), which also erases which location they were at. detect_current_stage
    can still recover the right stage via the CHR blob (see its own docstring),
    but that recovery is READ-ONLY -- it doesn't repair the save. On revive,
    if the detected stage's own flags_on aren't actually all set (proof the
    location flags are still wiped/inconsistent), restore them now so the
    save's own data matches where we just determined the NPC physically is.
    No-op for the overwhelming majority of NPCs/stages, where flags_on is
    already satisfied (that's WHY this stage was detected)."""
    key_stages = npc.get("key_stages", {})
    st = key_stages.get(stage_id)
    if not st:
        return
    wanted_on = st["flags_on"]
    already_ok = all(get_bit(buf, *fa.addr(fid)) == 1 for fid in wanted_on)
    if already_ok:
        return
    print(f"  location flags for '{stage_id}' were wiped/inconsistent -- restoring {wanted_on}")
    apply_stage_flags_on(fa, buf, ids, wanted_on)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", choices=["status", "rollback", "revive", "kill", "aggro", "calm"])
    ap.add_argument("--save", required=True)
    ap.add_argument("--slot", type=int, required=True)
    ap.add_argument("--npc", required=True)
    ap.add_argument("--stage", help="for 'rollback' (required) or to force a stage for revive/kill/aggro/calm instead of auto-detecting")
    ap.add_argument("--substage", help="group rollback only: the secondary member's stage (e.g. Sieglinde's), applied alongside --stage for the primary member (Siegmeyer). Omit to leave the secondary member untouched.")
    ap.add_argument("--revive-count", choices=["one", "all"], default="all",
                     help="rollback only, for NPCs with 'dependent_enemies' (e.g. Siegmeyer's Chaos Eaters): "
                          "when landing on a pre-fork stage, revive just one of them or all of them (default: all). "
                          "Has no effect when landing on an already-resolved ending stage (those are always killed).")
    args = ap.parse_args()

    schema = load_schema()
    is_group = args.npc in schema.get("npc_groups", {})
    if not is_group and args.npc not in schema["npcs"]:
        print(f"Unknown npc/group '{args.npc}'. Known npcs: {list(schema['npcs'])}. Known groups: {list(schema.get('npc_groups', {}))}")
        sys.exit(1)
    if is_group and args.action != "rollback":
        print(f"'{args.npc}' is an npc_group -- only 'rollback --stage <combo_stage>' is supported for groups (use the individual member names for revive/kill/aggro/calm).")
        sys.exit(1)

    if args.action == "status":
        cmd_status(schema, args)
    elif args.action == "rollback":
        if not args.stage:
            print("rollback requires --stage <key_stage_id>")
            sys.exit(1)
        cmd_rollback(schema, args)
    elif args.action == "revive":
        cmd_axis_action(schema, args, "alive", True)
    elif args.action == "kill":
        cmd_axis_action(schema, args, "alive", False)
    elif args.action == "aggro":
        cmd_axis_action(schema, args, "hostile", True)
    elif args.action == "calm":
        cmd_axis_action(schema, args, "hostile", False)


if __name__ == "__main__":
    main()
