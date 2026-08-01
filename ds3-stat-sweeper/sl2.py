"""Разбор файла сейва DS3 (.sl2): BND4 + AES-CBC.

Порт логики из src/apps/ds3/lib/SaveFileEditor.ts и Character.ts.
Формат энтри: [MD5 16][IV 16][AES-128-CBC зашифрованные данные].
Расшифрованный слот — это и есть выходной .bin. Из него же читаем стат для верификации.
"""

from __future__ import annotations

import hashlib
import struct

from Crypto.Cipher import AES

import constants as C


class SL2Error(Exception):
    pass


def _u32(data: bytes, off: int) -> int:
    return struct.unpack_from("<I", data, off)[0]


def _u64(data: bytes, off: int) -> int:
    return struct.unpack_from("<Q", data, off)[0]


def entry_count(save: bytes) -> int:
    if save[:4] != C.BND4_SIGNATURE:
        raise SL2Error("Не BND4 (неверная сигнатура)")
    return _u32(save, C.ENTRY_COUNT_OFFSET)


def decrypt_slot(save: bytes, slot_index: int, verify_md5: bool = True) -> bytes:
    """Расшифровать энтри (слот персонажа) по индексу. Возвращает открытые байты слота."""
    count = entry_count(save)
    if not (0 <= slot_index < count):
        raise SL2Error(f"Слот {slot_index} вне диапазона 0..{count - 1}")

    hdr = C.BND4_HEADER_SIZE + slot_index * C.ENTRY_HEADER_SIZE
    entry_size = _u64(save, hdr + 0x08)
    data_off = _u32(save, hdr + 0x10)

    stored_md5 = save[data_off:data_off + 16]
    iv = save[data_off + 16:data_off + 32]
    enc_size = entry_size - 32
    enc = save[data_off + 32:data_off + 32 + enc_size]

    if verify_md5:
        digest = hashlib.md5(save[data_off + 16:data_off + 16 + 16 + enc_size]).digest()
        if digest != stored_md5:
            raise SL2Error(f"MD5 не сходится для слота {slot_index}")

    cipher = AES.new(C.AES_KEY, AES.MODE_CBC, iv)
    return cipher.decrypt(enc)


def find_character_pattern(slot: bytes) -> int:
    """Найти смещение паттерна начала персонажа. -1 если не найден (пустой слот)."""
    return slot.find(C.CHARACTER_PATTERN)


def read_stat_from_slot(slot: bytes, stat_key: str) -> int:
    pat = find_character_pattern(slot)
    if pat < 0:
        raise SL2Error("Паттерн персонажа не найден (пустой/битый слот)")
    off = pat + C.SL2_RELATIVE_OFFSETS[stat_key]
    return struct.unpack_from("<i", slot, off)[0]


def read_level_from_slot(slot: bytes) -> int:
    pat = find_character_pattern(slot)
    if pat < 0:
        raise SL2Error("Паттерн персонажа не найден (пустой/битый слот)")
    return struct.unpack_from("<i", slot, pat + C.SL2_LEVEL_OFFSET)[0]


def read_all_stats_from_slot(slot: bytes) -> dict[str, int]:
    pat = find_character_pattern(slot)
    if pat < 0:
        raise SL2Error("Паттерн персонажа не найден (пустой/битый слот)")
    out = {}
    for k, rel in C.SL2_RELATIVE_OFFSETS.items():
        out[k] = struct.unpack_from("<i", slot, pat + rel)[0]
    out["LEVEL"] = struct.unpack_from("<i", slot, pat + C.SL2_LEVEL_OFFSET)[0]
    return out


def _main() -> None:
    """python sl2.py <path.sl2> <slot> — расшифровать слот и распечатать статы."""
    import sys

    if len(sys.argv) < 3:
        print("Использование: python sl2.py <DS30000.sl2> <slot>")
        return
    path, slot = sys.argv[1], int(sys.argv[2])
    with open(path, "rb") as f:
        save = f.read()

    print(f"BND4 энтри: {entry_count(save)}")
    data = decrypt_slot(save, slot)
    pat = find_character_pattern(data)
    print(f"Слот {slot}: размер {len(data)} байт, паттерн @ "
          + (hex(pat) if pat >= 0 else "не найден"))
    if pat >= 0:
        stats = read_all_stats_from_slot(data)
        for k in C.STAT_ORDER:
            print(f"  {C.STAT_NAMES[k]:<13} = {stats[k]}")
        print(f"  Level         = {stats['LEVEL']}")
        print(f"  сумма-89      = {sum(stats[k] for k in C.STAT_ORDER) - C.BASE_STATS_AT_ZERO}")


if __name__ == "__main__":
    _main()
