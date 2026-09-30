"""Разбор файла сейва DS3 (.sl2): BND4 + AES-CBC, плюс набор якорей слота.

Порт логики из src/apps/ds3/lib (SaveFileEditor.ts, constants.ts, offsetPatterns.ts).
Формат энтри: [MD5 16][IV 16][AES-128-CBC зашифрованные данные].

Якоря нужны затем, что в DS3 абсолютные офсеты внутри слота ПЛАВАЮТ: расположение
блоков зависит от инвентаря переменной длины. Поэтому найденную таблицу жестов
меряем сразу от всех известных якорей и смотрим, у какого дельта постоянна —
ровно тем же способом, каким в редакторе выбирали якорь для костров и NG+.
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


def load(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def entry_count(save: bytes) -> int:
    if save[:4] != C.BND4_SIGNATURE:
        raise SL2Error("Не BND4 (неверная сигнатура)")
    return _u32(save, C.ENTRY_COUNT_OFFSET)


def decrypt_slot(save: bytes, slot_index: int, verify_md5: bool = False) -> bytes:
    """Расшифровать энтри (слот персонажа) по индексу."""
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

    return AES.new(C.AES_KEY, AES.MODE_CBC, iv).decrypt(enc)


def is_empty(slot: bytes) -> bool:
    return slot.find(C.CHARACTER_PATTERN) < 0


def read_name(slot: bytes) -> str:
    pat = slot.find(C.CHARACTER_PATTERN)
    if pat < 0:
        return ""
    off = pat - 0xC8          # RELATIVE_OFFSETS.NAME
    raw = slot[off:off + 32]
    out = []
    for k in range(0, len(raw) - 1, 2):
        ch = raw[k] | (raw[k + 1] << 8)
        if ch == 0:
            break
        out.append(chr(ch))
    return "".join(out)


def read_level(slot: bytes) -> int:
    pat = slot.find(C.CHARACTER_PATTERN)
    if pat < 0:
        return 0
    return struct.unpack_from("<i", slot, pat - 0xE0)[0]


# ===========================================================================
# Якоря слота — порт из src/apps/ds3/lib/offsetPatterns.ts и constants.ts
# ===========================================================================

def anchor_character_pattern(slot: bytes):
    """Первое вхождение CHARACTER_PATTERN — якорь статов/имени/уровня."""
    i = slot.find(C.CHARACTER_PATTERN)
    return i if i >= 0 else None


def anchor_inventory_start(slot: bytes):
    """Начало инвентаря — скан GA-таблицы (findInventoryStart в редакторе)."""
    GA_TABLE_OFFSET = 0x70
    GA_ENTRY_SMALL = 8
    GA_ENTRY_LARGE = 60
    GA_MAX_ENTRIES = 6144

    if len(slot) <= GA_TABLE_OFFSET:
        return None
    offset = GA_TABLE_OFFSET
    count = 0
    while count < GA_MAX_ENTRIES:
        if offset + GA_ENTRY_SMALL > len(slot):
            break
        b3 = slot[offset + 3]
        offset += GA_ENTRY_LARGE if b3 in (0x80, 0x90, 0xA0, 0xB0) else GA_ENTRY_SMALL
        count += 1
    inv = offset + 0x13F + 0x1DD
    return inv if inv < len(slot) else None


BONFIRE_PATTERN = bytes([
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
])
BONFIRE_COARSE_FROM_INV = 0x12B1F
BONFIRE_ANCHOR_TO_BLOCK = 0xB5D


def anchor_bonfire_block(slot: bytes):
    """Начало блока костров — оконный поиск, как в редакторе."""
    inv = anchor_inventory_start(slot)
    if inv is None:
        return None
    est = inv + BONFIRE_COARSE_FROM_INV
    lo = max(0, est - 0x1500)
    hi = min(len(slot), est + 0x200)
    found = -1
    i = lo
    while True:
        j = slot.find(BONFIRE_PATTERN, i, hi)
        if j < 0:
            break
        found = j
        i = j + 1
    if found < 0:
        return None
    return found + BONFIRE_ANCHOR_TO_BLOCK


STEAMID_PATTERN = bytes([0x01, 0x00, 0x10, 0x01])
STEAMID_SLOT_PTR_OFFSET = 0x58
STEAMID_PTR_TO_ID = 0x6F
STEAMID_PATTERN_TO_ID = -4


def anchor_steamid(slot: bytes):
    """Офсет SteamID64 в слоте (указатель на 0x58, с проверкой сигнатуры)."""
    def looks_like_id(at: int) -> bool:
        return (at >= 0 and at + 8 <= len(slot)
                and slot[at + 4:at + 8] == STEAMID_PATTERN)

    if len(slot) >= STEAMID_SLOT_PTR_OFFSET + 4:
        ptr = _u32(slot, STEAMID_SLOT_PTR_OFFSET)
        if ptr != 0 and looks_like_id(ptr + STEAMID_PTR_TO_ID):
            return ptr + STEAMID_PTR_TO_ID
    j = slot.find(STEAMID_PATTERN)
    return j + STEAMID_PATTERN_TO_ID if j >= 0 else None


#: Все якоря, от которых меряем найденную таблицу жестов.
ANCHORS = {
    "character_pattern": anchor_character_pattern,
    "inventory_start": anchor_inventory_start,
    "bonfire_block": anchor_bonfire_block,
    "steamid": anchor_steamid,
    "absolute": lambda _slot: 0,
}


def anchor_offsets(slot: bytes) -> dict:
    """{имя якоря: его офсет или None}."""
    out = {}
    for name, fn in ANCHORS.items():
        try:
            out[name] = fn(slot)
        except Exception:
            out[name] = None
    return out


# ===========================================================================
# Поиск таблицы жестов по её собственной сигнатуре
# ===========================================================================

def find_gesture_tables(slot: bytes, min_records: int = 20) -> list:
    """[(offset, record_count)] — все места, где лежит таблица жестов.

    Запись: [u16 value][u16 index], index == i и value>>1 == i+1.
    Ищем начало (запись 0 = `02 00 00 00` либо `03 00 00 00`), затем считаем,
    сколько записей подряд сходится.
    """
    hits = []
    start = 0
    while True:
        j = slot.find(b"\x02\x00\x00\x00", start)
        k = slot.find(b"\x03\x00\x00\x00", start)
        cands = [x for x in (j, k) if x >= 0]
        if not cands:
            break
        o = min(cands)
        start = o + 1
        n = 0
        while o + (n + 1) * 4 <= len(slot):
            value = slot[o + n * 4] | (slot[o + n * 4 + 1] << 8)
            index = slot[o + n * 4 + 2] | (slot[o + n * 4 + 3] << 8)
            if index != n or (value >> 1) != n + 1:
                break
            n += 1
        if n >= min_records:
            hits.append((o, n))
    return hits


def read_gesture_flags(slot: bytes, offset: int, count: int) -> list:
    return [(slot[offset + i * 4] & 1) == 1 for i in range(count)]


def _main() -> None:
    """python sl2.py <DS30000.sl2> — слоты, якоря и найденная таблица жестов."""
    import sys

    C.use_utf8_stdout()
    if len(sys.argv) < 2:
        print("Использование: python sl2.py <DS30000.sl2>")
        return
    save = load(sys.argv[1])
    print(f"BND4 энтри: {entry_count(save)}\n")
    for i in range(min(C.CHARACTER_SLOT_COUNT, entry_count(save))):
        d = decrypt_slot(save, i)
        if is_empty(d):
            print(f"  слот {i:2d}: ПУСТО")
            continue
        tables = find_gesture_tables(d)
        anchors = anchor_offsets(d)
        head = f"  слот {i:2d}: {read_name(d)!r:<16} lvl {read_level(d):<4}"
        if not tables:
            print(head + " таблица жестов НЕ НАЙДЕНА")
            continue
        off, n = tables[0]
        unlocked = sum(read_gesture_flags(d, off, n))
        print(head + f" таблица @ 0x{off:X}, записей {n}, разблокировано {unlocked}/{n}"
              + (f"  (вхождений: {len(tables)})" if len(tables) > 1 else ""))
        for name, a in anchors.items():
            rel = "—" if a is None else f"{off - a:+#x}"
            print(f"        {name:<18} = {('—' if a is None else hex(a)):<10} дельта {rel}")


if __name__ == "__main__":
    _main()
