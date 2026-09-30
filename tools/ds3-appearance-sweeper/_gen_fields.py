"""Одноразовый генератор таблицы полей внешности из DS3_TGA_v3.4.0.CT.

Оставлен в репозитории, чтобы таблицу в constants.py можно было пересобрать
при обновлении CT:  python _gen_fields.py <path-to.CT> > fields_block.txt
"""
import re
import sys
import xml.etree.ElementTree as ET

DEFAULT_CT = r"C:\Users\Iho\Desktop\66d84e64-5d52-4b30-bcfb-366a01304143\DS3_TGA_v3.4.0.CT"
SKIP_OFFSETS = {0x2B8}          # Weapon Sheathed — из группы Model, не внешность


def slugify(name: str) -> str:
    s = name.split(" / ")[0].lower()
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


def short_group(path: str) -> str:
    parts = [p for p in path.split("/") if p not in ("Appearance", "FaceData")]
    if parts[:1] == ["Face Detail"]:
        parts = parts[1:]
    return "/".join(parts)


def collect(ct_path: str):
    lines = open(ct_path, encoding="utf-8", errors="replace").read().split("\n")
    root = ET.fromstring("\n".join(lines[12489:14951]))
    rows = []

    def walk(e, path):
        d = (e.findtext("Description") or "").strip('"').strip()
        t = e.findtext("VariableType") or ""
        a = e.findtext("Address") or ""
        offs = [o.text for o in e.findall("Offsets/Offset")]
        if a == "GameDataMan" and len(offs) == 2 and offs[-1] == "10":
            rows.append((int(offs[0], 16), t, d, "/".join(path)))
        for c in e.findall("CheatEntries/CheatEntry"):
            walk(c, path + [d] if d else path)

    walk(root, [])
    by_off = {}
    for off, t, d, g in sorted(rows):
        if off in SKIP_OFFSETS:
            continue
        if off in by_off:
            if d not in by_off[off][2]:
                by_off[off][2].append(d)
        else:
            by_off[off] = [t, g, [d]]
    return by_off


def main() -> None:
    ct = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CT
    by_off = collect(ct)
    used = set()
    print("FIELDS = [")
    for off in sorted(by_off):
        t, g, names = by_off[off]
        kind = "f32" if t == "Float" else "u8"
        name = " / ".join(names)
        slug = slugify(name)
        n = 2
        while slug in used:
            slug = f"{slugify(name)}_{n}"
            n += 1
        used.add(slug)
        print(f"    (0x{off:03X}, {kind!r}, {short_group(g)!r}, {name!r}, {slug!r}),")
    print("]")


if __name__ == "__main__":
    main()
