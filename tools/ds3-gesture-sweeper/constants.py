"""Константы для DS3 Gesture Sweeper.

Офсеты памяти взяты из DS3_TGA_v3.4.0.CT (группа "Gesture Game Data",
скрипт "Unlock All Gestures").
Цепочка указателей: [[[GameDataMan]+0x10]+0x7B8]+0x10 + 4*i

Запись на жест — 4 байта: [u16 value][u16 index], как в DS1
(см. ds1-gesture-sweeper). Значение:
    Locked   = (i+1)*2
    Unlocked = (i+1)*2 + 1
то есть бит 0 = «разблокирован».
"""

PROCESS_NAME = "DarkSoulsIII.exe"
WINDOW_TITLE_SUBSTR = "DARK SOULS III"

# --- Резолв GameDataMan (как в ds3-stat-sweeper) ---------------------------
# AOB инструкции `mov rax,[rip+disp32]` (7 байт: 48 8B 05 dd dd dd dd).
GAMEDATAMAN_AOB = "48 8B 05 ?? ?? ?? ?? 48 85 C0 ?? ?? 48 8B 40 ?? C3"

# Цепочка разыменований от [GameDataMan] до массива жестов.
# p = read_u64(GameDataMan); p = read_u64(p+0x10); p = read_u64(p+0x7B8); array = p + 0x10
GESTURE_CHAIN = [0x10, 0x7B8]
GESTURE_ARRAY_OFFSET = 0x10
GESTURE_STRIDE = 4

# Порядок и имена — из скрипта "Unlock All Gestures" и дропдаунов "Equipped
# Gestures" в CT. Индекс = позиция в массиве, значение = (i+1)*2 (+1 если открыт).
# Индексы 0x21/0x22 (Unmannered Bow, Lord of Cinder) в CT закомментированы, но
# это реальные жесты; 0x23..0x28 — вырезанные заглушки FDP_MenuText.
GESTURE_NAMES = [
    "Point Forward",       # 0x00
    "Point Up",            # 0x01
    "Point Down",          # 0x02
    "Wave",                # 0x03
    "Beckon",              # 0x04
    "Call Over",           # 0x05
    "Welcome",             # 0x06
    "Applause",            # 0x07
    "Quiet Resolve",       # 0x08
    "Jump For Joy",        # 0x09
    "Joy",                 # 0x0A
    "Rejoice",             # 0x0B
    "Hurrah!",             # 0x0C
    "Praise the Sun",      # 0x0D
    "My Thanks",           # 0x0E
    "Bow",                 # 0x0F
    "Proper Bow",          # 0x10
    "Dignified Bow",       # 0x11
    "Duel Bow",            # 0x12
    "Legion Etiquette",    # 0x13
    "Darkmoon Loyalty",    # 0x14
    "By My Sword",         # 0x15
    "Prayer",              # 0x16
    "Silent Ally",         # 0x17
    "Rest",                # 0x18
    "Collapse",            # 0x19
    "Patches Squat",       # 0x1A
    "Prostration",         # 0x1B
    "Toast",               # 0x1C
    "Sleep",               # 0x1D
    "Curl Up",             # 0x1E
    "Stretch Out",         # 0x1F
    "Path of the Dragon",  # 0x20
    "Unmannered Bow",      # 0x21  вырезан, но анимация целая — жест рабочий
    "Lord of Cinder",      # 0x22  ВЫРЕЗАН, СЛОМАН — placeholder-анимация броска кукри
    "FDP_MenuText(301140)",  # 0x23  вырезано
    "FDP_MenuText(301141)",  # 0x24  вырезано
    "FDP_MenuText(301142)",  # 0x25  вырезано
    "FDP_MenuText(301143)",  # 0x26  вырезано
    "FDP_MenuText(301144)",  # 0x27  вырезано
    "FDP_MenuText(301145)",  # 0x28  вырезано
]
GESTURE_COUNT = len(GESTURE_NAMES)

# Сколько жестов реально РАБОТАЕТ в игре: 0x00..0x21 (по Unmannered Bow).
# Записи 0x22..0x28 — сломанные: "Lord of Cinder" играет placeholder-анимацию
# броска кукри вместо идл-позы Soul of Cinder, а FDP_MenuText — пустые заглушки.
# Флаг у них ставится и сохраняется, но в игровом меню они выглядят сломанными
# (проверено в игре 2026-09-12).
# Unmannered Bow (0x21) тоже вырезанный контент, но анимация целая — оставлен.
# Прогон всё равно идёт по всем 41 — иначе не проверить структуру таблицы.
REAL_GESTURE_COUNT = 34

GESTURE_SLUGS = [
    "point_forward", "point_up", "point_down", "wave", "beckon",
    "call_over", "welcome", "applause", "quiet_resolve", "jump_for_joy",
    "joy", "rejoice", "hurrah", "praise_the_sun", "my_thanks",
    "bow", "proper_bow", "dignified_bow", "duel_bow", "legion_etiquette",
    "darkmoon_loyalty", "by_my_sword", "prayer", "silent_ally", "rest",
    "collapse", "patches_squat", "prostration", "toast", "sleep",
    "curl_up", "stretch_out", "path_of_the_dragon", "unmannered_bow",
    "lord_of_cinder",
    "fdp_301140", "fdp_301141", "fdp_301142", "fdp_301143", "fdp_301144",
    "fdp_301145",
]
assert len(GESTURE_SLUGS) == GESTURE_COUNT


def locked_value(index: int) -> int:
    return (index + 1) * 2


def unlocked_value(index: int) -> int:
    return (index + 1) * 2 + 1


# ===========================================================================
# Разбор файла сейва .sl2 (BND4 + AES-CBC) — порт из src/apps/ds3/lib
# ===========================================================================

BND4_HEADER_SIZE = 0x40
ENTRY_HEADER_SIZE = 0x20
BND4_SIGNATURE = b"BND4"
ENTRY_COUNT_OFFSET = 0x0C  # u32 LE

AES_KEY = bytes([
    0xFD, 0x46, 0x4D, 0x69, 0x5E, 0x69, 0xA3, 0x9A,
    0x10, 0xE3, 0x19, 0xA7, 0xAC, 0xE8, 0xB7, 0xFA,
])

# Паттерн начала блока персонажа: FF FF FF FF 00*12, повторённый дважды.
CHARACTER_PATTERN = bytes([
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
])

CHARACTER_SLOT_COUNT = 10   # энтри 0..9 — персонажи, 10 — системный слот
SYSTEM_ENTRY_INDEX = 10

DEFAULT_SAVE_ROOT = r"AppData\Roaming\DarkSoulsIII"
DEFAULT_SAVE_NAME = "DS30000.sl2"


def use_utf8_stdout() -> None:
    """Консоль Windows по умолчанию cp1252/cp866 — русские логи в неё не лезут."""
    import sys

    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
