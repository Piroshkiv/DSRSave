"""Константы для DS1 Gesture Sweeper.

Офсеты памяти взяты из 1FRDarkSoulsRemastered.CT (группа "Gesture Game Data").
Цепочка указателей: [[[BaseB]+0x10]+0x568]+0x10 + 4*i   (byte на каждый жест)

Значение байта жеста: (i+1)*2      — Locked
                      (i+1)*2 + 1  — Unlocked
(из DropDownList'ов CT и из скрипта "Unlock All Gestures (AOB)", который пишет
 записи по 4 байта: [value, 00, index, 00]).
"""

PROCESS_NAME = "DarkSoulsRemastered.exe"
WINDOW_TITLE_SUBSTR = "DARK SOULS"

# --- Резолв BaseB (из скрипта "Open" в .CT) --------------------------------
# aobscanmodule(GetB,DarkSoulsRemastered.exe,48 8B 05 xx xx xx xx 45 33 ED 48 8B F1 48 85 C0)
# addr = GetB + readInteger(GetB+3) + 7  -> BaseB (адрес переменной-указателя)
BASEB_AOB = "48 8B 05 ?? ?? ?? ?? 45 33 ED 48 8B F1 48 85 C0"

# Цепочка разыменований от [BaseB] до массива жестов.
# p = read_u64(BaseB); p = read_u64(p+0x10); p = read_u64(p+0x568); array = p + 0x10
GESTURE_CHAIN = [0x10, 0x568]
GESTURE_ARRAY_OFFSET = 0x10
GESTURE_STRIDE = 4

# Порядок и имена — строго как в CT (индекс = позиция в массиве).
GESTURE_NAMES = [
    "Point Forward",       # 0  -> 2 / 3
    "Point Up",            # 1  -> 4 / 5
    "Point Down",          # 2  -> 6 / 7
    "Beckon",              # 3  -> 8 / 9
    "Wave",                # 4  -> 10 / 11
    "Bow",                 # 5  -> 12 / 13
    "Proper Bow",          # 6  -> 14 / 15
    "Hurrah",              # 7  -> 16 / 17
    "Joy",                 # 8  -> 18 / 19
    "Shrug",               # 9  -> 20 / 21
    "Look Skyward",        # 10 -> 22 / 23
    "Well! What is it!",   # 11 -> 24 / 25
    "Prostration",         # 12 -> 26 / 27
    "Prayer",              # 13 -> 28 / 29
    "Praise The Sun",      # 14 -> 30 / 31
]
GESTURE_COUNT = len(GESTURE_NAMES)

# Короткие slug'и для имён файлов дампов.
GESTURE_SLUGS = [
    "point_forward", "point_up", "point_down", "beckon", "wave",
    "bow", "proper_bow", "hurrah", "joy", "shrug",
    "look_skyward", "well_what_is_it", "prostration", "prayer", "praise_the_sun",
]


def locked_value(index: int) -> int:
    return (index + 1) * 2


def unlocked_value(index: int) -> int:
    return (index + 1) * 2 + 1


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

# Слот на диске: [MD5 16][IV 16][ciphertext].
# Редактор (и этот тул) читают со сдвигом +16: MD5 скармливается как IV, реальный
# IV становится первым "фантомным" блоком открытых данных. Так офсеты дампов
# совпадают с офсетами в Character.ts (имя на 0x108 и т.д.).
# См. комментарий класса в src/apps/ds1/lib/SaveFileEditor.ts.

# Pattern1 — якорь блока флагов (костры, мировые события, NG+).
PATTERN1 = bytes([
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
])
PATTERN1_SEARCH_START = 0x1F000
PATTERN1_SEARCH_END = 0x1FFFF

NAME_OFFSET = 0x108
NAME_MAX_BYTES = 34
LEVEL_OFFSET = 0x00F0

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
