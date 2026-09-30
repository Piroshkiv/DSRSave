"""Разбор файла сейва DSR (DRAKS0005.sl2): 11 слотов AES-128-CBC.

Порт логики из src/apps/ds1/lib/SaveFileEditor.ts. Слот на диске:

    [ MD5 (16) ][ IV (16) ][ AES-128-CBC ciphertext ]

Редактор (и мы) расшифровывают со сдвигом +16 — MD5 идёт в AES как IV, реальный
IV становится первым "фантомным" блоком открытых данных. Это осознанно: так
офсеты дампов 1:1 совпадают с офсетами в Character.ts (имя на 0x108 и т.д.),
которые и надо будет прописать в редактор.
"""

from __future__ import annotations

import hashlib

from Crypto.Cipher import AES

import constants as C


class SL2Error(Exception):
    pass


def slot_offset(slot_index: int) -> int:
    return C.BASE_SLOT_OFFSET + slot_index * C.SAVE_SLOT_SIZE


def decrypt_slot(save: bytes, slot_index: int) -> bytes:
    """Расшифровать слот. Возвращает открытые байты (офсеты как в Character.ts)."""
    if len(save) < C.SAVE_FILE_SIZE:
        raise SL2Error(
            f"Размер файла {len(save)} < {C.SAVE_FILE_SIZE} — это не PC-сейв DSR"
        )
    if not (0 <= slot_index < C.USER_DATA_FILE_COUNT):
        raise SL2Error(f"Слот {slot_index} вне диапазона 0..{C.USER_DATA_FILE_COUNT - 1}")

    off = slot_offset(slot_index)
    checksum = save[off:off + 16]
    enc = save[off + 16:off + 16 + C.USER_DATA_SIZE]
    return AES.new(C.AES_KEY, AES.MODE_CBC, checksum).decrypt(enc)


def verify_slot_md5(save: bytes, slot_index: int) -> bool:
    """MD5 слота = md5(IV ‖ ciphertext), т.е. md5 всего региона после чексуммы."""
    off = slot_offset(slot_index)
    stored = save[off:off + 16]
    region = save[off + 16:off + 16 + C.USER_DATA_SIZE]
    return hashlib.md5(region).digest() == stored


def find_pattern1(slot: bytes) -> int:
    """Последнее вхождение Pattern1 в 0x1F000..0x1FFFF (как Character.findPattern1)."""
    end = min(C.PATTERN1_SEARCH_END, len(slot) - 1)
    found = -1
    i = C.PATTERN1_SEARCH_START
    while True:
        j = slot.find(C.PATTERN1, i, end + 1)
        if j < 0:
            break
        found = j
        i = j + 1
    return found


def read_name(slot: bytes) -> str:
    raw = slot[C.NAME_OFFSET:C.NAME_OFFSET + C.NAME_MAX_BYTES]
    out = []
    for k in range(0, len(raw) - 1, 2):
        ch = raw[k] | (raw[k + 1] << 8)
        if ch == 0:
            break
        out.append(chr(ch))
    return "".join(out)


def read_level(slot: bytes) -> int:
    return slot[C.LEVEL_OFFSET] | (slot[C.LEVEL_OFFSET + 1] << 8)


def is_empty(slot: bytes) -> bool:
    return all(b == 0 for b in slot[0x20:0x91])


def load(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def list_slots(save: bytes) -> list[dict]:
    rows = []
    for i in range(C.USER_DATA_FILE_COUNT):
        data = decrypt_slot(save, i)
        rows.append({
            "slot": i,
            "empty": is_empty(data),
            "name": read_name(data),
            "level": read_level(data),
            "pattern1": find_pattern1(data),
            "md5_ok": verify_slot_md5(save, i),
        })
    return rows


def _main() -> None:
    """python sl2.py <DRAKS0005.sl2> [slot] — список слотов или дамп одного."""
    import sys

    C.use_utf8_stdout()

    if len(sys.argv) < 2:
        print("Использование: python sl2.py <DRAKS0005.sl2> [slot]")
        return
    save = load(sys.argv[1])
    for r in list_slots(save):
        tag = "ПУСТО" if r["empty"] else f"{r['name']!r} lvl {r['level']}"
        p1 = hex(r["pattern1"]) if r["pattern1"] >= 0 else "не найден"
        print(f"  слот {r['slot']:2d}: {tag:<28} pattern1={p1}  md5={'ok' if r['md5_ok'] else 'BAD'}")


if __name__ == "__main__":
    _main()
