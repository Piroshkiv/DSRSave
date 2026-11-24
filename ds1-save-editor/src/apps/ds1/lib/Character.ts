import { STATS_OFFSETS, PlayerClass, Covenant, VIT_TO_HP, END_TO_STAMINA } from './constants';

// Relative offsets to the base address found by findPattern1()
const BONFIRE_RELATIVE_OFFSET_1 = 0x6B; // Bonfire data 1
const BONFIRE_RELATIVE_OFFSET_2 = 0x6C; // Bonfire data 2
const BONFIRE_RELATIVE_OFFSET_3 = 0x6D; // Bonfire data 3
const BONFIRE_RELATIVE_FLAG_OFFSET = 0xAE; // Warp flag
const NG_PLUS_RELATIVE_OFFSET = -0xBC0; // NG+ counter (pattern1 - 0xBC0)

/**
 * Current covenant, PGD+0x113 (PGD = stats block - 0x60, see HAIR_MENU_INDEX_OFFSET
 * comment). Matches `1FRDarkSoulsRemastered.CT`'s "Current Covenant" chain
 * (`[[BaseB]+0x10]+0x113`) and the legacy C# `CovenantEditor`'s `0x0173`, both
 * confirmed against this same slot-data coordinate system via VIT (CT +0x40 ==
 * here 0x00A0) and HP/Level/Class, which already matched byte-for-byte.
 */
const COVENANT_OFFSET = 0x173;

/**
 * Per-covenant rank, 7 contiguous bytes at PGD+0xED..+0xF3 (file 0x14D..0x153,
 * same PGD->file +0x60 shift as COVENANT_OFFSET). One byte per covenant,
 * WarriorOfSunlight(3)..ChaosServant(9) in ascending covenant-id order; WayOfWhite
 * and PrincessGuard have no rank. Confirmed real (not padding) via Ghidra:
 * PlayerGameData::Save (FUN_140761bb0) reads these 7 bytes individually and
 * copies each into a separate cached field right before the save buffer is
 * finalized — DarkmoonBlade's byte (+0xF2) notably lands in its own non-sequential
 * slot there, consistent with its rank being used separately for PvP matchmaking.
 *
 * The byte is the RAW CUMULATIVE OFFERING COUNT (0-80+), not the 0-3 rank
 * tier directly — writing a literal "3" doesn't show as rank 3 in-game
 * (confirmed by the user). Vanilla DS1's covenant mechanic converts this to a
 * displayed rank via fixed thresholds (10/30/80 total offerings for ranks
 * 1/2/3, the same pattern across all 7 covenants per the game's own
 * "Mechanics Common to all Covenants"); offerings beyond 80 give no further
 * benefit. `getCovenantRank`/`setCovenantRank` convert through these
 * thresholds so callers work in rank-tier (0-3) terms.
 */
const COVENANT_RANK_BASE_OFFSET = 0x14D;
const COVENANT_RANK_MIN = Covenant.WarriorOfSunlight;
const COVENANT_RANK_MAX = Covenant.ChaosServant;
const COVENANT_RANK_THRESHOLDS = [0, 10, 30, 80] as const;

/**
 * Covenant availability: a 2-byte (16-bit) bitfield at file offset 0x180,
 * bit index = `Covenant` enum value directly (0=None .. 9=ChaosServant). A
 * covenant's bit is what DSR's "switch covenant at a bonfire" QoL menu
 * checks to decide whether it's selectable — distinct from rank/offerings,
 * confirmed because a character could have a maxed offering count on a
 * covenant (set via this editor) that still didn't show as selectable
 * in-game until actually joined through normal play.
 *
 * Found via a live diff (join WayOfWhite, then separately join
 * PathOfTheDragon(enum 5) on top of it): the byte at 0x180 was already `3`
 * (bits 0 and 1 — None and WayOfWhite) even on a completely fresh,
 * covenant-less character, confirming those two are always available by
 * default; joining PathOfTheDragon set exactly bit 5, nothing else. Verified
 * against 9 real characters in the user's live save — e.g. a character whose
 * only joined covenant ever was Darkwraith(4) has exactly bit 4 set (no
 * bit 0/1 default in that case), and one who'd only ever joined
 * PathOfTheDragon(5) has bits {0,1,5}.
 */
const COVENANT_AVAILABLE_OFFSET = 0x180;

/**
 * Bit indices of the 21 warpable bonfires, in display order.
 * Bits 0-2 of +0x6B are warp bits, not bonfires, so the list starts at 3.
 */
export const BONFIRE_BIT_INDICES = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
] as const;

/**
 * Bonfire kindling array: a run of fixed-size records (one per bonfire/
 * rest-point entity, including some non-warpable ones — more than the
 * 21-item warp menu), each 20 bytes. Record layout (relative to its own
 * start):
 *   +0: marker byte, always 0x0B
 *   +4..+6: 3-byte LE bonfire/area entity id (matches DS1's `area*10000 +
 *           1960+n` sub-zone code scheme used elsewhere in this file)
 *   +8: kindling value
 *   +12: an unrelated per-bonfire flag, always 1 on exactly the id==...960
 *        (first-in-area) record of several areas — left alone, not exposed
 *
 * Found via a live 4-step diff (base -> kindled x1/x2/x3/x4): the value byte
 * at +8 rose 10 -> 20 -> 30 -> 40 in lockstep with each kindle action on one
 * specific record, while the others stayed fixed. 10/20/30/40 maps exactly
 * onto the real max-Estus progression 10/15/20/(25, past the vanilla cap —
 * that test exceeded the normal 3-kindle limit) via `maxEstus = 5 + value/2`,
 * i.e. `value = (maxEstus - 5) * 2`.
 *
 * NOT at a fixed pattern1-relative offset, and NOT a fixed record count:
 * checked across 6 real characters in one live save, the array's offset
 * relative to pattern1 and its record count (30-44) both varied with no
 * simple formula found. So, like the gesture table above, this is found by
 * scanning for the longest run of consecutive valid-looking 20-byte records
 * rather than computed — see `findBonfireKindleArray()`.
 */
const BONFIRE_KINDLE_RECORD_SIZE = 20;
const BONFIRE_KINDLE_ID_OFFSET = 4;
const BONFIRE_KINDLE_VALUE_OFFSET = 8;
const BONFIRE_KINDLE_ID_MIN = 1_000_000;
const BONFIRE_KINDLE_ID_MAX = 2_000_000;
const BONFIRE_KINDLE_MIN_RUN = 10;

