import { Character } from './Character';
import {
  StateMachineSchema, NpcEntry, AxisStageConfig, NpcSummary, TriState,
} from '../types/npcStateMachine';

/** Resolves a DS1 EventFlag id to (byteOffset, bit) relative to the start of a
 * decrypted save slot, given this character's own pattern1 anchor. Port of
 * tools/npc-state-machine/cli.py's FlagAddr / DSRSave's C# FlagAddr.cs. */
export class FlagAddr {
  private bufferStart: number;
  private kTable: Record<string, number>;
  private megabank: Record<number, number>;

  constructor(schema: StateMachineSchema, p1: number) {
    this.bufferStart = p1 + parseInt(schema.flag_address_formula.buffer_start_offset, 16);
    this.kTable = schema.flag_address_formula.k_table_by_map;
    this.megabank = {};
    for (const [k, v] of Object.entries(schema.flag_address_formula.megabank_by_region)) {
      this.megabank[parseInt(k, 10)] = v;
    }
  }

  addr(flagId: number): [number, number] {
    const region = Math.floor(flagId / 10_000_000) % 10;
    const area = Math.floor(flagId / 100_000) % 100;
    const group = Math.floor(flagId / 10_000) % 10;
    const zone = Math.floor(flagId / 1_000) % 10;
    const local = flagId % 1_000;
    const word = Math.floor(local / 32);
    const bit = 31 - (local % 32);
    const byteInWord = Math.floor(bit / 8);
    const bitInByte = bit % 8;

    let block: number;
    if (region === 0 || (area === 0 && group === 0 && !(region in this.megabank))) {
      block = 0;
    } else if (area === 0 && group === 0) {
      block = 1 + this.megabank[region] * 18;
    } else {
      const mapName = `m${String(area).padStart(2, '0')}_${String(group).padStart(2, '0')}`;
      if (!(mapName in this.kTable)) {
        throw new Error(`no k_table entry for ${mapName} (flag ${flagId})`);
      }
      block = 1 + this.megabank[region] * 18 + this.kTable[mapName];
    }

    const wordStart = this.bufferStart + block * 1280 + zone * 128 + word * 4;
    return [wordStart + byteInWord, bitInByte];
  }
}

/** A flag key is normally a decimal EventFlag id string, resolved via the
 * k-table formula. One bit (Gwynevere's 0x16D77 bit7) was live-bisected to a
 * real pattern1-relative byte+bit in a past session but never resolved to an
 * actual EventFlag id -- for that, the key is "raw:<hex_offset>:<bit>" (e.g.
 * "raw:0x16D77:7"), addressed directly as pattern1+offset, bypassing the
 * k-table/buffer_start formula entirely. Mirrors the Python/C# ports. */
export function resolveAddr(fa: FlagAddr, p1: number, key: string): [number, number] {
  if (key.startsWith('raw:')) {
    const [, offHex, bitStr] = key.split(':');
    return [p1 + parseInt(offHex, 16), parseInt(bitStr, 10)];
  }
  return fa.addr(parseInt(key, 10));
}

function getBit(c: Character, offset: number, bit: number): number {
  return (c.getByte(offset) >> bit) & 1;
}

function setBit(c: Character, offset: number, bit: number, value: number): void {
  const b = c.getByte(offset);
  c.setByte(offset, value ? (b | (1 << bit)) : (b & ~(1 << bit)));
}

export interface ChrBlobEntry {
  map: string;
  mapId: number;
  pos: number;
  entrySize: number;
  chrCount: number;
}

/** Per-map "forced CHR state" blob embedded in the save, right after the
 * EventFlag buffer. See project memory project_ds1_chr_obj_blob_mechanism /
 * DSRSave's C# ChrBlob.cs for the full reverse-engineering writeup. */
export class ChrBlob {
  private off: number;
  private buf: Uint8Array;
  private view: DataView;

  constructor(schema: StateMachineSchema, p1: number, character: Character) {
    this.off = p1 + parseInt(schema.chr_blob.offset_from_pattern1, 16);
    this.buf = character.getRawData();
    this.view = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
  }

