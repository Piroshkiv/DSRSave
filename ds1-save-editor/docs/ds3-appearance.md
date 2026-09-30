# DS3 appearance: the face block and the game's own presets

Everything found while building the DS3 Appearance tab, written down so the work
can be picked up cold. Companion to `docs/ds3-bonfire-anchor.md`; the research
tool is `../tools/ds3-appearance-sweeper/` (its README carries the method, this file
carries the results and what is left).

Status as of 2026-09-12: **the tab is built and tested, the preset format is
decoded, and one end-to-end check is still open** — see "Next session" at the
bottom.

---

## 1. Where a character's look lives

In memory: `PlayerGameData = [[GameDataMan]+0x10]`, face block at `+0x6B8`.
In a save: the same 208 bytes, verbatim.

| what | where | notes |
|---|---|---|
| face block | 208 bytes, `PGD+0x6B8` in memory | the whole look except gender/voice |
| gender | `CHARACTER_PATTERN - 0xA6` in the slot | 0/1 on all 99 characters checked |
| voice | `CHARACTER_PATTERN - 0xA5` | 0/1/2, confirmed live in the creator |
| class | `CHARACTER_PATTERN - 0xA2` | pre-existing, unrelated to appearance |
| body proportion floats | `PGD+0x3B0`, 7 floats | **never written to the save** — a runtime expansion of the Build Detail bytes inside the face block |

The Cheat Engine table (`DS3_TGA_v3.4.0.CT`, group *Appearance* — the table is
maintained by The Grand Archives, and its FaceData scripts carry no author line)
knows only 192 bytes of the face block. The real structure runs
`0x6B8..0x787` = 208. Proof: after a crash left marker values in the last 16
bytes, the next in-game save wrote exactly those bytes into the slot.

### Face block layout

```
+0x00..0x23  nine u32 "parts": build/age, hair, pupil L, pupil R, brow, beard,
             unused, tattoo, eyelashes        (values are small: top 3 bytes zero)
+0x24..0x47  nine RGBA colours IN THE SAME ORDER: skin, hair, pupil L, pupil R,
             brow, beard, unused, tattoo, eyelash      (alpha always 0xFF)
+0x48..0x4B  tattoo position / rotation / size
+0x4C..0x52  Build Detail — 7 bytes of body proportions
+0x66…       face shape sliders, cosmetics, skin layers
```

Index 6 of both lists (`+0x18` and `+0x3C`) is **dead**: id 0 and colour
`00 00 00 FF` on all 82 characters, untouched by every control in the creator,
and untouched even by switching the built-in face presets (which rewrites 81
bytes of the block). The editor does not expose it.

### Finding the block in a slot

The absolute offset floats — between characters, and between two saves of the
same character (one save had the gesture table where the face block had been
three minutes earlier). Two ways to locate it, both implemented:

1. **`DS3Character.findFaceBlock()`** — coarse estimate `findBonfireBlock()
   - 0xA245`, structural-signature search in a ±0x800 window, full scan as the
   fallback. Verified 99/99 across 15 files. The signature is the block's own
   shape: nine u32 with zero top bytes, then nine alpha bytes of 0xFF.
2. **The `"FACE"` magic** (see §3) — every character slot carries exactly one
   such record, and the face block sits at magic+12. Discovered later, while
   decoding presets. **This is the better anchor** and worth switching to; the
   windowed search stays as the fallback. Not done yet.

A full scan alone is wrong: the signature also matches clusters spaced `0x1B8`
apart deeper in a slot (up to 40 in a levelled character), which look like a
cache of other players' faces.

## 2. What may and may not be written

The nine "parts" are **model ids**, not sliders. A value the game has no model
for makes it load a nonexistent asset and crash — this is not theoretical, the
first sweep run crashed DS3 exactly this way.

The valid ids were read off the game itself (`--watch-ids` polls the field while
the list is scrolled in the creator, because the preview writes straight into
PlayerGameData):

