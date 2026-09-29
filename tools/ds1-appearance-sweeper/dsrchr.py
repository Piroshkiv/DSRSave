"""Формат .dsrchr — пресет DSAppearancePresetTool (BobDoleOwndU).

130 байт без заголовка, поля PGD подряд:

    sex u8 | physique u8 | hair i32 | hair RGB 12 | eye RGB 12 | face 50 | skin 50

Мод копирует цвета сырыми байтами (альфа в файл не попадает) — здесь так же,
поэтому пресет из памяти, из сейва и из редактора можно сравнивать побайтово.

    python dsrchr.py a.dsrchr [b.dsrchr]   показать / сравнить по полям
"""

from __future__ import annotations

import struct
import sys

import constants as C


def _parts(read) -> bytes:
    """Собрать файл, где read(slug, n) отдаёт первые n байт поля."""
    out = bytearray()
    for slug, n in C.DSRCHR_LAYOUT:
        out += read(slug, n)
    assert len(out) == C.DSRCHR_SIZE
    return bytes(out)


def from_memory(mem) -> bytes:
    """Ровно то, что пишет в файл кнопка Export мода."""
    def read(slug, n):
        return mem.read_pgd(C.FIELD_BY_SLUG[slug][1], n)
    return _parts(read)


def from_slot(slot: bytes) -> bytes:
    """То, что должен выдавать экспорт редактора из расшифрованного слота."""
    def read(slug, n):
        off = C.FIELD_BY_SLUG[slug][2]
        return slot[off:off + n]
    return _parts(read)


def to_memory(mem, data: bytes) -> None:
    """Ровно то, что делает кнопка Import мода: пишет 7 полей в PGD."""
    for slug, (off, n) in split(data).items():
        mem.write_pgd(C.FIELD_BY_SLUG[slug][1], data[off:off + n])


def split(data: bytes) -> dict:
    """{slug: (офсет в файле, длина)}"""
    if len(data) < C.DSRCHR_SIZE:
        raise ValueError(f"не .dsrchr: {len(data)} байт, нужно {C.DSRCHR_SIZE}")
    out, pos = {}, 0
    for slug, n in C.DSRCHR_LAYOUT:
        out[slug] = (pos, n)
        pos += n
    return out


def describe(data: bytes) -> dict:
    """{slug: человекочитаемое значение}"""
    parts = split(data)
    out = {}
    for slug, (off, n) in parts.items():
        raw = data[off:off + n]
        if n == 1:
            out[slug] = str(raw[0])
        elif n == 4:
            out[slug] = str(struct.unpack("<i", raw)[0])
        elif n == 12:
            out[slug] = "(" + ", ".join(f"{c:.4f}" for c in struct.unpack("<3f", raw)) + ")"
        else:
            out[slug] = raw.hex()
    return out


def compare(a: bytes, b: bytes) -> list:
    """[(slug, значение_a, значение_b, число_разных_байт)] только по отличающимся полям."""
    da, db = describe(a), describe(b)
    rows = []
    for slug, (off, n) in split(a).items():
        diff = sum(1 for i in range(off, off + n) if a[i] != b[i])
        if diff:
            rows.append((slug, da[slug], db[slug], diff))
    return rows


def print_compare(a: bytes, b: bytes, name_a: str = "A", name_b: str = "B") -> bool:
    rows = compare(a, b)
    if not rows:
        print(f"  {name_a} и {name_b} совпадают побайтово ({C.DSRCHR_SIZE} байт)")
        return True
    for slug, va, vb, n in rows:
        print(f"  {slug:<11} отличается ({n} байт)")
        print(f"      {name_a}: {va}")
        print(f"      {name_b}: {vb}")
    return False


def _main() -> None:
    C.use_utf8_stdout()
    if len(sys.argv) < 2:
        print(__doc__)
        return
    a = open(sys.argv[1], "rb").read()
    if len(sys.argv) == 2:
        for slug, v in describe(a).items():
            print(f"  {slug:<11} {v}")
        return
    b = open(sys.argv[2], "rb").read()
    print_compare(a, b, sys.argv[1], sys.argv[2])


if __name__ == "__main__":
    _main()
