"""Константы для DS3 Appearance Sweeper.

Офсеты памяти взяты из DS3_TGA_v3.4.0.CT, группа "Appearance" и скрипты
"Save / Restore Current FaceData" / "Save to file". Таблицу ведёт команда
The Grand Archives; у самих этих скриптов автор в таблице не указан.

Цепочка: PlayerGameData = [[GameDataMan]+0x10], дальше офсет поля.

Скрипт сохранения внешности в CT работает ровно с тремя блоками:

    facedata = PGD + 0x6B8, 192 байта      # причёска/лицо/цвета/косметика
    misc     = PGD + 0x0AA,   4 байта      # gender, voice, ?, ?
    body     = PGD + 0x3B0,  28 байт       # 7 float пропорций тела

192 байта — это данные для v1.14 (2017). В самой таблице поля доходят до
+0x782, то есть блок на деле не короче 0xCB. Поэтому FACE читаем шире (0xD0),
а где реально кончаются данные — покажет прогон.

Таблица FIELDS сгенерирована из CT скриптом `_gen_fields.py`.
"""

from __future__ import annotations

import struct

PROCESS_NAME = "DarkSoulsIII.exe"
WINDOW_TITLE_SUBSTR = "DARK SOULS III"

# --- Резолв GameDataMan (тот же AOB, что в gesture/stat sweeper) -----------
GAMEDATAMAN_AOB = "48 8B 05 ?? ?? ?? ?? 48 85 C0 ?? ?? 48 8B 40 ?? C3"

#: p = read_u64(GameDataMan); PlayerGameData = read_u64(p + 0x10)
PGD_CHAIN = [0x10]

# --- Блоки внешности в PlayerGameData --------------------------------------
#: имя -> (офсет в PGD, длина). Длина FACE взята с запасом против CT-шных 192.
BLOCKS = {
    "misc": (0x0AA, 0x06),
    "body": (0x3B0, 0x1C),
    "face": (0x6B8, 0xD0),
}
#: сколько байт блока face подтверждено скриптом CT (0x6B8..0x777)
FACE_CT_SIZE = 192

# --- Где блоки лежат в СЕЙВЕ (итог прогона 2026-09-12) ----------------------
# Абсолютный офсет плавает вместе с инвентарём, поэтому face-блок ищется так же,
# как блок костров: грубая оценка от якоря костров + поиск сигнатуры в окне.
# Замерено на 99 персонажах из 15 файлов (4 профиля + бэкапы): дельта от блока
# костров укладывается в -0xA153 … -0xA337, оценка по середине даёт 99/99.
FACE_COARSE_FROM_BONFIRE = -0xA245
FACE_SEARCH_WINDOW = 0x800     # ±; на 99/99 хватало и ±0x200, запас бесплатный

#: misc-блок (gender/voice) — от якоря CHARACTER_PATTERN, как остальные статы.
#: Сходится с уже известным редактору CLASS = pattern-0xA2: в памяти class лежит
#: на PGD+0xAE, то есть на 4 байта дальше gender (PGD+0xAA).
MISC_FROM_CHARACTER_PATTERN = -0xA6

#: Блоки, которые в сейв НЕ попадают (проверено 2026-09-12: 28 байт body из памяти
#: не находятся в слоте ни разу). Пропорции тела хранятся в face-блоке байтами
#: 0x704..0x70A ("Build Detail"), а float'ы в PGD+0x3B0 — их runtime-развёртка,
#: значение = байт/255.
RUNTIME_ONLY_BLOCKS = {"body"}

# --- Поля, в которые НЕЛЬЗЯ писать произвольное значение --------------------
# Это не ползунки 0..255, а ИНДЕКСЫ моделей/ассетов (u32). Запись значения вне
# диапазона = запрос несуществующей причёски/бороды/зрачка, и игра вылетает —
# ровно это случилось на первом прогоне 2026-09-12.
#
# Верхние границы у большинства неизвестны (нужен разбор паравов), поэтому по
# умолчанию прогон их просто НЕ ТРОГАЕТ: их положение в блоке и так известно —
# блок находится по совпадению с памятью целиком, и офсет поля внутри него задан
# таблицей. Маркеры нужны были только как доказательство.
ID_FIELDS = {
    0x0AA: 1,     # Gender  0..1
    0x0AB: 2,     # Voice   0..2
    0x0AE: 9,     # Class   0..9
    0x6B8: 3,     # Age     0..3 (Young / Mature / Aged / Gael's Beard)
    0x6BC: None,  # Hair Style
    0x6C0: None,  # Left Pupil
    0x6C4: None,  # Right Pupil
    0x6C8: None,  # Brow Style
    0x6CC: None,  # Beard Style
    0x6D4: None,  # Tattoo/Mark
    0x6D8: None,  # Eyelashes Type
}