/**
 * `maxEstus = value/2` — confirmed by the user testing every tier directly
 * in-game (two earlier passes here both had this off by +5: one assumed a
 * "+5 base" that doesn't exist, another wrongly special-cased value=40 as a
 * sentinel). value=40 is the real, confirmed max (20 Estus); the user also
 * confirmed in-game that nothing beyond 20 is achievable, so there's no
 * "test" tier beyond 40 — a value=50 option offered earlier was removed.
 */
export const BONFIRE_KINDLE_VALUES = [0, 10, 20, 30, 40] as const;
export const BONFIRE_KINDLE_VALUE_LABELS: Record<number, string> = {
  0: 'kindleUnkindled',
};
export const BONFIRE_KINDLE_VALUE_ESTUS: Record<number, number> = {
  0: 0, 10: 5, 20: 10, 30: 15, 40: 20,
};

/**
 * Entity id -> real bonfire name. Two sources, cross-validated against each
 * other (every id present in both agrees on area):
 *  - The 21 official warp-menu names: read directly out of the exe's own
 *    warp-destination table (21 x [event_flag, entity_id, text_id] int32
 *    triples at 0x141a325c0, found via Ghidra), cross-referenced with the
 *    event_flag->name mapping from `docs/exe-re-findings.md` §7.1. Only 11 of
 *    these 21 actually appear in the save's 30-entry kindle array (the other
 *    10 — Painted World, Duke's Archives, Crystal Cave, The Abyss, Altar of
 *    the Gravelord, and the 5 Oolacile-DLC bonfires — are presumably
 *    always-maxed "Fire Keeper" bonfires with nothing to track).
 *  - The other 19 (non-warpable) names: from a hand-made Cheat Engine table's
 *    "Last Bonfire" dropdown list (`1FRDarkSoulsRemastered.CT`), whose ids
 *    are this array's entity ids + 1000 (verified against all 11 exe-table
 *    entries above, e.g. our 1021960 = Firelink Shrine = CT's 1022960). One
 *    of these (`1011962`) was also independently confirmed as "Blacksmith"
 *    via a screenshot of the "Better Bonfire Menu" mod's own in-game UI.
 */
const BONFIRE_KINDLE_ID_NAMES: Record<number, string> = {
  1021960: 'Firelink Shrine',
  1011961: 'Sunlight Altar',
  1011962: 'Blacksmith (Undead Burg)',
  1511960: 'Anor Londo',
  1511950: 'Chamber of the Princess',
  1511962: 'Darkmoon Tomb',
  1601950: 'The Abyss',
  1401960: 'Daughter of Chaos',
  1311950: 'Altar of the Gravelord',
  1321960: 'Stone Dragon',
  1211963: 'Sanctuary Garden',
  1211961: 'Oolacile Sanctuary',
  1211962: 'Oolacile Township',
  1211950: 'Chasm of the Abyss',
  1211964: 'Oolacile Township Dungeon',
  1001960: 'Depths',
  1011964: 'Undead Parish',
  1101960: 'Painted World of Ariamis',
  1311961: 'Tomb of Giants',
  1701960: "Duke's Archives",
  1701950: 'Crystal Cave',
  1301962: 'Catacombs',
  // Non-warpable, named via the CT's "Last Bonfire" dropdown (id - 1000):
  1511961: 'Anor Londo (Interior Bonfire)',
  1811961: 'Northern Undead Asylum (Bonfire #2)',
  1811960: 'Northern Undead Asylum (Bonfire #1)',
  1411964: 'Lost Izalith (Bonfire #1)',
  1411963: 'Demon Ruins (Bonfire #3)',
  1411962: 'Demon Ruins (Bonfire #2)',
  1411961: 'Demon Ruins (Bonfire #1)',
  1411960: 'Lost Izalith (Bonfire #2)',
  1401962: 'Blighttown (Bridge Bonfire)',
  1401961: 'Blighttown (Swamp Bonfire)',
  1601961: 'Darkroot Basin',
  1501961: "Sen's Fortress",
  1311960: 'Tomb of the Giants (Bonfire #1)',
  1321961: 'Ash Lake (Bonfire #1)',
  1321962: 'Great Hollow',
  1301960: 'The Catacombs (Bonfire #1)',
  1301961: 'The Catacombs (Bonfire #2)',
  1201961: 'Darkroot Garden',
  1701961: "Duke's Archives (Cell Bonfire)",
  1701962: "Duke's Archives (Elevator Bonfire)",
  1411950: 'Lost Izalith (Bed of Chaos)',
  1801960: 'Firelink Altar',
};

/**
 * Gesture unlock table — 15 records of `[u16 value][u16 index]`, in the fixed
 * game order (Point Forward … Praise the Sun), followed by an `FE FF FF FF`
 * terminator:
 *
 *   value = (index + 1) * 2 + (unlocked ? 1 : 0)
 *
 * so bit 0 of the first byte is the unlock flag and the rest of the record is
 * a self-describing id/index pair. This is byte-for-byte the same layout the
 * game keeps in memory at `[[[BaseB]+0x10]+0x568]+0x10` (the "Gesture Game
 * Data" group in `1FRDarkSoulsRemastered.CT`).
 *
 * Mapped by `ds1-gesture-sweeper`: gestures were toggled one at a time in the
 * game's memory, the game was forced to save after each change (ESC×2), and
 * the decrypted slots were diffed bit by bit. Each gesture claimed exactly one
 * bit, and nothing else in the slot moved.
 *
 * Unlike the bonfire flags this table sits at a *fixed absolute* offset, not
 * one relative to `findPattern1()` — verified at 0x1E4A8 in all 26 characters
 * across the six local profiles, while the pattern1-relative distance varied
 * between them (p1-0xCD6 … p1-0xD7E). `findGestureTable()` still validates the
 * structure and falls back to a scan, so a save that lays it out differently
 * is found rather than silently mis-edited.
 */
export const GESTURE_COUNT = 15;
const GESTURE_RECORD_SIZE = 4;
const GESTURE_TABLE_OFFSET = 0x1E4A8;

