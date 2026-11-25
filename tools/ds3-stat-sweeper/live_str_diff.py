"""Один живой прогон: поднять STR у текущего загруженного персонажа, заставить
игру сохраниться (ESC x2), и показать ВСЕ байты, которые изменились вокруг
паттерна персонажа — не только известные (статы/HP/FP/ST/резисты), но и любые
неожиданные. В конце возвращает STR обратно и сохраняет снова (не оставляет
персонажа изменённым).

Запуск: python live_str_diff.py [--steam-id ...] [--new-str 70]
"""
from __future__ import annotations

import argparse
import os
import shutil
import struct
import sys
import time

import constants as C
import memory
import input_save as I
import sl2

WIN_LO, WIN_HI = -0x140, 0x20  # окно относительно паттерна персонажа

KNOWN = {
    -0x134: "HP-A(скрытое)", -0x130: "HP-max", -0x128: "FP-A", -0x124: "FP-max",
    -0x11c: "Stamina-A", -0x118: "Stamina-B", -0x114: "Stamina-max",
    -0x10C: "VIG", -0x108: "ATN", -0x104: "END", -0x100: "STR", -0xFC: "DEX",
    -0xF8: "INT", -0xF4: "FTH", -0xF0: "LCK", -0xE4: "VIT", -0xE0: "Level",
    -0xDC: "Souls",
    -0x70: "Резист1(?)", -0x6c: "Резист2(?)", -0x68: "Резист3(?)",
    -0x64: "Резист4(?)", -0x60: "Резист5(?)",
}


def save_path_for(steam_id: str) -> str:
    return os.path.join(os.environ["APPDATA"], "DarkSoulsIII", steam_id, "DS30000.sl2")


def find_matching_slot(save: bytes, live_stats: dict[str, int]) -> int:
    count = sl2.entry_count(save)
    for idx in range(count):
        try:
            data = sl2.decrypt_slot(save, idx, verify_md5=True)
        except sl2.SL2Error:
            continue
        pat = sl2.find_character_pattern(data)
        if pat < 0:
            continue
        try:
            stats = sl2.read_all_stats_from_slot(data)
        except Exception:
            continue
        if all(stats.get(k) == v for k, v in live_stats.items()):
            return idx
    return -1


def dump_window(label: str, data: bytes, pat: int) -> dict[int, int]:
    out = {}
    for rel in range(WIN_LO, WIN_HI):
        out[rel] = data[pat + rel]
    return out


def diff_and_print(before: bytes, after: bytes, pat_b: int, pat_a: int) -> None:
    print("\n  известные поля (before -> after):")
    for rel in sorted(KNOWN):
        name = KNOWN[rel]
        bi = struct.unpack_from("<i", before, pat_b + rel)[0]
        ai = struct.unpack_from("<i", after, pat_a + rel)[0]
        mark = "" if bi == ai else "   <== ИЗМЕНИЛОСЬ"
        print(f"    {name:<16} pat{rel:+#x}: {bi} -> {ai}{mark}")

    known_bytes = set()
    for rel in KNOWN:
        for k in range(4):
            known_bytes.add(rel + k)

    changed = [r for r in range(WIN_LO, WIN_HI)
               if before[pat_b + r] != after[pat_a + r] and r not in known_bytes]
    if not changed:
        print("\n  НЕизвестных изменений в окне [{:#x}..{:#x}] нет".format(WIN_LO, WIN_HI))
        return

    print(f"\n  НЕизвестные изменившиеся байты в окне [{WIN_LO:#x}..{WIN_HI:#x}]:")
    groups = []
    s = p = changed[0]
    for r in changed[1:]:
        if r == p + 1:
            p = r
        else:
            groups.append((s, p))
            s = p = r
    groups.append((s, p))
    for a, b in groups:
        bv = before[pat_b + a:pat_b + b + 1].hex()
        av = after[pat_a + a:pat_a + b + 1].hex()
        print(f"    pat{a:+#x}..{b:+#x}: {bv} -> {av}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--steam-id", default="0110000131bf8025")
    p.add_argument("--new-str", type=int, default=70)
    p.add_argument("--pre-delay", type=float, default=4.0)
    p.add_argument("--settle-delay", type=float, default=0.0,
                   help="пауза после записи стата в память, ПЕРЕД ESC-сейвом — "
                        "чтобы счётчики успели сами догнать новый максимум "
                        "(самый медленный — curse, 3 очка/сек)")
    args = p.parse_args()

    path = save_path_for(args.steam_id)
    if not os.path.exists(path):
        print(f"Сейв не найден: {path}")
        return 1

    mem = memory.DS3Memory()
    mem.attach()
    live_stats = mem.read_all_stats()
    live_level = mem.read_level()
    orig_str = live_stats["STR"]
    print("Текущие статы (память):", live_stats, "level=", live_level)

    with open(path, "rb") as f:
        save_before_bytes = f.read()

    slot = find_matching_slot(save_before_bytes, live_stats)
    if slot < 0:
        print("Не нашёл слот в файле, совпадающий с живыми статами. "
              "Персонаж не сохранён ни разу с текущими статами, или байты файла устарели.")
        mem.close()
        return 1
    print(f"Совпадающий слот в файле: {slot}")

    backup_path = path + f".before_live_str_diff_{int(time.time())}.bak"
    shutil.copy2(path, backup_path)
    print(f"Бэкап сейва: {backup_path}")

    before_slot = sl2.decrypt_slot(save_before_bytes, slot, verify_md5=False)
    pat_b = sl2.find_character_pattern(before_slot)

    new_str = args.new_str
    if new_str == orig_str:
        new_str = orig_str + 1 if orig_str < C.STAT_MAX else orig_str - 1
    print(f"\nПишу STR: {orig_str} -> {new_str} (в памяти живого персонажа)")
    new_level = mem.write_stat("STR", new_str, update_level=True)
    print(f"Новый Level (в памяти) = {new_level}")

    if args.settle_delay > 0:
        print(f"Жду {args.settle_delay:.0f} c, чтобы счётчики статусов догнали новый максимум...")
        time.sleep(args.settle_delay)

    print("\nСейчас заставлю игру сохраниться (ESC x2). Если игра уже в фокусе — ок, "
          "иначе переключись на неё за отсчёт.")
    ok = I.save_via_esc(path, pre_delay=args.pre_delay, gap=0.3, presses=2,
                        retries=3, retry_gap=1.0, timeout=10.0)
    if not ok:
        print("! Сейв не подтвердился по mtime — смотрю файл как есть, но будь осторожен.")

    with open(path, "rb") as f:
        save_after_bytes = f.read()
    after_slot = sl2.decrypt_slot(save_after_bytes, slot, verify_md5=False)
    pat_a = sl2.find_character_pattern(after_slot)

    print(f"\n===== STR {orig_str} -> {new_str}, слот {slot} "
          f"(pat before@{hex(pat_b)} after@{hex(pat_a)}) =====")
    diff_and_print(before_slot, after_slot, pat_b, pat_a)

    # --- вернуть STR назад и пересохранить, чтобы не оставить персонажа изменённым ---
    print(f"\nВозвращаю STR обратно: {new_str} -> {orig_str}")
    mem.write_stat("STR", orig_str, update_level=True)
    ok2 = I.save_via_esc(path, pre_delay=2.0, gap=0.3, presses=2, retries=3,
                        retry_gap=1.0, timeout=10.0)
    print("Откат сохранён." if ok2 else "! Откат НЕ подтвердился по mtime — проверь характеристику в игре вручную.")

    mem.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
