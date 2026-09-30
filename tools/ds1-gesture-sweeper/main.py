"""DS1 Gesture Sweeper — ищет, где в сейве лежат флаги разблокировки жестов.

Как в ds3-stat-sweeper: правим значения в ПАМЯТИ процесса (как это делает
Cheat Engine по 1FRDarkSoulsRemastered.CT), заставляем игру сохраниться через
ESC x2, дампим расшифрованный слот и сравниваем дампы между собой.

Схема прогона (изолирующая — каждый дамп отличается от baseline ровно одним
жестом):
  1. все 15 жестов -> Locked, сейв, дамп  -> baseline_all_locked.bin
  2. для i в 0..14: всё Locked кроме i, сейв, дамп -> gNN_<slug>.bin
  3. все 15 -> Unlocked, сейв, дамп       -> final_all_unlocked.bin
  4. восстанавливаем исходное состояние жестов + финальный сейв
  5. diff.py строит report.md с офсетами относительно Pattern1

Примеры:
  python main.py --list                       # какие слоты есть в сейве
  python main.py --slot 0 --out ./out         # полный прогон
  python main.py --slot 0 --only 0,14         # только два жеста
  python main.py --analyse-only --out ./out   # пересобрать отчёт по дампам
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
    dst = os.path.join(out_dir, f"DRAKS0005.backup.{int(time.time())}.sl2")
    shutil.copy2(path, dst)
    return dst


def dump_slot(save_path: str, slot: int, dst: str) -> bytes:
    data = sl2.decrypt_slot(sl2.load(save_path), slot)
    with open(dst, "wb") as f:
        f.write(data)
    return data


def detect_active_slot(before: bytes, after: bytes) -> int:
    """Какой слот игра переписала между двумя состояниями файла.

    Игра пишет только затронутые слоты, поэтому слот активного персонажа — тот,
    чьи расшифрованные данные изменились. Слот 10 (настройки) игнорируем: он
    меняется почти всегда и персонажа не содержит.
    """
    changed = []
    for i in range(C.USER_DATA_FILE_COUNT - 1):  # 0..9, без слота настроек
        a = sl2.decrypt_slot(before, i)
        b = sl2.decrypt_slot(after, i)
        if a != b and not sl2.is_empty(b):
            changed.append(i)
    if len(changed) == 1:
        return changed[0]
    if not changed:
        raise SystemExit(
            "Автодетект слота не сработал: ни один слот персонажа не изменился "
            "после сейва. Игра точно сохранилась? Укажи --slot вручную."
        )
    raise SystemExit(
        f"Автодетект слота неоднозначен — изменились слоты {changed}. "
        "Укажи --slot вручную."
    )


def do_save(save_path: str, args, first: list) -> bool:
    pre = args.pre_delay if first[0] else args.step_delay
    first[0] = False
    return I.save_via_esc(save_path, pre_delay=pre, gap=args.gap,
                          presses=args.presses, retries=args.retries,
                          retry_gap=args.retry_gap, timeout=args.timeout)


def capture(mem, save_path: str, slot: int, dst: str, args, first: list,
            label: str):
    saved = do_save(save_path, args, first)
    data = dump_slot(save_path, slot, dst)
    raw = mem.read_raw()
    mark = "OK" if saved else "НЕ СОХРАНИЛОСЬ"
    print(f"  {label:<34} saved={mark:<15} dump={os.path.basename(dst)} "
          f"({len(data)} байт)")
    return saved, raw


def parse_only(spec: str | None) -> list:
    if not spec:
        return list(range(C.GESTURE_COUNT))
    out = []
    for tok in spec.split(","):
        tok = tok.strip()
        if not tok:
            continue
        i = int(tok)
        if not (0 <= i < C.GESTURE_COUNT):
            raise SystemExit(f"Жест {i} вне диапазона 0..{C.GESTURE_COUNT - 1}")
        out.append(i)
    return out


def sweep(args) -> int:
    save_path = args.save or default_save_path(args.profile)
    if not os.path.isfile(save_path):
        print(f"Сейв не найден: {save_path}")
        return 1

    os.makedirs(args.out, exist_ok=True)
    targets = parse_only(args.only)

    mem = memory.DS1Memory()
    mem.attach()
    var = mem.resolve_baseb_var()
    array = mem.resolve_gesture_array()
    original = mem.read_raw()

    print(f"BaseB var:      {hex(var)}")
    print(f"Gesture array:  {hex(array)}")
    print(f"Сейв:           {save_path}")
    print(f"Слот:           {'auto' if args.slot < 0 else args.slot}")
    print(f"Дампы:          {os.path.abspath(args.out)}")
    print("Исходное состояние жестов:")
    for i, v in enumerate(original):
        print(f"  [{i:2d}] {C.GESTURE_NAMES[i]:<20} = {v:<3} "
              f"{'UNLOCKED' if v & 1 else 'locked'}")

    bak = backup_save(save_path, args.out)
    print(f"Бэкап сейва:    {bak}")
    print("\nИгру держи в окне/borderless и НЕ трогай мышь/клавиатуру во время прогона.")

    log_path = os.path.join(args.out, "sweep.csv")
    log = open(log_path, "w", newline="", encoding="utf-8")
    writer = csv.writer(log)
    writer.writerow(["step", "gesture_index", "gesture_name", "mem_raw", "saved", "dump"])

    first = [True]

    # --- 1. baseline: всё заблокировано -----------------------------------
    print("\n=== baseline: все жесты Locked ===")
    mem.set_all(False)
    before = sl2.load(save_path)
    saved = do_save(save_path, args, first)
    after = sl2.load(save_path)

    slot = args.slot
    if slot < 0:
        slot = detect_active_slot(before, after)
        name = sl2.read_name(sl2.decrypt_slot(after, slot))
        print(f"  автодетект слота: {slot} ({name!r})")
    elif sl2.decrypt_slot(before, slot) == sl2.decrypt_slot(after, slot):
        print(f"  ВНИМАНИЕ: слот {slot} не изменился после сейва — "
              "скорее всего активный персонаж в другом слоте. "
              "Запусти с --slot auto или укажи верный номер.")

    dst = os.path.join(args.out, diff.BASELINE_NAME)
    with open(dst, "wb") as f:
        f.write(sl2.decrypt_slot(after, slot))
    raw = mem.read_raw()
    print(f"  {'all locked':<34} saved={'OK' if saved else 'НЕ СОХРАНИЛОСЬ':<15} "
          f"dump={os.path.basename(dst)}")
    writer.writerow(["baseline", "", "", " ".join(map(str, raw)), saved,
                     os.path.basename(dst)])
    log.flush()

    # --- 2. по одному жесту -----------------------------------------------
    print("\n=== по одному жесту (всё Locked кроме одного) ===")
    for i in targets:
        mem.set_only(i)
        dst = os.path.join(args.out, f"g{i:02d}_{C.GESTURE_SLUGS[i]}.bin")
        saved, raw = capture(mem, save_path, slot, dst, args, first,
                             f"[{i:2d}] {C.GESTURE_NAMES[i]}")
        writer.writerow([f"g{i:02d}", i, C.GESTURE_NAMES[i],
                         " ".join(map(str, raw)), saved, os.path.basename(dst)])
        log.flush()

    # --- 3. контроль: всё разблокировано ----------------------------------
    print("\n=== контроль: все жесты Unlocked ===")
    mem.set_all(True)
    dst = os.path.join(args.out, diff.FINAL_NAME)
    saved, raw = capture(mem, save_path, slot, dst, args, first, "all unlocked")
    writer.writerow(["final", "", "", " ".join(map(str, raw)), saved,
                     os.path.basename(dst)])
    log.close()

    # --- 4. восстановление ------------------------------------------------
    if args.restore:
        print("\n=== восстановление исходного состояния жестов ===")
        mem.write_raw(original)
        do_save(save_path, args, first)
        print("  восстановлено и сохранено")
    else:
        print("\n--no-restore: жесты остались разблокированными в памяти")

    mem.close()
    return 0


def list_slots(args) -> int:
    save_path = args.save or default_save_path(args.profile)
    print(f"Сейв: {save_path}\n")
    for r in sl2.list_slots(sl2.load(save_path)):
        tag = "ПУСТО" if r["empty"] else f"{r['name']!r} lvl {r['level']}"
        p1 = hex(r["pattern1"]) if r["pattern1"] >= 0 else "не найден"
        print(f"  слот {r['slot']:2d}: {tag:<28} pattern1={p1}  "
              f"md5={'ok' if r['md5_ok'] else 'BAD'}")
    return 0


def main() -> int:
    C.use_utf8_stdout()
    p = argparse.ArgumentParser(
        description="DS1 Gesture Sweeper — поиск офсетов флагов жестов в .sl2")
    p.add_argument("--save", default=None,
                   help="путь к DRAKS0005.sl2 (по умолчанию — самый свежий профиль)")
    p.add_argument("--profile", default=None,
                   help="Steam-профиль (папка в Documents/NBGI/DARK SOULS REMASTERED)")
    p.add_argument("--slot", default="auto",
                   help="номер слота персонажа (0..9) или auto — определить по "
                        "тому, какой слот игра переписала при первом сейве")
    p.add_argument("--out", default="./out", help="папка для дампов и отчётов")
    p.add_argument("--only", default=None,
                   help="список индексов жестов через запятую, напр. 0,5,14")
    p.add_argument("--list", action="store_true", help="показать слоты сейва и выйти")
    p.add_argument("--analyse-only", action="store_true",
                   help="не трогать игру, только пересобрать report.md по дампам")
    p.add_argument("--no-restore", dest="restore", action="store_false",
                   help="не возвращать исходное состояние жестов в конце")
    # тайминги (как в ds3-stat-sweeper)
    p.add_argument("--pre-delay", type=float, default=5.0,
                   help="пауза перед самым первым ESC (успеть развернуть игру)")
    p.add_argument("--step-delay", type=float, default=0.5,
                   help="пауза перед ESC на последующих шагах")
    p.add_argument("--gap", type=float, default=0.5, help="пауза между ESC")
    p.add_argument("--presses", type=int, default=2, help="сколько ESC за попытку")
    p.add_argument("--retries", type=int, default=3, help="повторов при неудаче")
    p.add_argument("--retry-gap", type=float, default=1.0, help="интервал ESC при повторе")
    p.add_argument("--timeout", type=float, default=15.0,
                   help="ожидание записи сейва, сек")
    args = p.parse_args()
    args.slot = -1 if str(args.slot).lower() == "auto" else int(args.slot)

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
