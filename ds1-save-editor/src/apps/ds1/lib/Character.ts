import { STATS_OFFSETS, PlayerClass, VIT_TO_HP, END_TO_STAMINA } from './constants';

// Relative offsets to the base address found by findPattern1()
const BONFIRE_RELATIVE_OFFSET_1 = 0x6B; // Bonfire data 1
const BONFIRE_RELATIVE_OFFSET_2 = 0x6C; // Bonfire data 2
const BONFIRE_RELATIVE_OFFSET_3 = 0x6D; // Bonfire data 3
const BONFIRE_RELATIVE_FLAG_OFFSET = 0xAE; // Warp flag
const NG_PLUS_RELATIVE_OFFSET = -0xBC0; // NG+ counter (pattern1 - 0xBC0)

/**
 * Bit indices of the 21 warpable bonfires, in display order.
 * Bits 0-2 of +0x6B are warp bits, not bonfires, so the list starts at 3.
 */
export const BONFIRE_BIT_INDICES = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
] as const;

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
   * Восстановленный метод поиска "Магического паттерна" (Pattern1).
   * Ищет последнее вхождение паттерна в диапазоне 0x1F000 - 0x1FFFF.
   * @returns Базовое смещение (baseOffset) или -1, если не найдено.
   */
  public findPattern1(): number {
    // Pattern1: FF FF FF FF 00 00 00 00 FF FF FF FF 00 00 00 00
    const pattern = [
      0xFF, 0xFF, 0xFF, 0xFF,
      0x00, 0x00, 0x00, 0x00,
      0xFF, 0xFF, 0xFF, 0xFF,
      0x00, 0x00, 0x00, 0x00
    ];

    const startOffset = 0x1F000;
    const endOffset = 0x1FFFF;
    
    if (startOffset < 0 || endOffset >= this.data.length || startOffset > endOffset) {
      // Это может произойти, если файл слишком короткий
      return -1;
    }
    
    const maxStart = endOffset - pattern.length + 1;
    const patternOffsets: number[] = [];

    // Ищем ВСЕ вхождения
    for (let i = startOffset; i <= maxStart; i++) {
      let matches = true;
      for (let j = 0; j < pattern.length; j++) {
        if (this.data[i + j] !== pattern[j]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        patternOffsets.push(i);
      }
    }

    if (patternOffsets.length === 0) {
      return -1;
    }

    // Возвращаем ПОСЛЕДНЕЕ вхождение
    const lastOffset = patternOffsets[patternOffsets.length - 1];
    console.log(`Найдено ${patternOffsets.length} Pattern1, используется ПОСЛЕДНЕЕ на 0x${lastOffset.toString(16)}`);

    return lastOffset;
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
    console.log('Pattern1 (LAST) found at:', `0x${pattern1Offset.toString(16)}`);
    console.log('Bonfire offsets (Абсолютные):');
    console.log(`  0x${bonfireOffset1.toString(16)}: 0x${this.data[bonfireOffset1].toString(16).padStart(2, '0')}`);
    console.log(`  0x${bonfireOffset2.toString(16)}: 0x${this.data[bonfireOffset2].toString(16).padStart(2, '0')}`);
    console.log(`  0x${bonfireOffset3.toString(16)}: 0x${this.data[bonfireOffset3].toString(16).padStart(2, '0')}`);
    console.log(`  0x${warpFlagOffset.toString(16)}: 0x${this.data[warpFlagOffset].toString(16).padStart(2, '0')}`);

    return results;
  }
}