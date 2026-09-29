"""DS1 Appearance Sweeper — внешность DSR: память ↔ сейв ↔ .dsrchr.

Тот же приём, что у ds1-gesture-sweeper: правим PlayerGameData в памяти игры,
заставляем её сохраниться (ESC x2) и диффим расшифрованные слоты. Плюс режимы
без записи в игру — сверка памяти с сейвом и слежение за изменениями.

Только чтение:
  python main.py --list                      слоты сейва
  python main.py --read                      поля внешности: память vs сейв
  python main.py --locate                    какие куски PGD где лежат в слоте
  python main.py --watch --seconds 120       что меняется в памяти и в сейве
  python main.py --diff a.bin b.bin          дифф двух дампов (слотов или PGD)
  python main.py --check-dsrchr              .dsrchr из памяти (как мод) vs из сейва
  python main.py --export-dsrchr me.dsrchr   экспорт как у мода (из памяти)
  python main.py --save-dsrchr me.dsrchr     экспорт как у редактора (из сейва)

Пишут в игру (гоняй на тестовом персонаже, бэкап сейва кладётся в --out):
  python main.py --import-dsrchr me.dsrchr   импорт как у мода (в память)
  python main.py --probe hair_id --value 3200    одно поле -> сейв -> дифф -> откат
  python main.py --sweep                     маркеры во все поля .dsrchr -> проверка
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time

import constants as C
import dsrchr
import input_save as I
import memory
import sl2


# ===========================================================================
# Сейв и слоты
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


def save_path_of(args) -> str:
    path = args.save or default_save_path(args.profile)
    if not os.path.isfile(path):
        raise SystemExit(f"Сейв не найден: {path}")
    return path


def backup_save(path: str, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, f"DRAKS0005.backup.{int(time.time())}.sl2")
    shutil.copy2(path, dst)
    return dst


def char_slots(save: bytes) -> dict:
    """{номер: расшифрованный слот} по непустым слотам персонажей 0..9."""
    out = {}
    for i in range(C.USER_DATA_FILE_COUNT - 1):
        data = sl2.decrypt_slot(save, i)
        if not sl2.is_empty(data):
            out[i] = data
    return out


def match_slot(save: bytes, mem) -> list:
    """Слоты, где лежит персонаж из памяти: совпали имя и блок лица.

    При дефолтном пресете лицо одинаково у нескольких персонажей, поэтому
    сверяем ещё и имя. Всё равно может выйти несколько — тогда нужен --slot.
    """
    name = mem.read_name()
    face_off = C.FIELD_BY_SLUG["face_data"]
    face = mem.read_pgd(face_off[1], 50)
    hits = []
    for i, data in char_slots(save).items():
        if sl2.read_name(data) == name and data[face_off[2]:face_off[2] + 50] == face:
            hits.append(i)
    return hits


def resolve_slot(args, save: bytes, mem) -> int:
    if args.slot >= 0:
        return args.slot
    hits = match_slot(save, mem)
    if len(hits) == 1:
        print(f"Слот определён по имени и лицу: {hits[0]}")
        return hits[0]
    raise SystemExit(
        f"Не удалось однозначно найти персонажа из памяти в сейве (кандидаты: {hits}). "
        "Сохранись в игре (ESC x2) или укажи --slot."
    )


# ===========================================================================
# Дифф и карта PGD -> слот
# ===========================================================================

def diff_runs(a: bytes, b: bytes, skip: int = 0) -> list:
    """[(start, length)] отличающихся диапазонов (соседние байты сливаются)."""
    runs = []
    for i in range(skip, min(len(a), len(b))):
        if a[i] != b[i]:
            if runs and runs[-1][0] + runs[-1][1] == i:
                runs[-1][1] += 1
            else:
                runs.append([i, 1])
    return [(s, n) for s, n in runs]


def locate(pgd: bytes, slot: bytes, win: int = 16, step: int = 4) -> list:
    """Где куски PGD лежат в слоте. [(pgd_start, pgd_end, delta)], delta = слот - PGD.

    Окно PGD берётся, только если оно «информативное» (не почти одни нули) и
    встречается в слоте ровно один раз; соседние окна с одной дельтой сливаются.
    """
    points = []
    for o in range(0, len(pgd) - win + 1, step):
        w = pgd[o:o + win]
        if w.count(0) > win - 5 or len(set(w)) <= 2:
            continue
        j = slot.find(w)
        if j < 0 or slot.find(w, j + 1) >= 0:
            continue
        points.append((o, j - o))
    runs = []
    for o, d in points:
        if runs and runs[-1][2] == d and o <= runs[-1][1]:
            runs[-1][1] = o + win
        else:
            runs.append([o, o + win, d])
    return [tuple(r) for r in runs]


def field_at_save(off: int) -> str | None:
    for slug, _p, s, kind, _d in C.FIELDS:
        if s <= off < s + C.field_size(kind):
            return slug if off == s else f"{slug}+{off - s}"
    return None


def field_at_pgd(off: int) -> str | None:
    for slug, p, _s, kind, _d in C.FIELDS:
        if p <= off < p + C.field_size(kind):
            return slug if off == p else f"{slug}+{off - p}"
    return None


def pgd_to_save(off: int, runs: list) -> int | None:
    for a, b, d in runs:
        if a <= off < b:
            return off + d
    return None


def save_to_pgd(off: int, runs: list) -> int | None:
    for a, b, d in runs:
        if a <= off - d < b:
            return off - d
    return None


def print_slot_diff(a: bytes, b: bytes, runs: list | None = None, limit: int = 60) -> int:
    """Печатает отличия двух расшифрованных слотов. Возвращает число диапазонов."""
    rs = diff_runs(a, b, skip=C.PHANTOM_IV_SIZE)
    for s, n in rs[:limit]:
        notes = []
        f = field_at_save(s)
        if f:
            notes.append(f)
        if runs:
            p = save_to_pgd(s, runs)
            if p is not None:
                notes.append(f"PGD+0x{p:X}")
        old = a[s:s + min(n, 16)].hex(" ")
        new = b[s:s + min(n, 16)].hex(" ")
        tail = " …" if n > 16 else ""
        note = f"  [{', '.join(notes)}]" if notes else ""
        print(f"    0x{s:05X} +{n:<3} {old}{tail} -> {new}{tail}{note}")
    if len(rs) > limit:
        print(f"    … ещё {len(rs) - limit} диапазонов")
    return len(rs)


# ===========================================================================
# Режимы без записи
# ===========================================================================

def cmd_list(args) -> int:
    path = save_path_of(args)
    print(f"Сейв: {path}\n")
    for r in sl2.list_slots(sl2.load(path)):
        tag = "ПУСТО" if r["empty"] else f"{r['name']!r} lvl {r['level']}"
        print(f"  слот {r['slot']:2d}: {tag}")
    return 0


def cmd_read(args, mem) -> int:
    path = save_path_of(args)
    save = sl2.load(path)
    slot = resolve_slot(args, save, mem)
    data = sl2.decrypt_slot(save, slot)
    print(f"Память: {mem.read_name()!r}   сейв: слот {slot} {sl2.read_name(data)!r}\n")
    bad = 0
    for slug, p, s, kind, desc in C.FIELDS:
        size = C.field_size(kind)
        vm = mem.read_field(slug)
        vs = C.decode(kind, data[s:s + size])
        same = C.encode(kind, vm) == data[s:s + size]
        bad += not same
        mark = "==" if same else "!="
        print(f"  {slug:<12} PGD+0x{p:03X} {mark} слот 0x{s:05X}   # {desc}")
        if kind == "bytes50":
            if not same:
                print(f"      память: {vm.hex()}\n      сейв:   {vs.hex()}")
        else:
            print(f"      память: {C.show(kind, vm)}" + ("" if same else f"   сейв: {C.show(kind, vs)}"))
    print()
    if bad:
        print(f"Не совпало полей: {bad}. Если ты менял внешность в игре после "
              "последнего сейва — сохранись (ESC x2) и повтори.")
    else:
        print("Все поля совпадают — офсеты в сейве верные.")
    return 0


def cmd_locate(args, mem) -> int:
    save = sl2.load(save_path_of(args))
    slot = resolve_slot(args, save, mem)
    data = sl2.decrypt_slot(save, slot)
    pgd = mem.read_pgd(0, args.pgd_size)
    runs = locate(pgd, data)
    print(f"PGD 0..0x{args.pgd_size:X} -> слот {slot}  (окно 16 байт, только уникальные)\n")
    print("   PGD            слот               дельта    поля")
    for a, b, d in runs:
        names = sorted({field_at_pgd(o).split("+")[0] for o in range(a, b) if field_at_pgd(o)})
        print(f"  0x{a:03X}..0x{b - 1:03X}  0x{a + d:05X}..0x{b - 1 + d:05X}  "
              f"{d:+#8x}    {', '.join(names)}")
    print()
    for slug, p, s, kind, _d in C.FIELDS:
        got = pgd_to_save(p, runs)
        if got is None:
            verdict = "не найден окном (мелкое поле — смотри --read)"
        elif got == s:
            verdict = "совпадает с редактором"
        else:
            verdict = f"!!! окно говорит 0x{got:05X}"
        print(f"  {slug:<12} PGD+0x{p:03X} -> редактор 0x{s:05X}: {verdict}")
    return 0


def cmd_watch(args, mem) -> int:
    """Опрос PGD + ожидание записи сейва. Ничего не пишет."""
    path = save_path_of(args)
    start, size = args.region_start, args.region_size
    if args.dump:
        os.makedirs(args.dump, exist_ok=True)

    save = sl2.load(path)
    slots = char_slots(save)
    settings = sl2.decrypt_slot(save, C.USER_DATA_FILE_COUNT - 1)
    mtime = os.stat(path).st_mtime
    prev = mem.read_pgd(start, size)
    pgd_full = mem.read_pgd(0, max(C.PGD_DUMP_SIZE, start + size))
    try:
        slot = resolve_slot(args, save, mem)
        runs = locate(pgd_full, slots[slot])
    except SystemExit:
        runs = []

    print(f"Слежу: PGD+0x{start:X}..0x{start + size - 1:X} каждые {args.interval * 1000:.0f} мс "
          f"и {path}")
    print("Меняй внешность/что угодно в игре; для записи сейва — ESC x2. Ctrl+C — выход.\n")
    t0 = time.time()
    events = 0
    try:
        while args.seconds <= 0 or time.time() - t0 < args.seconds:
            cur = mem.read_pgd(start, size)
            if cur != prev:
                stamp = time.strftime("%H:%M:%S")
                for s, n in diff_runs(prev, cur):
                    o = start + s
                    notes = []
                    f = field_at_pgd(o)
                    if f:
                        notes.append(f)
                    so = pgd_to_save(o, runs)
                    if so is not None:
                        notes.append(f"слот 0x{so:05X}")
                    note = f"  [{', '.join(notes)}]" if notes else ""
                    print(f"[{stamp}] ПАМЯТЬ PGD+0x{o:03X} +{n:<3} "
                          f"{prev[s:s + min(n, 16)].hex(' ')} -> {cur[s:s + min(n, 16)].hex(' ')}{note}")
                prev = cur

            try:
                m = os.stat(path).st_mtime
            except FileNotFoundError:
                m = mtime
            if m != mtime:
                time.sleep(0.4)  # дать записи докатиться
                mtime = os.stat(path).st_mtime
                events += 1
                new_save = sl2.load(path)
                new_slots = char_slots(new_save)
                stamp = time.strftime("%H:%M:%S")
                print(f"\n[{stamp}] СЕЙВ #{events} записан")
                changed = False
                for i in sorted(set(slots) | set(new_slots)):
                    a, b = slots.get(i), new_slots.get(i)
                    if a is None or b is None:
                        print(f"  слот {i}: {'появился' if a is None else 'опустел'}")
                        changed = True
                        continue
                    if a[C.PHANTOM_IV_SIZE:] == b[C.PHANTOM_IV_SIZE:]:
                        continue
                    changed = True
                    print(f"  слот {i} {sl2.read_name(b)!r}:")
                    print_slot_diff(a, b, runs, limit=args.limit)
                    if args.dump:
                        with open(os.path.join(args.dump, f"save{events:03d}_slot{i}.bin"), "wb") as f:
                            f.write(b)
                if args.with_settings:
                    new_settings = sl2.decrypt_slot(new_save, C.USER_DATA_FILE_COUNT - 1)
                    if new_settings[C.PHANTOM_IV_SIZE:] != settings[C.PHANTOM_IV_SIZE:]:
                        print("  слот 10 (настройки/load-screen):")
                        print_slot_diff(settings, new_settings, limit=args.limit)
                    settings = new_settings
                if not changed:
                    print("  слоты персонажей не изменились")
                if args.dump:
                    with open(os.path.join(args.dump, f"save{events:03d}_pgd.bin"), "wb") as f:
                        f.write(mem.read_pgd(0, C.PGD_DUMP_SIZE))
                print()
                slots = new_slots
            time.sleep(args.interval)
    except KeyboardInterrupt:
        pass
    print(f"\nГотово, сейвов поймано: {events}")
    return 0


def cmd_diff(args) -> int:
    a = open(args.diff[0], "rb").read()
    b = open(args.diff[1], "rb").read()
    is_slot = len(a) > C.PGD_DUMP_SIZE
    print(f"{args.diff[0]} ({len(a)} байт) -> {args.diff[1]} ({len(b)} байт)\n")
    if is_slot:
        n = print_slot_diff(a, b, limit=args.limit)
    else:
        rs = diff_runs(a, b)
        for s, k in rs[:args.limit]:
            f = field_at_pgd(s)
            print(f"    PGD+0x{s:03X} +{k:<3} {a[s:s + min(k, 16)].hex(' ')} -> "
                  f"{b[s:s + min(k, 16)].hex(' ')}" + (f"  [{f}]" if f else ""))
        n = len(rs)
    print(f"\nДиапазонов: {n}")
    return 0


def cmd_check_dsrchr(args, mem) -> int:
    save = sl2.load(save_path_of(args))
    slot = resolve_slot(args, save, mem)
    a = dsrchr.from_memory(mem)
    b = dsrchr.from_slot(sl2.decrypt_slot(save, slot))
    print(f".dsrchr из памяти (мод) vs из слота {slot} (редактор):")
    same = dsrchr.print_compare(a, b, "мод", "сейв")
    return 0 if same else 1


def cmd_export(args, mem) -> int:
    data = dsrchr.from_memory(mem)
    with open(args.export_dsrchr, "wb") as f:
        f.write(data)
    print(f"Записан {args.export_dsrchr} ({len(data)} байт) из памяти, как это делает мод:")
    for slug, v in dsrchr.describe(data).items():
        print(f"  {slug:<11} {v}")
    return 0


def cmd_save_dsrchr(args, mem) -> int:
    save = sl2.load(save_path_of(args))
    slot = resolve_slot(args, save, mem)
    data = dsrchr.from_slot(sl2.decrypt_slot(save, slot))
    with open(args.save_dsrchr, "wb") as f:
        f.write(data)
    print(f"Записан {args.save_dsrchr} из слота {slot} — так же экспортирует редактор.")
    return 0


# ===========================================================================
# Режимы с записью в игру
# ===========================================================================

def do_save(save_path: str, args, first: list) -> bool:
    pre = args.pre_delay if first[0] else args.step_delay
    first[0] = False
    return I.save_via_esc(save_path, pre_delay=pre, gap=args.gap,
                          presses=args.presses, retries=args.retries,
                          retry_gap=args.retry_gap, timeout=args.timeout)


def parse_value(slug: str, text: str, force: bool):
    kind = C.FIELD_BY_SLUG[slug][3]
    if kind in ("u8", "i32"):
        v = int(text, 0)
        if not force:
            if slug == "hair_id" and v not in C.HAIR_IDS:
                raise SystemExit(f"hair_id {v} не из списка {C.HAIR_IDS} — "
                                 "несуществующая модель может уронить игру (--force, если уверен)")
            if slug == "physique" and not 0 <= v <= C.PHYSIQUE_MAX:
                raise SystemExit(f"physique 0..{C.PHYSIQUE_MAX}")
            if slug == "sex" and v not in (0, 1):
                raise SystemExit("sex 0 или 1")
        return v
    if kind == "rgba":
        parts = [float(x) for x in text.split(",")]
        if len(parts) == 3:
            parts.append(1.0)
        if len(parts) != 4:
            raise SystemExit("rgba: r,g,b[,a]")
        return tuple(parts)
    raw = bytes.fromhex(text.replace(" ", ""))
    if len(raw) != 50:
        raise SystemExit("bytes50: ровно 50 байт hex")
    return raw


def marker_values(original: dict) -> dict:
    """Уникальные, но безопасные значения для каждого поля .dsrchr."""
    hair = original["hair_id"]
    family = [h for h in C.HAIR_IDS if (h >= 3000) == (hair >= 3000)]
    new_hair = family[(family.index(hair) + 1) % len(family)] if hair in family else family[1]
    hc, ec = original["hair_color"], original["eye_color"]
    return {
        "physique": (original["physique"] + 1) % (C.PHYSIQUE_MAX + 1),
        "hair_id": new_hair,
        "hair_color": (0.1111, 0.2222, 0.3333, hc[3]),
        "eye_color": (0.4444, 0.5555, 0.6666, ec[3]),
        "face_data": bytes((k * 7 + 13) & 0xFF for k in range(50)),
        "skin_color": (bytes((k * 7 + 13 + 50 * 7) & 0xFF for k in range(50))),
    }


def write_run(args, mem, changes: dict, label: str) -> int:
    """Общий цикл: сейв до -> запись в память -> сейв -> дифф -> откат -> сейв."""
    path = save_path_of(args)
    os.makedirs(args.out, exist_ok=True)
    save0 = sl2.load(path)
    slot = resolve_slot(args, save0, mem)
    print(f"Бэкап сейва: {backup_save(path, args.out)}")

    original = mem.read_fields()
    runs = locate(mem.read_pgd(0, C.PGD_DUMP_SIZE), sl2.decrypt_slot(save0, slot))
    first = [True]

    print("\n1) исходный сейв")
    if not do_save(path, args, first):
        print("   игра не сохранилась — прерываю")
        return 1
    before = sl2.decrypt_slot(sl2.load(path), slot)

    print(f"\n2) пишу в память: {label}")
    for slug, v in changes.items():
        kind = C.FIELD_BY_SLUG[slug][3]
        print(f"   {slug:<11} {C.show(kind, original[slug])} -> {C.show(kind, v)}")
        mem.write_field(slug, v)
    ok = do_save(path, args, first)
    after = sl2.decrypt_slot(sl2.load(path), slot)
    rs = []
    if not ok:
        print("   игра не сохранилась после записи!")
    else:
        rs = diff_runs(before, after, skip=C.PHANTOM_IV_SIZE)
    with open(os.path.join(args.out, "before.bin"), "wb") as f:
        f.write(before)
    with open(os.path.join(args.out, "after.bin"), "wb") as f:
        f.write(after)

    print(f"\n3) что поменялось в слоте {slot}:")
    print_slot_diff(before, after, runs, limit=args.limit)

    print("\n4) проверка офсетов редактора:")
    results = {}
    for slug, v in changes.items():
        _s, p, s, kind, _d = C.FIELD_BY_SLUG[slug]
        enc = C.encode(kind, v)
        at = after[s:s + len(enc)]
        where = []
        j = after.find(enc)
        while j >= 0 and len(where) < 5:
            where.append(j)
            j = after.find(enc, j + 1)
        hit = at == enc
        results[slug] = {"expected": s, "ok": hit, "found_at": where}
        where_s = ", ".join(f"0x{w:05X}" for w in where) or "нигде"
        print(f"   {slug:<11} ждали 0x{s:05X}: {'OK' if hit else 'НЕТ'}   значение в слоте: {where_s}")
    covered = set()
    for slug in changes:
        _s, _p, s, kind, _d = C.FIELD_BY_SLUG[slug]
        covered.update(range(s, s + C.field_size(kind)))
    extra = [(s, n) for s, n in rs if not any(o in covered for o in range(s, s + n))]
    print(f"   прочих изменившихся диапазонов (шум/побочка): {len(extra)}")

    if args.restore:
        print("\n5) откат исходных значений")
        for slug in changes:
            mem.write_field(slug, original[slug])
        if do_save(path, args, first):
            restored = sl2.decrypt_slot(sl2.load(path), slot)
            back = all(
                restored[s:s + C.field_size(k)] == before[s:s + C.field_size(k)]
                for _sl, _p, s, k, _d in (C.FIELD_BY_SLUG[x] for x in changes)
            )
            print("   поля вернулись побайтово" if back else "   !!! поля НЕ вернулись — сверь с before.bin")
        else:
            print("   игра не сохранилась при откате — значения в памяти уже исходные, "
                  "сохранись вручную")

    with open(os.path.join(args.out, "result.json"), "w", encoding="utf-8") as f:
        json.dump({"slot": slot, "label": label, "fields": results,
                   "other_runs": [[s, n] for s, n in extra]}, f, indent=2)
    all_ok = all(r["ok"] for r in results.values())
    print(f"\nИтог: {'все офсеты подтверждены' if all_ok else 'есть расхождения'} "
          f"— {os.path.abspath(args.out)}")
    return 0 if all_ok else 1


def cmd_probe(args, mem) -> int:
    slug = args.probe
    if slug not in C.FIELD_BY_SLUG:
        raise SystemExit(f"Нет поля {slug}. Есть: {', '.join(C.FIELD_BY_SLUG)}")
    if args.value is None:
        raise SystemExit("--probe требует --value")
    return write_run(args, mem, {slug: parse_value(slug, args.value, args.force)},
                     f"одно поле {slug}")


def cmd_sweep(args, mem) -> int:
    return write_run(args, mem, marker_values(mem.read_fields()), "маркеры во все поля .dsrchr")


def cmd_import(args, mem) -> int:
    data = open(args.import_dsrchr, "rb").read()
    hair = dsrchr.describe(data)["hair_id"]
    if int(hair) not in C.HAIR_IDS and not args.force:
        raise SystemExit(f"hair_id {hair} не из известного списка — --force, если уверен")
    dsrchr.to_memory(mem, data)
    print(f"{args.import_dsrchr} записан в память, как это делает мод. "
          "Сохранись и перезайди, чтобы модель обновилась.")
    return 0


# ===========================================================================

def main() -> int:
    C.use_utf8_stdout()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--save", default=None, help="путь к DRAKS0005.sl2 (по умолчанию самый свежий профиль)")
    p.add_argument("--profile", default=None, help="папка профиля в Documents/NBGI/DARK SOULS REMASTERED")
    p.add_argument("--slot", default="auto", help="слот 0..9 или auto (по имени и лицу из памяти)")
    p.add_argument("--out", default="./out", help="папка для бэкапа и дампов режимов с записью")

    m = p.add_mutually_exclusive_group(required=True)
    m.add_argument("--list", action="store_true")
    m.add_argument("--read", action="store_true")
    m.add_argument("--locate", action="store_true")
    m.add_argument("--watch", action="store_true")
    m.add_argument("--diff", nargs=2, metavar=("A", "B"))
    m.add_argument("--check-dsrchr", action="store_true")
    m.add_argument("--export-dsrchr", metavar="FILE")
    m.add_argument("--save-dsrchr", metavar="FILE")
    m.add_argument("--import-dsrchr", metavar="FILE")
    m.add_argument("--probe", metavar="FIELD")
    m.add_argument("--sweep", action="store_true")

    p.add_argument("--value", help="значение для --probe: число, r,g,b[,a] или 50 байт hex")
    p.add_argument("--force", action="store_true", help="разрешить значения вне известных списков")
    p.add_argument("--no-restore", dest="restore", action="store_false", help="не откатывать после --probe/--sweep")
    p.add_argument("--pgd-size", type=lambda s: int(s, 0), default=C.PGD_DUMP_SIZE)
    p.add_argument("--limit", type=int, default=60, help="сколько диапазонов диффа печатать")

    w = p.add_argument_group("--watch")
    w.add_argument("--seconds", type=float, default=0, help="0 = пока не Ctrl+C")
    w.add_argument("--interval", type=float, default=0.05, help="период опроса памяти, сек")
    w.add_argument("--region-start", type=lambda s: int(s, 0), default=0)
    w.add_argument("--region-size", type=lambda s: int(s, 0), default=C.PGD_DUMP_SIZE)
    w.add_argument("--with-settings", action="store_true", help="диффить и слот 10 (load-screen)")
    w.add_argument("--dump", default=None, help="класть слоты и PGD каждого сейва в эту папку")

    t = p.add_argument_group("тайминги ESC x2 (как в gesture-sweeper)")
    t.add_argument("--pre-delay", type=float, default=5.0, help="пауза перед первым ESC (развернуть игру)")
    t.add_argument("--step-delay", type=float, default=0.5)
    t.add_argument("--gap", type=float, default=0.5)
    t.add_argument("--presses", type=int, default=2)
    t.add_argument("--retries", type=int, default=3)
    t.add_argument("--retry-gap", type=float, default=1.0)
    t.add_argument("--timeout", type=float, default=15.0)
    args = p.parse_args()
    args.slot = -1 if str(args.slot).lower() == "auto" else int(args.slot)

    if args.list:
        return cmd_list(args)
    if args.diff:
        return cmd_diff(args)
    if args.save_dsrchr and args.slot >= 0:
        return cmd_save_dsrchr(args, None)

    mem = memory.DS1Memory()
    mem.attach()
    try:
        if args.read:
            return cmd_read(args, mem)
        if args.locate:
            return cmd_locate(args, mem)
        if args.watch:
            return cmd_watch(args, mem)
        if args.check_dsrchr:
            return cmd_check_dsrchr(args, mem)
        if args.export_dsrchr:
            return cmd_export(args, mem)
        if args.save_dsrchr:
            return cmd_save_dsrchr(args, mem)
        if args.import_dsrchr:
            return cmd_import(args, mem)
        if args.probe:
            return cmd_probe(args, mem)
        if args.sweep:
            return cmd_sweep(args, mem)
    finally:
        mem.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