/**
 * Visited-area/sub-zone list, right after the gesture table's own
 * `FE FF FF FF` terminator (`GESTURE_TABLE_OFFSET + 15*4 + 4 = 0x1E4E8`).
 * Each 4-byte LE entry is a decimal area/sub-zone code — e.g. `101000` =
 * "Undead Burg Start" — confirmed by cross-referencing a hand-curated area
 * code list and by live-watching entries appear while walking between
 * zones. Entries sit in the ~100000-180000 range, far below the ~1.6M+
 * range item/weapon IDs occupy, so `AREA_CODE_MAX` safely tells a real
 * entry apart from the `0xFFFFFFFF`/`0x00000000` filler that follows them.
 *
 * `AREA_LIST_COUNT_OFFSET` (0x1E4E8) holds a count too, but isn't safe to
 * trust alone: a corrupted or non-character slot can hold garbage there
 * with nothing to catch it. Counting entries by content shape instead
 * matched that field exactly across every real character tested (670
 * entries, 4 independent save files, zero exceptions) and degrades to 0
 * instead of garbage on invalid data — see docs/exe-re-findings.md.
 *
 * `PATTERN1_BASE` is the anchor for bonfire warp flags, NG+, and world
 * event flags, and shifts forward by exactly 4 bytes per list entry. The
 * byte-signature scan this replaced took the *last* match of a 16-byte
 * FF/00 pattern across 0x1F000-0x1FFFF, which is unreliable: a fresh
 * character has hundreds of bytes of genuine filler that all match it, and
 * real (non-filler) save data occasionally matches it by coincidence
 * further in the file.
 */
const AREA_LIST_START = 0x1E4F0;
const AREA_LIST_COUNT_OFFSET = 0x1E4E8;
const AREA_CODE_MIN = 1;
const AREA_CODE_MAX = 500_000;
const AREA_LIST_MAX_SCAN = 2000;
const PATTERN1_BASE = 0x1F17E;

/**
 * Appearance. The game keeps it in PlayerGameData (`PGD = [[BaseB]+0x10]`),
 * and the slot stores PGD in pieces: the stats block is PGD shifted by +0x60,
 * the equipment block by -0x10, and the colour/face block sits far away at
 * 0xE414. Mapped by `tools/ds1-appearance-sweeper` against the live game.
 *
 * The hairstyle the game actually renders is the equipped hair part — an ID
 * in the equipment block (PGD+0x354, the field DSAppearancePresetTool writes):
 * female `3000 + 100*i`, male `1000 + 100*i`. The byte at 0x175 (PGD+0x115) is
 * only the character creator's list index; the game ignores it when drawing.
 */
const HAIR_ID_OFFSET = 0x344;
const HAIR_MENU_INDEX_OFFSET = 0x175;
const HAIR_COLOR_OFFSET = 0xe414;   // RGBA float32
const EYE_COLOR_OFFSET = 0xe424;    // RGBA float32
const FACE_DATA_OFFSET = 0xe434;
const SKIN_COLOR_OFFSET = 0xe466;
const FACE_BLOCK_SIZE = 50;

/**
 * `.dsrchr` preset of BobDoleOwndU's DSAppearancePresetTool: the raw PGD
 * fields back to back, 130 bytes, no header —
 * `sex u8 | physique u8 | hair i32 | hair RGB 12 | eye RGB 12 | face 50 | skin 50`.
 * Colours are copied as raw bytes (alpha is not in the file), exactly as the
 * tool does, so a preset survives a round trip through the editor unchanged.
 */
export const DSRCHR_SIZE = 130;

export const HAIR_ID_FEMALE_BASE = 3000;
export const HAIR_ID_MALE_BASE = 1000;
export const HAIR_ID_STEP = 100;
export const HAIRSTYLE_COUNT = 10;

/** Hair ID of the i-th creator hairstyle for a gender (0 = female, 1 = male). */
export function hairIdForIndex(gender: number, index: number): number {
  return (gender === 0 ? HAIR_ID_FEMALE_BASE : HAIR_ID_MALE_BASE) + index * HAIR_ID_STEP;
}

/** Creator list index of a hair ID for a gender, or -1 if it belongs to the other one. */
export function hairIndexForId(gender: number, id: number): number {
  const base = gender === 0 ? HAIR_ID_FEMALE_BASE : HAIR_ID_MALE_BASE;
  const index = (id - base) / HAIR_ID_STEP;
  return Number.isInteger(index) && index >= 0 && index < HAIRSTYLE_COUNT ? index : -1;
}

export class Character {
  private data: Uint8Array;
  public slotNumber: number;
  private gestureTableOffset: number | null = null;
  private bonfireKindleArray: { start: number; count: number } | null | undefined = undefined;

  constructor(data: Uint8Array, slotNumber: number) {
    this.data = data;
    this.slotNumber = slotNumber;
  }

  get isEmpty(): boolean {
    if (this.data.length <= 0x90) {
      return true;
    }

    for (let i = 0x20; i <= 0x90; i++) {
      if (this.data[i] !== 0x00) {
        return false;
      }
    }

    return true;
  }

  getRawData(): Uint8Array {
    return this.data;
  }

  getByte(offset: number): number {
    if (offset < 0 || offset >= this.data.length) {
      throw new Error(`Offset ${offset} out of range`);
    }
    return this.data[offset];
  }

  setByte(offset: number, value: number): void {
    if (offset < 0 || offset >= this.data.length) {
      throw new Error(`Offset ${offset} out of range`);
    }
    this.data[offset] = value & 0xFF;
  }

  // Name methods
  private readUtf16String(offset: number, maxLength: number = 64): string {
    const decoder = new TextDecoder('utf-16le');
    let length = 0;

    // Find null terminator
    for (let i = 0; i < maxLength - 1; i += 2) {
      if (this.data[offset + i] === 0x00 && this.data[offset + i + 1] === 0x00) {
        length = i;
        break;
      }
    }

    // If no terminator found or length is 0, return empty string
    if (length === 0) {
      return '';
    }

    return decoder.decode(this.data.slice(offset, offset + length));
  }

  private writeUtf16String(offset: number, value: string, maxLength: number = 64): void {
    // Clear the entire area first
    for (let i = 0; i < maxLength; i++) {
      this.data[offset + i] = 0x00;
    }

    // If empty string, just leave it cleared
    if (!value || value.length === 0) {
      return;
    }

    // Encode string to UTF-16LE manually
    const maxChars = Math.min(value.length, (maxLength - 2) / 2);
    let bytePos = 0;

    for (let i = 0; i < maxChars; i++) {
      const charCode = value.charCodeAt(i);
      // UTF-16LE encoding (little-endian)
      this.data[offset + bytePos] = charCode & 0xFF;
      this.data[offset + bytePos + 1] = (charCode >> 8) & 0xFF;
      bytePos += 2;
    }

    // Null terminator is already set by the initial clearing
  }

