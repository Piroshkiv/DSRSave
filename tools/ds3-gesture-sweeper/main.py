"""DS3 Gesture Sweeper — ищет, где в сейве лежат флаги разблокировки жестов.

То же, что ds1-gesture-sweeper, но для DS3: правим значения в ПАМЯТИ процесса
(как это делает Cheat Engine по DS3_TGA_v3.4.0.CT, скрипт "Unlock All Gestures"),
заставляем игру сохраниться через ESC x2, дампим расшифрованный слот и сравниваем
дампы между собой.

Схема прогона (изолирующая — каждый дамп отличается от baseline ровно одним
жестом):
  1. все жесты -> Locked, сейв, дамп  -> baseline_all_locked.bin
  2. для каждого i: всё Locked кроме i, сейв, дамп -> gNN_<slug>.bin
  3. все -> Unlocked, сейв, дамп      -> final_all_unlocked.bin
  4. восстанавливаем исходное состояние жестов + финальный сейв
  5. diff.py строит report.md

Примеры:
  python main.py --list                        # слоты сейва + найденные таблицы
  python main.py --slot 4 --out ./out          # полный прогон
  python main.py --slot 4 --only 0,32,33,34    # выборочно
  python main.py --analyse-only --out ./out    # пересобрать отчёт по дампам
"""

from __future__ import annotations

import argparse
import csv
import os
import shutil
import sys
import time

import constants as C
import diff
import input_save as I
import memory
import sl2


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


def capture(mem, save_path: str, slot: int, dst: str, args, first: list, label: str):
    saved = do_save(save_path, args, first)
    data = dump_slot(save_path, slot, dst)
    mark = "OK" if saved else "НЕ СОХРАНИЛОСЬ"
    print(f"  {label:<34} saved={mark:<15} dump={os.path.basename(dst)}")
    return saved


def parse_only(spec: str | None, count: int) -> list:
    if not spec:
        return list(range(count))
    out = []
    for tok in spec.split(","):
        tok = tok.strip()
        if not tok:
            continue
        i = int(tok)
        if not (0 <= i < count):
            raise SystemExit(f"Жест {i} вне диапазона 0..{count - 1}")
        out.append(i)
    return out


def sweep(args) -> int:
    save_path = args.save or default_save_path(args.profile)
    if not os.path.isfile(save_path):
        print(f"Сейв не найден: {save_path}")
        return 1

    os.makedirs(args.out, exist_ok=True)

    mem = memory.DS3Memory()
    mem.attach()
    var = mem.resolve_gamedataman_var()
    array = mem.resolve_gesture_array()
    count = mem.detect_record_count()
    if count == 0:
        print("В массиве жестов ноль сходящихся записей — персонаж загружен в мир?")
        return 1
    original = mem.read_raw(count)
    targets = parse_only(args.only, count)

    # где таблица лежит в файле ДО начала прогона
    pre_slot = sl2.decrypt_slot(sl2.load(save_path), args.slot)
    tables = sl2.find_gesture_tables(pre_slot)

    print(f"GameDataMan var: {hex(var)}")
    print(f"Gesture array:   {hex(array)}")
    print(f"Записей в массиве памяти: {count}")
    print(f"Сейв:            {save_path}")
    print(f"Слот:            {args.slot}  ({sl2.read_name(pre_slot)!r}, "
          f"lvl {sl2.read_level(pre_slot)})")
    if tables:
        off, n = tables[0]
        print(f"Таблица в файле: 0x{off:X}, записей {n}")
    else:
        print("Таблица в файле по сигнатуре НЕ НАЙДЕНА — проверь номер слота")
    print(f"Дампы:           {os.path.abspath(args.out)}")
    print("Исходное состояние жестов:")
    for i, v in enumerate(original):
        print(f"  [{i:2d}] {C.GESTURE_NAMES[i]:<22} = {v:<3} "
              f"{'UNLOCKED' if v & 1 else 'locked'}")

    bak = backup_save(save_path, args.out)
    print(f"Бэкап сейва:     {bak}")
    print("\nИгру держи в окне/borderless и НЕ трогай мышь/клавиатуру во время прогона.")

    log_path = os.path.join(args.out, "sweep.csv")
    log = open(log_path, "w", newline="", encoding="utf-8")
    writer = csv.writer(log)
    writer.writerow(["step", "gesture_index", "gesture_name", "mem_raw", "saved", "dump"])

    first = [True]

    # --- 1. baseline: всё заблокировано -----------------------------------
    print("\n=== baseline: все жесты Locked ===")
    mem.set_all(False, count)
    before = sl2.load(save_path)
    dst = os.path.join(args.out, diff.BASELINE_NAME)
    saved = capture(mem, save_path, args.slot, dst, args, first, "all locked")
    after = sl2.load(save_path)
    if sl2.decrypt_slot(before, args.slot) == sl2.decrypt_slot(after, args.slot):
        print(f"  ВНИМАНИЕ: слот {args.slot} не изменился после сейва — "
              "скорее всего активный персонаж в другом слоте.")
    writer.writerow(["baseline", "", "", " ".join(map(str, mem.read_raw(count))),
                     saved, os.path.basename(dst)])
    log.flush()

    # --- 2. по одному жесту -----------------------------------------------
    print("\n=== по одному жесту (всё Locked кроме одного) ===")
    for i in targets:
        mem.set_only(i, count)
        dst = os.path.join(args.out, f"g{i:02d}_{C.GESTURE_SLUGS[i]}.bin")
        saved = capture(mem, save_path, args.slot, dst, args, first,
                        f"[{i:2d}] {C.GESTURE_NAMES[i]}")
        writer.writerow([f"g{i:02d}", i, C.GESTURE_NAMES[i],
                         " ".join(map(str, mem.read_raw(count))), saved,
                         os.path.basename(dst)])
        log.flush()

    # --- 3. контроль: всё разблокировано ----------------------------------
    print("\n=== контроль: все жесты Unlocked ===")
    mem.set_all(True, count)
    dst = os.path.join(args.out, diff.FINAL_NAME)
    saved = capture(mem, save_path, args.slot, dst, args, first, "all unlocked")
    writer.writerow(["final", "", "", " ".join(map(str, mem.read_raw(count))),
                     saved, os.path.basename(dst)])
    log.close()

    # --- 4. восстановление ------------------------------------------------
    if args.restore:
        print("\n=== восстановление исходного состояния жестов ===")
        mem.write_raw(original)
        ok = do_save(save_path, args, first)
        back = sl2.decrypt_slot(sl2.load(save_path), args.slot)
        t = sl2.find_gesture_tables(back)
        matched = bool(t) and [back[t[0][0] + i * 4] for i in range(count)] == original
        print(f"  сейв записан: {ok};  состояние в файле совпало с исходным: {matched}")
        if not matched:
            print("  ВНИМАНИЕ: восстановить не удалось — исходный сейв лежит в "
                  f"{os.path.basename(bak)}")
    else:
        print("\n--no-restore: жесты остались разблокированными")

    mem.close()
    return 0


