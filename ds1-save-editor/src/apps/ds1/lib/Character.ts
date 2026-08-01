import { STATS_OFFSETS, PlayerClass, VIT_TO_HP, END_TO_STAMINA } from './constants';

// Relative offsets to the base address found by findPattern1()
const BONFIRE_RELATIVE_OFFSET_1 = 0x6B; // Bonfire data 1
const BONFIRE_RELATIVE_OFFSET_2 = 0x6C; // Bonfire data 2
const BONFIRE_RELATIVE_OFFSET_3 = 0x6D; // Bonfire data 3
const BONFIRE_RELATIVE_FLAG_OFFSET = 0xAE; // Warp flag
const NG_PLUS_RELATIVE_OFFSET = -0xBC0; // NG+ counter (pattern1 - 0xBC0)

export class Character {
  private data: Uint8Array;
  public slotNumber: number;

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

  get hairstyle(): number {
    return this.data[0x0175] | (this.data[0x0176] << 8) | (this.data[0x0177] << 16) | (this.data[0x0178] << 24);
  }

  set hairstyle(value: number) {
    this.data[0x0175] = value & 0xFF;
    this.data[0x0176] = (value >> 8) & 0xFF;
    this.data[0x0177] = (value >> 16) & 0xFF;
    this.data[0x0178] = (value >> 24) & 0xFF;
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

  getHairColor(): [number, number, number] {
    return [
      this.readFloat32LE(0xe414),
      this.readFloat32LE(0xe418),
      this.readFloat32LE(0xe41c),
    ];
  }

  setHairColor(r: number, g: number, b: number): void {
    this.writeFloat32LE(0xe414, r);
    this.writeFloat32LE(0xe418, g);
    this.writeFloat32LE(0xe41c, b);
    if (this.readFloat32LE(0xe420) === 0) {
      this.writeFloat32LE(0xe420, 1.0);
    }
  }

  getEyeColor(): [number, number, number] {
    return [
      this.readFloat32LE(0xe424),
      this.readFloat32LE(0xe428),
      this.readFloat32LE(0xe42c),
    ];
  }

  setEyeColor(r: number, g: number, b: number): void {
    this.writeFloat32LE(0xe424, r);
    this.writeFloat32LE(0xe428, g);
    this.writeFloat32LE(0xe42c, b);
    if (this.readFloat32LE(0xe430) === 0) {
      this.writeFloat32LE(0xe430, 1.0);
    }
  }

  getFaceData(): Uint8Array {
    return new Uint8Array(this.data.slice(0xe434, 0xe466));
  }

  setFaceData(data: Uint8Array): void {
    for (let i = 0; i < Math.min(data.length, 50); i++) {
      this.data[0xe434 + i] = data[i];
    }
  }

  getSkinColor(): Uint8Array {
    return new Uint8Array(this.data.slice(0xe466, 0xe498));
  }

  setSkinColor(data: Uint8Array): void {
    for (let i = 0; i < Math.min(data.length, 50); i++) {
      this.data[0xe466 + i] = data[i];
    }
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

  areBonfiresUnlocked(): boolean {
    const status = this.getBonfireStatus();
    if (!status) return false;

    // Проверяем соответствие целевым значениям разблокировки
    return status.values[0] === 0xF0 &&
              status.values[1] === 0xFF &&
              status.values[2] === 0xFF &&
              status.values[3] === 0x22;
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