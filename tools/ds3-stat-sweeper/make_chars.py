"""Создать 10 персонажей в сейве через редактор (байтовый патч), для теста бана.

Клонирует валидный слот-шаблон во все 10 слотов, в каждом патчит только 9 статов
и Soul Level (как сейв-эдитор), а производные (HP/FP/резисты/хеш 0x60) ОСТАВЛЯЕТ
старыми — их пересчитает игра при входе. Активирует все 10 слотов в энтри 10.

После: зайти в игру каждым персонажем -> игра пересчитает -> сравнить before/after.

Билды: слот0 = все 11 (база), слоты 1..9 = один стат=99, остальные 11.
"""
import os, sys, shutil, hashlib, struct, datetime
from Crypto.Cipher import AES

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import constants as C

SAVE = r"C:\Users\Iho\AppData\Roaming\DarkSoulsIII\011000012ff75f05\DS30000.sl2"
TEMPLATE_SLOT = 2
SLOT_FLAGS_OFFSET = 0x1098
BEFORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chars_before")

# билды: (метка, {стат: значение})
def build(**over):
    s = {k: 11 for k in C.STAT_ORDER}
    s.update(over)
    return s

BUILDS = [
    ("base11", build()),
    ("VIG99", build(VIG=99)),
    ("ATN99", build(ATN=99)),
    ("END99", build(END=99)),
    ("STR99", build(STR=99)),
    ("DEX99", build(DEX=99)),
    ("INT99", build(INT=99)),
    ("FTH99", build(FTH=99)),
    ("LCK99", build(LCK=99)),
    ("VIT99", build(VIT=99)),
]
assert len(BUILDS) == 10


def entry_hdr(save, idx):
    off = 0x40 + idx * 0x20
    size = struct.unpack_from("<Q", save, off + 0x08)[0]
    data_off = struct.unpack_from("<I", save, off + 0x10)[0]
    return size, data_off


def decrypt_entry(save, idx):
    size, do = entry_hdr(save, idx)
    iv = bytes(save[do + 16:do + 32])
    enc = bytes(save[do + 32:do + 32 + size - 32])
    dec = AES.new(C.AES_KEY, AES.MODE_CBC, iv).decrypt(enc)
    return dec, iv, do, size


def write_entry(save, idx, plain):
    """Зашифровать plain IV-ом слота idx, пересчитать MD5, записать в save (in place)."""
    size, do = entry_hdr(save, idx)
    iv = bytes(save[do + 16:do + 32])
    enc = AES.new(C.AES_KEY, AES.MODE_CBC, iv).encrypt(plain)
    assert len(enc) == size - 32, f"size mismatch slot {idx}: {len(enc)} vs {size-32}"
    md5 = hashlib.md5(iv + enc).digest()
    save[do:do + 16] = md5
    save[do + 32:do + 32 + len(enc)] = enc


def find_pattern(dec):
    p = dec.find(C.CHARACTER_PATTERN)
    if p < 0:
        raise RuntimeError("паттерн не найден в шаблоне")
    return p


def patch_stats(dec, pat, stats):
    d = bytearray(dec)
    for k, v in stats.items():
        off = pat + C.SL2_RELATIVE_OFFSETS[k]
        struct.pack_into("<i", d, off, v)
    level = sum(stats[k] for k in C.STAT_ORDER) - C.BASE_STATS_AT_ZERO
    struct.pack_into("<i", d, pat + C.SL2_LEVEL_OFFSET, level)
    return bytes(d), level


def main():
    if not os.path.exists(SAVE):
        sys.exit(f"нет сейва: {SAVE}")
    # бэкап
    bk = SAVE + ".bak_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    shutil.copy2(SAVE, bk)
    print(f"бэкап: {bk}")

    with open(SAVE, "rb") as f:
        save = bytearray(f.read())

    template, _, _, _ = decrypt_entry(save, TEMPLATE_SLOT)
    pat = find_pattern(template)
    print(f"шаблон: слот {TEMPLATE_SLOT}, паттерн @ {hex(pat)}, размер {len(template)}")

    os.makedirs(BEFORE_DIR, exist_ok=True)

    for slot, (label, stats) in enumerate(BUILDS):
        plain, level = patch_stats(template, pat, stats)
        write_entry(save, slot, plain)
        # сохранить editor-версию (before login) для будущего дифа
        with open(os.path.join(BEFORE_DIR, f"slot{slot}_{label}_before.bin"), "wb") as f:
            f.write(plain)
        print(f"  слот {slot}: {label:<7} level={level}  "
              + " ".join(f"{k}={stats[k]}" for k in C.STAT_ORDER))

    # активировать все 10 слотов в энтри 10
    e10, _, _, _ = decrypt_entry(save, 10)
    e10 = bytearray(e10)
    before = [e10[SLOT_FLAGS_OFFSET + i] for i in range(10)]
    for i in range(10):
        e10[SLOT_FLAGS_OFFSET + i] = 0x01
    write_entry(save, 10, bytes(e10))
    print(f"\nэнтри10 флаги слотов: {['%02x'%b for b in before]} -> все 0x01")

    with open(SAVE, "wb") as f:
        f.write(save)
    print(f"\nЗаписано: {SAVE}")

    # верификация: перечитать и показать статы каждого слота
    with open(SAVE, "rb") as f:
        chk = bytearray(f.read())
    print("\nверификация из файла:")
    for slot, (label, stats) in enumerate(BUILDS):
        dec, _, _, _ = decrypt_entry(chk, slot)
        p = dec.find(C.CHARACTER_PATTERN)
        vals = {k: struct.unpack_from("<i", dec, p + C.SL2_RELATIVE_OFFSETS[k])[0] for k in C.STAT_ORDER}
        lvl = struct.unpack_from("<i", dec, p + C.SL2_LEVEL_OFFSET)[0]
        ok = vals == stats
        print(f"  слот {slot} {label:<7} lvl={lvl} ok={ok}")


if __name__ == "__main__":
    main()