  entries(): ChrBlobEntry[] {
    const out: ChrBlobEntry[] = [];
    let p = this.off + 4 + 4 + 4;
    while (true) {
      const mapId = this.view.getUint32(p, true);
      if (mapId === 0xFFFFFFFF) break;
      const entrySize = this.view.getUint32(p + 4, true);
      const chrCount = this.view.getUint32(p + 8, true);
      const b3 = (mapId >>> 24) & 0xFF;
      const b2 = (mapId >>> 16) & 0xFF;
      const mapName = `m${String(b3).padStart(2, '0')}_${String(b2).padStart(2, '0')}_00_00`;
      out.push({ map: mapName, mapId, pos: p, entrySize, chrCount });
      p += entrySize;
    }
    return out;
  }

  /** Blunt edit: defangs the WHOLE map's CHR-blob entry (corrupts chr_count so
   * the game ignores every forced-kill bit in it). This is the recommended,
   * self-healing technique -- see project memory. */
  defangMap(mapShortName?: string | null): boolean {
    if (!mapShortName) return false;
    const targetFull = `${mapShortName}_00_00`;
    let changed = false;
    for (const e of this.entries()) {
      if (e.map === targetFull) {
        this.view.setUint32(e.pos + 8, 0xFFFFFFFF, true);
        changed = true;
      }
    }
    return changed;
  }

  /** Precise per-character edit: flips specific MSB-index bits within one
   * map's bitmask, instead of corrupting chr_count for the whole map. */
  setBits(mapShortName: string | undefined, msbIndices: number[], value: number): boolean {
    if (!mapShortName) return false;
    const targetFull = `${mapShortName}_00_00`;
    let changed = false;
    for (const e of this.entries()) {
      if (e.map === targetFull) {
        const bitmaskStart = e.pos + 12;
        for (const idx of msbIndices) {
          const byteOff = bitmaskStart + Math.floor(idx / 8);
          const bit = idx % 8;
          const b = this.buf[byteOff];
          this.buf[byteOff] = value ? (b | (1 << bit)) : (b & ~(1 << bit));
        }
        changed = true;
      }
    }
    return changed;
  }

  /** Read-only: current forced-dead bit for one character at one map
   * placement. Returns 0 if that map has no CHR-blob entry yet (never
   * backread this session) -- same as "not forced dead", the safe default. */
  getBit(mapShortName: string | undefined, msbIndex: number): number {
    if (!mapShortName) return 0;
    const targetFull = `${mapShortName}_00_00`;
    for (const e of this.entries()) {
      if (e.map === targetFull) {
        const byteOff = e.pos + 12 + Math.floor(msbIndex / 8);
        return (this.buf[byteOff] >> (msbIndex % 8)) & 1;
      }
    }
    return 0;
  }
}

export interface ObjBlobEntry {
  map: string;
  mapId: number;
  pos: number;
  entrySize: number;
  count: number;
}

/** Sibling of ChrBlob for the 'OBJ ' section that immediately follows the
 * 'CHR ' section in the save (same format, applies to MSB Objects instead of
 * Characters -- see project memory project_ds1_npc_engine.md, 2026-11-19
 * entry). Its position is NOT a fixed pattern1 offset: it sits right after
 * CHR's own body, whose length varies per-save, so it must be located
 * dynamically every time from the live CHR blob's own size field. */
export class ObjBlob {
  private off: number;
  private buf: Uint8Array;
  private view: DataView;

  constructor(schema: StateMachineSchema, p1: number, character: Character) {
    const chrOff = p1 + parseInt(schema.chr_blob.offset_from_pattern1, 16);
    this.buf = character.getRawData();
    this.view = new DataView(this.buf.buffer, this.buf.byteOffset, this.buf.byteLength);
    const chrBodySize = this.view.getUint32(chrOff, true);
    this.off = chrOff + 4 + chrBodySize;
  }

  entries(): ObjBlobEntry[] {
    const out: ObjBlobEntry[] = [];
    let p = this.off + 4 + 8;
    while (true) {
      const mapId = this.view.getUint32(p, true);
      if (mapId === 0xFFFFFFFF) break;
      const entrySize = this.view.getUint32(p + 4, true);
      const count = this.view.getUint32(p + 8, true);
      const b3 = (mapId >>> 24) & 0xFF;
      const b2 = (mapId >>> 16) & 0xFF;
      const mapName = `m${String(b3).padStart(2, '0')}_${String(b2).padStart(2, '0')}_00_00`;
      out.push({ map: mapName, mapId, pos: p, entrySize, count });
      p += entrySize;
    }
    return out;
  }

