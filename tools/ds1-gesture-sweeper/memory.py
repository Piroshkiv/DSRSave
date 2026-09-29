"""Чтение/запись массива жестов DS1 в памяти процесса — порт из 1FRDarkSoulsRemastered.CT.

Делает то же, что группа "Gesture Game Data" в CT:
  - резолвит BaseB через AOB-скан + разбор RIP-relative адреса;
  - идёт по цепочке [[[BaseB]+0x10]+0x568]+0x10;
  - читает/пишет байт жеста (шаг 4 байта).
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

    # --- низкоуровневое ----------------------------------------------------
    def _read_u64(self, addr: int) -> int:
        return struct.unpack("<Q", self.pm.read_bytes(addr, 8))[0]

    def _read_u8(self, addr: int) -> int:
        return self.pm.read_bytes(addr, 1)[0]

    def _write_u8(self, addr: int, value: int) -> None:
        self.pm.write_bytes(addr, bytes([value & 0xFF]), 1)

    # --- резолв BaseB ------------------------------------------------------
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
            raise RuntimeError(
                "BaseB не найден по AOB. Игра запущена? "
                "Версия игры совпадает с той, под которую сделана .CT?"
            )
        # инструкция: 48 8B 05 + disp32 = 7 байт
        disp = struct.unpack("<i", self.pm.read_bytes(match + 3, 4))[0]
        var_addr = match + 7 + disp
        if not (base <= var_addr < base + size):
            raise RuntimeError(
                f"BaseB var {hex(var_addr)} вне образа модуля — неверный AOB"
            )
        self._baseb_var = var_addr
        return var_addr

    def resolve_gesture_array(self) -> int:
        """Адрес нулевого элемента массива жестов."""
        var_addr = self.resolve_baseb_var()
        p = self._read_u64(var_addr)  # [BaseB]
        if p == 0:
            raise RuntimeError("[BaseB] == 0 (персонаж не загружен в игру?)")
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
    def read_raw(self) -> list[int]:
        """Сырые байты всех жестов (как их показывает CT)."""
        array = self.resolve_gesture_array()
        return [self._read_u8(self._gesture_addr(array, i))
                for i in range(C.GESTURE_COUNT)]

    def read_unlocked(self) -> list[bool]:
        """bool на каждый жест: нечётное значение = разблокирован."""
        return [(v & 1) == 1 for v in self.read_raw()]

    def write_raw(self, values: list[int]) -> None:
        array = self.resolve_gesture_array()
        for i, v in enumerate(values[:C.GESTURE_COUNT]):
            self._write_u8(self._gesture_addr(array, i), v)

    def set_gesture(self, index: int, unlocked: bool) -> None:
        array = self.resolve_gesture_array()
        value = C.unlocked_value(index) if unlocked else C.locked_value(index)
        self._write_u8(self._gesture_addr(array, index), value)

    def set_all(self, unlocked: bool) -> None:
        self.write_raw([
            C.unlocked_value(i) if unlocked else C.locked_value(i)
            for i in range(C.GESTURE_COUNT)
        ])

    def set_only(self, index: int) -> None:
        """Всё заблокировать, кроме одного жеста — так диффы сейвов изолированы."""
        self.write_raw([
            C.unlocked_value(i) if i == index else C.locked_value(i)
            for i in range(C.GESTURE_COUNT)
        ])


def _main() -> None:
    """python memory.py — печатает адреса и текущее состояние жестов."""
    C.use_utf8_stdout()
    mem = DS1Memory()
    mem.attach()
    var = mem.resolve_baseb_var()
    array = mem.resolve_gesture_array()
    print(f"BaseB var:     {hex(var)}")
    print(f"Gesture array: {hex(array)}")
    for i, v in enumerate(mem.read_raw()):
        state = "UNLOCKED" if v & 1 else "locked"
        expect = f"{C.locked_value(i)}/{C.unlocked_value(i)}"
        warn = "" if v in (C.locked_value(i), C.unlocked_value(i)) else "  <-- неожиданное значение!"
        print(f"  [{i:2d}] {C.GESTURE_NAMES[i]:<20} @ {hex(array + i * C.GESTURE_STRIDE)} "
              f"= {v:<3} ({expect})  {state}{warn}")
    mem.close()


if __name__ == "__main__":
    _main()