| field | count | ids |
|---|---|---|
| hair | 24 | `0..11` and `101..112` — two families, not one range |
| eyebrows | 17 | `0..16` |
| beard | 12 | `0..11` |
| pupil L / R | 9 | `0..8` |
| eyelashes | 4 | `0..3` |
| tattoo / mark | 50 | `0..55` **minus 11, 12, 16, 19, 31, 46** |

The tattoo holes are real: two independent passes over the whole list produced
the same 50 values and the same six gaps. A naive `0..55` range would offer six
ids that do not exist.

### Byte 0 packs three settings

`face+0x00` is not an id. It is three character-creation settings in decimal
digits:

```
value = 100 * muscular + 10 * chestHair + age        (age 0..2)
```

Each digit was confirmed alone in the creator: the muscular toggle flipped
`112 <-> 12`, chest hair flipped `112 <-> 102`, age cycled the last digit, and
each left the other digits alone. That is why the CT's "Age 0..3" dropdown looked
like nonsense in real saves (0, 1, 100, 110, 111, 112). Exposed as
`faceAge` / `muscular` / `chestHair`.

### Pupils

The creator has three eye controls — `Pupils`, `Left Pupil`, `Right Pupil` — but
only two fields. The pair control writes **both** eyes at once, shape and colour,
always the same value. `getPupilId()` / `setPupilColor()` mirror that and report
null while the eyes differ.

### Three fields the CT does not know

`face+0x91`, `+0xAB`, `+0xAC` move when the built-in presets are switched, so
they are real appearance data with no entry in the reference table. Exposed in
the `Unlabelled` group. Of the 49 bytes in the block that no field describes,
these three are the only ones anything was ever seen to touch — a ten-minute
capture over every control in the creator found nothing else.

## 3. The game's own appearance presets

DS3 stores finished faces in the save. They live in the **system entry**
(entry 10), six fixed records right at the front, ahead of the slot flags and the
load-menu summaries:

```
base 0xB0, stride 0x104, six slots

  "FACE" | u32 version = 3 | u32 size = 0xF4 | payload 0xF8 bytes
     payload+0x00   the same 208-byte face block a character carries
     payload+0xD0   21 bytes of 0x7F        (identical in every record seen)
     payload+0xE5   00 00 00
     payload+0xE8   u16 used                 1 on a saved preset
     payload+0xEA   u16 ?                    1 / 104 / 0
     payload+0xEC   u32 ?                    1 / 115 / 0
     payload+0xF0   u32 ?                    16 / 140 / 1 / 0
     payload+0xF4   u32 ?                    changes on its own between saves
```

An unused slot is **not** an empty record — it is `0x104` bytes of zeros, so the
magic is the presence test. Eleven other saves have the whole `0xB0..0x6DC`
range zeroed; only a save where presets were actually made in game has records.

**A preset and a character speak the same format**, so moving a look between them
is a 208-byte copy and nothing else.

### What the game does, watched live

`--watch-presets` snapshots the six records on every save the game writes.
Making and deleting all six produced:

- **create**: the record appears with `used = 0`, and the *next* save flips it to
  `used = 1`;
- **overwrite**: only the face region changes (121 bytes), trailer untouched;
- **delete**: the record ends up as `0x104` zeros.

The undecoded trailer fields do not have to be meaningful: **slot 3 was a real
preset in the game's list with `used = 1` and every other trailer field zero.**
That is exactly the record `writeAppearancePreset` builds for an empty slot, so
the synthesized record has the same shape as one the game wrote itself.

Caveat: some intermediate states in that capture read as "garbage without magic".
Those may be torn reads of a 9 MB file caught mid-write rather than real states —
`decrypt_slot` does not verify MD5 by default.

## 4. What is implemented

**`src/apps/ds3/lib/constants.ts`**
`FACE_BLOCK_SIZE`, `FACE_COARSE_FROM_BONFIRE`, `FACE_SEARCH_RADIUS`, the
signature constants, `APPEARANCE_IDS` / `APPEARANCE_COLORS` /
`APPEARANCE_SLIDERS` (90) / `APPEARANCE_ID_VALUES`, `FACE_BUILD_OFFSET`,
`FACE_PUPIL_*`, `FACE_UNUSED_*`, the `.ds3chr` preset-file constants, and the
in-save preset constants (`APPEARANCE_PRESET_*`, `FACE_RECORD_*`).