  /** Precise per-object edit: flips specific indices within one map's OBJ
   * bitmask (e.g. Andre's anvil props, indices 460/461 in m10_01). Not a
   * passive flag -- on next load this triggers the real native destroy/
   * restore routine (FUN_1402fce20), confirmed by decompile. */
  setBits(mapShortName: string | undefined, indices: number[], value: number): boolean {
    if (!mapShortName) return false;
    const targetFull = `${mapShortName}_00_00`;
    let changed = false;
    for (const e of this.entries()) {
      if (e.map === targetFull) {
        const bitmaskStart = e.pos + 12;
        for (const idx of indices) {
          const byteOff = bitmaskStart + Math.floor(idx / 8);
          const bit = idx % 8;
          const b = this.buf[byteOff];
          this.buf[byteOff] = value ? (b | (1 << bit)) : (b & ~(1 << bit));
        }
        changed = true;
      }
    }
    return changed;
  }
}

export class NpcStateMachineError extends Error {}

/** TS port of tools/npc-state-machine/cli.py / DSRSave's C#
 * NpcStateMachineEngine.cs. Reads/writes the generic per-NPC flag/CHR-blob
 * state machine described in npc_state_machine.json: jump an NPC to a quest
 * stage ("rollback"), or flip just its alive/hostile axis ("revive"/"kill"/
 * "aggro"/"calm") without moving the quest stage. */
export class NpcStateMachineEngine {
  schema!: StateMachineSchema;

  private static readonly SCHEMA_PATH = 'json/npc_state_machine.json';

