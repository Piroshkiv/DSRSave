"""Анализ дампов сейва DS3: где в слоте лежат флаги разблокировки жестов.

Вход — папка с дампами от main.py:
    baseline_all_locked.bin
    g00_point_forward.bin ... gNN_<slug>.bin
    final_all_unlocked.bin

Каждый дамп снят при состоянии "всё заблокировано, кроме одного жеста", поэтому
дифф с baseline должен содержать ровно биты этого жеста + шум (таймер игры,
позиция персонажа и т.п.).

Единица анализа — БИТ (offset, bit), а не байт. Бит, изменившийся ровно в одном
дампе, — кандидат на флаг жеста; бит, изменившийся во всех, — шум.

Дополнительно отчёт меряет найденную таблицу от всех известных якорей слота
(character_pattern / inventory_start / bonfire_block / steamid / absolute) —
в DS3 абсолютные офсеты плавают между персонажами, поэтому якорь надо выбирать
по данным, а не на глаз.

Запуск отдельно:  python diff.py ./out
"""

from __future__ import annotations

import os
import sys
from collections import defaultdict

import constants as C
import sl2

BASELINE_NAME = "baseline_all_locked.bin"
FINAL_NAME = "final_all_unlocked.bin"


def _load(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def diff_bits(a: bytes, b: bytes):
    """[(offset, bit, old_bit, new_bit)] по всем различающимся битам."""
    out = []
    n = min(len(a), len(b))
    for i in range(n):
        x = a[i] ^ b[i]
        if not x:
            continue
        for bit in range(8):
            if (x >> bit) & 1:
                out.append((i, bit, (a[i] >> bit) & 1, (b[i] >> bit) & 1))
    return out


def collect(out_dir: str):
    base_path = os.path.join(out_dir, BASELINE_NAME)
    if not os.path.exists(base_path):
        raise SystemExit(f"Нет baseline: {base_path}")
    baseline = _load(base_path)

    caps = {}
    for i in range(C.GESTURE_COUNT):
        name = f"g{i:02d}_{C.GESTURE_SLUGS[i]}.bin"
        path = os.path.join(out_dir, name)
        if os.path.exists(path):
            caps[i] = (name, _load(path))
    return baseline, caps


def analyse(out_dir: str) -> dict:
    baseline, caps = collect(out_dir)
    if not caps:
        raise SystemExit(f"В {out_dir} нет ни одного дампа жеста")

    per_bit = defaultdict(dict)
    for i, (_, data) in caps.items():
        for off, bit, _old, new in diff_bits(baseline, data):
            per_bit[(off, bit)][i] = new

    total = len(caps)
    noise, unique, shared = {}, {}, {}
    for key, hits in per_bit.items():
        if len(hits) == total:
            noise[key] = hits
        elif len(hits) == 1:
            unique[key] = hits
        else:
            shared[key] = hits

    return {
        "baseline": baseline,
        "caps": caps,
        "anchors": sl2.anchor_offsets(baseline),
        "tables": sl2.find_gesture_tables(baseline),
        "noise": noise,
        "unique": unique,
        "shared": shared,
    }


def report(out_dir: str) -> str:
    a = analyse(out_dir)
    lines = []
    w = lines.append

    w("# DS3 Gesture Sweeper — карта офсетов")
    w("")
    w(f"Дампов жестов: {len(a['caps'])} / {C.GESTURE_COUNT}")
    if a["tables"]:
        off, n = a["tables"][0]
        w(f"Таблица жестов по сигнатуре: `0x{off:X}`, записей {n}"
          + (f" (вхождений в слоте: {len(a['tables'])})" if len(a["tables"]) > 1 else ""))
    else:
        w("Таблица жестов по сигнатуре не найдена")
    w("")

    # --- главное: по одному биту на жест ---------------------------------
    w("## Биты-кандидаты (изменились ровно в одном дампе)")
    w("")
    w("| жест | offset | бит | locked->unlocked |")
    w("|---|---|---|---|")
    by_gesture = defaultdict(list)
    for (off, bit), hits in a["unique"].items():
        (gi, new), = hits.items()
        by_gesture[gi].append((off, bit, new))
    rows = 0
    for gi in sorted(by_gesture):
        for off, bit, new in sorted(by_gesture[gi]):
            w(f"| [{gi}] {C.GESTURE_NAMES[gi]} | 0x{off:X} | {bit} | {1 - new}->{new} |")
            rows += 1
    if not rows:
        w("| — | — | — | нет уникальных битов |")
    w("")

    missing = [i for i in a["caps"] if i not in by_gesture]
    if missing:
        w("**Без уникального бита:** "
          + ", ".join(f"[{i}] {C.GESTURE_NAMES[i]}" for i in missing))
        w("")

    # --- сверка с сигнатурной таблицей + якоря ----------------------------
    if by_gesture and a["tables"]:
        table_off, n = a["tables"][0]
        w("## Сверка с таблицей, найденной по сигнатуре")
        w("")
        hit_expected = []
        missing = []
        extra = []
        for gi, v in sorted(by_gesture.items()):
            expected = table_off + gi * 4
            if any(off == expected and bit == 0 for off, bit, _ in v):
                hit_expected.append(gi)
            else:
                missing.append(gi)
            extra += [(gi, off, bit) for off, bit, _ in v
                      if not (off == expected and bit == 0)]

        w(f"Легли ровно в `таблица + index*4`, бит 0: **{len(hit_expected)}/{len(by_gesture)}**.")
        w("")
        if missing:
            w("НЕ нашлись на ожидаемом месте (это проблема):")
            w("")
            w("| жест | ожидалось |")
            w("|---|---|")
            for gi in missing:
                w(f"| [{gi}] {C.GESTURE_NAMES[gi]} | 0x{table_off + gi * 4:X} бит 0 |")
            w("")
        if extra:
            # Копии таблицы в runtime-хвосте слота плавают между сейвами, поэтому
            # побайтовый дифф ловит их как «изменения». Это мусор, а не данные.
            lo = min(o for _, o, _ in extra)
            w(f"Лишние биты вне таблицы: {len(extra)} шт, начиная с 0x{lo:X}. "
              "Это копии таблицы в runtime-хвосте слота — он плавает между сейвами, "
              "поэтому в диффе выглядит как изменения. Настоящая таблица — первая "
              "по офсету.")
            w("")

        w("## Дельты от известных якорей слота")
        w("")
        w("| якорь | офсет якоря | таблица - якорь |")
        w("|---|---|---|")
        for name, anc in a["anchors"].items():
            if anc is None:
                w(f"| {name} | — | — |")
            else:
                w(f"| {name} | 0x{anc:X} | `{table_off - anc:+#x}` |")
        w("")
        w("Какой якорь верный — видно только при сравнении НЕСКОЛЬКИХ персонажей "
          "(`python anchors.py <save.sl2>`): постоянная дельта = годный якорь.")
        w("")

    if a["shared"]:
        w("## Биты, общие для нескольких жестов (но не для всех)")
        w("")
        w("| offset | бит | жесты |")
        w("|---|---|---|")
        for (off, bit) in sorted(a["shared"]):
            who = ", ".join(str(i) for i in sorted(a["shared"][(off, bit)]))
            w(f"| 0x{off:X} | {bit} | {who} |")
        w("")

    w("## Шум (изменилось во всех дампах — таймер/позиция/и т.п.)")
    w("")
    if a["noise"]:
        noise_bytes = sorted({off for (off, _bit) in a["noise"]})
        w(", ".join(f"0x{o:X}" for o in noise_bytes[:200]))
        if len(noise_bytes) > 200:
            w(f"… и ещё {len(noise_bytes) - 200} байт")
    else:
        w("нет")
    w("")

    final_path = os.path.join(out_dir, FINAL_NAME)
    if os.path.exists(final_path):
        fin = _load(final_path)
        d = [x for x in diff_bits(a["baseline"], fin)
             if (x[0], x[1]) not in a["noise"]]
        w("## Контроль: all-locked -> all-unlocked (без шума)")
        w("")
        w("| offset | бит | old->new |")
        w("|---|---|---|")
        for off, bit, old, new in d[:200]:
            w(f"| 0x{off:X} | {bit} | {old}->{new} |")
        if len(d) > 200:
            w(f"| … | | ещё {len(d) - 200} бит |")
        w("")

    return "\n".join(lines)


def _main() -> None:
    C.use_utf8_stdout()
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "./out"
    text = report(out_dir)
    path = os.path.join(out_dir, "report.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(text)
    print(f"\nОтчёт записан: {os.path.abspath(path)}")


if __name__ == "__main__":
    _main()
