"""Разбор файла сейва DS3 (.sl2): BND4 + AES-CBC, якоря слота и поиск блоков внешности.

Порт логики из src/apps/ds3/lib (SaveFileEditor.ts, constants.ts, offsetPatterns.ts).
Формат энтри: [MD5 16][IV 16][AES-128-CBC зашифрованные данные].

Идея поиска: данные внешности игра держит в PlayerGameData сплошным блоком и
(как и в DS1) кладёт в сейв как есть. Значит блок, прочитанный из памяти, должен
найтись в расшифрованном слоте побайтово — без единой записи в игру.

Якоря нужны затем, что в DS3 абсолютные офсеты внутри слота ПЛАВАЮТ: расположение
блоков зависит от инвентаря переменной длины.
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


#: Все якоря, от которых меряем найденные блоки внешности.
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
# Поиск блоков внешности в слоте
# ===========================================================================

def find_all(hay: bytes, needle: bytes, limit: int = 64) -> list:
    """Все вхождения needle в hay."""
    out = []
    i = 0
    while len(out) < limit:
        j = hay.find(needle, i)
        if j < 0:
            break
        out.append(j)
        i = j + 1
    return out


def needle_for(name: str, data: bytes) -> bytes:
    """Что именно ищем для блока: у face берём подтверждённые CT 192 байта.

    Хвост 0x778..0x787 может не быть частью структуры, и лишние байты сорвали бы
    точное совпадение.
    """
    return data[:C.FACE_CT_SIZE] if name == "face" else data


def locate_blocks(slot: bytes, blocks: dict) -> dict:
    """{имя блока: {'needle': длина, 'hits': [офсеты]}} — где блок памяти лежит в слоте."""
    out = {}
    for name, data in blocks.items():
        needle = needle_for(name, data)
        out[name] = {"needle": len(needle), "hits": find_all(slot, needle)}
    return out


def face_tail_match(slot: bytes, face_offset: int, face_mem: bytes) -> int:
    """Сколько байт хвоста face-блока (после CT-шных 192) совпало с памятью."""
    n = 0
    for k in range(C.FACE_CT_SIZE, len(face_mem)):
        pos = face_offset + k
        if pos >= len(slot) or slot[pos] != face_mem[k]:
            break
        n += 1
    return n


def find_face_block(slot: bytes):
    """Найти face-блок в слоте — эталон алгоритма для редактора.

    Память не нужна: блок опознаётся по собственной структуре (см. anchors.py).
    Порядок ровно как у блока костров в редакторе:

      1. грубая оценка = блок костров + FACE_COARSE_FROM_BONFIRE;
      2. поиск сигнатуры в окне ±FACE_SEARCH_WINDOW вокруг неё;
      3. если в окне пусто — полный скан слота, берём кандидата ближе всех к оценке.

    Проверено на 99 персонажах из 15 файлов: в окне всегда ровно один кандидат,
    до полного скана дело не доходило ни разу.
    """
    import anchors  # локальный импорт: anchors импортирует sl2

    est = None
    bonfire = anchor_bonfire_block(slot)
    if bonfire is not None:
        est = bonfire + C.FACE_COARSE_FROM_BONFIRE
        hits = [o for o in anchors.find_face_blocks(slot)
                if abs(o - est) <= C.FACE_SEARCH_WINDOW]
        if len(hits) == 1:
            return hits[0]
        if hits:
            return min(hits, key=lambda o: abs(o - est))

    hits = anchors.find_face_blocks(slot)
    if not hits:
        return None
    return min(hits, key=lambda o: abs(o - est)) if est is not None else hits[0]


def find_misc_block(slot: bytes):
    """Офсет gender/voice в слоте: от CHARACTER_PATTERN, как остальные статы."""
    pat = anchor_character_pattern(slot)
    return None if pat is None else pat + C.MISC_FROM_CHARACTER_PATTERN


# ===========================================================================
# Пресеты внешности — собственная фича игры, лежит в системном энтри
# ===========================================================================

#: "FACE" | u32 версия=3 | u32 размер=0xF4 | payload 0xF8
FACE_MAGIC = b"FACE"
FACE_HEADER_SIZE = 12
PRESET_BASE = 0xB0
PRESET_STRIDE = 0x104
PRESET_COUNT = 6
PRESET_USED_OFFSET = 0xE8      # u16 внутри payload
PRESET_FILL_OFFSET = 0xD0      # дальше 21 байт 0x7F


def read_presets(entry10: bytes) -> list:
    """Шесть слотов пресетов. Пустой слот — не пустая запись, а сплошные нули."""
    out = []
    for k in range(PRESET_COUNT):
        at = PRESET_BASE + k * PRESET_STRIDE
        rec = bytes(entry10[at:at + PRESET_STRIDE])
        present = rec[:4] == FACE_MAGIC
        item = {"index": k, "offset": at, "raw": rec, "present": present,
                "empty": all(b == 0 for b in rec)}
        if present:
            pay = rec[FACE_HEADER_SIZE:]
            item["version"] = struct.unpack_from("<I", rec, 4)[0]
            item["declared"] = struct.unpack_from("<I", rec, 8)[0]
            item["face"] = pay[:C.BLOCKS["face"][1]]
            item["used"] = struct.unpack_from("<H", pay, PRESET_USED_OFFSET)[0]
            item["ids"] = list(struct.unpack_from("<9I", pay, 0))
            item["skin"] = tuple(pay[0x24:0x27])
        out.append(item)
    return out


def describe_preset(p: dict) -> str:
    if p["empty"]:
        return "пусто (нули)"
    if not p["present"]:
        return "мусор без магии"
    names = ["build", "hair", "pupL", "pupR", "brow", "beard", "?", "tattoo", "lash"]
    ids = " ".join(f"{n}={v}" for n, v in zip(names, p["ids"]) if v)
    return f"used={p['used']} кожа={p['skin']} {ids}"


def read_fields_from_slot(slot: bytes, block_offsets: dict) -> dict:
    """{слаг: значение} из слота по найденным офсетам блоков."""
    out = {}
    for off, kind, _g, _n, slug in C.FIELDS:
        bname, boff = C.block_of(off)
        base = block_offsets.get(bname)
        if base is None:
            continue
        size = C.field_size(kind)
        raw = slot[base + boff:base + boff + size]
        if len(raw) == size:
            out[slug] = C.decode(kind, raw)
    return out


def _main() -> None:
    """python sl2.py <DS30000.sl2> [--mem] — слоты, якоря и (с --mem) поиск блоков."""
    import sys

    C.use_utf8_stdout()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    use_mem = "--mem" in sys.argv
    if not args:
        print("Использование: python sl2.py <DS30000.sl2> [--mem]")
        return
    save = load(args[0])
    print(f"BND4 энтри: {entry_count(save)}\n")

    blocks = None
    if use_mem:
        import memory
        mem = memory.DS3Memory()
        mem.attach()
        blocks = mem.read_all_blocks()
        mem.close()
        print("Блоки из памяти:")
        for name, data in blocks.items():
            print(f"  {name}: {len(data)} байт  {data[:16].hex(' ')}...")
        print()

    for i in range(min(C.CHARACTER_SLOT_COUNT, entry_count(save))):
        d = decrypt_slot(save, i)
        if is_empty(d):
            print(f"  слот {i:2d}: ПУСТО")
            continue
        print(f"  слот {i:2d}: {read_name(d)!r:<16} lvl {read_level(d):<4} len 0x{len(d):X}")
        if blocks is None:
            continue
        found = locate_blocks(d, blocks)
        anchors = anchor_offsets(d)
        for name, info in found.items():
            hits = info["hits"]
            if not hits:
                print(f"        {name:<5} ({info['needle']} байт): не найден")
                continue
            hexhits = ", ".join(f"0x{h:X}" for h in hits[:8])
            print(f"        {name:<5} ({info['needle']} байт): {len(hits)} вхожд. [{hexhits}]")
            if name == "face":
                tail = face_tail_match(d, hits[0], blocks["face"])
                print(f"              хвост после 192: совпало {tail} из "
                      f"{len(blocks['face']) - C.FACE_CT_SIZE}")
            for aname, a in anchors.items():
                rel = "—" if a is None else f"{hits[0] - a:+#x}"
                print(f"              {aname:<18} = {('—' if a is None else hex(a)):<10} "
                      f"дельта {rel}")


if __name__ == "__main__":
    _main()
