"""Эксперимент №2: воспроизвести ровно то, что пишет САМ РЕДАКТОР, и проверить,
чинит ли игра скрытые копии производных.

Отличие от make_chars.py: там патчились ТОЛЬКО 9 статов + Level (жёстче редактора).
Здесь, как редактор (Character.ts setStat): стат + Level + БАЗОВОЕ производное
(HP_MAX из VIGOR_TO_HP, FP_MAX из ATTUNEMENT_TO_FP, ST_MAX из ENDURANCE_TO_STAMINA).
Скрытые копии (HP_A -0x134, FP_A -0x128, ST_A -0x11c, ST_B -0x118) НЕ трогаем —
остаются от шаблона. Вопрос эксперимента: пересчитает ли их игра при заходе.

Шаблон: слот 2 из бэкапа bak_20260712_005540 (game-made, консистентный, с угольком:
HP 427 / HP_A 555). Пишем 3 персонажей в слоты 0..2: VIG99 / ATN99 / END99.

После: зайти в игру КАЖДЫМ из слотов 0..2 (дать сохраниться), затем:
    python diff_derived.py chars_before2
Если после захода HP_A/FP_A/ST_A/ST_B подтянулись к новым max — игра их чинит,
редактору можно не писать. Если остались 555/98/95 — редактор обязан писать сам.
"""
import os, sys, shutil, hashlib, struct, datetime
from Crypto.Cipher import AES

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import constants as C

SAVE = r"C:\Users\Iho\AppData\Roaming\DarkSoulsIII\011000012ff75f05\DS30000.sl2"
TEMPLATE_SL2 = SAVE + ".bak_20260712_005540"
TEMPLATE_SLOT = 2
BEFORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chars_before2")

D = C.SL2_DERIVED_OFFSETS


def build(**over):
    s = {k: 11 for k in C.STAT_ORDER}
    s.update(over)
    return s

# (метка, статы) -> слоты 0..2
BUILDS = [
    ("VIG99", build(VIG=99)),
    ("ATN99", build(ATN=99)),
    ("END99", build(END=99)),
]


def entry_hdr(save, idx):
    off = 0x40 + idx * 0x20
    size = struct.unpack_from("<Q", save, off + 0x08)[0]
    data_off = struct.unpack_from("<I", save, off + 0x10)[0]
    return size, data_off


def decrypt_entry(save, idx):
    size, do = entry_hdr(save, idx)
    iv = bytes(save[do + 16:do + 32])
    enc = bytes(save[do + 32:do + 32 + size - 32])
    return AES.new(C.AES_KEY, AES.MODE_CBC, iv).decrypt(enc)


def write_entry(save, idx, plain):
    size, do = entry_hdr(save, idx)
    iv = bytes(save[do + 16:do + 32])
    enc = AES.new(C.AES_KEY, AES.MODE_CBC, iv).encrypt(plain)
    assert len(enc) == size - 32, f"size mismatch slot {idx}: {len(enc)} vs {size-32}"
    save[do:do + 16] = hashlib.md5(iv + enc).digest()
    save[do + 32:do + 32 + len(enc)] = enc


def patch_like_editor(template, pat, stats):
    """Стат + Level + базовые производные — ровно то, что пишет Character.ts."""
    d = bytearray(template)
    for k, v in stats.items():
        struct.pack_into("<i", d, pat + C.SL2_RELATIVE_OFFSETS[k], v)
    level = sum(stats[k] for k in C.STAT_ORDER) - C.BASE_STATS_AT_ZERO
    struct.pack_into("<i", d, pat + C.SL2_LEVEL_OFFSET, level)
    # как редактор: только *_MAX, копии не трогаем
    struct.pack_into("<i", d, pat + D["HP_MAX"], C.VIGOR_TO_HP[stats["VIG"]])
    struct.pack_into("<i", d, pat + D["FP_MAX"], C.ATTUNEMENT_TO_FP[stats["ATN"]])
    struct.pack_into("<i", d, pat + D["ST_MAX"], C.ENDURANCE_TO_STAMINA[stats["END"]])
    return bytes(d), level


def main():
    for p in (SAVE, TEMPLATE_SL2):
        if not os.path.exists(p):
            sys.exit(f"нет файла: {p}")

    bk = SAVE + ".bak_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(SAVE, bk)
    print(f"бэкап: {bk}")

    with open(TEMPLATE_SL2, "rb") as f:
        tpl_save = bytearray(f.read())
    template = decrypt_entry(tpl_save, TEMPLATE_SLOT)
    pat = template.find(C.CHARACTER_PATTERN)
    if pat < 0:
        sys.exit("паттерн не найден в шаблоне")
    g = lambda rel: struct.unpack_from("<i", template, pat + rel)[0]
    print(f"шаблон: {os.path.basename(TEMPLATE_SL2)} слот {TEMPLATE_SLOT}, паттерн @ {hex(pat)}")
    print(f"  шаблонные производные: HP {g(D['HP_MAX'])}/{g(D['HP_A'])} "
          f"FP {g(D['FP_MAX'])}/{g(D['FP_A'])} ST {g(D['ST_A'])}/{g(D['ST_B'])}/{g(D['ST_MAX'])}")

    with open(SAVE, "rb") as f:
        save = bytearray(f.read())

    os.makedirs(BEFORE_DIR, exist_ok=True)

    for slot, (label, stats) in enumerate(BUILDS):
        plain, level = patch_like_editor(template, pat, stats)
        write_entry(save, slot, plain)
        with open(os.path.join(BEFORE_DIR, f"slot{slot}_{label}_before.bin"), "wb") as f:
            f.write(plain)
        gg = lambda rel: struct.unpack_from("<i", plain, pat + rel)[0]
        print(f"  слот {slot}: {label} level={level}  "
              f"HP {gg(D['HP_MAX'])}/{gg(D['HP_A'])} FP {gg(D['FP_MAX'])}/{gg(D['FP_A'])} "
              f"ST {gg(D['ST_A'])}/{gg(D['ST_B'])}/{gg(D['ST_MAX'])}")

    with open(SAVE, "wb") as f:
        f.write(save)
    print(f"\nЗаписано: {SAVE}")

    # верификация: перечитать файл
    with open(SAVE, "rb") as f:
        chk = bytearray(f.read())
    print("\nверификация из файла:")
    for slot, (label, stats) in enumerate(BUILDS):
        dec = decrypt_entry(chk, slot)
        p = dec.find(C.CHARACTER_PATTERN)
        vals = {k: struct.unpack_from("<i", dec, p + C.SL2_RELATIVE_OFFSETS[k])[0] for k in C.STAT_ORDER}
        gg = lambda rel: struct.unpack_from("<i", dec, p + rel)[0]
        ok = vals == stats
        print(f"  слот {slot} {label} ok={ok}  "
              f"HP {gg(D['HP_MAX'])}/{gg(D['HP_A'])} FP {gg(D['FP_MAX'])}/{gg(D['FP_A'])} "
              f"ST {gg(D['ST_A'])}/{gg(D['ST_B'])}/{gg(D['ST_MAX'])}")


if __name__ == "__main__":
    main()