def is_pokeable(offset: int) -> bool:
    """Можно ли писать в поле произвольное значение, не рискуя уронить игру.

    Нельзя: ID-поля (см. ID_FIELDS) и всё, что лежит в runtime-блоках.
    """
    if offset in ID_FIELDS:
        return False
    block, _ = block_of(offset)
    return block is not None and block not in RUNTIME_ONLY_BLOCKS

# --- Таблица полей ---------------------------------------------------------
# (офсет в PlayerGameData, тип, группа, имя из CT, слаг)
FIELDS = [
    (0x0AA, 'u8', 'Misc', 'Gender', 'gender'),
    (0x0AB, 'u8', 'Misc', 'Voice', 'voice'),
    (0x0AE, 'u8', 'Misc', 'Class', 'class'),
    (0x3B0, 'f32', 'Body Proportions', 'Head Size', 'head_size'),
    (0x3B4, 'f32', 'Body Proportions', 'Upper Body', 'upper_body'),
    (0x3B8, 'f32', 'Body Proportions', 'Lower Body', 'lower_body'),
    (0x3BC, 'f32', 'Body Proportions', 'Right Hand', 'right_hand'),
    (0x3C0, 'f32', 'Body Proportions', 'Right Leg', 'right_leg'),
    (0x3C4, 'f32', 'Body Proportions', 'Left Hand', 'left_hand'),
    (0x3C8, 'f32', 'Body Proportions', 'Left Leg', 'left_leg'),
    (0x6B8, 'u8', 'Misc', 'Age', 'age'),
    (0x6BC, 'u8', 'Hair/Facial Har', 'Hair Style', 'hair_style'),
    (0x6C0, 'u8', 'Pupils', 'Left Pupil / Pupils', 'left_pupil'),
    (0x6C4, 'u8', 'Pupils', 'Pupils 2 / Right Pupil', 'pupils_2'),
    (0x6C8, 'u8', 'Hair/Facial Har', 'Brow Style', 'brow_style'),
    (0x6CC, 'u8', 'Hair/Facial Har', 'Beard Style', 'beard_style'),
    (0x6D4, 'u8', 'Tattoo/Mark', 'Tatoo/Mark', 'tatoo_mark'),
    (0x6D8, 'u8', 'Hair/Facial Har', 'Eyelashes Type', 'eyelashes_type'),
    (0x6DC, 'u8', 'Base Skin Color', 'Red', 'red'),
    (0x6DD, 'u8', 'Base Skin Color', 'Green', 'green'),
    (0x6DE, 'u8', 'Base Skin Color', 'Blue', 'blue'),
    (0x6E0, 'u8', 'Hair/Facial Har', 'Hair Color Red / Hair/Brow/Beard Red', 'hair_color_red'),
    (0x6E1, 'u8', 'Hair/Facial Har', 'Hair Color Green / Hair/Brow/Beard Green', 'hair_color_green'),
    (0x6E2, 'u8', 'Hair/Facial Har', 'Hair Color Blue / Hair/Brow/Beard Blue', 'hair_color_blue'),
    (0x6E4, 'u8', 'Pupils', 'Color of Pupils Red / Left Pupil Color Red', 'color_of_pupils_red'),
    (0x6E5, 'u8', 'Pupils', 'Color of Pupils Green / Left Pupil Color Green', 'color_of_pupils_green'),
    (0x6E6, 'u8', 'Pupils', 'Color of Pupils Blue / Left Pupil Color Blue', 'color_of_pupils_blue'),
    (0x6E8, 'u8', 'Pupils', 'Color of Pupils Red / Right Pupil Color Red', 'color_of_pupils_red_2'),
    (0x6E9, 'u8', 'Pupils', 'Color of Pupils Green / Right Pupil Color Green', 'color_of_pupils_green_2'),
    (0x6EA, 'u8', 'Pupils', 'Color of Pupils Blue / Right Pupil Color Blue', 'color_of_pupils_blue_2'),
    (0x6EC, 'u8', 'Hair/Facial Har', 'Brow Red / Hair/Brow/Beard Red', 'brow_red'),
    (0x6ED, 'u8', 'Hair/Facial Har', 'Brow Green / Hair/Brow/Beard Green', 'brow_green'),
    (0x6EE, 'u8', 'Hair/Facial Har', 'Brow Blue / Hair/Brow/Beard Blue', 'brow_blue'),
    (0x6F0, 'u8', 'Hair/Facial Har', 'Beard Red / Hair/Brow/Beard Red', 'beard_red'),
    (0x6F1, 'u8', 'Hair/Facial Har', 'Beard Green / Hair/Brow/Beard Green', 'beard_green'),
    (0x6F2, 'u8', 'Hair/Facial Har', 'Beard Blue / Hair/Brow/Beard Blue', 'beard_blue'),
    (0x6F8, 'u8', 'Tattoo/Mark', 'Tattoo/Mark Color Red', 'tattoo_mark_color_red'),
    (0x6F9, 'u8', 'Tattoo/Mark', 'Tattoo/Mark Color Green', 'tattoo_mark_color_green'),
    (0x6FA, 'u8', 'Tattoo/Mark', 'Tattoo/Mark Color Blue', 'tattoo_mark_color_blue'),
    (0x6FC, 'u8', 'Hair/Facial Har', 'Eyelash Color Red', 'eyelash_color_red'),
    (0x6FD, 'u8', 'Hair/Facial Har', 'Eyelash Color Green', 'eyelash_color_green'),
    (0x6FE, 'u8', 'Hair/Facial Har', 'Eyelash Color Blue', 'eyelash_color_blue'),
    (0x700, 'u8', 'Tattoo/Mark', 'Position (Horizontal)', 'position_horizontal'),
    (0x701, 'u8', 'Tattoo/Mark', 'Position Vertical', 'position_vertical'),
    (0x702, 'u8', 'Tattoo/Mark', 'Angle', 'angle'),
    (0x703, 'u8', 'Tattoo/Mark', 'Expansion', 'expansion'),
    (0x704, 'u8', 'Build Detail', 'Head', 'head'),
    (0x705, 'u8', 'Build Detail', 'Chest', 'chest'),
    (0x706, 'u8', 'Build Detail', 'Abdomen', 'abdomen'),
    (0x707, 'u8', 'Build Detail', 'Arm 1', 'arm_1'),
    (0x708, 'u8', 'Build Detail', 'Leg 1', 'leg_1'),
    (0x709, 'u8', 'Build Detail', 'Arm 2', 'arm_2'),
    (0x70A, 'u8', 'Build Detail', 'Leg 2', 'leg_2'),
    (0x71E, 'u8', 'Features', 'Apparent Age', 'apparent_age'),
    (0x71F, 'u8', 'Features', 'Facial Aesthetic', 'facial_aesthetic'),
    (0x720, 'u8', 'Features', 'Form Emphasis', 'form_emphasis'),
    (0x722, 'u8', 'Face Shape/Brow Ridge', 'Brow Ridge Height', 'brow_ridge_height'),
    (0x723, 'u8', 'Face Shape/Brow Ridge', 'Inner Brow Ridge', 'inner_brow_ridge'),
    (0x724, 'u8', 'Face Shape/Brow Ridge', 'Outer Brow Ridge', 'outer_brow_ridge'),
    (0x725, 'u8', 'Face Shape/Cheeks', 'Cheekbone Height', 'cheekbone_height'),
    (0x726, 'u8', 'Face Shape/Cheeks', 'Chekbone Depth', 'chekbone_depth'),
    (0x727, 'u8', 'Face Shape/Cheeks', 'Checkbonde Width', 'checkbonde_width'),
    (0x728, 'u8', 'Face Shape/Cheeks', 'Cheekbone', 'cheekbone'),
    (0x729, 'u8', 'Face Shape/Cheeks', 'Cheeks', 'cheeks'),
    (0x72A, 'u8', 'Face Shape/Chin', 'Chin Tip Position', 'chin_tip_position'),
    (0x72B, 'u8', 'Face Shape/Chin', 'Chin Length', 'chin_length'),
    (0x72C, 'u8', 'Face Shape/Chin', 'Chin Protrusion', 'chin_protrusion'),
    (0x72D, 'u8', 'Face Shape/Chin', 'Chin Depth', 'chin_depth'),
    (0x72E, 'u8', 'Face Shape/Chin', 'Chin Size', 'chin_size'),
    (0x72F, 'u8', 'Face Shape/Chin', 'Chin Height', 'chin_height'),
    (0x730, 'u8', 'Face Shape/Chin', 'Chin Width', 'chin_width'),
    (0x731, 'u8', 'Face Shape/Eyes', 'Eye Position', 'eye_position'),
    (0x732, 'u8', 'Face Shape/Eyes', 'Eye Size', 'eye_size'),
    (0x733, 'u8', 'Face Shape/Eyes', 'Eye Slant', 'eye_slant'),
    (0x734, 'u8', 'Face Shape/Eyes', 'Eye Spacing', 'eye_spacing'),
    (0x735, 'u8', 'Face Shape/Facial Balance', 'Nose Size', 'nose_size'),
    (0x736, 'u8', 'Face Shape/Facial Balance', 'Nose/Forehead Ratio', 'nose_forehead_ratio'),
    (0x738, 'u8', 'Face Shape/Facial Balance', 'Face Protrusion', 'face_protrusion'),
    (0x739, 'u8', 'Face Shape/Facial Balance', 'Vert.Facial Spacing', 'vert_facial_spacing'),
    (0x73A, 'u8', 'Face Shape/Facial Balance', 'Facial Feature Slant', 'facial_feature_slant'),
    (0x73B, 'u8', 'Face Shape/Facial Balance', 'Horiz. Facial', 'horiz_facial'),
    (0x73D, 'u8', 'Face Shape/Forehead/Glabella', 'Forehead Depth', 'forehead_depth'),
    (0x73E, 'u8', 'Face Shape/Forehead/Glabella', 'Forehead Protrusion', 'forehead_protrusion'),
    (0x740, 'u8', 'Face Shape/Jaw', 'Jaw Position', 'jaw_position'),
    (0x741, 'u8', 'Face Shape/Jaw', 'Jaw Width', 'jaw_width'),
    (0x742, 'u8', 'Face Shape/Jaw', 'Lower Jaw', 'lower_jaw'),
    (0x743, 'u8', 'Face Shape/Jaw', 'Jaw Contour', 'jaw_contour'),
    (0x744, 'u8', 'Face Shape/Lips', 'Lip Shape', 'lip_shape'),
    (0x745, 'u8', 'Face Shape/Lips', 'Mouth Expression', 'mouth_expression'),
    (0x746, 'u8', 'Face Shape/Lips', 'Lip Fullness', 'lip_fullness'),
    (0x747, 'u8', 'Face Shape/Lips', 'Lip Size', 'lip_size'),
    (0x748, 'u8', 'Face Shape/Lips', 'Lip Protrusion', 'lip_protrusion'),
    (0x74A, 'u8', 'Face Shape/Mouth', 'Mouth Protrusion', 'mouth_protrusion'),
    (0x74B, 'u8', 'Face Shape/Mouth', 'Mouth Slant', 'mouth_slant'),
    (0x74C, 'u8', 'Face Shape/Mouth', 'Occlusion', 'occlusion'),
    (0x74D, 'u8', 'Face Shape/Mouth', 'Mouth Position', 'mouth_position'),
    (0x74E, 'u8', 'Face Shape/Mouth', 'Mouth Width', 'mouth_width'),
    (0x74F, 'u8', 'Face Shape/Mouth', 'Mouth-Chin Distance', 'mouth_chin_distance'),
    (0x750, 'u8', 'Face Shape/Nose Ridge', 'Nose Ridge Depth', 'nose_ridge_depth'),
    (0x751, 'u8', 'Face Shape/Nose Ridge', 'Nose Ridge Lenght', 'nose_ridge_lenght'),
    (0x752, 'u8', 'Face Shape/Nose Ridge', 'Nose Position', 'nose_position'),
    (0x753, 'u8', 'Face Shape/Nose Ridge', 'Nose Tip Height', 'nose_tip_height'),
    (0x754, 'u8', 'Face Shape/Nostrils', 'Nostril Slant', 'nostril_slant'),
    (0x755, 'u8', 'Face Shape/Nostrils', 'Nostril Size', 'nostril_size'),
    (0x756, 'u8', 'Face Shape/Nostrils', 'Nostril Width', 'nostril_width'),
    (0x757, 'u8', 'Face Shape/Nose Ridge', 'Nose Protrusion', 'nose_protrusion'),
    (0x758, 'u8', 'Face Shape/Forehead/Glabella', 'Nose Bridge Height', 'nose_bridge_height'),
    (0x759, 'u8', 'Face Shape/Forehead/Glabella', 'Bridge Protrusion 1', 'bridge_protrusion_1'),
    (0x75A, 'u8', 'Face Shape/Forehead/Glabella', 'Bridge Protrusion 2', 'bridge_protrusion_2'),
    (0x75B, 'u8', 'Face Shape/Forehead/Glabella', 'Nose Bridge Width', 'nose_bridge_width'),
    (0x75C, 'u8', 'Face Shape/Nose Ridge', 'Nose Height', 'nose_height'),
    (0x75D, 'u8', 'Face Shape/Nose Ridge', 'Nose Slant', 'nose_slant'),
    (0x765, 'u8', 'Base Skin Color', 'Cheek Color', 'cheek_color'),
    (0x766, 'u8', 'Cosmetics', 'Tone Around Eyes', 'tone_around_eyes'),
    (0x767, 'u8', 'Cosmetics', 'Eye Socket', 'eye_socket'),
    (0x771, 'u8', 'Cosmetics', 'Eyelid Brightness', 'eyelid_brightness'),
    (0x772, 'u8', 'Cosmetics', 'Eyelid Color', 'eyelid_color'),
    (0x773, 'u8', 'Cosmetics', 'Eyeliner', 'eyeliner'),
    (0x774, 'u8', 'Cosmetics', 'Eye Shadow', 'eye_shadow'),
    (0x779, 'u8', 'Cosmetics', 'Lipstick 1', 'lipstick_1'),
    (0x77A, 'u8', 'Cosmetics', 'Lipstick 2', 'lipstick_2'),
    (0x77B, 'u8', 'Base Skin Color', 'Laugh Lines', 'laugh_lines'),
    (0x77C, 'u8', 'Face Shape/Nostrils', 'Nasal Size', 'nasal_size'),
    (0x77D, 'u8', 'Base Skin Color', 'Nose Bridge Color', 'nose_bridge_color'),
    (0x77E, 'u8', 'Base Skin Color', 'Skin Color Layer 4', 'skin_color_layer_4'),
    (0x77F, 'u8', 'Base Skin Color', 'Skin Tone', 'skin_tone'),
    (0x780, 'u8', 'Base Skin Color', 'Skin Color Layer 1', 'skin_color_layer_1'),
    (0x781, 'u8', 'Base Skin Color', 'Skin Color Layer 2', 'skin_color_layer_2'),
    (0x782, 'u8', 'Base Skin Color', 'Skin Color Layer 3', 'skin_color_layer_3'),
]

