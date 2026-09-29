"""Подбор якоря для блока внешности: меряем его от всех известных якорей слота.

В DS3 абсолютные офсеты внутри слота плавают вместе с инвентарём переменной
длины, поэтому редактору нужен якорь с ПОСТОЯННОЙ дельтой. Тот же вопрос решался
для костров, NG+ и жестов — и у жестов ни один якорь не подошёл.

Найти блок у произвольного персонажа (внешность которого мы не знаем) позволяет
структурная сигнатура face-блока:

    +0x00..0x23   девять u32 — ID моделей, значения маленькие => старшие 3 байта нули
    +0x24..0x47   девять RGBA-квартетов (кожа + 8 цветов) => каждый 4-й байт 0xFF

27 нулей и 9 байт 0xFF в жёстко заданных позициях — совпадение маловероятно, а
проверка ещё и подтверждается тем, что блок найден ровно один раз.

Запуск:  python anchors.py [файл.sl2 ...]
"""

from __future__ import annotations

import glob
import os
import re
import sys

import constants as C
import sl2

#: 0x24..0x47 — девять RGBA, у каждого альфа 0xFF.
_ALPHA_RE = re.compile(rb"(?:.{3}\xff){9}", re.S)

ID_COUNT = 9
IDS_SIZE = ID_COUNT * 4          # 0x00..0x23
COLORS_OFFSET = IDS_SIZE         # 0x24


def looks_like_face_block(slot: bytes, off: int) -> bool:
    """Проверка структуры по ID-полям: значения маленькие, старшие байты нулевые."""
    if off < 0 or off + C.BLOCKS["face"][1] > len(slot):
        return False
    for k in range(ID_COUNT):
        if slot[off + 4 * k + 1] or slot[off + 4 * k + 2] or slot[off + 4 * k + 3]:
            return False
    return True


def find_face_blocks(slot: bytes) -> list:
    """Все офсеты, где структура сходится под face-блок."""
    out = []
    for m in _ALPHA_RE.finditer(slot):
        off = m.start() - COLORS_OFFSET
        if looks_like_face_block(slot, off):
            out.append(off)
    return out


def analyse(paths: list) -> None:
    rows = []
    for path in paths:
        try:
            save = sl2.load(path)
            n = sl2.entry_count(save)
        except Exception as exc:
            print(f"{path}: пропуск ({exc})")
            continue
        label = os.path.basename(path)
        for i in range(min(C.CHARACTER_SLOT_COUNT, n)):
            d = sl2.decrypt_slot(save, i)
            if sl2.is_empty(d):
                continue
            blocks = find_face_blocks(d)
            anchors = sl2.anchor_offsets(d)
            rows.append((label, i, sl2.read_name(d), sl2.read_level(d), blocks, anchors))

    names = list(sl2.ANCHORS.keys())
    print(f"{'файл':<34} {'сл':>3} {'имя':<10} {'lvl':>4} {'блоков':>7} "
          f"{'офсет':>9} " + " ".join(f"{a:>12}" for a in names))
    deltas = {a: set() for a in names}
    for label, i, name, lvl, blocks, anchors in rows:
        off = blocks[0] if blocks else None
        cells = []
        for a in names:
            base = anchors.get(a)
            if off is None or base is None:
                cells.append(f"{'—':>12}")
            else:
                d = off - base
                deltas[a].add(d)
                cells.append(f"{d:>+12x}")
        print(f"{label[:34]:<34} {i:>3} {name[:10]:<10} {lvl:>4} {len(blocks):>7} "
              f"{('—' if off is None else hex(off)):>9} " + " ".join(cells))

    print("\nРазброс дельты по якорям:")
    for a in names:
        vals = sorted(deltas[a])
        if not vals:
            print(f"  {a:<18} нет данных")
            continue
        spread = vals[-1] - vals[0]
        verdict = "ГОДЕН" if len(vals) == 1 else f"разброс 0x{spread:X}"
        print(f"  {a:<18} значений {len(vals):<3} "
              f"[{hex(vals[0])} … {hex(vals[-1])}]  {verdict}")


def _main() -> None:
    C.use_utf8_stdout()
    paths = sys.argv[1:]
    if not paths:
        root = os.path.join(os.path.expanduser("~"), C.DEFAULT_SAVE_ROOT)
        paths = glob.glob(os.path.join(root, "*", C.DEFAULT_SAVE_NAME))
    analyse(paths)


if __name__ == "__main__":
    _main()
