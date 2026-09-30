"""Анализ дампов сейва: где в слоте лежат флаги разблокировки жестов.

Вход — папка с дампами от main.py:
    baseline_all_locked.bin
    g00_point_forward.bin ... g14_praise_the_sun.bin
    final_all_unlocked.bin

Каждый дамп снят при состоянии "всё заблокировано, кроме одного жеста", поэтому
дифф с baseline должен содержать ровно биты этого жеста + шум (таймер игры,
позиция персонажа и т.п.).

Единица анализа — БИТ (offset, bit), а не байт: флаги жестов почти наверняка
упакованы по битам в один-два байта, как костры в Character.getBonfireWarpFlags().
Бит, изменившийся ровно в одном дампе, — кандидат на флаг этого жеста; бит,
изменившийся во всех, — шум.

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

    p1 = sl2.find_pattern1(baseline)

    # (offset, bit) -> {gesture_index: new_bit}
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
        "pattern1": p1,
        "per_bit": per_bit,
        "noise": noise,
        "unique": unique,
        "shared": shared,
    }


def _rel(p1: int, off: int) -> str:
    if p1 < 0:
        return "—"
    d = off - p1
    return f"p1{'+' if d >= 0 else '-'}0x{abs(d):X}"


def report(out_dir: str) -> str:
    a = analyse(out_dir)
    p1 = a["pattern1"]
    lines = []
    w = lines.append

    w("# DS1 Gesture Sweeper — карта офсетов")
    w("")
    w(f"Дампов жестов: {len(a['caps'])} / {C.GESTURE_COUNT}")
    w(f"Pattern1 в baseline: {hex(p1) if p1 >= 0 else 'не найден'}")
    w("")

    # --- главное: по одному биту на жест ---------------------------------
    w("## Биты-кандидаты (изменились ровно в одном дампе)")
    w("")
    w("| жест | offset | отн. pattern1 | бит | locked->unlocked |")
    w("|---|---|---|---|---|")
    by_gesture = defaultdict(list)
    for (off, bit), hits in a["unique"].items():
        (gi, new), = hits.items()
        by_gesture[gi].append((off, bit, new))
    rows = 0
    for gi in sorted(by_gesture):
        for off, bit, new in sorted(by_gesture[gi]):
            w(f"| [{gi}] {C.GESTURE_NAMES[gi]} | 0x{off:X} | {_rel(p1, off)} | "
              f"{bit} | {1 - new}->{new} |")
            rows += 1
    if not rows:
        w("| — | — | — | — | нет уникальных битов |")
    w("")

    missing = [i for i in a["caps"] if i not in by_gesture]
    if missing:
        w("**Без уникального бита:** "
          + ", ".join(f"[{i}] {C.GESTURE_NAMES[i]}" for i in missing))
        w("")

    # --- готовая раскладка, если биты легли в один-два байта --------------
    if by_gesture:
        owner_of = {}
        for gi, v in by_gesture.items():
            for off, bit, _new in v:
                owner_of[(off, bit)] = gi
        offs = sorted({off for (off, _bit) in owner_of})
        w("## Раскладка по байтам")
        w("")
        for off in offs:
            cells = []
            for bit in range(8):
                gi = owner_of.get((off, bit))
                cells.append(f"bit{bit}={C.GESTURE_NAMES[gi]}" if gi is not None
                             else f"bit{bit}=?")
            w(f"- `0x{off:X}` (`{_rel(p1, off)}`): " + ", ".join(cells))
        w("")
        w("Для Character.ts: якорь — `findPattern1()`, относительные офсеты — "
          + ", ".join(f"`{_rel(p1, o)}`" for o in offs))
        w("")

    if a["shared"]:
        w("## Биты, общие для нескольких жестов (но не для всех)")
        w("")
        w("| offset | отн. pattern1 | бит | жесты |")
        w("|---|---|---|---|")
        for (off, bit) in sorted(a["shared"]):
            who = ", ".join(str(i) for i in sorted(a["shared"][(off, bit)]))
            w(f"| 0x{off:X} | {_rel(p1, off)} | {bit} | {who} |")
        w("")

    w("## Шум (изменилось во всех дампах — таймер/позиция/и т.п.)")
    w("")
    if a["noise"]:
        noise_bytes = sorted({off for (off, _bit) in a["noise"]})
        w(", ".join(f"0x{o:X} ({_rel(p1, o)})" for o in noise_bytes))
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
        w("| offset | отн. pattern1 | бит | old->new |")
        w("|---|---|---|---|")
        for off, bit, old, new in d:
            w(f"| 0x{off:X} | {_rel(p1, off)} | {bit} | {old}->{new} |")
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