def list_slots(args) -> int:
    save_path = args.save or default_save_path(args.profile)
    print(f"Сейв: {save_path}\n")
    save = sl2.load(save_path)
    for i in range(min(C.CHARACTER_SLOT_COUNT, sl2.entry_count(save))):
        d = sl2.decrypt_slot(save, i)
        if sl2.is_empty(d):
            print(f"  слот {i:2d}: ПУСТО")
            continue
        tables = sl2.find_gesture_tables(d)
        head = f"  слот {i:2d}: {sl2.read_name(d)!r:<16} lvl {sl2.read_level(d):<4}"
        if tables:
            off, n = tables[0]
            unlocked = sum(sl2.read_gesture_flags(d, off, n))
            print(head + f" таблица @ 0x{off:X}, записей {n}, разблокировано {unlocked}/{n}")
        else:
            print(head + " таблица жестов НЕ НАЙДЕНА")
    return 0


def main() -> int:
    C.use_utf8_stdout()
    p = argparse.ArgumentParser(
        description="DS3 Gesture Sweeper — поиск офсетов флагов жестов в .sl2")
    p.add_argument("--save", default=None,
                   help="путь к DS30000.sl2 (по умолчанию — самый свежий профиль)")
    p.add_argument("--profile", default=None,
                   help="Steam-профиль (папка в AppData/Roaming/DarkSoulsIII)")
    p.add_argument("--slot", type=int, default=0,
                   help="номер слота персонажа, который верифицируем (0..9)")
    p.add_argument("--out", default="./out", help="папка для дампов и отчётов")
    p.add_argument("--only", default=None,
                   help="список индексов жестов через запятую, напр. 0,32,34")
    p.add_argument("--list", action="store_true", help="показать слоты сейва и выйти")
    p.add_argument("--analyse-only", action="store_true",
                   help="не трогать игру, только пересобрать report.md по дампам")
    p.add_argument("--no-restore", dest="restore", action="store_false",
                   help="не возвращать исходное состояние жестов в конце")
    # тайминги
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
        return list_slots(args)

    if not args.analyse_only:
        rc = sweep(args)
        if rc != 0:
            return rc

    print("\n=== анализ дампов ===\n")
    text = diff.report(args.out)
    with open(os.path.join(args.out, "report.md"), "w", encoding="utf-8") as f:
        f.write(text + "\n")
    print(text)
    print(f"\nОтчёт: {os.path.abspath(os.path.join(args.out, 'report.md'))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
