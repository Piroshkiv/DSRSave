"""Live process-memory access to the loaded DS3 character.

Base pointers are resolved the way DS3_TGA_v3.4.0.CT does it: AOB scan of the
module, then the RIP-relative operand of the matched `mov reg,[rip+disp32]`.
Field offsets are the CT's ("Attributes", "Equipped Gear", "Ember",
"Hollowing", "Equip Inventory Data") plus the resist module layout from
docs/ds3-resist-recalc.md.

Nothing here writes to disk.

What reacts to a plain memory write, measured on 1.15.2:
  stats          -> effective stats, base/max vitals, resist maxima: immediately
  armor item IDs -> resist maxima: immediately
  ring item IDs  -> nothing. A ring acts through its SpEffect, which is only
                    attached by the game's equip routine - use equip().
  ember byte     -> nothing, for the same reason (SpEffect 490).

Do NOT port the CT's "Activate SpEffects" scripts: they call a hard-coded
`DarkSoulsIII.exe+9F3C30`, which in the 1.15.2 executable is the middle of an
unrelated function.
"""
from __future__ import annotations

import re
import struct

import pymem
import pymem.process

PROCESS = 'DarkSoulsIII.exe'

AOB = {
    'GameDataMan': '48 8B 05 ?? ?? ?? ?? 48 85 C0 ?? ?? 48 8B 40 ?? C3',
    'WorldChrMan': '48 8B 1D ?? ?? ?? 04 48 8B F9 48 85 DB ?? ?? 8B 11 85 D2 ?? ?? 8D',
    'GameMan': '48 8B ?? ?? ?? ?? 04 89 48 28 C3',
}
# CT "EquipItem": equipGear = AOBScan(...) - 0x2B
EQUIP_AOB = '?? 8b f1 ?? 8b d8 ?? 63 ea ?? 8b f9'
EQUIP_AOB_BACK = 0x2B
EQUIP_PROLOGUE = '40555657'      # push rbp / push rsi / push rdi, as analysed

# PlayerGameData ([[GameDataMan]+0x10]) field offsets
STAT_ORDER = ['VIG', 'ATN', 'END', 'VIT', 'STR', 'DEX', 'INT', 'FTH', 'LCK']
STAT = {'VIG': 0x44, 'ATN': 0x48, 'END': 0x4C, 'STR': 0x50, 'DEX': 0x54,
        'INT': 0x58, 'FTH': 0x5C, 'LCK': 0x60, 'VIT': 0x6C}
LEVEL = 0x70
VITALS = {'hp': 0x18, 'hpMax': 0x1C, 'hpBase': 0x20, 'fp': 0x24, 'fpMax': 0x28, 'fpBase': 0x2C,
          'sp': 0x34, 'spMax': 0x38, 'spBase': 0x3C}
RESIST_PGD = 0xE0            # 5 x i32, save order: poison, bleed, toxic, curse, frost
EMBER = 0x100                # byte
EFFECTIVE_STATS = 0x200      # 9 x i32: VIG ATN END VIT STR DEX INT FTH LCK
EQUIP_GAME_DATA = 0x228
EQUIP_INDICES = 0x24C        # 22 x i32, inventory index + tailDataIdx
ACTIVE_SLOTS = 0x2BC         # i32 left, i32 right
WEAPONS = 0x32C              # 6 x i32: L1 R1 L2 R2 L3 R3
ARMOR = 0x35C                # 4 x i32
RINGS = 0x370                # 4 x i32
INVENTORY_LIST = 0x3E8       # pointer to 16-byte entries {handle, itemId, quantity, ?}
INVENTORY_NUM = 0x3F0
INVENTORY_TAIL = 0x3F4

