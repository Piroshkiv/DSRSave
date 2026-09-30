"""Чтение/запись PlayerGameData DS1 (DSR) в памяти процесса.

Та же цепочка, что у DSAppearancePresetTool: BaseB (AOB) -> [[BaseB]+0x10].
Мод, кстати, читает указатели как int32 — у нас честные u64.

Без явного вызова write_* ничего не пишет: `python memory.py` только читает.
"""

from __future__ import annotations

import struct

import pymem
import pymem.pattern
import pymem.process

import constants as C


def _aob_to_regex(aob: str) -> bytes:
    """'48 8B 05 ?? ?? ..' -> b'\x48\x8b\x05..' (для pymem.pattern)."""
    out = bytearray()
    for tok in aob.split():
        if tok in ("??", "?", "xx"):
            out += b"."
        else:
            byte = int(tok, 16)
            if byte in b".^$*+?()[]{}|\\":
                out += b"\\" + bytes([byte])
            else:
                out += bytes([byte])
    return bytes(out)


class DS1Memory:
    def __init__(self) -> None:
        self.pm: pymem.Pymem | None = None
        self.module = None
        self._baseb_var: int | None = None

    # --- подключение -------------------------------------------------------
    def attach(self) -> None:
        self.pm = pymem.Pymem(C.PROCESS_NAME)
        self.module = pymem.process.module_from_name(
            self.pm.process_handle, C.PROCESS_NAME
        )
        if self.module is None:
            raise RuntimeError(f"Модуль {C.PROCESS_NAME} не найден")

    def close(self) -> None:
        if self.pm is not None:
            self.pm.close_process()
            self.pm = None

    def _read_u64(self, addr: int) -> int:
        return struct.unpack("<Q", self.pm.read_bytes(addr, 8))[0]

    # --- резолв ------------------------------------------------------------
    def resolve_baseb_var(self) -> int:
        """Адрес переменной-указателя BaseB (кэшируется)."""
        if self._baseb_var is not None:
            return self._baseb_var
        base = self.module.lpBaseOfDll
        size = self.module.SizeOfImage
        match = pymem.pattern.pattern_scan_module(
            self.pm.process_handle, self.module, _aob_to_regex(C.BASEB_AOB)
        )
        if not match:
            raise RuntimeError("BaseB не найден по AOB. Игра запущена? Версия та?")
        disp = struct.unpack("<i", self.pm.read_bytes(match + 3, 4))[0]
        var_addr = match + 7 + disp
        if not (base <= var_addr < base + size):
            raise RuntimeError(f"BaseB var {hex(var_addr)} вне образа модуля — неверный AOB")
        self._baseb_var = var_addr
        return var_addr

    def resolve_pgd(self) -> int:
        """PlayerGameData = [[BaseB]+0x10]. Резолвится каждый раз: после
        загрузки другого персонажа адрес меняется."""
        p = self._read_u64(self.resolve_baseb_var())
        if p == 0:
            raise RuntimeError("[BaseB] == 0 (персонаж не загружен в игру?)")
        for off in C.PGD_CHAIN:
            p = self._read_u64(p + off)
            if p == 0:
                raise RuntimeError(f"Разыменование дало 0 на {hex(off)} (персонаж не загружен?)")
        return p

    # --- сырой PGD ---------------------------------------------------------
    def read_pgd(self, start: int = 0, size: int = C.PGD_DUMP_SIZE) -> bytes:
        return self.pm.read_bytes(self.resolve_pgd() + start, size)

    def write_pgd(self, start: int, data: bytes) -> None:
        self.pm.write_bytes(self.resolve_pgd() + start, bytes(data), len(data))

    # --- поля --------------------------------------------------------------
    def read_field(self, slug: str):
        _s, pgd_off, _save_off, kind, _d = C.FIELD_BY_SLUG[slug]
        return C.decode(kind, self.read_pgd(pgd_off, C.field_size(kind)))

    def write_field(self, slug: str, value) -> None:
        _s, pgd_off, _save_off, kind, _d = C.FIELD_BY_SLUG[slug]
        self.write_pgd(pgd_off, C.encode(kind, value))

    def read_fields(self) -> dict:
        return {f[0]: self.read_field(f[0]) for f in C.FIELDS}

    def read_name(self) -> str:
        raw = self.read_pgd(C.NAME_PGD_OFFSET, C.NAME_MAX_BYTES)
        out = []
        for k in range(0, len(raw) - 1, 2):
            ch = raw[k] | (raw[k + 1] << 8)
            if ch == 0:
                break
            out.append(chr(ch))
        return "".join(out)


def _main() -> None:
    """python memory.py — адреса и поля внешности (только чтение)."""
    C.use_utf8_stdout()
    mem = DS1Memory()
    mem.attach()
    print(f"BaseB var:      {hex(mem.resolve_baseb_var())}")
    print(f"PlayerGameData: {hex(mem.resolve_pgd())}")
    print(f"Персонаж:       {mem.read_name()!r}\n")
    for slug, pgd_off, _save_off, kind, desc in C.FIELDS:
        v = mem.read_field(slug)
        print(f"  PGD+0x{pgd_off:03X}  {slug:<12} {C.show(kind, v)}   # {desc}")
    mem.close()


if __name__ == "__main__":
    _main()
