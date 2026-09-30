"""DS3 Stat Sweeper — прогон характеристик от 1 до 99.

За один запуск гоняет ВСЕ характеристики (или одну, если задан --stat).
Для каждой характеристики:
  - все остальные 8 атрибутов выставляются в baseline (по умолчанию 11);
  - исследуемый стат крутится 1..99, и на каждом значении:
      1) пишем стат в память (+ пересчёт Soul Level) — как CT;
      2) ESC x2 -> игра сохраняется (на самом первом сейве ждём, пока развернёшь игру);
      3) расшифровываем слот из .sl2 и сверяем значение;
      4) при несовпадении — до 3 повторов ESC-сейва;
      5) сохраняем расшифрованный слот в <STAT>/<STAT>_NN.bin и строку в report.csv.

Примеры:
  python main.py --out ./out                      # все статы 1..99
  python main.py --stat VIT --out ./out           # только Vitality
"""

from __future__ import annotations

import argparse
import csv
import os
import sys

import constants as C
import memory
import input_save as I
import sl2


def save_path_for(steam_id: str) -> str:
    appdata = os.environ["APPDATA"]
    return os.path.join(appdata, "DarkSoulsIII", steam_id, "DS30000.sl2")


def verify_from_file(path: str, slot: int, stat: str):
    """Читает файл, расшифровывает слот, возвращает (data, file_stat, file_level)."""
    with open(path, "rb") as f:
        save = f.read()
    data = sl2.decrypt_slot(save, slot)
    got = sl2.read_stat_from_slot(data, stat)
    lvl = sl2.read_level_from_slot(data)
    return data, got, lvl


def sweep_stat(mem: memory.DS3Memory, stat: str, path: str, args, first_flag: list) -> int:
    """Прогнать один стат 1..99. Возвращает число неудач."""
    out_dir = os.path.join(args.out, stat)
    os.makedirs(out_dir, exist_ok=True)
    report_path = os.path.join(out_dir, f"{stat}_report.csv")

    # базовая линия: все прочие атрибуты в baseline
    base_level = mem.set_baseline(stat, value=args.baseline)
    print(f"\n=== {C.STAT_NAMES[stat]} ({stat}) === остальные атрибуты = {args.baseline}, "
          f"базовый уровень {base_level}")

    report = open(report_path, "w", newline="", encoding="utf-8")
    writer = csv.writer(report)
    writer.writerow(["value", "mem_stat", "mem_level", "file_stat",
                     "file_level", "saved", "ok", "bin"])

    failures = 0
    for value in range(args.from_, args.to + 1):
        level = mem.write_stat(stat, value, update_level=True)
        mem_stat = mem.read_stat(stat)
        if mem_stat != value:
            print(f"[{value}] ! память не приняла запись ({mem_stat}) — пропуск")
            writer.writerow([value, mem_stat, level, "", "", False, False, ""])
            report.flush()
            failures += 1
            continue

        pre = args.pre_delay if first_flag[0] else args.step_delay
        first_flag[0] = False
        saved = I.save_via_esc(path, pre_delay=pre, gap=args.gap, presses=args.presses,
                               retries=args.retries, retry_gap=args.retry_gap,
                               timeout=args.timeout)

        data, file_stat, file_level = verify_from_file(path, args.slot, stat)
        attempt = 0
        while file_stat != value and attempt < args.retries:
            attempt += 1
            print(f"[{value}] файл={file_stat}, повтор верификации {attempt}/{args.retries}")
            prev = os.stat(path).st_mtime
            I._do_presses(args.presses, args.retry_gap)
            I.wait_for_save(path, prev, timeout=args.timeout)
            data, file_stat, file_level = verify_from_file(path, args.slot, stat)

        ok = (file_stat == value)
        bin_path = os.path.join(out_dir, f"{stat}_{value:02d}.bin")
        with open(bin_path, "wb") as f:
            f.write(data)
        writer.writerow([value, mem_stat, level, file_stat, file_level,
                         saved, ok, os.path.basename(bin_path)])
        report.flush()
        if not ok:
            failures += 1
        mark = "OK" if ok else "FAIL"
        print(f"[{value:2d}] mem={mem_stat} lvl={level} | file={file_stat} "
              f"lvl={file_level} | saved={saved} -> {mark}  ({os.path.basename(bin_path)})")

    report.close()
    return failures


def sweep(args) -> int:
    path = save_path_for(args.steam_id)
    if not os.path.exists(path):
        print(f"Сейв не найден: {path}")
        return 1

    stats = [args.stat] if args.stat else list(C.STAT_OFFSETS)

    mem = memory.DS3Memory()
    mem.attach()
    print(f"GameDataMan: {hex(mem.resolve_gamedataman_var())}")
    print(f"PlayerGameData: {hex(mem.resolve_attr_base())}")
    print(f"Сейв: {path}\nСлот: {args.slot}  Статы: {', '.join(stats)}  "
          f"Диапазон: {args.from_}..{args.to}  baseline={args.baseline}")

    first_flag = [True]  # 5-сек отсчёт только на самом первом сейве всего прогона
    total_fail = 0
    per_stat_total = args.to - args.from_ + 1
    for stat in stats:
        total_fail += sweep_stat(mem, stat, path, args, first_flag)

    mem.close()
    grand_total = per_stat_total * len(stats)
    print(f"\nГотово: {grand_total - total_fail}/{grand_total} успешно "
          f"по {len(stats)} стат(ам). Файлы: {os.path.abspath(args.out)}")
    return 0 if total_fail == 0 else 2


def main() -> int:
    p = argparse.ArgumentParser(description="DS3 Stat Sweeper 1->99 (все статы за прогон)")
    p.add_argument("--steam-id", default="011000012ff75f05",
                   help="папка сейва %%APPDATA%%\\DarkSoulsIII\\<steam-id>")
    p.add_argument("--slot", type=int, default=2, help="номер персонажа (BND4-энтри)")
    p.add_argument("--stat", choices=list(C.STAT_OFFSETS), default=None,
                   help="один стат; если не задан — гоняются ВСЕ по очереди")
    p.add_argument("--out", default="./out", help="папка для .bin и отчётов")
    p.add_argument("--from", dest="from_", type=int, default=C.STAT_MIN)
    p.add_argument("--to", type=int, default=C.STAT_MAX)
    p.add_argument("--baseline", type=int, default=11,
                   help="значение остальных атрибутов на время прогона стата")
    # тайминги
    p.add_argument("--pre-delay", type=float, default=5.0,
                   help="пауза перед самым первым ESC (успеть развернуть игру)")
    p.add_argument("--step-delay", type=float, default=0.5,
                   help="пауза перед ESC на последующих шагах")
    p.add_argument("--gap", type=float, default=0.2, help="пауза между ESC")
    p.add_argument("--presses", type=int, default=2, help="сколько ESC за попытку")
    p.add_argument("--retries", type=int, default=3, help="повторов при неудаче")
    p.add_argument("--retry-gap", type=float, default=1.0, help="интервал ESC при повторе")
    p.add_argument("--timeout", type=float, default=10.0, help="ожидание записи сейва, сек")
    args = p.parse_args()

    if not (C.STAT_MIN <= args.from_ <= args.to <= C.STAT_MAX):
        print(f"Некорректный диапазон {args.from_}..{args.to} (допустимо {C.STAT_MIN}..{C.STAT_MAX})")
        return 1
    if not (C.STAT_MIN <= args.baseline <= C.STAT_MAX):
        print(f"Некорректный baseline {args.baseline}")
        return 1
    return sweep(args)


if __name__ == "__main__":
    sys.exit(main())