  get name(): string {
    return this.readUtf16String(0x108, 34);
  }

  set name(value: string) {
    this.writeUtf16String(0x108, value, 34);
    this.writeUtf16String(0x18C, value, 34);
  }

  // Stats methods
  get level(): number {
    return this.data[0x00F1] * 256 + this.data[0x00F0];
  }

  set level(value: number) {
    this.data[0x00F0] = value & 0xFF;
    this.data[0x00F1] = (value >> 8) & 0xFF;
  }

  get humanity(): number {
    return this.data[0x00E4];
  }

  set humanity(value: number) {
    this.data[0x00E4] = value & 0xFF;
  }

  get souls(): number {
    return this.data[0x00F4] +
              (this.data[0x00F5] << 8) +
              (this.data[0x00F6] << 16) +
              (this.data[0x00F7] << 24);
  }

  set souls(value: number) {
    this.data[0x00F4] = value & 0xFF;
    this.data[0x00F5] = (value >> 8) & 0xFF;
    this.data[0x00F6] = (value >> 16) & 0xFF;
    this.data[0x00F7] = (value >> 24) & 0xFF;
  }

  get ngPlus(): number {
    const baseOffset = this.findPattern1();
    if (baseOffset === -1) {
      return 0;
    }
    const ngPlusOffset = baseOffset + NG_PLUS_RELATIVE_OFFSET;
    if (ngPlusOffset < 0 || ngPlusOffset >= this.data.length) {
      return 0;
    }
    return this.data[ngPlusOffset];
  }

  set ngPlus(value: number) {
    const baseOffset = this.findPattern1();
    if (baseOffset === -1) {
      throw new Error('Cannot set NG+: Pattern1 not found');
    }
    const ngPlusOffset = baseOffset + NG_PLUS_RELATIVE_OFFSET;
    if (ngPlusOffset < 0 || ngPlusOffset >= this.data.length) {
      throw new Error('NG+ offset out of range');
    }
    this.data[ngPlusOffset] = value & 0xFF;
  }

  get gender(): number {
    return this.data[0x012A];
  }

  set gender(value: number) {
    this.data[0x012A] = value & 0xFF;
  }

  get physique(): number {
    return this.data[0x012F];
  }

  set physique(value: number) {
    this.data[0x012F] = value & 0xFF;
  }

  /** Equipped hair part ID — what the game renders (see HAIR_ID_OFFSET). */
  get hairstyle(): number {
    return new DataView(this.data.buffer, this.data.byteOffset).getInt32(HAIR_ID_OFFSET, true);
  }

  /**
   * Sets the hair ID and, when it is one of the creator's hairstyles for the
   * current gender, the creator list index too, as the game itself would.
   */
  set hairstyle(value: number) {
    new DataView(this.data.buffer, this.data.byteOffset).setInt32(HAIR_ID_OFFSET, value, true);
    const index = hairIndexForId(this.gender, value);
    if (index >= 0) {
      this.data[HAIR_MENU_INDEX_OFFSET] = index;
    }
  }

  private readFloat32LE(offset: number): number {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setUint8(0, this.data[offset]);
    view.setUint8(1, this.data[offset + 1]);
    view.setUint8(2, this.data[offset + 2]);
    view.setUint8(3, this.data[offset + 3]);
    return view.getFloat32(0, true);
  }

  private writeFloat32LE(offset: number, value: number): void {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    view.setFloat32(0, value, true);
    this.data[offset] = view.getUint8(0);
    this.data[offset + 1] = view.getUint8(1);
    this.data[offset + 2] = view.getUint8(2);
    this.data[offset + 3] = view.getUint8(3);
  }

  private setColor(offset: number, r: number, g: number, b: number): void {
    this.writeFloat32LE(offset, r);
    this.writeFloat32LE(offset + 4, g);
    this.writeFloat32LE(offset + 8, b);
    // A zero alpha renders the part invisible in-game.
    if (this.readFloat32LE(offset + 12) === 0) {
      this.writeFloat32LE(offset + 12, 1.0);
    }
  }

  getHairColor(): [number, number, number] {
    return [
      this.readFloat32LE(HAIR_COLOR_OFFSET),
      this.readFloat32LE(HAIR_COLOR_OFFSET + 4),
      this.readFloat32LE(HAIR_COLOR_OFFSET + 8),
    ];
  }

  setHairColor(r: number, g: number, b: number): void {
    this.setColor(HAIR_COLOR_OFFSET, r, g, b);
  }

  getEyeColor(): [number, number, number] {
    return [
      this.readFloat32LE(EYE_COLOR_OFFSET),
      this.readFloat32LE(EYE_COLOR_OFFSET + 4),
      this.readFloat32LE(EYE_COLOR_OFFSET + 8),
    ];
  }

  setEyeColor(r: number, g: number, b: number): void {
    this.setColor(EYE_COLOR_OFFSET, r, g, b);
  }

  getFaceData(): Uint8Array {
    return new Uint8Array(this.data.slice(FACE_DATA_OFFSET, FACE_DATA_OFFSET + FACE_BLOCK_SIZE));
  }

  setFaceData(data: Uint8Array): void {
    this.data.set(data.subarray(0, FACE_BLOCK_SIZE), FACE_DATA_OFFSET);
  }

  getSkinColor(): Uint8Array {
    return new Uint8Array(this.data.slice(SKIN_COLOR_OFFSET, SKIN_COLOR_OFFSET + FACE_BLOCK_SIZE));
  }

  setSkinColor(data: Uint8Array): void {
    this.data.set(data.subarray(0, FACE_BLOCK_SIZE), SKIN_COLOR_OFFSET);
  }

  /** Appearance as a `.dsrchr` preset (see DSRCHR_SIZE). */
  exportDsrchr(): Uint8Array {
    const out = new Uint8Array(DSRCHR_SIZE);
    const view = new DataView(out.buffer);
    out[0] = this.gender;
    out[1] = this.physique;
    view.setInt32(2, this.hairstyle, true);
    out.set(this.data.subarray(HAIR_COLOR_OFFSET, HAIR_COLOR_OFFSET + 12), 6);
    out.set(this.data.subarray(EYE_COLOR_OFFSET, EYE_COLOR_OFFSET + 12), 18);
    out.set(this.getFaceData(), 30);
    out.set(this.getSkinColor(), 80);
    return out;
  }

