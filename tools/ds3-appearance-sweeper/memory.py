"""Чтение/запись данных внешности DS3 в памяти процесса.

Делает то же, что скрипты "Save / Restore Current FaceData" и "Save to file"
из DS3_TGA_v3.4.0.CT:
  - резолвит GameDataMan через AOB-скан + разбор RIP-relative адреса;
  - берёт PlayerGameData = [[GameDataMan]+0x10];
  - читает/пишет три блока (misc / body / face) и отдельные поля из них.

Никаких записей без явного вызова write_* — `python memory.py` только читает.
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


class DS3Memory:
    def __init__(self) -> None:
        self.pm: pymem.Pymem | None = None
        self.module = None
        self._gamedataman_var: int | None = None

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

    # --- низкоуровневое ----------------------------------------------------
    def _read_u64(self, addr: int) -> int:
        return struct.unpack("<Q", self.pm.read_bytes(addr, 8))[0]

    # --- резолв ------------------------------------------------------------
    def resolve_gamedataman_var(self) -> int:
        """Адрес переменной-указателя GameDataMan (кэшируется)."""
        if self._gamedataman_var is not None:
            return self._gamedataman_var

        base = self.module.lpBaseOfDll
        size = self.module.SizeOfImage
        match = pymem.pattern.pattern_scan_module(
            self.pm.process_handle, self.module, _aob_to_regex(C.GAMEDATAMAN_AOB)
        )
        if not match:
            raise RuntimeError(
                "GameDataMan не найден по AOB. Игра запущена? "
                "Сверь адрес с Cheat Engine, обнови AOB."
            )
        disp = struct.unpack("<i", self.pm.read_bytes(match + 3, 4))[0]
        var_addr = match + 7 + disp
        if not (base <= var_addr < base + size):
            raise RuntimeError(
                f"GameDataMan var {hex(var_addr)} вне образа модуля — неверный AOB"
            )
        self._gamedataman_var = var_addr
        return var_addr

    def resolve_pgd(self) -> int:
        """PlayerGameData = [[GameDataMan]+0x10]."""
        p = self._read_u64(self.resolve_gamedataman_var())
        if p == 0:
            raise RuntimeError("[GameDataMan] == 0 (персонаж не загружен в игру?)")
        for off in C.PGD_CHAIN:
            p = self._read_u64(p + off)
            if p == 0:
                raise RuntimeError(
                    f"Разыменование дало 0 на офсете {hex(off)} "
                    "(персонаж не загружен в игру?)"
                )
        return p

    def block_addr(self, name: str) -> int:
        start, _size = C.BLOCKS[name]
        return self.resolve_pgd() + start

    # --- блоки -------------------------------------------------------------
    def read_block(self, name: str) -> bytes:
        start, size = C.BLOCKS[name]
        return self.pm.read_bytes(self.resolve_pgd() + start, size)

    def write_block(self, name: str, data: bytes) -> None:
        start, size = C.BLOCKS[name]
        if len(data) != size:
            raise ValueError(f"Блок {name}: ожидалось {size} байт, дано {len(data)}")
        self.pm.write_bytes(self.resolve_pgd() + start, bytes(data), size)

    def read_all_blocks(self) -> dict:
        return {name: self.read_block(name) for name in C.BLOCKS}

    def write_all_blocks(self, blocks: dict) -> None:
        for name, data in blocks.items():
            self.write_block(name, data)

    # --- поля --------------------------------------------------------------
    def read_field(self, slug: str):
        off, kind, _group, _name, _slug = C.FIELD_BY_SLUG[slug]
        raw = self.pm.read_bytes(self.resolve_pgd() + off, C.field_size(kind))
        return C.decode(kind, raw)

    def write_field(self, slug: str, value) -> None:
        off, kind, _group, _name, _slug = C.FIELD_BY_SLUG[slug]
        raw = C.encode(kind, value)
        self.pm.write_bytes(self.resolve_pgd() + off, raw, len(raw))

    def read_fields(self) -> dict:
        """{слаг: значение} по всем полям — одним чтением на блок."""
        blocks = self.read_all_blocks()
        out = {}
        for off, kind, _group, _name, slug in C.FIELDS:
            bname, boff = C.block_of(off)
            raw = blocks[bname][boff:boff + C.field_size(kind)]
            out[slug] = C.decode(kind, raw)
        return out

    # --- маркеры -----------------------------------------------------------
    def make_marker_blocks(self, salt: int = 0) -> dict:
        """Блоки с маркерами: каждому полю своё значение (ramp `k*7+13`).

        Трогаем ТОЛЬКО безопасные поля (C.POKEABLE_FIELDS): ID-поля вроде
        Hair Style индексируют модели, и произвольное значение роняет игру —
        проверено на живом прогоне 2026-09-12. Прочие байты блока тоже остаются
        как были, чтобы не портить неизвестные структуры рядом.
        """
        out = {name: bytearray(self.read_block(name)) for name in C.BLOCKS}
        for k, (off, kind, _g, _n, _slug) in enumerate(C.POKEABLE_FIELDS):
            bname, boff = C.block_of(off)
            raw = C.encode(kind, C.marker_byte(k, salt))
            out[bname][boff:boff + len(raw)] = raw
        return {name: bytes(buf) for name, buf in out.items()}

    def expected_marker_values(self, salt: int = 0) -> dict:
        """{слаг: маркерное значение} — только по тем полям, что реально пишем."""
        return {f[4]: C.marker_byte(k, salt)
                for k, f in enumerate(C.POKEABLE_FIELDS)}

    def set_single_marker(self, slug: str, salt: int = 0) -> int:
        """Записать маркер в ОДНО поле, остальные не трогать. Возвращает значение."""
        if slug not in C.POKEABLE_SLUGS:
            raise ValueError(f"Поле {slug} писать нельзя (ID-поле или runtime-блок)")
        k = C.POKEABLE_SLUGS.index(slug)
        value = C.marker_byte(k, salt)
        self.write_field(slug, value)
        return value


def _main() -> None:
    """python memory.py — адреса и текущие значения внешности (только чтение)."""
    C.use_utf8_stdout()
    mem = DS3Memory()
    mem.attach()
    var = mem.resolve_gamedataman_var()
    pgd = mem.resolve_pgd()
    print(f"GameDataMan var: {hex(var)}")
    print(f"PlayerGameData:  {hex(pgd)}")
    for name, (start, size) in C.BLOCKS.items():
        print(f"  блок {name:<5} @ {hex(pgd + start)}  (PGD+0x{start:X}, {size} байт)")

    values = mem.read_fields()
    print(f"\nПоля внешности ({C.FIELD_COUNT}):")
    for group in C.GROUP_ORDER:
        print(f"\n  [{group}]")
        for off, kind, g, name, slug in C.FIELDS:
            if g != group:
                continue
            v = values[slug]
            shown = f"{v:.6g}" if kind == "f32" else f"{v:3d}  0x{v:02X}"
            print(f"    PGD+0x{off:03X} {name:<42} {shown}")

    print("\nСырые блоки:")
    for name, data in mem.read_all_blocks().items():
        print(f"  {name}: {data.hex(' ')}")
    mem.close()


if __name__ == "__main__":
    _main()
