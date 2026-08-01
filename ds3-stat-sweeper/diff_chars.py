"""Диф 'до (эдитор) vs после (игра пересчитала)' по каждому слоту.

Запускать ПОСЛЕ того, как зайти в игру каждым персонажем (игра пересчитает и пересохранит).
Показывает поимённо, какие байты игра изменила = что редактор оставлял рассинхронизированным.
"""
import os, sys, glob, struct
from Crypto.Cipher import AES

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import constants as C

SAVE = r"C:\Users\Iho\AppData\Roaming\DarkSoulsIII\011000012ff75f05\DS30000.sl2"
BEFORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chars_before")

KNOWN = {
    -0x134: "HP-A(скрытое)", -0x130: "HP-max", -0x128: "FP-A", -0x124: "FP-max",
    -0x11c: "Stamina", -0x118: "Stamina", -0x114: "Stamina",
    -0x10C: "VIG", -0x108: "ATN", -0x104: "END", -0x100: "STR", -0xFC: "DEX",
    -0xF8: "INT", -0xF4: "FTH", -0xF0: "LCK", -0xE4: "VIT", -0xE0: "Level", -0xDC: "Souls",
    -0x70: "Резист", -0x6c: "Резист", -0x68: "Резист", -0x64: "Резист", -0x60: "Резист",
}
HEADER = {0x0C: "playtime/счётчик", 0x24: "служебное", 0x60: "хеш(16)"}


def entry_hdr(save, idx):
    off = 0x40 + idx * 0x20
    size = struct.unpack_from("<Q", save, off + 0x08)[0]
    do = struct.unpack_from("<I", save, off + 0x10)[0]
    return size, do


def decrypt_entry(save, idx):
    size, do = entry_hdr(save, idx)
    iv = bytes(save[do + 16:do + 32])
    enc = bytes(save[do + 32:do + 32 + size - 32])
    return AES.new(C.AES_KEY, AES.MODE_CBC, iv).decrypt(enc)


def annotate(off, pat):
    if off in HEADER:
        return f"[{HEADER[off]}]"
    if pat >= 0:
        r = off - pat
        for k, name in KNOWN.items():
            if 0 <= r - k < 4:
                return f"[{name} pat{k:+#x}]"
        return f"pat{r:+#x}"
    return hex(off)


def runs(offs):
    out = []
    if not offs:
        return out
    s = p = offs[0]
    for o in offs[1:]:
        if o == p + 1:
            p = o
        else:
            out.append((s, p)); s = p = o
    out.append((s, p))
    return out


def main():
    with open(SAVE, "rb") as f:
        save = bytearray(f.read())

    befores = {}
    for path in glob.glob(os.path.join(BEFORE_DIR, "slot*_before.bin")):
        base = os.path.basename(path)
        slot = int(base[4:base.index("_")])
        befores[slot] = path

    for slot in sorted(befores):
        with open(befores[slot], "rb") as f:
            before = f.read()
        after = decrypt_entry(save, slot)
        label = os.path.basename(befores[slot]).split("_")[1]
        pat = after.find(C.CHARACTER_PATTERN)

        diffs = [i for i in range(min(len(before), len(after))) if before[i] != after[i]]
        print(f"\n===== слот {slot} [{label}] изменённых байт: {len(diffs)} (паттерн @ {hex(pat)}) =====")
        for a, b in runs(diffs):
            w = b - a + 1
            bv = before[a:b+1]
            av = after[a:b+1]
            # компактно: как int если <=4
            if w <= 4:
                bi = int.from_bytes(bv, "little"); ai = int.from_bytes(av, "little")
                val = f"{bi} -> {ai}"
            else:
                val = f"{bv.hex()} -> {av.hex()}"
            print(f"  {annotate(a, pat):<22} off={hex(a):<8} w{w:<2} {val}")


if __name__ == "__main__":
    main()