  /** Applies a `.dsrchr` preset. Throws if the file is shorter than 130 bytes. */
  importDsrchr(preset: Uint8Array): void {
    if (preset.length < DSRCHR_SIZE) {
      throw new Error(`Not a .dsrchr preset: ${preset.length} bytes, expected ${DSRCHR_SIZE}`);
    }
    const view = new DataView(preset.buffer, preset.byteOffset, preset.length);
    // Gender first: the hair setter picks the creator index from it.
    this.gender = preset[0];
    this.physique = preset[1];
    this.hairstyle = view.getInt32(2, true);
    this.data.set(preset.subarray(6, 18), HAIR_COLOR_OFFSET);
    this.data.set(preset.subarray(18, 30), EYE_COLOR_OFFSET);
    for (const offset of [HAIR_COLOR_OFFSET, EYE_COLOR_OFFSET]) {
      if (this.readFloat32LE(offset + 12) === 0) {
        this.writeFloat32LE(offset + 12, 1.0);
      }
    }
    this.setFaceData(preset.subarray(30, 80));
    this.setSkinColor(preset.subarray(80, 130));
  }

  get playerClass(): PlayerClass {
    return this.data[0x012E] as PlayerClass;
  }

  set playerClass(value: PlayerClass) {
    this.data[0x012E] = value;
  }

  get covenant(): Covenant {
    return this.data[COVENANT_OFFSET] as Covenant;
  }

  set covenant(value: Covenant) {
    this.data[COVENANT_OFFSET] = value;
  }

  hasCovenantRank(covenant: Covenant): boolean {
    return covenant >= COVENANT_RANK_MIN && covenant <= COVENANT_RANK_MAX;
  }

  /** Raw cumulative offering count (0-255), independent of the rank-tier conversion below. */
  getCovenantOfferings(covenant: Covenant): number {
    if (!this.hasCovenantRank(covenant)) return 0;
    return this.data[COVENANT_RANK_BASE_OFFSET + (covenant - COVENANT_RANK_MIN)];
  }

  /** Rank tier (0-3), converted from the raw offering count via the 10/30/80 thresholds. */
  getCovenantRank(covenant: Covenant): number {
    const offerings = this.getCovenantOfferings(covenant);
    let rank = 0;
    for (let i = 0; i < COVENANT_RANK_THRESHOLDS.length; i++) {
      if (offerings >= COVENANT_RANK_THRESHOLDS[i]) rank = i;
    }
    return rank;
  }

  /** Sets rank by writing the offering count for that tier's threshold (0/10/30/80). */
  setCovenantRank(covenant: Covenant, rank: number): void {
    if (!this.hasCovenantRank(covenant)) return;
    const tier = Math.max(0, Math.min(COVENANT_RANK_THRESHOLDS.length - 1, Math.round(rank)));
    this.data[COVENANT_RANK_BASE_OFFSET + (covenant - COVENANT_RANK_MIN)] = COVENANT_RANK_THRESHOLDS[tier];
  }

  /** Whether this covenant shows as selectable in the "switch covenant at a bonfire" menu. */
  isCovenantAvailable(covenant: Covenant): boolean {
    const byteIndex = COVENANT_AVAILABLE_OFFSET + (covenant >> 3);
    const bit = covenant & 7;
    return ((this.data[byteIndex] >> bit) & 1) === 1;
  }

  setCovenantAvailable(covenant: Covenant, available: boolean): void {
    const byteIndex = COVENANT_AVAILABLE_OFFSET + (covenant >> 3);
    const bit = covenant & 7;
    if (available) {
      this.data[byteIndex] |= 1 << bit;
    } else {
      this.data[byteIndex] &= ~(1 << bit);
    }
  }

  /** Sets the current covenant, marks it available, and bumps a 0 rank to 1 (freshly joined). */
  joinCovenant(covenant: Covenant): void {
    this.covenant = covenant;
    this.setCovenantAvailable(covenant, true);
    if (this.hasCovenantRank(covenant) && this.getCovenantRank(covenant) === 0) {
      this.setCovenantRank(covenant, 1);
    }
  }

  get hp(): number {
    return this.data[0x0079] * 256 + this.data[0x0078];
  }

  set hp(value: number) {
    // Set max HP
    this.data[0x007C] = value & 0xFF;
    this.data[0x007D] = (value >> 8) & 0xFF;

    // Set current HP (so UI shows the change)
    this.data[0x0078] = value & 0xFF;
    this.data[0x0079] = (value >> 8) & 0xFF;

    this.data[0x0074] = 10;
    this.data[0x0075] = 10;
  }

  get stamina(): number {
    return this.data[0x0098];
  }

  set stamina(value: number) {
    this.data[0x0098] = value & 0xFF;
  }

  getStat(statName: string): number {
    const offset = STATS_OFFSETS[statName];
    if (offset === undefined) {
      throw new Error(`Unknown stat: ${statName}`);
    }
    return this.data[offset];
  }

  setStat(statName: string, value: number, autoUpdateDerived: boolean = false): void {
    const offset = STATS_OFFSETS[statName];
    if (offset === undefined) {
      throw new Error(`Unknown stat: ${statName}`);
    }

    this.data[offset] = value & 0xFF;

    // Update HP when VIT changes (only in safe mode)
    if (autoUpdateDerived && statName === 'VIT') {
      const hp = VIT_TO_HP[value];
      if (hp !== undefined) {
        this.hp = hp;
      }
    }

    // Update stamina when END changes (only in safe mode)
    if (autoUpdateDerived && statName === 'END') {
      const stamina = END_TO_STAMINA[value];
      if (stamina !== undefined) {
        this.stamina = stamina;
      }
    }
  }

  /**
   * Counts the visited-area list entries by content shape rather than
   * trusting `AREA_LIST_COUNT_OFFSET` alone (see the field's doc comment).
   * Warns (but still returns the scanned count) when the two disagree.
   */
  private countAreaListEntries(): number {
    const view = new DataView(this.data.buffer, this.data.byteOffset, this.data.length);
    let count = 0;
    for (let i = 0; i < AREA_LIST_MAX_SCAN; i++) {
      const offset = AREA_LIST_START + i * 4;
      if (offset + 4 > this.data.length) break;
      const value = view.getUint32(offset, true);
      if (value < AREA_CODE_MIN || value > AREA_CODE_MAX) break;
      count++;
    }

    if (AREA_LIST_COUNT_OFFSET + 4 <= this.data.length) {
      const stored = view.getUint32(AREA_LIST_COUNT_OFFSET, true);
      if (stored !== count) {
        console.warn(
          `Area list count mismatch: stored field says ${stored}, content scan found ${count}. Trusting the scan.`
        );
      }
    }

    return count;
  }