# [[WorldChrMan]+0x80] = PlayerIns; [[PlayerIns+0x1F90]+0x20] = resist module
PLAYER_INS = 0x80
MODULES = 0x1F90
RESIST_MODULE = 0x20
RESIST_CURRENT = 0x10        # 5 x i32, game type order: poison, toxic, bleed, curse, frost
RESIST_MAX = 0x24
HOLLOWING = 0x204E           # [GameMan]+0x204E, byte

SLOT_ARMOR = 12              # equip slots: head, chest, hands, legs = 12..15
SLOT_RING = 17               # rings 1..4 = 17..20
TYPE_TO_SAVE_ORDER = [0, 2, 1, 3, 4]


def _regex(aob: str) -> bytes:
    return b''.join(b'.' if t in ('??', '?') else re.escape(bytes([int(t, 16)])) for t in aob.split())


class Live:
    def __init__(self) -> None:
        self.pm = pymem.Pymem(PROCESS)
        mod = pymem.process.module_from_name(self.pm.process_handle, PROCESS)
        self.base, self.size = mod.lpBaseOfDll, mod.SizeOfImage
        image = self.pm.read_bytes(self.base, 0x2800000)     # covers .text
        self.vars = {}
        for name, aob in AOB.items():
            hits = [m.start() for m in re.finditer(_regex(aob), image, re.S)]
            if len(hits) != 1:
                raise RuntimeError(f'{name}: {len(hits)} AOB matches, expected 1')
            disp = struct.unpack_from('<i', image, hits[0] + 3)[0]
            self.vars[name] = self.base + hits[0] + 7 + disp
        hits = [m.start() for m in re.finditer(_regex(EQUIP_AOB), image, re.S)]
        self.equip_fn = None
        if len(hits) == 1:
            start = hits[0] - EQUIP_AOB_BACK
            if image[start:start + 4] == bytes.fromhex(EQUIP_PROLOGUE):
                self.equip_fn = self.base + start

    # --- primitives ---------------------------------------------------------
    def u64(self, a): return struct.unpack('<Q', self.pm.read_bytes(a, 8))[0]
    def i32(self, a): return struct.unpack('<i', self.pm.read_bytes(a, 4))[0]
    def u32(self, a): return struct.unpack('<I', self.pm.read_bytes(a, 4))[0]
    def u8(self, a): return self.pm.read_bytes(a, 1)[0]
    def ints(self, a, n): return list(struct.unpack('<%di' % n, self.pm.read_bytes(a, 4 * n)))
    def uints(self, a, n): return list(struct.unpack('<%dI' % n, self.pm.read_bytes(a, 4 * n)))
    def w32(self, a, v): self.pm.write_bytes(a, struct.pack('<I', v & 0xFFFFFFFF), 4)

    # --- pointers -----------------------------------------------------------
    def pgd(self) -> int:
        p = self.u64(self.u64(self.vars['GameDataMan']) + 0x10)
        if not p:
            raise RuntimeError('no PlayerGameData - is a character loaded?')
        return p

    def player_ins(self) -> int:
        p = self.u64(self.u64(self.vars['WorldChrMan']) + PLAYER_INS)
        if not p:
            raise RuntimeError('no PlayerIns - is a character loaded?')
        return p

    def resist_module(self) -> int:
        return self.u64(self.u64(self.player_ins() + MODULES) + RESIST_MODULE)

    # --- reads --------------------------------------------------------------
    def snapshot(self) -> dict:
        g = self.pgd()
        rm = self.resist_module()
        cur = self.ints(rm + RESIST_CURRENT, 5)
        mx = self.ints(rm + RESIST_MAX, 5)
        return {
            'stats': {k: self.i32(g + STAT[k]) for k in STAT_ORDER},
            'effective': dict(zip(STAT_ORDER, self.ints(g + EFFECTIVE_STATS, 9))),
            'level': self.i32(g + LEVEL),
            'vitals': {k: self.i32(g + o) for k, o in VITALS.items()},
            'ember': self.u8(g + EMBER),
            'hollowing': self.u8(self.u64(self.vars['GameMan']) + HOLLOWING),
            'weapons': self.uints(g + WEAPONS, 6),
            'active': self.ints(g + ACTIVE_SLOTS, 2),
            'armor': self.uints(g + ARMOR, 4),
            'rings': self.uints(g + RINGS, 4),
            'equipIndices': self.ints(g + EQUIP_INDICES, 22),
            'resistPgd': self.ints(g + RESIST_PGD, 5),
            'resistCurrent': [cur[t] for t in TYPE_TO_SAVE_ORDER],
            'resistMax': [mx[t] for t in TYPE_TO_SAVE_ORDER],
        }

    def inventory(self) -> list:
        """[(inventory index, handle, item id with category nibble, quantity)]"""
        g = self.pgd()
        lst, num = self.u64(g + INVENTORY_LIST), self.i32(g + INVENTORY_NUM)
        raw = self.pm.read_bytes(lst, (num + 1) * 16)
        out = []
        for i in range(num + 1):
            handle, item, qty, _ = struct.unpack_from('<IIII', raw, i * 16)
            if item not in (0, 0xFFFFFFFF) and handle != 0xFFFFFFFF:
                out.append((i, handle, item, qty))
        return out

    # --- writes (PlayerGameData only) ---------------------------------------
    def set_stat(self, key: str, value: int) -> None:
        g = self.pgd()
        self.w32(g + STAT[key], value)
        self.w32(g + LEVEL, sum(self.i32(g + STAT[k]) for k in STAT_ORDER) - 89)

    def set_armor(self, slot: int, item_id: int) -> None:
        self.w32(self.pgd() + ARMOR + 4 * slot, item_id)

    # --- the game's own equip routine ---------------------------------------
    def equip(self, slot: int, inv_index: int) -> None:
        """Equip an owned item, exactly as the CT's "EquipItem" does:

            equip(EquipGameData, slot, &itemHandle, invIdx + tailDataIdx, 1, 1, 0)

        run on a remote thread. `slot` is the game's equip slot (SLOT_RING + n,
        SLOT_ARMOR + n); `inv_index` an index from inventory().
        """
        if self.equip_fn is None:
            raise RuntimeError('equip function not found / prologue differs from the analysed build')
        g = self.pgd()
        tail = self.i32(g + INVENTORY_TAIL)
        handle = self.u32(self.u64(g + INVENTORY_LIST) + inv_index * 16)
        mem = self.pm.allocate(0x100)
        try:
            self.w32(mem + 0x80, handle)
            q = lambda v: struct.pack('<Q', v)
            d = lambda v: struct.pack('<I', v)
            code = (bytes.fromhex('4883EC48')                       # sub rsp,48h
                    + bytes.fromhex('48B9') + q(g + EQUIP_GAME_DATA)  # mov rcx, EquipGameData
                    + bytes.fromhex('BA') + d(slot)                   # mov edx, slot
                    + bytes.fromhex('49B8') + q(mem + 0x80)           # mov r8, &handle
                    + bytes.fromhex('41B9') + d(inv_index + tail)     # mov r9d, index
                    + bytes.fromhex('C744242001000000')               # [rsp+20h] = 1
                    + bytes.fromhex('C744242801000000')               # [rsp+28h] = 1
                    + bytes.fromhex('C744243000000000')               # [rsp+30h] = 0
                    + bytes.fromhex('48B8') + q(self.equip_fn)        # mov rax, equip
                    + bytes.fromhex('FFD0')                           # call rax
                    + bytes.fromhex('4883C448C3'))                    # add rsp,48h ; ret
            self.pm.write_bytes(mem, code, len(code))
            self.pm.start_thread(mem)
        finally:
            self.pm.free(mem)


if __name__ == '__main__':
    import json
    live = Live()
    print({k: hex(v) for k, v in live.vars.items()}, 'equip', live.equip_fn and hex(live.equip_fn))
    print(json.dumps(live.snapshot(), indent=1))