FIELD_BY_OFFSET = {f[0]: f for f in FIELDS}
FIELD_BY_SLUG = {f[4]: f for f in FIELDS}
FIELD_COUNT = len(FIELDS)
assert len(FIELD_BY_SLUG) == FIELD_COUNT, "слаги полей не уникальны"

#: порядок групп для вывода
GROUP_ORDER = []
for _f in FIELDS:
    if _f[2] not in GROUP_ORDER:
        GROUP_ORDER.append(_f[2])


def field_size(kind: str) -> int:
    return 4 if kind == "f32" else 1


def block_of(offset: int):
    """В какой из BLOCKS попадает офсет поля -> (имя блока, офсет внутри блока)."""
    for name, (start, size) in BLOCKS.items():
        if start <= offset < start + size:
            return name, offset - start
    return None, None


def decode(kind: str, raw: bytes) -> float | int:
    return struct.unpack("<f", raw)[0] if kind == "f32" else raw[0]


def encode(kind: str, value) -> bytes:
    return struct.pack("<f", float(value)) if kind == "f32" else bytes([int(value) & 0xFF])


#: Поля, которые прогон имеет право менять (ползунки и цвета, любое 0..255).
POKEABLE_FIELDS = [f for f in FIELDS if is_pokeable(f[0])]
POKEABLE_SLUGS = [f[4] for f in POKEABLE_FIELDS]


# ===========================================================================
# Маркеры для прогона
# ===========================================================================

#: Значение байта-маркера для позиции k внутри блока. Шаг 7 взаимно прост с 256,
#: так что на окне в 256 байт значения не повторяются, а последовательность не
#: похожа ни на что настоящее — её легко искать в дампе слота.
def marker_byte(k: int, salt: int = 0) -> int:
    return (k * 7 + 13 + salt * 101) & 0xFF


#: Маркер для float-поля: заведомо валидное, но нехарактерное значение.
#: Пропорции тела в игре лежат примерно в 0..1, так что 0.0x различимы и безопасны.
def marker_float(k: int, salt: int = 0) -> float:
    return round(0.11 + 0.017 * k + 0.003 * salt, 6)


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

#: Паттерн начала блока персонажа: FF FF FF FF 00*12, повторённый дважды.
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