  /**
   * Anchor for bonfire warp flags, NG+, and world event flags:
   * `PATTERN1_BASE + 4 * (visited-area list length)`. See `AREA_LIST_START`'s
   * doc comment for why this replaced a byte-signature scan.
   * @returns the anchor offset, or -1 for an empty/undersized slot.
   */
  public findPattern1(): number {
    if (this.isEmpty) {
      return -1;
    }

    const offset = PATTERN1_BASE + 4 * this.countAreaListEntries();
    if (offset < 0 || offset >= this.data.length) {
      return -1;
    }

    return offset;
  }

  // Bonfire methods - using relative offsets to Pattern1

  // Get status of all bonfire warp flags from +0x6B/0x6C/0x6D
  // Returns 24-element array indexed by bit index (0-23)
  // bits 1-3 are reserved (always false), all others are bonfire flags
  getBonfireWarpFlags(): boolean[] {
    const baseOffset = this.findPattern1();
    if (baseOffset === -1) return new Array(24).fill(false);

    const byte6B = this.data[baseOffset + 0x6B];
    const byte6C = this.data[baseOffset + 0x6C];
    const byte6D = this.data[baseOffset + 0x6D];

    return [
      // byte 0x6B bits 0-7

      ((byte6B >> 0) & 1) === 1, // bit 0: warp
      ((byte6B >> 1) & 1) === 1, // bit 1: warp
      ((byte6B >> 2) & 1) === 1, // bit 2: warp

      ((byte6B >> 3) & 1) === 1, // bit 3: The Catacombs
      ((byte6B >> 4) & 1) === 1, // bit 4: Crystal Cave
      ((byte6B >> 5) & 1) === 1, // bit 5: The Duke's Archives
      ((byte6B >> 6) & 1) === 1, // bit 6: Tomb of Giants
      ((byte6B >> 7) & 1) === 1, // bit 7: Painted World of Ariamis
      // byte 0x6C bits 0-7
      ((byte6C >> 0) & 1) === 1, // bit 8: Undead Parish
      ((byte6C >> 1) & 1) === 1, // bit 9: Depths
      ((byte6C >> 2) & 1) === 1, // bit 10: Oolacile Township Dungeon
      ((byte6C >> 3) & 1) === 1, // bit 11: Chasm of the Abyss
      ((byte6C >> 4) & 1) === 1, // bit 12: Oolacile
      ((byte6C >> 5) & 1) === 1, // bit 13: Oolacile Sanctuary
      ((byte6C >> 6) & 1) === 1, // bit 14: Sanctuary Garden
      ((byte6C >> 7) & 1) === 1, // bit 15: Darkmoon Tomb
      // byte 0x6D bits 0-7
      ((byte6D >> 0) & 1) === 1, // bit 16: Chamber of the Princess
      ((byte6D >> 1) & 1) === 1, // bit 17: Altar of the Gravelord
      ((byte6D >> 2) & 1) === 1, // bit 18: Sunlight Altar
      ((byte6D >> 3) & 1) === 1, // bit 19: The Abyss
      ((byte6D >> 4) & 1) === 1, // bit 20: Anor Londo
      ((byte6D >> 5) & 1) === 1, // bit 21: Daughter of Chaos
      ((byte6D >> 6) & 1) === 1, // bit 22: Stone Dragon
      ((byte6D >> 7) & 1) === 1, // bit 23: Firelink Shrine
    ];
  }

  // Set a single bonfire flag by bit index (0-23)
  setBonfireWarpFlag(bitIndex: number, unlocked: boolean): void {
    const baseOffset = this.findPattern1();
    if (baseOffset === -1) return;

    let byteOffset: number;
    let bit: number;

    if (bitIndex < 8) {
      byteOffset = baseOffset + 0x6B;
      bit = bitIndex;
    } else if (bitIndex < 16) {
      byteOffset = baseOffset + 0x6C;
      bit = bitIndex - 8;
    } else {
      byteOffset = baseOffset + 0x6D;
      bit = bitIndex - 16;
    }

    const current = this.data[byteOffset];
    if (unlocked) {
      this.data[byteOffset] = current | (1 << bit);
    } else {
      this.data[byteOffset] = current & ~(1 << bit);
    }
  }


  getWarpFlag(): boolean {
    const baseOffset = this.findPattern1();
    if (baseOffset === -1) return false;
    return this.data[baseOffset + BONFIRE_RELATIVE_FLAG_OFFSET] !== 0;
  }

  setWarpFlag(enabled: boolean): void {
    const baseOffset = this.findPattern1();
    if (baseOffset === -1) return;
    this.data[baseOffset + BONFIRE_RELATIVE_FLAG_OFFSET] = enabled ? 0x22 : 0x00;
  }


  // Gesture methods - fixed table offset, validated by the record structure

  /** True when `offset` holds all 15 well-formed gesture records. */
  private isGestureTableAt(offset: number): boolean {
    if (offset < 0 || offset + GESTURE_COUNT * GESTURE_RECORD_SIZE > this.data.length) {
      return false;
    }
    for (let i = 0; i < GESTURE_COUNT; i++) {
      const o = offset + i * GESTURE_RECORD_SIZE;
      const value = this.data[o] | (this.data[o + 1] << 8);
      const index = this.data[o + 2] | (this.data[o + 3] << 8);
      // value carries the unlock flag in bit 0, so compare it shifted out
      if (index !== i || (value >> 1) !== i + 1) return false;
    }
    return true;
  }

  /**
   * Offset of the gesture table, or -1 when this slot has none (empty slot).
   *
   * Tries the known offset first and only scans when that fails, so the common
   * case costs 15 comparisons. The records are 4-byte aligned and the editor's
   * 16-byte read shift preserves that alignment, hence the step of 4.
   */
  public findGestureTable(): number {
    if (this.gestureTableOffset !== null && this.isGestureTableAt(this.gestureTableOffset)) {
      return this.gestureTableOffset;
    }
    if (this.isGestureTableAt(GESTURE_TABLE_OFFSET)) {
      this.gestureTableOffset = GESTURE_TABLE_OFFSET;
      return GESTURE_TABLE_OFFSET;
    }

    const max = this.data.length - GESTURE_COUNT * GESTURE_RECORD_SIZE;
    for (let i = 0; i <= max; i += GESTURE_RECORD_SIZE) {
      // Cheap reject: record 0 is always `02 00 00 00` or `03 00 00 00`.
      if ((this.data[i] | 1) !== 0x03 || this.data[i + 1] !== 0x00 ||
          this.data[i + 2] !== 0x00 || this.data[i + 3] !== 0x00) {
        continue;
      }
      if (this.isGestureTableAt(i)) {
        this.gestureTableOffset = i;
        return i;
      }
    }

    this.gestureTableOffset = null;
    return -1;
  }