**`src/apps/ds3/lib/Character.ts`**
`findFaceBlock`, `getFaceBlock` / `setFaceBlock`, `getFaceByte` / `setFaceByte`,
`getFaceId` / `setFaceId`, `getFaceColor` / `setFaceColor`, `gender`, `voice`,
`faceAge` / `muscular` / `chestHair`, `getPupilId` / `setPupilId` /
`getPupilColor` / `setPupilColor`, `exportAppearancePreset` /
`importAppearancePreset`.

**`src/apps/ds3/lib/SaveFileEditor.ts`**
`listAppearancePresets`, `hasAppearancePreset`, `readAppearancePreset`,
`writeAppearancePreset`, `clearAppearancePreset`. Writing into an occupied slot
replaces only the face and keeps the trailer the game wrote.

**`src/apps/ds3/components/AppearanceTab.tsx`** — the tab: `.ds3chr` import and
export, in-game preset slots (Apply / Store / Clear), gender, voice, age,
muscular, chest hair, model ids (dropdowns of verified values in safe mode, free
entry when safe mode is off), nine colours with pickers, 90 sliders in collapsible
groups. Wired through `TabPanel` (`presets` prop) and `DS3App`.

**Tests** — 496 green. `tests/ds3/character.test.ts` covers the block, every
slider round-trip, the packed byte, pupils, `.ds3chr`; `tests/ds3/saveFile.test.ts`
covers export round-trips and the preset API.

### The `.ds3chr` preset file

Our own format, DS1-style, 216 bytes: magic `D3CH`, version, gender, voice,
reserved, then the face block verbatim. The CT's own preset format is
deliberately not used — it truncates the face to 192 bytes, losing the last ten
fields, and its `<body>` tag holds the runtime floats that never reach a save.

## 5. Next session

**The one open check.** Nothing has yet proven that a preset written by the
editor is accepted by the game. The save's preset array is currently empty (all
six were deleted in game), which makes this the clean case to test:

1. close DS3 — a running game overwrites the file with its own state;
2. back up `~/AppData/Roaming/DarkSoulsIII/011000013017fff9/DS30000.sl2`;
3. with the editor, store the current character into preset slot 1 and save;
4. launch DS3, open character creation, and look at the preset list.

If it shows up, `writeAppearancePreset` is done. If it does not, the suspects are
the trailer fields at `payload+0xEA..0xF7` and whether the game keeps a count
somewhere ahead of `0xB0` (the bytes at `0x90..0xAF` hold two values that look
like runtime pointers, so that region is worth a second look).

**Worth doing while in there**

- Switch `findFaceBlock` to the `"FACE"` magic (one hit per slot, face at +12)
  and keep the windowed search as the fallback.
- `SLOT_SUMMARY_SIZE` is `0x22A`, but one save on this machine has load-menu
  summaries at a stride of `0x250`. The constant may not be universal — worth
  checking before trusting slot-summary writes on other people's saves.
- Unresolved and probably not appearance at all: `PGD+0xF8` takes 0..9 in the
  creator, which looks like the starting class while `PGD+0xAE` stays put; the
  three bytes at `PGD+0x550..0x552` toggle with menu state.

**Tools** (`../tools/ds3-appearance-sweeper/`, all read-only unless stated)

```
python main.py --read                    appearance from memory
python main.py --locate                  find the blocks in the current save
python main.py --presets                 the six preset slots as they sit in the file
python main.py --watch-presets           snapshot presets on every save the game writes
python main.py --watch-ids --seconds 90  collect valid model ids while scrolling in game
python main.py --watch-region --label x  which PGD byte a given setting moves
python main.py --sweep --slot N          marker run (writes to memory, restores after)
python anchors.py                        anchor spread across every profile
python viewer.py out/region_x.json       HTML byte-map viewer
```

Byte map of the last full capture:
https://claude.ai/code/artifact/e1b9480c-781f-44c1-a564-3d3f974579fb