  // Deliberately NOT cached across instances: this schema is actively hand-edited
  // during live testing sessions, and a static cross-instance cache previously
  // served a stale copy for the lifetime of the page (surviving component
  // remounts, confirmed to cause real false-bug-report confusion -- see project
  // memory, ds1_npc_unresolved.md, "Forgiven Awaiting Nito" sessions). Always
  // fetch fresh; it's a small local JSON file, the cost is negligible.
  async load(): Promise<void> {
    const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
    const bust = `?t=${Date.now()}`;
    const paths = isElectron
      ? [`./${NpcStateMachineEngine.SCHEMA_PATH}${bust}`, `/${NpcStateMachineEngine.SCHEMA_PATH}${bust}`]
      : [`/${NpcStateMachineEngine.SCHEMA_PATH}${bust}`, `./${NpcStateMachineEngine.SCHEMA_PATH}${bust}`];
    let lastError: Error | null = null;
    for (const p of paths) {
      try {
        const res = await fetch(p, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        this.schema = (await res.json()) as StateMachineSchema;
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
    throw new Error(`Could not load npc_state_machine.json: ${lastError?.message}`);
  }

  getNpc(id: string): NpcEntry {
    const npc = this.schema.npcs[id];
    if (!npc) throw new NpcStateMachineError(`Unknown npc '${id}'.`);
    return npc;
  }

  private setFlags(fa: FlagAddr, p1: number, c: Character, dict: Record<string, number>): void {
    for (const [key, val] of Object.entries(dict)) {
      const [off, bit] = resolveAddr(fa, p1, key);
      setBit(c, off, bit, val);
    }
  }

  private setFlagIds(fa: FlagAddr, c: Character, ids: number[], value: number): void {
    for (const fid of ids) {
      const [off, bit] = fa.addr(fid);
      setBit(c, off, bit, value);
    }
  }

  /** Every flag id this NPC's definition ever reads or writes, as a sorted
   * array -- used both for a status dump and as the "universe" swept to 0 on
   * a key_stage jump. "raw:" keys are skipped (bit-level validity markers,
   * not part of the numeric sweep universe). */
  allFlagIds(npc: NpcEntry): number[] {
    const ids = new Set<number>();
    if (npc.key_stages) for (const st of Object.values(npc.key_stages)) for (const f of st.flags_on) ids.add(f);
    if (npc.non_key_stages) for (const st of Object.values(npc.non_key_stages)) {
      for (const f of st.flags_on_add ?? []) ids.add(f);
      for (const f of st.flags_off ?? []) ids.add(f);
    }
    if (npc.status_axes) for (const axis of Object.values(npc.status_axes)) for (const st of Object.values(axis.per_stage)) {
      for (const k of Object.keys(st.set_true)) if (!k.startsWith('raw:')) ids.add(parseInt(k, 10));
      for (const k of Object.keys(st.set_false)) if (!k.startsWith('raw:')) ids.add(parseInt(k, 10));
      for (const f of st.always_clear_traps ?? []) ids.add(f);
    }
    for (const f of npc.transition_traps_always_clear ?? []) ids.add(f);
    if (npc.personal_flag_range) {
      const [lo, hi] = npc.personal_flag_range;
      for (let f = lo; f <= hi; f++) ids.add(f);
    }
    return Array.from(ids).sort((a, b) => a - b);
  }

  private applyStageFlagsOn(fa: FlagAddr, c: Character, idsUniverse: number[], flagsOn: number[]): void {
    const onSet = new Set(flagsOn);
    for (const fid of idsUniverse) {
      const [off, bit] = fa.addr(fid);
      setBit(c, off, bit, onSet.has(fid) ? 1 : 0);
    }
  }

  /** Resolves either a key_stage id or a non_key_stage id into its full
   * flags_on list, plus whether the result is live-verified. */
  resolveStageFlagsOn(npc: NpcEntry, stageId: string): [number[], boolean] {
    if (npc.key_stages?.[stageId]) {
      const ks = npc.key_stages[stageId];
      return [ks.flags_on, !!ks.verified];
    }
    if (npc.non_key_stages?.[stageId]) {
      const nk = npc.non_key_stages[stageId];
      const parent = npc.key_stages![nk.parent];
      const flagsOn = new Set(parent.flags_on);
      for (const f of nk.flags_on_add ?? []) flagsOn.add(f);
      for (const f of nk.flags_off ?? []) flagsOn.delete(f);
      return [Array.from(flagsOn).sort((a, b) => a - b), !!parent.verified];
    }
    throw new NpcStateMachineError(`'${stageId}' is not a key_stage or non_key_stage of this npc.`);
  }

  /** Normalizes one status axis (alive/hostile) to targetTrue for a specific
   * stage. No-op if the NPC/stage has no definition for this axis. Falls back
   * to a "default" entry if the axis isn't repeated per named stage. */
  private applyAxisForStage(fa: FlagAddr, p1: number, c: Character, npc: NpcEntry, axisName: string, targetTrue: boolean, stageId: string): void {
    const axis = npc.status_axes?.[axisName];
    if (!axis) return;
    const axisCfg: AxisStageConfig | undefined = axis.per_stage[stageId] ?? axis.per_stage['default'];
    if (!axisCfg) return;

    const toSet = targetTrue ? axisCfg.set_true : axisCfg.set_false;
    this.setFlags(fa, p1, c, toSet);
    if (axisCfg.always_clear_traps?.length) this.setFlagIds(fa, c, axisCfg.always_clear_traps, 0);

    if (axisName === 'alive') this.applyChrObjBits(p1, c, axisCfg, targetTrue);
  }

  /** Some NPCs' native death-watcher wipes their WHOLE personal_flag_range on
   * death (e.g. trusty_patches at Firelink), erasing which location they were
   * at. detectCurrentStage can still recover the right stage via the CHR
   * blob, but that recovery is read-only -- it doesn't repair the save. On
   * revive, if the detected stage's own flags_on aren't actually all set
   * (proof the location flags are still wiped/inconsistent), restore them so
   * the save's data matches where we just determined the NPC physically is.
   * No-op for the overwhelming majority of NPCs/stages, where flags_on is
   * already satisfied (that's WHY this stage was detected). */
  private restoreLocationFlagsIfWiped(fa: FlagAddr, c: Character, npc: NpcEntry, ids: number[], stageId: string): void {
    const st = npc.key_stages?.[stageId];
    if (!st) return;
    const alreadyOk = st.flags_on.every(fid => {
      const [off, bit] = fa.addr(fid);
      return getBit(c, off, bit) === 1;
    });
    if (alreadyOk) return;
    this.applyStageFlagsOn(fa, c, ids, st.flags_on);
  }

  /** Shared by both the stage-rollback path and the plain revive/kill/aggro/
   * calm path (previously this logic was duplicated and the plain axisAction
   * path forgot chr_bit entirely -- see project memory, 'axisAction chr_bit
   * gap'). Bidirectional: revive clears the bit (0, 'not forced-dead'), kill
   * sets it (1, 'forced-dead' -- triggers the real native kill/destroy
   * routine on next load, matching what a genuine kill does). chr_map
   * blunt-defang is revive-only (no sane 'force the whole map dead'
   * counterpart). */
  private applyChrObjBits(p1: number, c: Character, axisCfg: AxisStageConfig, targetTrue: boolean): void {
    const chrBlob = new ChrBlob(this.schema, p1, c);
    if (targetTrue) {
      chrBlob.defangMap(axisCfg.chr_map);
      if (axisCfg.chr_bit) chrBlob.setBits(axisCfg.chr_bit.map, [axisCfg.chr_bit.msb_index], 0);
    } else if (axisCfg.chr_bit) {
      chrBlob.setBits(axisCfg.chr_bit.map, [axisCfg.chr_bit.msb_index], 1);
    }

    if (axisCfg.obj_bits) {
      const objBlob = new ObjBlob(this.schema, p1, c);
      objBlob.setBits(axisCfg.obj_bits.map, axisCfg.obj_bits.indices, targetTrue ? 0 : 1);
    }
  }

  /** Jumps an NPC straight to a quest stage: sets its personal flags_on, then
   * always normalizes it to alive+not-hostile for that stage. Returns the
   * "axis stage id" used for the alive/hostile/dependent_enemies lookup. */
  private applyNpcStage(fa: FlagAddr, p1: number, c: Character, npc: NpcEntry, stageId: string): string {
    const ids = this.allFlagIds(npc);
    const [flagsOn] = this.resolveStageFlagsOn(npc, stageId);
    this.applyStageFlagsOn(fa, c, ids, flagsOn);

    const axisStageId = npc.non_key_stages?.[stageId]?.parent ?? stageId;
    this.applyAxisForStage(fa, p1, c, npc, 'alive', true, axisStageId);
    this.applyAxisForStage(fa, p1, c, npc, 'hostile', false, axisStageId);
    return axisStageId;
  }

  private applyDependentEnemies(fa: FlagAddr, p1: number, c: Character, npc: NpcEntry, stageId: string, reviveCount: 'one' | 'all'): void {
    if (!npc.dependent_enemies) return;
    const chrBlob = new ChrBlob(this.schema, p1, c);
    for (const cfg of Object.values(npc.dependent_enemies)) {
      const indices = cfg.msb_indices;
      if (cfg.revive_at_stages.includes(stageId)) {
        const n = reviveCount === 'one' ? 1 : indices.length;
        chrBlob.setBits(cfg.chr_map, indices.slice(0, n), 0);
        if (cfg.event_slot_flags) this.setFlagIds(fa, c, cfg.event_slot_flags.slice(0, n), 0);
      } else if (cfg.kill_at_stages.includes(stageId)) {
        chrBlob.setBits(cfg.chr_map, indices, 1);
        if (cfg.event_slot_flags) this.setFlagIds(fa, c, cfg.event_slot_flags, 1);
      }
    }
  }

  private matchesFlagDict(fa: FlagAddr, p1: number, c: Character, dict: Record<string, number>): boolean {
    for (const [key, want] of Object.entries(dict)) {
      const [off, bit] = resolveAddr(fa, p1, key);
      if (getBit(c, off, bit) !== want) return false;
    }
    return true;
  }

  /** Picks the key_stage whose flags_on best matches the save's real flags.
   * For each key_stage, also tries every HIDDEN non_key_stage that resolves
   * to it (via resolveStageFlagsOn) and keeps whichever variant mismatches
   * least -- this is what makes a hidden sub-variant (e.g. trusty_patches'
   * forgiven_awaiting_nito, folded into pit_pushed) detect correctly as its
   * PARENT without relying on object key insertion order to break a
   * mismatch-count tie. Returns a key_stage id, never a non_key_stage id. */
  private detectCurrentStage(fa: FlagAddr, p1: number, c: Character, npc: NpcEntry, ids: number[]): string {
    if (!npc.key_stages || Object.keys(npc.key_stages).length === 0) return 'default';
    const vals = new Map<number, number>();
    for (const fid of ids) {
      const [off, bit] = fa.addr(fid);
      vals.set(fid, getBit(c, off, bit));
    }
    const mismFor = (flagsOn: number[]): number => {
      const wantedOn = new Set(flagsOn);
      let mism = 0;
      for (const fid of ids) {
        if (wantedOn.has(fid) !== (vals.get(fid) !== 0)) mism++;
      }
      return mism;
    };
    const childrenByParent = new Map<string, string[]>();
    for (const [nkId, nk] of Object.entries(npc.non_key_stages ?? {})) {
      const arr = childrenByParent.get(nk.parent) ?? [];
      arr.push(nkId);
      childrenByParent.set(nk.parent, arr);
    }
    const scores = new Map<string, number>();
    for (const [stageId, st] of Object.entries(npc.key_stages)) {
      let mism = mismFor(st.flags_on);
      for (const nkId of childrenByParent.get(stageId) ?? []) {
        const [nkFlagsOn] = this.resolveStageFlagsOn(npc, nkId);
        mism = Math.min(mism, mismFor(nkFlagsOn));
      }
      scores.set(stageId, mism);
    }
    const bestMism = Math.min(...scores.values());
    const tied = [...scores.entries()].filter(([, m]) => m === bestMism).map(([id]) => id);

    let bestId = tied[0];
    if (tied.length > 1) {
      // A multi-placement NPC whose native death-watcher wipes its whole
      // personal_flag_range on death (e.g. trusty_patches at Firelink) can
      // leave EVERY key_stage equally mismatched -- EventFlags alone can't
      // say which placement he died at. Break the tie using the CHR blob:
      // whichever tied stage's OWN chr_bit is currently forced-dead is
      // concrete physical evidence he's actually there.
      const alivePerStage = npc.status_axes?.alive?.per_stage ?? {};
      const chrBlob = new ChrBlob(this.schema, p1, c);
      const deadCandidates = tied.filter(sid => {
        const cb = alivePerStage[sid]?.chr_bit;
        return cb && chrBlob.getBit(cb.map, cb.msb_index) === 1;
      });
      if (deadCandidates.length === 1) bestId = deadCandidates[0];
    }
    return bestId;
  }

  /** Every stage id this NPC can be rolled back to, with whether it's
   * live-verified. */
  listStages(npc: NpcEntry): { id: string; verified: boolean }[] {
    const out: { id: string; verified: boolean }[] = [];
    if (npc.key_stages) for (const [id, st] of Object.entries(npc.key_stages)) out.push({ id, verified: !!st.verified });
    if (npc.non_key_stages) for (const [id, nk] of Object.entries(npc.non_key_stages)) {
      out.push({ id, verified: !!npc.key_stages?.[nk.parent]?.verified });
    }
    return out;
  }

  /** Best-effort, read-only one-line summary for a list: current
   * best-matching stage plus alive/hostile reading for that stage. Never
   * throws -- falls back to 'unknown'/'n/a' so a listing never crashes on an
   * incomplete entry. */
  summarize(character: Character, npcId: string): NpcSummary {
    try {
      const npc = this.getNpc(npcId);
      const p1 = character.findPattern1();
      if (p1 === -1) return { id: npcId, stage: 'unknown', alive: 'unknown', hostile: 'unknown' };
      const fa = new FlagAddr(this.schema, p1);
      const ids = this.allFlagIds(npc);
      const stage = this.detectCurrentStage(fa, p1, character, npc, ids);

      const describe = (axisName: string): TriState | 'n/a' => {
        const axis = npc.status_axes?.[axisName];
        if (!axis) return 'n/a';
        const cfg = axis.per_stage[stage] ?? axis.per_stage['default'];
        if (!cfg) return 'unknown';
        if (this.matchesFlagDict(fa, p1, character, cfg.detect_true ?? cfg.set_true)) return 'true';
        if (this.matchesFlagDict(fa, p1, character, cfg.detect_false ?? cfg.set_false)) return 'false';
        return 'unknown';
      };

      return { id: npcId, stage, alive: describe('alive'), hostile: describe('hostile') };
    } catch {
      return { id: npcId, stage: 'unknown', alive: 'unknown', hostile: 'unknown' };
    }
  }

  /** Rolls a single NPC to a quest stage: sets its key_stage flags_on, then
   * normalizes alive=true/hostile=false for that stage, then fixes up
   * dependent_enemies. */
  rollback(character: Character, npcId: string, stage: string, reviveCount: 'one' | 'all' = 'all'): void {
    const npc = this.getNpc(npcId);
    this.resolveStageFlagsOn(npc, stage); // throws if unknown, before touching anything
    const p1 = character.findPattern1();
    if (p1 === -1) throw new NpcStateMachineError('pattern1 not found for this character.');
    const fa = new FlagAddr(this.schema, p1);
    const axisStageId = this.applyNpcStage(fa, p1, character, npc, stage);
    this.applyDependentEnemies(fa, p1, character, npc, axisStageId, reviveCount);
  }

  /** Rolls an npc_group to a named combo stage, or to {primary: stage[,
   * secondary: substage]}. */
  rollbackGroup(character: Character, groupId: string, stage: string, substage: string | null, reviveCount: 'one' | 'all' = 'all'): void {
    const group = this.schema.npc_groups[groupId];
    if (!group) throw new NpcStateMachineError(`Unknown npc_group '${groupId}'.`);

    let plan: Record<string, string>;
    if (group.combo_stages?.[stage] && !substage) {
      plan = group.combo_stages[stage];
    } else {
      plan = { [group.primary_member]: stage };
      if (substage) {
        if (!group.secondary_member) throw new NpcStateMachineError(`'${groupId}' has no secondary_member -- substage is not applicable.`);
        plan[group.secondary_member] = substage;
      }
    }

    const p1 = character.findPattern1();
    if (p1 === -1) throw new NpcStateMachineError('pattern1 not found for this character.');
    const fa = new FlagAddr(this.schema, p1);
    for (const [member, memberStage] of Object.entries(plan)) {
      const npc = this.getNpc(member);
      const axisStageId = this.applyNpcStage(fa, p1, character, npc, memberStage);
      this.applyDependentEnemies(fa, p1, character, npc, axisStageId, reviveCount);
    }
  }

  /** revive(true)/kill(false)/aggro(true)/calm(false) without moving the
   * quest stage: auto-detects the current stage (or uses stageOverride) and
   * flips just the requested axis for that stage's own per_stage config. */
  axisAction(character: Character, npcId: string, axisName: 'alive' | 'hostile', targetTrue: boolean, stageOverride?: string): void {
    const npc = this.getNpc(npcId);
    if (!npc.status_axes?.[axisName]) throw new NpcStateMachineError(`NPC '${npcId}' has no '${axisName}' axis.`);

    const p1 = character.findPattern1();
    if (p1 === -1) throw new NpcStateMachineError('pattern1 not found for this character.');
    const fa = new FlagAddr(this.schema, p1);
    const ids = this.allFlagIds(npc);

    const stageId = stageOverride ?? this.detectCurrentStage(fa, p1, character, npc, ids);
    const perStage = npc.status_axes[axisName].per_stage;
    const axisCfg = perStage[stageId] ?? perStage['default'];
    if (!axisCfg) throw new NpcStateMachineError(`Axis '${axisName}' has no definition for stage '${stageId}'.`);

    if (axisName === 'alive' && targetTrue) this.restoreLocationFlagsIfWiped(fa, character, npc, ids, stageId);

    const toSet = targetTrue ? axisCfg.set_true : axisCfg.set_false;
    this.setFlags(fa, p1, character, toSet);
    if (axisCfg.always_clear_traps?.length) this.setFlagIds(fa, character, axisCfg.always_clear_traps, 0);
    if (axisName === 'alive') this.applyChrObjBits(p1, character, axisCfg, targetTrue);
  }
}