  /** Unlock state of all 15 gestures, in game order. */
  getGestureFlags(): boolean[] {
    const base = this.findGestureTable();
    if (base === -1) return new Array(GESTURE_COUNT).fill(false);
    return Array.from({ length: GESTURE_COUNT }, (_, i) =>
      (this.data[base + i * GESTURE_RECORD_SIZE] & 1) === 1
    );
  }

  /** Flip a single gesture. Only bit 0 of the record is touched. */
  setGestureFlag(index: number, unlocked: boolean): void {
    if (index < 0 || index >= GESTURE_COUNT) {
      throw new Error(`Gesture index ${index} out of range (0-${GESTURE_COUNT - 1})`);
    }
    const base = this.findGestureTable();
    if (base === -1) {
      throw new Error('Cannot set gesture: gesture table not found in this slot');
    }
    const offset = base + index * GESTURE_RECORD_SIZE;
    this.data[offset] = unlocked
      ? this.data[offset] | 1
      : this.data[offset] & ~1;
  }

  unlockAllGestures(): void {
    const base = this.findGestureTable();
    if (base === -1) {
      throw new Error('Cannot unlock gestures: gesture table not found in this slot');
    }
    for (let i = 0; i < GESTURE_COUNT; i++) {
      this.data[base + i * GESTURE_RECORD_SIZE] |= 1;
    }
  }

  areGesturesUnlocked(): boolean {
    const base = this.findGestureTable();
    if (base === -1) return false;
    return this.getGestureFlags().every(Boolean);
  }

  // World event flags
  getWorldEventFlag(offset: string, bit: number, reverse: boolean): boolean {
    const baseOffset = this.findPattern1();
    if (baseOffset === -1) return false;

    const relOff = parseInt(offset, 16);
    const absOff = baseOffset + relOff;
    if (absOff < 0 || absOff >= this.data.length) return false;

    const rawBit = (this.data[absOff] >> bit) & 1;
    return reverse ? !rawBit : !!rawBit;
  }

  unlockAllBonfires(): void {
    // Находим базовое смещение Pattern1
    const baseOffset = this.findPattern1();

    if (baseOffset === -1) {
      throw new Error('Не удалось найти Pattern1 в данных сохранения. Убедитесь, что это допустимый файл сохранения Dark Souls Remastered.');
    }

    // Рассчитываем абсолютные смещения
    const bonfireOffset1 = baseOffset + BONFIRE_RELATIVE_OFFSET_1;
    const bonfireOffset2 = baseOffset + BONFIRE_RELATIVE_OFFSET_2;
    const bonfireOffset3 = baseOffset + BONFIRE_RELATIVE_OFFSET_3;
    const warpFlagOffset = baseOffset + BONFIRE_RELATIVE_FLAG_OFFSET;

    if (warpFlagOffset >= this.data.length) {
      throw new Error('Смещения костров выходят за границы файла. Возможно, файл сохранения поврежден.');
    }

    // Unlock all 21 warpable bonfires (bits 3, 4-23)
    // 0xF8 = 11111000 - bit 3 (Catacombs) + bits 4-7 of 6B (Crystal Cave, Duke's Archives, Tomb of Giants, Painted World)
    // 0xFF = 11111111 - all 8 bits of 6C (Undead Parish through Darkmoon Tomb)
    // 0xFF = 11111111 - all 8 bits of 6D (Chamber of the Princess through Firelink Shrine)
    // 0x22 = 00100010 - warp availability flag
    this.data[bonfireOffset1] = 0xF8;
    this.data[bonfireOffset2] = 0xFF;
    this.data[bonfireOffset3] = 0xFF;
    this.data[warpFlagOffset] = 0x22;

    console.log('Разблокированы все костры, доступные для варпа:');
    console.log(`  0x${bonfireOffset1.toString(16)} (Dif: 0x${BONFIRE_RELATIVE_OFFSET_1.toString(16)}): 0xF8`);
    console.log(`  0x${bonfireOffset2.toString(16)} (Dif: 0x${BONFIRE_RELATIVE_OFFSET_2.toString(16)}): 0xFF`);
    console.log(`  0x${bonfireOffset3.toString(16)} (Dif: 0x${BONFIRE_RELATIVE_OFFSET_3.toString(16)}): 0xFF`);
    console.log(`  0x${warpFlagOffset.toString(16)} (Dif: 0x${BONFIRE_RELATIVE_FLAG_OFFSET.toString(16)}): 0x22`);
  }

  getBonfireStatus(): {
    offset1: number;
    offset2: number;
    offset3: number;
    offsetFlag: number;
    values: number[];
  } | null {
    const baseOffset = this.findPattern1();
    if (baseOffset === -1) {
      return null;
    }

    const bonfireOffset1 = baseOffset + BONFIRE_RELATIVE_OFFSET_1;
    const bonfireOffset2 = baseOffset + BONFIRE_RELATIVE_OFFSET_2;
    const bonfireOffset3 = baseOffset + BONFIRE_RELATIVE_OFFSET_3;
    const warpFlagOffset = baseOffset + BONFIRE_RELATIVE_FLAG_OFFSET;

    if (warpFlagOffset >= this.data.length) {
      return null;
    }

    return {
      offset1: bonfireOffset1,
      offset2: bonfireOffset2,
      offset3: bonfireOffset3,
      offsetFlag: warpFlagOffset,
      values: [
        this.data[bonfireOffset1],
        this.data[bonfireOffset2],
        this.data[bonfireOffset3],
        this.data[warpFlagOffset]
      ],
    };
  }

  /**
   * True when every warpable bonfire is unlocked.
   *
   * Decodes the actual flag bits via getBonfireWarpFlags() instead of
   * comparing the raw bytes against fixed values. The old byte comparison
   * expected 0xF0 in the first byte while unlockAllBonfires() writes 0xF8
   * (0xF0 plus bit 3, The Catacombs), so it reported "locked" right after an
   * unlock, and it also rejected any save where the warp bits 0-2 happened to
   * be set. Bits 0-2 are warp bits, not bonfires, and are ignored here.
   */
  areBonfiresUnlocked(): boolean {
    const flags = this.getBonfireWarpFlags();
    return BONFIRE_BIT_INDICES.every(bit => flags[bit]);
  }

