"""DS3 Appearance Sweeper — ищет, где в сейве лежат данные внешности персонажа.

Родня ds3-gesture-sweeper, но приём другой и куда дешевле. У жестов флаг —
один бит на запись, и его пришлось выделять изоляцией: 43 сейва по 9 МБ.
Внешность же лежит в памяти сплошными блоками (их границы задаёт скрипт
"Save / Restore Current FaceData" из DS3_TGA_v3.4.0.CT):

    misc = PGD+0x0AA,  body = PGD+0x3B0,  face = PGD+0x6B8

поэтому блок ищется в расшифрованном слоте просто ПОБАЙТОВЫМ СОВПАДЕНИЕМ с
памятью — ноль записей в игру, ноль сейвов. Записи нужны только чтобы доказать,
что найденное место действительно то самое (а не копия в runtime-хвосте).

Команды:
  python main.py --list                  слоты сейва
  python main.py --read                  значения внешности из памяти (без записи)
  python main.py --locate                найти блоки в текущем сейве (без записи)
  python main.py --sweep --out ./out     полный прогон с маркерами и проверкой
  python main.py --analyse-only --out ./out    пересобрать report.md по дампам
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time

import constants as C
import diff
import input_save as I
import memory
import preset
import sl2


# ===========================================================================
# Вспомогательное
# ===========================================================================

def default_save_path(profile: str | None) -> str:
    root = os.path.join(os.path.expanduser("~"), C.DEFAULT_SAVE_ROOT)
    if profile:
        return os.path.join(root, profile, C.DEFAULT_SAVE_NAME)
    if not os.path.isdir(root):
        raise SystemExit(f"Папка сейвов не найдена: {root}")
    cands = []
    for name in os.listdir(root):
        p = os.path.join(root, name, C.DEFAULT_SAVE_NAME)
        if os.path.isfile(p):
            cands.append((os.stat(p).st_mtime, p))
    if not cands:
        raise SystemExit(f"В {root} нет ни одного {C.DEFAULT_SAVE_NAME}")
    cands.sort()
    return cands[-1][1]  # самый свежий профиль


def backup_save(path: str, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, f"DS30000.backup.{int(time.time())}.sl2")
    shutil.copy2(path, dst)
    return dst


def dump_slot(save_path: str, slot: int, dst: str) -> bytes:
    data = sl2.decrypt_slot(sl2.load(save_path), slot)
    with open(dst, "wb") as f:
        f.write(data)
    return data


def do_save(save_path: str, args, first: list) -> bool:
    pre = args.pre_delay if first[0] else args.step_delay
    first[0] = False
    return I.save_via_esc(save_path, pre_delay=pre, gap=args.gap,
                          presses=args.presses, retries=args.retries,
                          retry_gap=args.retry_gap, timeout=args.timeout)


def detect_slot(save: bytes, face_mem: bytes) -> list:
    """Слоты, в которых нашёлся face-блок из памяти — это активный персонаж."""
    needle = sl2.needle_for("face", face_mem)
    out = []
    for i in range(min(C.CHARACTER_SLOT_COUNT, sl2.entry_count(save))):
        d = sl2.decrypt_slot(save, i)
        if sl2.is_empty(d):
            continue
        hits = sl2.find_all(d, needle)
        if hits:
            out.append((i, hits))
    return out


def print_fields(values: dict, title: str) -> None:
    print(f"\n{title} ({C.FIELD_COUNT} полей):")
    for group in C.GROUP_ORDER:
        print(f"\n  [{group}]")
        for off, kind, g, name, slug in C.FIELDS:
            if g != group or slug not in values:
                continue
            v = values[slug]
            shown = f"{v:.6g}" if kind == "f32" else f"{v:3d}  0x{v:02X}"
            print(f"    PGD+0x{off:03X} {name:<42} {shown}")


# ===========================================================================
# Команды
# ===========================================================================

def cmd_list(args) -> int:
    save_path = args.save or default_save_path(args.profile)
    print(f"Сейв: {save_path}\n")
    save = sl2.load(save_path)
    for i in range(min(C.CHARACTER_SLOT_COUNT, sl2.entry_count(save))):
        d = sl2.decrypt_slot(save, i)
        if sl2.is_empty(d):
            print(f"  слот {i:2d}: ПУСТО")
            continue
        print(f"  слот {i:2d}: {sl2.read_name(d)!r:<16} lvl {sl2.read_level(d):<4} "
              f"len 0x{len(d):X}")
    return 0


def cmd_read(args) -> int:
    mem = memory.DS3Memory()
    mem.attach()
    pgd = mem.resolve_pgd()
    print(f"GameDataMan var: {hex(mem.resolve_gamedataman_var())}")
    print(f"PlayerGameData:  {hex(pgd)}")
    for name, (start, size) in C.BLOCKS.items():
        print(f"  блок {name:<5} @ {hex(pgd + start)}  (PGD+0x{start:X}, {size} байт)")
    print_fields(mem.read_fields(), "Внешность в памяти")
    print("\nСырые блоки:")
    for name, data in mem.read_all_blocks().items():
        print(f"  {name}: {data.hex(' ')}")
    mem.close()
    return 0


def locate(save_path: str, blocks: dict, slot: int | None):
    """(слот, дамп слота, located, anchors) — где в сейве лежат блоки памяти."""
    save = sl2.load(save_path)
    if slot is None:
        found = detect_slot(save, blocks["face"])
        if not found:
            return None, None, None, None
        if len(found) > 1:
            print(f"  ВНИМАНИЕ: face-блок нашёлся в нескольких слотах: "
                  f"{[i for i, _ in found]} — беру первый")
        slot = found[0][0]
    d = sl2.decrypt_slot(save, slot)
    return slot, d, sl2.locate_blocks(d, blocks), sl2.anchor_offsets(d)


def cmd_locate(args) -> int:
    save_path = args.save or default_save_path(args.profile)
    mem = memory.DS3Memory()
    mem.attach()
    blocks = mem.read_all_blocks()
    mem_values = mem.read_fields()
    mem.close()

    print(f"Сейв: {save_path}")
    print("Блоки из памяти:")
    for name, data in blocks.items():
        print(f"  {name:<5} {len(data):3d} байт  {data[:16].hex(' ')}…")

    slot, d, located, anchors = locate(save_path, blocks, args.slot)
    if slot is None:
        print("\nface-блок не найден НИ В ОДНОМ слоте.")
        print("Обычно это значит, что сейв на диске старше памяти: внешность меняли")
        print("после последней записи. Нажми ESC x2 в игре (или запусти --sweep) и повтори.")
        return 1

    print(f"\nСлот {slot}: {sl2.read_name(d)!r} lvl {sl2.read_level(d)} len 0x{len(d):X}")
    print("\nНайденные блоки:")
    offsets = {}
    for name, info in located.items():
        hits = info["hits"]
        if not hits:
            print(f"  {name:<5} ({info['needle']} байт): НЕ НАЙДЕН")
            continue
        offsets[name] = hits[0]
        print(f"  {name:<5} ({info['needle']} байт): 0x{hits[0]:X}"
              + (f"  (всего вхождений {len(hits)}: "
                 + ", ".join(f'0x{h:X}' for h in hits[:6]) + ")" if len(hits) > 1 else ""))
        if name == "face":
            tail = sl2.face_tail_match(d, hits[0], blocks["face"])
            print(f"        хвост после {C.FACE_CT_SIZE}: совпало {tail} из "
                  f"{len(blocks['face']) - C.FACE_CT_SIZE}")
        for aname, a in anchors.items():
            rel = "—" if a is None else f"{hits[0] - a:+#x}"
            print(f"        {aname:<18} = {('—' if a is None else hex(a)):<10} дельта {rel}")

    save_values = sl2.read_fields_from_slot(d, offsets)
    bad = [s for s in mem_values if s in save_values and save_values[s] != mem_values[s]]
    print(f"\nСверка значений память ↔ сейв: совпало "
          f"{len(save_values) - len(bad)} из {len(save_values)}")
    for slug in bad:
        f = C.FIELD_BY_SLUG[slug]
        print(f"  {f[3]:<42} память {mem_values[slug]}  сейв {save_values[slug]}")
    if args.values:
        print_fields(save_values, "Внешность из сейва")
    return 0


def cmd_sweep(args) -> int:
    save_path = args.save or default_save_path(args.profile)
    if not os.path.isfile(save_path):
        print(f"Сейв не найден: {save_path}")
        return 1
    os.makedirs(args.out, exist_ok=True)

    mem = memory.DS3Memory()
    mem.attach()
    pgd = mem.resolve_pgd()
    original = mem.read_all_blocks()
    original_values = mem.read_fields()
    print(f"PlayerGameData:  {hex(pgd)}")
    print(f"Сейв:            {save_path}")
    print(f"Дампы:           {os.path.abspath(args.out)}")

    bak = backup_save(save_path, args.out)
    print(f"Бэкап сейва:     {bak}")
    with open(os.path.join(args.out, "original_blocks.json"), "w", encoding="utf-8") as f:
        json.dump({k: v.hex() for k, v in original.items()}, f, indent=2)
    print("Исходные блоки сохранены в original_blocks.json "
          "(если прогон оборвётся — восстановишь из них)")

    print("\nИгру держи в окне/borderless и НЕ трогай мышь/клавиатуру во время прогона.")
    first = [True]

    # --- 1. before: сейв текущего состояния --------------------------------
    print("\n=== before: сейв как есть ===")
    if not do_save(save_path, args, first):
        print("  Сейв не записался — прогон бессмысленен, выхожу.")
        mem.close()
        return 1
    slot, before, located_before, _anchors = locate(save_path, original, args.slot)
    if slot is None:
        print("  face-блок не найден ни в одном слоте даже после сейва.")
        print("  Проверь, что персонаж загружен в мир, а сейв — тот самый профиль.")
        mem.close()
        return 1
    with open(os.path.join(args.out, diff.BEFORE_NAME), "wb") as f:
        f.write(before)
    print(f"  слот {slot}: {sl2.read_name(before)!r} lvl {sl2.read_level(before)}")
    for name, info in located_before.items():
        hits = info["hits"]
        print(f"  {name:<5}: " + (f"0x{hits[0]:X} (вхождений {len(hits)})"
                                  if hits else "НЕ НАЙДЕН"))

    # --- 2. marker: пишем маркеры и сохраняемся ----------------------------
    print("\n=== marker: пишем маркерные значения ===")
    skipped = C.FIELD_COUNT - len(C.POKEABLE_FIELDS)
    print(f"  трогаем {len(C.POKEABLE_FIELDS)} полей-ползунков; пропускаем {skipped} "
          "ID/runtime-полей (произвольный ID модели роняет игру)")
    marker_blocks = mem.make_marker_blocks(args.salt)
    expected = mem.expected_marker_values(args.salt)
    mem.write_all_blocks(marker_blocks)
    readback = mem.read_fields()
    stuck = [s for s in expected if readback[s] != expected[s]]
    if stuck:
        print(f"  ВНИМАНИЕ: {len(stuck)} полей не приняли запись в памяти "
              "(игра их перетирает?):")
        for slug in stuck[:10]:
            f = C.FIELD_BY_SLUG[slug]
            print(f"    {f[3]:<42} ждали {expected[slug]} получили {readback[slug]}")
    ok_save = do_save(save_path, args, first)
    marker = dump_slot(save_path, slot, os.path.join(args.out, diff.MARKER_NAME))
    print(f"  сейв записан: {ok_save}")

    located_marker = sl2.locate_blocks(marker, marker_blocks)
    anchors = sl2.anchor_offsets(marker)
    offsets = {n: i["hits"][0] for n, i in located_marker.items() if i["hits"]}
    for name, info in located_marker.items():
        hits = info["hits"]
        print(f"  {name:<5}: " + (f"0x{hits[0]:X} (вхождений {len(hits)})"
                                  if hits else "НЕ НАЙДЕН"))
    face_tail = (sl2.face_tail_match(marker, offsets["face"], marker_blocks["face"])
                 if "face" in offsets else 0)
    marker_in_save = sl2.read_fields_from_slot(marker, offsets)
    good = sum(1 for s in expected if marker_in_save.get(s) == expected[s])
    print(f"  маркеров доехало до сейва: {good} из {len(expected)}")

    # --- 3. восстановление --------------------------------------------------
    restored_ok = None
    if args.restore:
        print("\n=== восстановление исходной внешности ===")
        mem.write_all_blocks(original)
        back = mem.read_fields()
        mem_ok = all(back[s] == original_values[s] for s in original_values)
        ok_save = do_save(save_path, args, first)
        restored = dump_slot(save_path, slot,
                             os.path.join(args.out, diff.RESTORED_NAME))
        restored_ok = all(
            restored[offsets[n]:offsets[n] + C.BLOCKS[n][1]]
            == before[offsets[n]:offsets[n] + C.BLOCKS[n][1]]
            for n in offsets
        )
        print(f"  память вернулась: {mem_ok};  сейв записан: {ok_save};  "
              f"блоки в файле совпали с before: {restored_ok}")
        if not (mem_ok and restored_ok):
            print(f"  ВНИМАНИЕ: восстановить не удалось — исходный сейв лежит в "
                  f"{os.path.basename(bak)}, блоки в original_blocks.json")
    else:
        print("\n--no-restore: маркерная внешность осталась в игре")

    meta = {
        "save": save_path,
        "slot": slot,
        "name": sl2.read_name(before),
        "level": sl2.read_level(before),
        "salt": args.salt,
        "located": located_marker,
        "located_before": located_before,
        "anchors": anchors,
        "face_tail_match": face_tail,
        "expected_marker": expected,
        "marker_in_save": marker_in_save,
        "stuck_fields": stuck,
        "restored_ok": restored_ok,
    }
    with open(os.path.join(args.out, diff.META_NAME), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    mem.close()
    return 0


def cmd_watch_ids(args) -> int:
    """Собрать список допустимых ID моделей, пока их листают в игре.

    Валидные значения причёсок/бород/бровей/зрачков нигде не задокументированы —
    в игре они безымянные, а угадывать нельзя: неверный ID роняет игру. Зато их
    можно просто подсмотреть: открываешь в игре смену внешности (Розария) и
    листаешь вариант за вариантом, а мы читаем поле и копим всё, что увидели.

    Только чтение, в игру ничего не пишется.
    """
    import time as _time

    id_fields = [(off, C.FIELD_BY_OFFSET[off][3]) for off in sorted(C.ID_FIELDS)
                 if off in C.FIELD_BY_OFFSET and C.block_of(off)[0] == "face"]
    mem = memory.DS3Memory()
    mem.attach()

    seen = {off: {} for off, _ in id_fields}
    order = {off: [] for off, _ in id_fields}
    print(f"Слушаю {len(id_fields)} ID-полей {args.seconds:.0f} сек "
          f"(опрос каждые {args.poll * 1000:.0f} мс).")
    print("Открой в игре смену внешности и пролистай варианты — каждый увиденный "
          "ID запомнится.\nCtrl+C — закончить раньше.\n")

    deadline = _time.time() + args.seconds
    prev_face = None
    touched = set()          # какие байты блока вообще шевелились
    try:
        while _time.time() < deadline:
            face = mem.read_block("face")
            for off, name in id_fields:
                boff = off - C.BLOCKS["face"][0]
                v = int.from_bytes(face[boff:boff + 4], "little")
                if v not in seen[off]:
                    seen[off][v] = 0
                    order[off].append(v)
                    print(f"  {name:<24} новое значение {v}")
                seen[off][v] += 1
            if prev_face is not None:
                for k in range(len(face)):
                    if face[k] != prev_face[k]:
                        touched.add(k)
            prev_face = face
            _time.sleep(args.poll)
    except KeyboardInterrupt:
        print("\n  прервано")

    if touched:
        runs = []
        for k in sorted(touched):
            if runs and k == runs[-1][0] + runs[-1][1]:
                runs[-1][1] += 1
            else:
                runs.append([k, 1])
        print("\nШевелились байты блока (офсет в блоке +длина): "
              + ", ".join(f"0x{s:02X}+{n}" for s, n in runs))
    else:
        print("\nНи один байт face-блока не менялся за всё время.")
        print("Значит меню внешности рисует превью не здесь — листание в нём "
              "PlayerGameData не трогает,\nи ID придётся ловить иначе "
              "(подтверждать выбор, либо искать буфер превью).")

    mem.close()
    print("\nУвидено значений:")
    out = {}
    for off, name in id_fields:
        vals = sorted(seen[off])
        out[f"0x{off:X}"] = {"name": name, "values": vals,
                             "first_seen_order": order[off]}
        print(f"  {name:<24} ({len(vals)}): {vals}")

    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, "observed_ids.json")
    prev = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            prev = json.load(f)
        for key, rec in prev.items():        # копим между запусками
            if key in out:
                merged = sorted(set(out[key]["values"]) | set(rec.get("values", [])))
                out[key]["values"] = merged
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"\nЗаписано: {os.path.abspath(path)}"
          + (" (объединено с прошлым запуском)" if prev else ""))
    return 0


def cmd_watch_region(args) -> int:
    """Показать, какой байт PlayerGameData меняется, пока крутят настройку в игре.

    Нужен для полей, которых нет в таблице CT: возраст лица, мускулистость,
    волосы на груди, голос. Приём тот же, что у --watch-ids, только смотрим не
    девять известных полей, а целый кусок PGD, и в конце печатаем все офсеты,
    которые за время наблюдения хоть раз изменились, с набором значений.

    Гоняй по одной настройке за запуск: покрутил только возраст — в отчёте
    останется офсет возраста. Только чтение.
    """
    import time as _time

    mem = memory.DS3Memory()
    mem.attach()
    pgd = mem.resolve_pgd()
    start, size = args.region_start, args.region_size

    print(f"PlayerGameData: {hex(pgd)}")
    print(f"Слушаю PGD+0x{start:X}..+0x{start + size:X} ({size} байт) "
          f"{args.seconds:.0f} сек, опрос {args.poll * 1000:.0f} мс.")
    print(f"Крути в игре ОДНУ настройку{' — ' + args.label if args.label else ''}. "
          "Ctrl+C — закончить раньше.\n")

    seen: dict[int, dict[int, int]] = {}
    prev = None
    deadline = _time.time() + args.seconds
    try:
        while _time.time() < deadline:
            buf = mem.pm.read_bytes(pgd + start, size)
            if prev is not None:
                for k in range(size):
                    if buf[k] != prev[k]:
                        bucket = seen.setdefault(k, {})
                        fresh = buf[k] not in bucket
                        if fresh:
                            bucket[buf[k]] = 0
                            bucket.setdefault(prev[k], 0)
                        if fresh or args.all_changes:
                            print(f"  PGD+0x{start + k:03X}: {prev[k]} -> {buf[k]}")
                        bucket[buf[k]] += 1
            prev = buf
            _time.sleep(args.poll)
    except KeyboardInterrupt:
        print("\n  прервано")
    mem.close()

    if not seen:
        print("\nНичего не менялось.")
        return 0

    print(f"\nШевелились {len(seen)} байт:")
    out = {}
    for k in sorted(seen):
        off = start + k
        vals = sorted(seen[k])
        known = C.FIELD_BY_OFFSET.get(off)
        note = f"  <- {known[3]}" if known else ""
        block, boff = C.block_of(off)
        where = f" [{block}+0x{boff:02X}]" if block else ""
        print(f"  PGD+0x{off:03X}{where} значений {len(vals)}: {vals}{note}")
        out[f"0x{off:X}"] = {"values": vals, "block": block, "in_block": boff,
                             "known": known[3] if known else None}

    os.makedirs(args.out, exist_ok=True)
    name = f"region_{args.label}.json" if args.label else "region.json"
    path = os.path.join(args.out, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump({"label": args.label, "start": start, "size": size, "bytes": out},
                  f, indent=2, ensure_ascii=False)
    print(f"\nЗаписано: {os.path.abspath(path)}")
    return 0


def cmd_show_presets(args) -> int:
    """Шесть слотов пресетов внешности как они лежат в файле."""
    save_path = args.save or default_save_path(args.profile)
    presets = sl2.read_presets(sl2.decrypt_slot(sl2.load(save_path), 10))
    print(f"Сейв: {save_path}\n")
    for p in presets:
        print(f"  [{p['index']}] @0x{p['offset']:X}  {sl2.describe_preset(p)}")
    return 0


def cmd_watch_presets(args) -> int:
    """Следить за пресетами внешности в файле сейва, пока их правят в игре.

    Пресеты — фича самой игры: шесть записей в системном энтри. Записываются они
    на диск только когда игра сохраняется, поэтому смотрим не в память, а в файл:
    ждём смены mtime, расшифровываем энтри 10 и показываем, что стало с каждым
    из шести слотов и какие байты внутри записи поехали.

    Только чтение. Каждый снимок кладётся в JSON, чтобы потом разобрать.
    """
    import time as _time

    save_path = args.save or default_save_path(args.profile)
    os.makedirs(args.out, exist_ok=True)
    print(f"Сейв: {save_path}")
    print(f"Слежу {args.seconds:.0f} сек. Удаляй и добавляй пресеты в игре — "
          "снимок берётся на каждую запись сейва.\nCtrl+C — закончить раньше.\n")

    def snapshot():
        return sl2.read_presets(sl2.decrypt_slot(sl2.load(save_path), 10))

    prev = snapshot()
    history = [{"t": 0.0, "presets": [
        {"index": p["index"], "raw": p["raw"].hex(), "desc": sl2.describe_preset(p)}
        for p in prev]}]
    print("исходное состояние:")
    for p in prev:
        print(f"  [{p['index']}] {sl2.describe_preset(p)}")

    started = _time.time()
    mtime = os.stat(save_path).st_mtime
    try:
        while _time.time() - started < args.seconds:
            _time.sleep(0.4)
            try:
                m = os.stat(save_path).st_mtime
            except FileNotFoundError:
                continue
            if m == mtime:
                continue
            mtime = m
            _time.sleep(0.4)                     # дать записи докатиться
            cur = snapshot()
            stamp = _time.time() - started
            print(f"\n--- сейв записан, {stamp:.0f} c ---")
            for old, new in zip(prev, cur):
                if old["raw"] == new["raw"]:
                    continue
                k = new["index"]
                if old["empty"] and not new["empty"]:
                    print(f"  [{k}] ПОЯВИЛСЯ: {sl2.describe_preset(new)}")
                elif new["empty"] and not old["empty"]:
                    print(f"  [{k}] УДАЛЁН (обнулён)")
                else:
                    diff = [i for i in range(len(old["raw"]))
                            if old["raw"][i] != new["raw"][i]]
                    runs = []
                    for i in diff:
                        if runs and i == runs[-1][0] + runs[-1][1]:
                            runs[-1][1] += 1
                        else:
                            runs.append([i, 1])
                    where = ", ".join(f"+0x{s:03X}+{n}" for s, n in runs[:12])
                    print(f"  [{k}] изменён, {len(diff)} байт: {where}")
                    print(f"        было:  {sl2.describe_preset(old)}")
                    print(f"        стало: {sl2.describe_preset(new)}")
            history.append({"t": stamp, "presets": [
                {"index": p["index"], "raw": p["raw"].hex(),
                 "desc": sl2.describe_preset(p)} for p in cur]})
            prev = cur
    except KeyboardInterrupt:
        print("\n  прервано")

    path = os.path.join(args.out, "presets_history.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)
    print(f"\nСнимков: {len(history)}. Записано: {os.path.abspath(path)}")
    return 0


def cmd_export_preset(args) -> int:
    mem = memory.DS3Memory()
    mem.attach()
    blocks = mem.read_all_blocks()
    mem.close()
    data = preset.from_blocks(blocks)
    path = args.export_preset
    if not path.endswith(preset.EXTENSION):
        path += preset.EXTENSION
    with open(path, "wb") as f:
        f.write(data)
    print(f"Записано {len(data)} байт: {os.path.abspath(path)}")
    print(preset.describe(preset.unpack(data)))
    return 0


def cmd_import_preset(args) -> int:
    with open(args.import_preset, "rb") as f:
        data = f.read()
    try:
        p = preset.unpack(data)
    except preset.PresetError as exc:
        print(f"Пресет не читается: {exc}")
        return 1
    print(preset.describe(p))

    mem = memory.DS3Memory()
    mem.attach()
    mem.write_block("face", p["face"])
    misc = bytearray(mem.read_block("misc"))
    misc[0x0AB - C.BLOCKS["misc"][0]] = p["voice"]
    if args.with_gender:
        misc[0x0AA - C.BLOCKS["misc"][0]] = p["gender"]
    mem.write_block("misc", bytes(misc))
    mem.close()
    print("Записано в память. Смена пола без перезагрузки персонажа "
          "может не примениться — по умолчанию gender не трогается "
          "(--with-gender включает)." if not args.with_gender
          else "Записано в память вместе с полом; перезагрузи персонажа.")
    print("Чтобы это попало в файл — сохранись в игре (ESC x2).")
    return 0


def cmd_per_field(args) -> int:
    """Изолирующий прогон, как в gesture-sweeper: одно поле за один сейв.

    Дороже маркерного (по сейву на поле), зато каждый дамп отличается от baseline
    ровно одним полем — если маркерный прогон дал неоднозначность, разрешает её.
    """
    save_path = args.save or default_save_path(args.profile)
    if not os.path.isfile(save_path):
        print(f"Сейв не найден: {save_path}")
        return 1
    out_dir = os.path.join(args.out, "per_field")
    os.makedirs(out_dir, exist_ok=True)

    mem = memory.DS3Memory()
    mem.attach()
    original = mem.read_all_blocks()
    original_values = mem.read_fields()

    targets = C.POKEABLE_SLUGS
    if args.only:
        want = [t.strip() for t in args.only.split(",") if t.strip()]
        bad = [t for t in want if t not in C.POKEABLE_SLUGS]
        if bad:
            print(f"Неизвестные или запрещённые к записи поля: {bad}")
            mem.close()
            return 1
        targets = want

    bak = backup_save(save_path, out_dir)
    with open(os.path.join(out_dir, "original_blocks.json"), "w", encoding="utf-8") as f:
        json.dump({k: v.hex() for k, v in original.items()}, f, indent=2)
    print(f"Сейв:   {save_path}")
    print(f"Бэкап:  {bak}")
    print(f"Полей:  {len(targets)} (пропущено как ID/runtime: "
          f"{C.FIELD_COUNT - len(C.POKEABLE_FIELDS)})")
    print(f"Сейвов: {len(targets) + 2}")
    print("\nИгру держи в окне/borderless и НЕ трогай мышь/клавиатуру во время прогона.")

    first = [True]

    # --- baseline ----------------------------------------------------------
    print("\n=== baseline: внешность как есть ===")
    if not do_save(save_path, args, first):
        print("  Сейв не записался, выхожу.")
        mem.close()
        return 1
    slot, baseline, located, _a = locate(save_path, original, args.slot)
    if slot is None:
        print("  face-блок не найден ни в одном слоте — прогон невозможен.")
        mem.close()
        return 1
    with open(os.path.join(out_dir, "pf_baseline.bin"), "wb") as f:
        f.write(baseline)
    offsets = {n: i["hits"][0] for n, i in located.items() if i["hits"]}
    print(f"  слот {slot}, блоки: "
          + ", ".join(f"{n}=0x{o:X}" for n, o in offsets.items()))

    # --- по одному полю ----------------------------------------------------
    print("\n=== по одному полю ===")
    rows = []
    for idx, slug in enumerate(targets):
        off, kind, _g, name, _s = C.FIELD_BY_SLUG[slug]
        value = mem.set_single_marker(slug, args.salt)
        readback = mem.read_field(slug)
        saved = do_save(save_path, args, first)
        dst = os.path.join(out_dir, f"pf{idx:03d}_{slug}.bin")
        dump = dump_slot(save_path, slot, dst)
        mem.write_field(slug, original_values[slug])   # вернуть сразу же

        changed = [i for i in range(min(len(baseline), len(dump)))
                   if baseline[i] != dump[i]]
        expect = offsets.get(C.block_of(off)[0])
        expect = None if expect is None else expect + C.block_of(off)[1]
        hit = expect is not None and expect in changed
        rows.append({
            "slug": slug, "name": name, "pgd": off, "value": value,
            "readback": readback, "saved": saved, "expected_offset": expect,
            "changed": len(changed), "hit": hit, "dump": os.path.basename(dst),
        })
        mark = "OK" if hit else "МИМО"
        print(f"  [{idx:3d}] {name:<42} ={value:<4d} saved={str(saved):<5} "
              f"изменилось байт {len(changed):<4d} {mark}")

    # --- восстановление ----------------------------------------------------
    print("\n=== восстановление ===")
    mem.write_all_blocks(original)
    ok_save = do_save(save_path, args, first)
    restored = dump_slot(save_path, slot, os.path.join(out_dir, "pf_restored.bin"))
    same = all(restored[offsets[n]:offsets[n] + C.BLOCKS[n][1]]
               == baseline[offsets[n]:offsets[n] + C.BLOCKS[n][1]] for n in offsets)
    print(f"  сейв записан: {ok_save};  блоки совпали с baseline: {same}")

    meta = {"save": save_path, "slot": slot, "offsets": offsets,
            "salt": args.salt, "rows": rows, "restored_ok": same}
    with open(os.path.join(out_dir, "per_field.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    good = sum(1 for r in rows if r["hit"])
    print(f"\nПопаданий в ожидаемый офсет: {good} из {len(rows)}")
    mem.close()
    return 0


# ===========================================================================
# CLI
# ===========================================================================

def main() -> int:
    C.use_utf8_stdout()
    p = argparse.ArgumentParser(
        description="DS3 Appearance Sweeper — поиск данных внешности в .sl2")
    p.add_argument("--save", default=None,
                   help="путь к DS30000.sl2 (по умолчанию — самый свежий профиль)")
    p.add_argument("--profile", default=None,
                   help="Steam-профиль (папка в AppData/Roaming/DarkSoulsIII)")
    p.add_argument("--slot", type=int, default=None,
                   help="номер слота (0..9); по умолчанию определяется по совпадению "
                        "face-блока с памятью")
    p.add_argument("--out", default="./out", help="папка для дампов и отчётов")
    p.add_argument("--salt", type=int, default=0, help="соль маркеров (второй прогон)")
    p.add_argument("--values", action="store_true",
                   help="--locate: распечатать значения полей из сейва")
    # режимы
    p.add_argument("--list", action="store_true", help="показать слоты сейва")
    p.add_argument("--read", action="store_true",
                   help="прочитать внешность из памяти (без записи, без сейва)")
    p.add_argument("--locate", action="store_true",
                   help="найти блоки внешности в текущем сейве (без записи)")
    p.add_argument("--sweep", action="store_true", help="полный прогон с маркерами")
    p.add_argument("--watch-ids", dest="watch_ids", action="store_true",
                   help="слушать ID-поля, пока их листают в игре (только чтение)")
    p.add_argument("--seconds", type=float, default=120.0,
                   help="--watch-ids: сколько слушать")
    p.add_argument("--poll", type=float, default=0.05,
                   help="--watch-ids: интервал опроса, сек")
    p.add_argument("--watch-presets", dest="watch_presets", action="store_true",
                   help="следить за пресетами внешности в файле сейва")
    p.add_argument("--presets", dest="show_presets", action="store_true",
                   help="показать шесть слотов пресетов и выйти")
    p.add_argument("--watch-region", dest="watch_region", action="store_true",
                   help="слушать кусок PGD целиком и показать, какой байт меняется")
    p.add_argument("--region-start", type=lambda v: int(v, 0), default=0x0,
                   help="--watch-region: начало от PGD (по умолчанию 0)")
    p.add_argument("--region-size", type=lambda v: int(v, 0), default=0x800,
                   help="--watch-region: сколько байт")
    p.add_argument("--all-changes", dest="all_changes", action="store_true",
                   help="--watch-region: печатать каждый переход, а не только новые значения")
    p.add_argument("--label", default=None,
                   help="--watch-region: имя захвата для файла отчёта")
    p.add_argument("--export-preset", default=None,
                   help="сохранить текущую внешность в .ds3chr")
    p.add_argument("--import-preset", default=None,
                   help="загрузить .ds3chr в память игры")
    p.add_argument("--with-gender", action="store_true",
                   help="--import-preset: писать также пол (нужна перезагрузка персонажа)")
    p.add_argument("--per-field", dest="per_field", action="store_true",
                   help="изолирующий прогон: одно поле = один сейв (как в gesture-sweeper)")
    p.add_argument("--only", default=None,
                   help="--per-field: список слагов полей через запятую")
    p.add_argument("--analyse-only", action="store_true",
                   help="не трогать игру, только пересобрать report.md")
    p.add_argument("--no-restore", dest="restore", action="store_false",
                   help="не возвращать исходную внешность в конце")
    # тайминги (как в gesture-sweeper)
    p.add_argument("--pre-delay", type=float, default=10.0,
                   help="пауза перед самым первым ESC (успеть развернуть игру)")
    p.add_argument("--step-delay", type=float, default=0.5,
                   help="пауза перед ESC на последующих шагах")
    p.add_argument("--gap", type=float, default=0.5, help="пауза между ESC")
    p.add_argument("--presses", type=int, default=2, help="сколько ESC за попытку")
    p.add_argument("--retries", type=int, default=3, help="повторов при неудаче")
    p.add_argument("--retry-gap", type=float, default=1.0, help="интервал ESC при повторе")
    p.add_argument("--timeout", type=float, default=20.0,
                   help="ожидание записи сейва, сек (файл ~9 МБ)")
    args = p.parse_args()

    if args.list:
        return cmd_list(args)
    if args.read:
        return cmd_read(args)
    if args.locate:
        return cmd_locate(args)
    if args.show_presets:
        return cmd_show_presets(args)
    if args.watch_presets:
        return cmd_watch_presets(args)
    if args.watch_ids:
        return cmd_watch_ids(args)
    if args.watch_region:
        return cmd_watch_region(args)
    if args.export_preset:
        return cmd_export_preset(args)
    if args.import_preset:
        return cmd_import_preset(args)
    if args.per_field:
        return cmd_per_field(args)

    if args.sweep:
        rc = cmd_sweep(args)
        if rc != 0:
            return rc
    elif not args.analyse_only:
        p.print_help()
        return 0

    print("\n=== анализ дампов ===\n")
    text = diff.report(args.out)
    with open(os.path.join(args.out, "report.md"), "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(text)
    print(f"\nОтчёт: {os.path.abspath(os.path.join(args.out, 'report.md'))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
