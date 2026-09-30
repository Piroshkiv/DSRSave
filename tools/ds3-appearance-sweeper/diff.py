"""Анализ дампов сейва DS3: где в слоте лежат данные внешности.

Вход — папка с дампами от main.py:
    before.bin          снят до записи маркеров
    marker.bin          снят после записи маркеров в память
    after_restore.bin   снят после возврата исходных значений

Логика проще, чем у gesture-sweeper: там искали отдельные биты, здесь блок ищется
целиком по совпадению с памятью, а дампы нужны, чтобы доказать три вещи:

  1. блок в сейве действительно меняется от записи в память (значит это он, а не
     копия/мусор);
  2. меняется РОВНО он — все прочие отличия before↔marker перечислены отдельно
     и должны быть объяснимым шумом (таймер, позиция, счётчики);
  3. после возврата значений слот снова совпадает с before по этому блоку.

Запуск отдельно:  python diff.py ./out
"""

from __future__ import annotations

import json
import os
import sys

import constants as C

BEFORE_NAME = "before.bin"
MARKER_NAME = "marker.bin"
RESTORED_NAME = "after_restore.bin"
META_NAME = "run.json"


def _load(path: str):
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return f.read()


def diff_bytes(a: bytes, b: bytes) -> list:
    """[(offset, old, new)] по всем различающимся байтам."""
    out = []
    n = min(len(a), len(b))
    for i in range(n):
        if a[i] != b[i]:
            out.append((i, a[i], b[i]))
    return out


def group_runs(offsets: list) -> list:
    """[(start, length)] — слить соседние офсеты в диапазоны."""
    runs = []
    for off in offsets:
        if runs and off == runs[-1][0] + runs[-1][1]:
            runs[-1][1] += 1
        else:
            runs.append([off, 1])
    return [(s, n) for s, n in runs]


def report(out_dir: str) -> str:
    meta_path = os.path.join(out_dir, META_NAME)
    if not os.path.exists(meta_path):
        raise SystemExit(f"Нет {META_NAME} в {out_dir} — прогон не делался?")
    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)

    before = _load(os.path.join(out_dir, BEFORE_NAME))
    marker = _load(os.path.join(out_dir, MARKER_NAME))
    restored = _load(os.path.join(out_dir, RESTORED_NAME))
    if before is None or marker is None:
        raise SystemExit("Нужны как минимум before.bin и marker.bin")

    lines = []
    add = lines.append
    add("# DS3 Appearance Sweeper — отчёт")
    add("")
    add(f"- сейв: `{meta.get('save')}`")
    add(f"- слот: {meta.get('slot')} (`{meta.get('name')}`, lvl {meta.get('level')})")
    add(f"- размер слота: 0x{len(before):X}")
    add("")

    # --- 1. где нашлись блоки ------------------------------------------------
    add("## Блоки внешности в слоте")
    add("")
    add("| блок | PGD | длина | офсет в слоте | вхождений |")
    add("|---|---|---|---|---|")
    offsets = {}
    for name, info in meta["located"].items():
        hits = info["hits"]
        start, size = C.BLOCKS[name]
        first = f"0x{hits[0]:X}" if hits else "не найден"
        if hits:
            offsets[name] = hits[0]
        add(f"| {name} | +0x{start:X} | {info['needle']} | {first} | {len(hits)} |")
    add("")
    if "face_tail_match" in meta:
        add(f"Хвост face-блока после CT-шных {C.FACE_CT_SIZE} байт: совпало "
            f"{meta['face_tail_match']} из {C.BLOCKS['face'][1] - C.FACE_CT_SIZE}.")
        add("")

    # --- 2. дельты от якорей -------------------------------------------------
    add("## Дельты от якорей")
    add("")
    add("| блок | " + " | ".join(meta["anchors"].keys()) + " |")
    add("|---" * (len(meta["anchors"]) + 1) + "|")
    for name, off in offsets.items():
        cells = []
        for a in meta["anchors"].values():
            cells.append("—" if a is None else f"{off - a:+#x}")
        add(f"| {name} | " + " | ".join(cells) + " |")
    add("")

    # --- 3. дифф before -> marker -------------------------------------------
    d = diff_bytes(before, marker)
    changed = [o for o, _a, _b in d]
    in_blocks = []
    outside = []
    for off in changed:
        for name, base in offsets.items():
            size = C.BLOCKS[name][1]
            if base <= off < base + size:
                in_blocks.append((name, off - base, off))
                break
        else:
            outside.append(off)

    add("## Дифф before → marker")
    add("")
    add(f"- изменившихся байт всего: **{len(changed)}**")
    add(f"- из них внутри найденных блоков: **{len(in_blocks)}**")
    add(f"- вне блоков (шум): **{len(outside)}**")
    add("")

    expected = meta["expected_marker"]
    got = meta["marker_in_save"]
    ok = [s for s in expected if s in got and got[s] == expected[s]]
    bad = [s for s in expected if s not in got or got[s] != expected[s]]
    add(f"Полей, чьё маркерное значение доехало до сейва: **{len(ok)} из "
        f"{len(expected)}**")
    if bad:
        add("")
        add("Не совпали:")
        add("")
        add("| поле | PGD | ждали | в сейве |")
        add("|---|---|---|---|")
        for slug in bad:
            f = C.FIELD_BY_SLUG[slug]
            add(f"| {f[3]} | +0x{f[0]:X} | {expected[slug]} | {got.get(slug, '—')} |")
    add("")

    if outside:
        add("### Шум вне блоков")
        add("")
        runs = group_runs(sorted(outside))
        add(f"{len(runs)} диапазонов:")
        add("")
        for s, n in runs[:40]:
            add(f"- `0x{s:X}` +{n}")
        if len(runs) > 40:
            add(f"- … ещё {len(runs) - 40}")
        add("")

    # --- 4. восстановление ---------------------------------------------------
    add("## Восстановление")
    add("")
    if restored is None:
        add("Дампа after_restore.bin нет (прогон с --no-restore).")
    else:
        same = True
        for name, base in offsets.items():
            size = C.BLOCKS[name][1]
            if before[base:base + size] != restored[base:base + size]:
                same = False
                add(f"- блок **{name}** НЕ совпал с before")
        if same:
            add("- все блоки внешности совпали с `before` побайтово — исходный вид вернулся")
        rd = diff_bytes(before, restored)
        add(f"- всего отличий before ↔ after_restore: {len(rd)} байт (остальное — шум)")
    add("")

    return "\n".join(lines)


def _main() -> None:
    C.use_utf8_stdout()
    out_dir = sys.argv[1] if len(sys.argv) > 1 else "./out"
    text = report(out_dir)
    with open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(text)


if __name__ == "__main__":
    _main()
