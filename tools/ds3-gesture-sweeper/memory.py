"""Чтение/запись массива жестов DS3 в памяти процесса — порт из DS3_TGA_v3.4.0.CT.

Делает то же, что скрипт "Unlock All Gestures" в CT:
  - резолвит GameDataMan через AOB-скан + разбор RIP-relative адреса
    (тот же резолв, что в ds3-stat-sweeper);
  - идёт по цепочке [[[GameDataMan]+0x10]+0x7B8]+0x10;
  - читает/пишет байт жеста (шаг 4 байта).
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

    def _read_u8(self, addr: int) -> int:
        return self.pm.read_bytes(addr, 1)[0]

    def _read_u16(self, addr: int) -> int:
        return struct.unpack("<H", self.pm.read_bytes(addr, 2))[0]

    def _write_u8(self, addr: int, value: int) -> None:
        self.pm.write_bytes(addr, bytes([value & 0xFF]), 1)

    # --- резолв GameDataMan ------------------------------------------------
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

    def resolve_gesture_array(self) -> int:
        """Адрес нулевого элемента массива жестов."""
        var_addr = self.resolve_gamedataman_var()
        p = self._read_u64(var_addr)  # [GameDataMan]
        if p == 0:
            raise RuntimeError("[GameDataMan] == 0 (персонаж не загружен в игру?)")
        for off in C.GESTURE_CHAIN:
            p = self._read_u64(p + off)
            if p == 0:
                raise RuntimeError(
                    f"Разыменование дало 0 на офсете {hex(off)} "
                    "(персонаж не загружен в игру?)"
                )
        return p + C.GESTURE_ARRAY_OFFSET

    def _gesture_addr(self, array: int, index: int) -> int:
        if not (0 <= index < C.GESTURE_COUNT):
            raise IndexError(f"Жест {index} вне диапазона 0..{C.GESTURE_COUNT - 1}")
        return array + index * C.GESTURE_STRIDE

    # --- публичное API -----------------------------------------------------
    def read_raw(self, count: int | None = None) -> list[int]:
        """Сырые байты значений жестов (первый байт каждой записи)."""
        n = C.GESTURE_COUNT if count is None else count
        array = self.resolve_gesture_array()
        return [self._read_u8(array + i * C.GESTURE_STRIDE) for i in range(n)]

    def read_records(self, count: int | None = None) -> list[tuple[int, int]]:
        """[(value, index)] — обе половины каждой 4-байтовой записи."""
        n = C.GESTURE_COUNT if count is None else count
        array = self.resolve_gesture_array()
        return [
            (self._read_u16(array + i * C.GESTURE_STRIDE),
             self._read_u16(array + i * C.GESTURE_STRIDE + 2))
            for i in range(n)
        ]

    def detect_record_count(self, limit: int | None = None) -> int:
        """Сколько записей реально лежит в массиве.

        Идём, пока структура сходится: index == i и value>>1 == i+1. В DS1 после
        последней записи стоял терминатор FE FF FF FF — на нём проверка и рвётся.
        """
        cap = C.GESTURE_COUNT if limit is None else limit
        array = self.resolve_gesture_array()
        n = 0
        while n < cap:
            value = self._read_u16(array + n * C.GESTURE_STRIDE)
            index = self._read_u16(array + n * C.GESTURE_STRIDE + 2)
            if index != n or (value >> 1) != n + 1:
                break
            n += 1
        return n

    def read_unlocked(self, count: int | None = None) -> list[bool]:
        return [(v & 1) == 1 for v in self.read_raw(count)]

    def write_raw(self, values: list[int]) -> None:
        array = self.resolve_gesture_array()
        for i, v in enumerate(values):
            self._write_u8(self._gesture_addr(array, i), v)

    def set_gesture(self, index: int, unlocked: bool) -> None:
        array = self.resolve_gesture_array()
        value = C.unlocked_value(index) if unlocked else C.locked_value(index)
        self._write_u8(self._gesture_addr(array, index), value)

    def set_all(self, unlocked: bool, count: int) -> None:
        self.write_raw([
            C.unlocked_value(i) if unlocked else C.locked_value(i)
            for i in range(count)
        ])

    def set_only(self, index: int, count: int) -> None:
        """Всё заблокировать, кроме одного жеста — так диффы сейвов изолированы."""
        self.write_raw([
            C.unlocked_value(i) if i == index else C.locked_value(i)
            for i in range(count)
        ])


def _main() -> None:
    """python memory.py — печатает адреса и текущее состояние жестов."""
    C.use_utf8_stdout()
    mem = DS3Memory()
    mem.attach()
    var = mem.resolve_gamedataman_var()
    array = mem.resolve_gesture_array()
    n = mem.detect_record_count()
    print(f"GameDataMan var: {hex(var)}")
    print(f"Gesture array:   {hex(array)}")
    print(f"Записей со сходящейся структурой: {n} "
          f"(имён в constants.py: {C.GESTURE_COUNT}, из них реальных {C.REAL_GESTURE_COUNT})")
    for i, (value, index) in enumerate(mem.read_records()):
        addr = array + i * C.GESTURE_STRIDE
        name = C.GESTURE_NAMES[i]
        good = index == i and (value >> 1) == i + 1
        state = "UNLOCKED" if (value & 1) else "locked"
        flag = "" if good else "   <-- структура не сходится (конец массива?)"
        print(f"  [{i:2d}] {name:<22} @ {hex(addr)} value={value:<4} idx={index:<4} "
              f"{state if good else ''}{flag}")
    mem.close()


if __name__ == "__main__":
    _main()