  /** True when a valid-looking kindle record (marker + plausible id) starts at `offset`. */
  private isKindleRecordAt(offset: number): boolean {
    if (offset < 0 || offset + BONFIRE_KINDLE_RECORD_SIZE > this.data.length) return false;
    if (this.data[offset] !== 0x0B || this.data[offset + 1] !== 0 ||
        this.data[offset + 2] !== 0 || this.data[offset + 3] !== 0) {
      return false;
    }
    const idOff = offset + BONFIRE_KINDLE_ID_OFFSET;
    const id = this.data[idOff] | (this.data[idOff + 1] << 8) | (this.data[idOff + 2] << 16);
    return id >= BONFIRE_KINDLE_ID_MIN && id < BONFIRE_KINDLE_ID_MAX;
  }

  /**
   * Finds the bonfire-kindle array by scanning for the longest run of
   * consecutive 20-byte-stride valid-looking records (see class doc comment
   * on `BONFIRE_KINDLE_RECORD_SIZE` for why this isn't a fixed offset/count).
   * Cached per instance; returns null when nothing matches `BONFIRE_KINDLE_MIN_RUN`.
   */
  private findBonfireKindleArray(): { start: number; count: number } | null {
    if (this.bonfireKindleArray !== undefined) return this.bonfireKindleArray;

    let best: { start: number; count: number } | null = null;
    const max = this.data.length - BONFIRE_KINDLE_RECORD_SIZE;
    for (let i = 0; i <= max; i++) {
      if (!this.isKindleRecordAt(i)) continue;
      if (this.isKindleRecordAt(i - BONFIRE_KINDLE_RECORD_SIZE)) continue; // not a run start
      let count = 1;
      while (this.isKindleRecordAt(i + count * BONFIRE_KINDLE_RECORD_SIZE)) count++;
      if (!best || count > best.count) best = { start: i, count };
    }

    this.bonfireKindleArray = best && best.count >= BONFIRE_KINDLE_MIN_RUN ? best : null;
    return this.bonfireKindleArray;
  }

  /** Raw bonfire-kindle records: entity id + the raw value byte, by array index. */
  getBonfireKindleEntries(): { index: number; id: number; name: string | null; value: number }[] {
    const array = this.findBonfireKindleArray();
    if (!array) return [];
    const entries: { index: number; id: number; name: string | null; value: number }[] = [];
    for (let i = 0; i < array.count; i++) {
      const recOffset = array.start + i * BONFIRE_KINDLE_RECORD_SIZE;
      const idOff = recOffset + BONFIRE_KINDLE_ID_OFFSET;
      const id = this.data[idOff] | (this.data[idOff + 1] << 8) | (this.data[idOff + 2] << 16);
      const value = this.data[recOffset + BONFIRE_KINDLE_VALUE_OFFSET];
      entries.push({ index: i, id, name: BONFIRE_KINDLE_ID_NAMES[id] ?? null, value });
    }
    return entries;
  }

  /** Writes the raw kindle-value byte directly (see `BONFIRE_KINDLE_VALUES` for the 5 real states). */
  setBonfireKindleValue(index: number, value: number): void {
    const array = this.findBonfireKindleArray();
    if (!array) return;
    if (index < 0 || index >= array.count) return;
    const recOffset = array.start + index * BONFIRE_KINDLE_RECORD_SIZE;
    this.data[recOffset + BONFIRE_KINDLE_VALUE_OFFSET] = value;
  }

  /** Sets every tracked bonfire to the real max (25 Estus, value=40). */
  kindleAllBonfires(): void {
    const array = this.findBonfireKindleArray();
    if (!array) return;
    for (let i = 0; i < array.count; i++) {
      this.setBonfireKindleValue(i, 40);
    }
  }

  /**
   * Метод для отладки, который проверяет смещения Pattern1 и значения костров.
   * Восстановлен для удобства.
   */
  verifyOffsets(): {
    pattern1Found: boolean;
    pattern1Offset: number;
    bonfireOffsets: { offset1: number; offset2: number; offset3: number; offsetFlag: number };
    bonfireValues: number[];
  } {
    const pattern1Offset = this.findPattern1();

    if (pattern1Offset === -1) {
      return {
        pattern1Found: false,
        pattern1Offset: -1,
        bonfireOffsets: { offset1: -1, offset2: -1, offset3: -1, offsetFlag: -1 },
        bonfireValues: []
      };
    }

    const bonfireOffset1 = pattern1Offset + BONFIRE_RELATIVE_OFFSET_1;
    const bonfireOffset2 = pattern1Offset + BONFIRE_RELATIVE_OFFSET_2;
    const bonfireOffset3 = pattern1Offset + BONFIRE_RELATIVE_OFFSET_3;
    const warpFlagOffset = pattern1Offset + BONFIRE_RELATIVE_FLAG_OFFSET;

    const results = {
      pattern1Found: true,
      pattern1Offset: pattern1Offset,
      bonfireOffsets: {
        offset1: bonfireOffset1,
        offset2: bonfireOffset2,
        offset3: bonfireOffset3,
        offsetFlag: warpFlagOffset
      },
      bonfireValues: [
        this.data[bonfireOffset1],
        this.data[bonfireOffset2],
        this.data[bonfireOffset3],
        this.data[warpFlagOffset]
      ]
    };

    console.log('=== Pattern1 Verification (Восстановлено) ===');
    console.log('Pattern1 found at:', `0x${pattern1Offset.toString(16)}`);
    console.log('Bonfire offsets (Абсолютные):');
    console.log(`  0x${bonfireOffset1.toString(16)}: 0x${this.data[bonfireOffset1].toString(16).padStart(2, '0')}`);
    console.log(`  0x${bonfireOffset2.toString(16)}: 0x${this.data[bonfireOffset2].toString(16).padStart(2, '0')}`);
    console.log(`  0x${bonfireOffset3.toString(16)}: 0x${this.data[bonfireOffset3].toString(16).padStart(2, '0')}`);
    console.log(`  0x${warpFlagOffset.toString(16)}: 0x${this.data[warpFlagOffset].toString(16).padStart(2, '0')}`);

    return results;
  }
}