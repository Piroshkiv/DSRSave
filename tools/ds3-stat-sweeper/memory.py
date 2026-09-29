"""Чтение/запись атрибутов DS3 в памяти процесса — порт логики из DS3_TGA_v3.4.0.CT.

Делает то же, что группа "--- Attributes" в CT:
  - резолвит WorldChrMan через AOB-скан + разбор RIP-relative адреса;
  - идёт по цепочке [[[[WorldChrMan]+0x40]+0x38]+0x1FA0]+off;
  - читает/пишет 4-байтовый стат.

Дополнительно: при записи стата пересчитывает и пишет Soul Level
(Level = сумма 9 атрибутов - 89), т.к. в игре уровень зависит от суммы статов.
"""

from __future__ import annotations

import struct

import pymem
import pymem.pattern
import pymem.process

import constants as C


def _aob_to_regex(aob: str) -> bytes:
    """'48 8B 05 ?? ?? ..' -> b'\\x48\\x8b\\x05..' (для pymem.pattern)."""
    out = bytearray()
    for tok in aob.split():
        if tok in ("??", "?"):
            out += b"."
        else:
            byte = int(tok, 16)
            # экранируем спецсимволы regex
            if byte in b".^$*+?()[]{}|\\":
                out += b"\\" + bytes([byte])
            else:
                out += bytes([byte])
    return bytes(out)


class DS3Memory:
    def __init__(self) -> None:
        self.pm: pymem.Pymem | None = None
        self.module = None
        self._gamedataman_var: int | None = None  # адрес переменной-указателя

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

    # --- низкоуровневое чтение ---------------------------------------------
    def _read_u64(self, addr: int) -> int:
        return struct.unpack("<Q", self.pm.read_bytes(addr, 8))[0]

    def _read_i32(self, addr: int) -> int:
        return struct.unpack("<i", self.pm.read_bytes(addr, 4))[0]

    def _write_i32(self, addr: int, value: int) -> None:
        self.pm.write_bytes(addr, struct.pack("<i", value), 4)

    # --- резолв GameDataMan ------------------------------------------------
    def resolve_gamedataman_var(self) -> int:
        """Найти адрес переменной-указателя GameDataMan (кэшируется)."""
        if self._gamedataman_var is not None:
            return self._gamedataman_var

        base = self.module.lpBaseOfDll
        size = self.module.SizeOfImage

        pattern = _aob_to_regex(C.GAMEDATAMAN_AOB)
        match = pymem.pattern.pattern_scan_module(
            self.pm.process_handle, self.module, pattern
        )
        if not match:
            raise RuntimeError(
                "GameDataMan не найден по AOB. Игра запущена? "
                "Сверь адрес с Cheat Engine, обнови AOB."
            )
        # инструкция: 48 8B 05 + disp32 = 7 байт
        disp = struct.unpack("<i", self.pm.read_bytes(match + 3, 4))[0]
        var_addr = match + 7 + disp
        if not (base <= var_addr < base + size):
            raise RuntimeError(
                f"GameDataMan var {hex(var_addr)} вне образа модуля — неверный AOB"
            )
        self._gamedataman_var = var_addr
        return var_addr

    def resolve_attr_base(self) -> int:
        """База структуры PlayerGameData — [[GameDataMan]+0x10]."""
        var_addr = self.resolve_gamedataman_var()
        p = self._read_u64(var_addr)  # [GameDataMan]
        if p == 0:
            raise RuntimeError("GameDataMan == 0 (персонаж не загружен в игру?)")
        for off in C.ATTR_CHAIN:
            p = self._read_u64(p + off)
            if p == 0:
                raise RuntimeError(
                    f"Разыменование дало 0 на офсете {hex(off)} "
                    "(персонаж не загружен в игру?)"
                )
        return p

    def _stat_addr(self, base: int, stat_key: str) -> int:
        if stat_key not in C.STAT_OFFSETS:
            raise KeyError(f"Неизвестный стат: {stat_key}")
        return base + C.STAT_OFFSETS[stat_key]

    # --- публичное API -----------------------------------------------------
    def read_stat(self, stat_key: str) -> int:
        base = self.resolve_attr_base()
        return self._read_i32(self._stat_addr(base, stat_key))

    def read_all_stats(self) -> dict[str, int]:
        base = self.resolve_attr_base()
        return {k: self._read_i32(self._stat_addr(base, k)) for k in C.STAT_ORDER}

    def read_level(self) -> int:
        base = self.resolve_attr_base()
        return self._read_i32(base + C.LEVEL_OFFSET)

    def compute_level(self, stats: dict[str, int]) -> int:
        return sum(stats[k] for k in C.STAT_ORDER) - C.BASE_STATS_AT_ZERO

    def set_baseline(self, exclude_key: str, value: int = 11,
                     update_level: bool = True) -> int:
        """Выставить все атрибуты, КРОМЕ exclude_key, в `value`. Пересчитать Level.

        Возвращает новый уровень. Исследуемый стат не трогаем — его крутит sweep.
        """
        base = self.resolve_attr_base()
        for k in C.STAT_ORDER:
            if k != exclude_key:
                self._write_i32(self._stat_addr(base, k), value)
        stats = {k: self._read_i32(self._stat_addr(base, k)) for k in C.STAT_ORDER}
        level = sum(stats.values()) - C.BASE_STATS_AT_ZERO
        if update_level:
            self._write_i32(base + C.LEVEL_OFFSET, level)
        return level

    def write_stat(self, stat_key: str, value: int, update_level: bool = True) -> int:
        """Записать стат и (по умолчанию) пересчитать/записать Soul Level.

        Возвращает новый уровень.
        """
        if not (C.STAT_MIN <= value <= C.STAT_MAX):
            raise ValueError(f"Значение {value} вне диапазона {C.STAT_MIN}..{C.STAT_MAX}")

        base = self.resolve_attr_base()
        self._write_i32(self._stat_addr(base, stat_key), value)

        # читаем все статы уже с обновлённым значением и считаем уровень
        stats = {k: self._read_i32(self._stat_addr(base, k)) for k in C.STAT_ORDER}
        level = sum(stats.values()) - C.BASE_STATS_AT_ZERO
        if update_level:
            self._write_i32(base + C.LEVEL_OFFSET, level)
        return level


def _main() -> None:
    """Быстрая проверка: python memory.py — печатает статы, уровень и адреса."""
    mem = DS3Memory()
    mem.attach()
    var = mem.resolve_gamedataman_var()
    base = mem.resolve_attr_base()
    stats = mem.read_all_stats()
    print(f"GameDataMan var: {hex(var)}")
    print(f"PlayerGameData:  {hex(base)}")
    for k in C.STAT_ORDER:
        print(f"  {C.STAT_NAMES[k]:<13} ({k}) = {stats[k]}")
    print(f"  Level (в памяти)     = {mem.read_level()}")
    print(f"  Level (по формуле)   = {mem.compute_level(stats)}")
    mem.close()


if __name__ == "__main__":
    _main()
