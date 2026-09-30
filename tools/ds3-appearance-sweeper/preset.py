"""Формат пресета внешности DS3 — `.ds3chr`.

Сделан по образцу DS1: плоский бинарник фиксированной раскладки, little-endian,
никакого текста и никакого парсинга. В DS1 файл `.dsrchr` заголовка не имеет,
потому что там мы подстраиваемся под чужой инструмент (DSR Appearance Preset
Tool). Здесь формат наш собственный, поэтому в начале стоит магия и версия —
иначе `.dsrchr` от DS1 и пресет DS3 неотличимы, и подсунутый не тот файл молча
запишет мусор в лицо.

Раскладка (216 байт):

    0x00   4   магия "D3CH"
    0x04   1   версия = 1
    0x05   1   gender    (PGD+0x0AA)
    0x06   1   voice     (PGD+0x0AB)
    0x07   1   резерв, 0
    0x08 208   face-блок (PGD+0x6B8 .. +0x787) как есть

Почему именно так:

- **Всё значимое лежит в face-блоке** — ID причёски/бороды/бровей/зрачков/
  татуировки, все цвета (RGBA), все ползунки формы лица и Build Detail
  (пропорции тела). Копируем его целиком, поэтому потерь нет по определению.
- **float-пропорции `PGD+0x3B0` не входят**: они в сейв не пишутся вообще, это
  runtime-развёртка байтов Build Detail из того же face-блока.
- **Class (`PGD+0x0AE`) не входит**: это не внешность, а стартовый класс.
- Формат CT (`<facedata>…</facedata>`) сознательно НЕ используется: он режет
  facedata до 192 байт и теряет хвост `0x778..0x787`, а `<body>` там —
  как раз незаписываемая runtime-развёртка.
"""

from __future__ import annotations

import struct

import constants as C

MAGIC = b"D3CH"
VERSION = 1
HEADER_SIZE = 8
FACE_SIZE = C.BLOCKS["face"][1]
PRESET_SIZE = HEADER_SIZE + FACE_SIZE
EXTENSION = ".ds3chr"


class PresetError(Exception):
    pass


def pack(gender: int, voice: int, face: bytes) -> bytes:
    """Собрать файл пресета."""
    if len(face) != FACE_SIZE:
        raise PresetError(f"face-блок: ожидалось {FACE_SIZE} байт, дано {len(face)}")
    head = struct.pack("<4sBBBB", MAGIC, VERSION, gender & 0xFF, voice & 0xFF, 0)
    return head + bytes(face)


def unpack(data: bytes) -> dict:
    """Разобрать файл пресета -> {'gender', 'voice', 'face'}."""
    if len(data) < HEADER_SIZE:
        raise PresetError("файл короче заголовка")
    magic, version, gender, voice, _res = struct.unpack_from("<4sBBBB", data, 0)
    if magic != MAGIC:
        hint = ""
        if len(data) == 130:
            hint = " — похоже на .dsrchr от DS1, он тут не подходит"
        raise PresetError(f"не пресет DS3 (магия {magic!r}){hint}")
    if version != VERSION:
        raise PresetError(f"версия {version}, поддерживается {VERSION}")
    face = data[HEADER_SIZE:HEADER_SIZE + FACE_SIZE]
    if len(face) != FACE_SIZE:
        raise PresetError(
            f"обрезанный файл: face-блок {len(face)} из {FACE_SIZE} байт")
    return {"gender": gender, "voice": voice, "face": face}


def from_blocks(blocks: dict) -> bytes:
    """Пресет из блоков памяти (как их отдаёт DS3Memory.read_all_blocks)."""
    misc = blocks["misc"]
    return pack(misc[0x0AA - C.BLOCKS["misc"][0]],
                misc[0x0AB - C.BLOCKS["misc"][0]],
                blocks["face"])


def describe(preset: dict) -> str:
    """Короткая сводка по пресету — что в нём лежит."""
    face = preset["face"]
    ids = struct.unpack_from("<9I", face, 0)
    names = ["Age", "Hair", "Pupil L", "Pupil R", "Brow", "Beard", "?", "Tattoo",
             "Eyelashes"]
    parts = [f"gender={preset['gender']} voice={preset['voice']}"]
    parts.append("  ".join(f"{n}={v}" for n, v in zip(names, ids)))
    skin = face[0x24:0x27]
    parts.append(f"кожа RGB={tuple(skin)}")
    return "\n".join(parts)
