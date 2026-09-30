"""Подбор якоря для таблицы жестов DS3.

В DS3 абсолютные офсеты внутри слота плавают: блоки едут вместе с инвентарём
переменной длины. Поэтому офсет таблицы жестов нельзя просто записать
константой — нужен якорь, дельта от которого постоянна.

Этот скрипт находит таблицу по её сигнатуре во всех непустых слотах всех
профилей и печатает дельту до каждого известного якоря. Годный якорь — тот,
у которого дельта одна и та же везде.

    python anchors.py                       # все профили в AppData\\Roaming\\DarkSoulsIII
    python anchors.py <save.sl2> [...]      # конкретные файлы
"""

from __future__ import annotations

import os
import sys
from collections import defaultdict

import constants as C
import sl2


def iter_saves(argv: list) -> list:
    if argv:
        return [p for p in argv if os.path.isfile(p)]
    root = os.path.join(os.path.expanduser("~"), C.DEFAULT_SAVE_ROOT)
    out = []
    if os.path.isdir(root):
        for name in sorted(os.listdir(root)):
            p = os.path.join(root, name, C.DEFAULT_SAVE_NAME)
            if os.path.isfile(p):
                out.append(p)
    return out


def main() -> int:
    C.use_utf8_stdout()
    saves = iter_saves(sys.argv[1:])
    if not saves:
        print("Не найдено ни одного DS30000.sl2")
        return 1

    # anchor -> {delta: [описание слота, ...]}
    deltas = defaultdict(lambda: defaultdict(list))
    rows = 0
    missing = []

    for path in saves:
        prof = os.path.basename(os.path.dirname(path))
        try:
            save = sl2.load(path)
            n_entries = sl2.entry_count(save)
        except Exception as e:
            print(f"{path}: не читается ({e})")
            continue
        print(f"\n=== {prof} ({os.path.basename(path)}) ===")
        for i in range(min(C.CHARACTER_SLOT_COUNT, n_entries)):
            d = sl2.decrypt_slot(save, i)
            if sl2.is_empty(d):
                continue
            tables = sl2.find_gesture_tables(d)
            tag = f"{prof}/слот{i} {sl2.read_name(d)!r}"
            if not tables:
                print(f"  слот {i:2d}: {sl2.read_name(d)!r:<14} таблица НЕ НАЙДЕНА")
                missing.append(tag)
                continue
            off, n = tables[0]
            rows += 1
            anchors = sl2.anchor_offsets(d)
            parts = []
            for name, anc in anchors.items():
                if anc is None:
                    deltas[name]["—"].append(tag)
                    parts.append(f"{name}=—")
                else:
                    dl = off - anc
                    deltas[name][dl].append(tag)
                    parts.append(f"{name}={dl:+#x}")
            extra = f" (вхождений {len(tables)})" if len(tables) > 1 else ""
            print(f"  слот {i:2d}: {sl2.read_name(d)!r:<14} таблица 0x{off:X} "
                  f"записей {n}{extra}")
            print(f"          " + "  ".join(parts))

    print(f"\n\n=== ИТОГ по {rows} персонажам ===\n")
    if missing:
        print("Таблица не найдена в: " + ", ".join(missing) + "\n")

    print(f"{'якорь':<20} {'разных дельт':<14} вердикт")
    print("-" * 72)
    verdict = []
    for name in sl2.ANCHORS:
        groups = deltas[name]
        uniq = len(groups)
        if uniq == 1:
            only = next(iter(groups))
            text = (f"ГОДИТСЯ — дельта всегда {only:+#x}"
                    if isinstance(only, int) else "не резолвится нигде")
            if isinstance(only, int):
                verdict.append((name, only))
        else:
            sample = ", ".join(
                (f"{k:+#x}" if isinstance(k, int) else str(k)) + f"×{len(v)}"
                for k, v in sorted(groups.items(),
                                   key=lambda kv: -len(kv[1]))[:4])
            text = f"нет — плавает ({sample})"
        print(f"{name:<20} {uniq:<14} {text}")

    print()
    if verdict:
        print("Годные якоря:")
        for name, dl in verdict:
            print(f"  {name}: таблица = якорь {dl:+#x}")
        print("\nБери самый дешёвый из годных. Но даже с якорем оставляй проверку "
              "структуры записей — она и есть защита от чужих/правленых сейвов.")
    else:
        print("Ни один известный якорь не даёт постоянную дельту — "
              "искать таблицу только по сигнатуре (find_gesture_tables).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
