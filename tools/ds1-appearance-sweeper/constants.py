"""Константы для DS1 Appearance Sweeper.

Цепочка памяти — как в DSAppearancePresetTool (BobDoleOwndU) и
1FRDarkSoulsRemastered.CT:

    BaseB = AOB `48 8B 05 ?? ?? ?? ?? 45 33 ED 48 8B F1 48 85 C0`, RIP-relative (+7)
    PGD   = [[BaseB]+0x10]                  (PlayerGameData)

Сейв хранит PGD кусками, а не одним блоком (снято `--locate` на живой игре,
2026-09-19):

    PGD+0x010..0x1BF  -> слот +0x60     (статы, имя, пол, телосложение)
    PGD+0x320..0x36F  -> слот -0x10     (экипировка, в т.ч. ID причёски)
    PGD+0x4C0..0x543  -> слот +0xDF54   (цвета, лицо, кожа)
"""

from __future__ import annotations

import struct

PROCESS_NAME = "DarkSoulsRemastered.exe"
WINDOW_TITLE_SUBSTR = "DARK SOULS"

BASEB_AOB = "48 8B 05 ?? ?? ?? ?? 45 33 ED 48 8B F1 48 85 C0"
#: p = read_u64(BaseB); PGD = read_u64(p + 0x10)
PGD_CHAIN = [0x10]

#: сколько PGD читаем для --locate / --watch по умолчанию
PGD_DUMP_SIZE = 0x800

# ===========================================================================
# Поля внешности
# ===========================================================================
# (slug, PGD-офсет, офсет в слоте, тип, описание)
# Типы: u8, i32, rgba (4 x f32), bytes50.
# Офсеты в слоте — те, что использует редактор (Character.ts); --read и
# --sweep их проверяют, а не принимают на веру.
FIELDS = [
    ("sex",         0x0CA, 0x012A, "u8",      "Пол (0 = жен., 1 = муж.)"),
    ("physique",    0x0CF, 0x012F, "u8",      "Телосложение 0..8"),
    ("face_type",   0x114, 0x0174, "u8",      "Индекс лица в меню создания"),
    ("hair_index",  0x115, 0x0175, "u8",      "Индекс причёски в меню создания"),
    ("color_index", 0x116, 0x0176, "u8",      "Индекс цвета в меню создания"),
    ("hair_id",     0x354, 0x0344, "i32",     "ID причёски (надетая деталь)"),
    ("hair_color",  0x4C0, 0xE414, "rgba",    "Цвет волос RGBA"),
    ("eye_color",   0x4D0, 0xE424, "rgba",    "Цвет глаз RGBA"),
    ("face_data",   0x4E0, 0xE434, "bytes50", "Форма лица, 50 байт"),
    ("skin_color",  0x512, 0xE466, "bytes50", "Кожа/тон, 50 байт"),
]
FIELD_BY_SLUG = {f[0]: f for f in FIELDS}

#: Поля, которые пишет/читает DSAppearancePresetTool (.dsrchr), в порядке файла.
#: Цвета в файле — только RGB (12 байт), альфа не сохраняется.
DSRCHR_LAYOUT = [
    ("sex", 1), ("physique", 1), ("hair_id", 4),
    ("hair_color", 12), ("eye_color", 12), ("face_data", 50), ("skin_color", 50),
]
DSRCHR_SIZE = sum(n for _s, n in DSRCHR_LAYOUT)   # 130

# ID причёски = надетая деталь из EquipParamProtector. Диапазоны сняты с
# реальных сейвов и пресетов: жен. 3000..3900, муж. 1000..1900, шаг 100.
# Произвольный ID = несуществующая модель, поэтому --sweep/--probe пишут только
# значения из этого списка.
HAIR_IDS = [1000 + 100 * i for i in range(10)] + [3000 + 100 * i for i in range(10)]
PHYSIQUE_MAX = 8

# Имя персонажа: PGD+0xA8 (UTF-16, в слоте +0x108)
NAME_PGD_OFFSET = 0xA8


def field_size(kind: str) -> int:
    return {"u8": 1, "i32": 4, "rgba": 16, "bytes50": 50}[kind]


def decode(kind: str, raw: bytes):
    if kind == "u8":
        return raw[0]
    if kind == "i32":
        return struct.unpack("<i", raw)[0]
    if kind == "rgba":
        return struct.unpack("<4f", raw)
    return bytes(raw)


def encode(kind: str, value) -> bytes:
    if kind == "u8":
        return bytes([value & 0xFF])
    if kind == "i32":
        return struct.pack("<i", value)
    if kind == "rgba":
        return struct.pack("<4f", *value)
    return bytes(value)


def show(kind: str, value) -> str:
    if kind == "u8":
        return f"{value}"
    if kind == "i32":
        return f"{value}"
    if kind == "rgba":
        return "(" + ", ".join(f"{c:.4f}" for c in value) + ")"
    return value.hex()


# ===========================================================================
# Разбор файла сейва .sl2 (DSR, PC) — порт из src/apps/ds1/lib
# ===========================================================================

SAVE_FILE_SIZE = 0x4204D0
SAVE_SLOT_SIZE = 0x060030
BASE_SLOT_OFFSET = 0x02C0
USER_DATA_SIZE = 0x060020
USER_DATA_FILE_COUNT = 11      # 10 персонажей + слот настроек (10)

AES_KEY = bytes([
    0x01, 0x23, 0x45, 0x67,
    0x89, 0xAB, 0xCD, 0xEF,
    0xFE, 0xDC, 0xBA, 0x98,
    0x76, 0x54, 0x32, 0x10,
])

PATTERN1 = bytes([
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
])
PATTERN1_SEARCH_START = 0x1F000
PATTERN1_SEARCH_END = 0x1FFFF

NAME_OFFSET = 0x108
NAME_MAX_BYTES = 34
LEVEL_OFFSET = 0x00F0

#: Байты 0x00..0x0F расшифрованного слота — «фантомный» IV-блок, случайный на
#: каждом сейве. В диффах его всегда игнорируем.
PHANTOM_IV_SIZE = 0x10

DEFAULT_SAVE_ROOT = r"Documents\NBGI\DARK SOULS REMASTERED"
DEFAULT_SAVE_NAME = "DRAKS0005.sl2"


def use_utf8_stdout() -> None:
    """Консоль Windows по умолчанию cp1252/cp866 — русские логи в неё не лезут."""
    import sys

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
