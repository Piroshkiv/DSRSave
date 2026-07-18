"""Целевой диф блока персонажа: до(эдитор) vs после(игра), выровнено по паттерну.

Смотрим только окно вокруг паттерна (где статы/уровень/производные), чтобы
геймплейный шум (позиция/мир/инвентарь) не мешал. Плюс явный список известных
производных полей before->after и поиск НЕизвестных изменившихся полей в окне.
"""
import os, sys, glob, struct
from Crypto.Cipher import AES

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import constants as C

SAVE = r"C:\Users\Iho\AppData\Roaming\DarkSoulsIII\011000012ff75f05\DS30000.sl2"
# папка с *_before.bin можно передать аргументом: python diff_derived.py chars_before2
BEFORE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                          sys.argv[1] if len(sys.argv) > 1 else "chars_before")

WIN_LO, WIN_HI = -0x140, 0x10   # окно относительно паттерна

KNOWN = {
    -0x134: "HP-A(скрытое)", -0x130: "HP-max", -0x128: "FP-A", -0x124: "FP-max",
    -0x11c: "Stamina-A", -0x118: "Stamina-B", -0x114: "Stamina-max",
    -0x10C: "VIG", -0x108: "ATN", -0x104: "END", -0x100: "STR", -0xFC: "DEX",
    -0xF8: "INT", -0xF4: "FTH", -0xF0: "LCK", -0xE4: "VIT", -0xE0: "Level", -0xDC: "Souls",
    -0x70: "Резист1", -0x6c: "Резист2", -0x68: "Резист3", -0x64: "Резист4", -0x60: "Резист5",
}


def entry_hdr(save, idx):
    off = 0x40 + idx * 0x20
    return struct.unpack_from("<Q", save, off + 0x08)[0], struct.unpack_from("<I", save, off + 0x10)[0]

def decrypt_entry(save, idx):
    size, do = entry_hdr(save, idx)
    iv = bytes(save[do + 16:do + 32])
    enc = bytes(save[do + 32:do + 32 + size - 32])
    return AES.new(C.AES_KEY, AES.MODE_CBC, iv).decrypt(enc)


def main():
    with open(SAVE, "rb") as f:
        save = bytearray(f.read())

    befores = {}
    for path in glob.glob(os.path.join(BEFORE_DIR, "slot*_before.bin")):
        base = os.path.basename(path)
        befores[int(base[4:base.index("_")])] = path

    for slot in sorted(befores):
        with open(befores[slot], "rb") as f:
            before = f.read()
        after = decrypt_entry(save, slot)
        label = os.path.basename(befores[slot]).split("_")[1]
        pb = before.find(C.CHARACTER_PATTERN)
        pa = after.find(C.CHARACTER_PATTERN)
        print(f"\n===== слот {slot} [{label}]  паттерн before@{hex(pb)} after@{hex(pa)} =====")

        # 1) известные поля: before -> after (значение как int)
        print("  известные поля (before -> after):")
        for rel in sorted(KNOWN):
            name = KNOWN[rel]
            w = 4
            bi = struct.unpack_from("<i", before, pb + rel)[0]
            ai = struct.unpack_from("<i", after, pa + rel)[0]
            mark = "" if bi == ai else "   <== ИЗМЕНЕНО игрой"
            print(f"    {name:<14} pat{rel:+#x}: {bi} -> {ai}{mark}")

        # 2) любые изменившиеся байты в окне, НЕ покрытые known
        known_offs = set()
        for rel in KNOWN:
            for k in range(4):
                known_offs.add(rel + k)
        changed_unknown = []
        for rel in range(WIN_LO, WIN_HI):
            if before[pb + rel] != after[pa + rel] and rel not in known_offs:
                changed_unknown.append(rel)
        if changed_unknown:
            print("  НЕизвестные изменившиеся байты в окне (кандидаты на скрытое поле):")
            # группируем
            s = p = changed_unknown[0]
            groups = []
            for r in changed_unknown[1:]:
                if r == p + 1: p = r
                else: groups.append((s, p)); s = p = r
            groups.append((s, p))
            for a, b in groups:
                bv = bytes(before[pb+a:pb+b+1]).hex()
                av = bytes(after[pa+a:pa+b+1]).hex()
                print(f"    pat{a:+#x}..{b:+#x}: {bv} -> {av}")
        else:
            print("  НЕизвестных изменений в окне нет")


if __name__ == "__main__":
    main()
