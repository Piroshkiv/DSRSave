import { STATS_OFFSETS, PlayerClass, VIT_TO_HP, END_TO_STAMINA } from './constants';

// Relative offsets to the base address found by findPattern1()
const BONFIRE_RELATIVE_OFFSET_1 = 0x6B; // Bonfire data 1
const BONFIRE_RELATIVE_OFFSET_2 = 0x6C; // Bonfire data 2
const BONFIRE_RELATIVE_OFFSET_3 = 0x6D; // Bonfire data 3
const BONFIRE_RELATIVE_FLAG_OFFSET = 0xAE; // Warp flag

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
    return this.readUtf16String(0x108);
  }

  set name(value: string) {
    this.writeUtf16String(0x108, value);
    this.writeUtf16String(0x18C, value);
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
  findPattern1(): number {
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

    // Записываем шаблон разблокировки (битовые флаги)
    // 0xF0 = 11110000 - разблокирует 4 костра
    // 0xFF = 11111111 - разблокирует 8 костров
    // 0x22 = 00100010 - специфичный флаг варпа
    this.data[bonfireOffset1] = 0xF0;
    this.data[bonfireOffset2] = 0xFF;
    this.data[bonfireOffset3] = 0xFF;
    this.data[warpFlagOffset] = 0x22;

    console.log('Разблокированы все костры, доступные для варпа:');
    console.log(`  0x${bonfireOffset1.toString(16)} (Dif: 0x${BONFIRE_RELATIVE_OFFSET_1.toString(16)}): 0xF0`);
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

  // NPC methods
  /**
   * Set a specific bit in a byte at the given offset
   * @param offset Byte offset in the data
   * @param bitPosition Bit position (0-7)
   * @param value true to set bit to 1, false to set to 0
   */
  private setBit(offset: number, bitPosition: number, value: boolean): void {
    if (bitPosition < 0 || bitPosition > 7) {
      throw new Error('Bit position must be between 0 and 7');
    }

    const currentValue = this.data[offset];
    const mask = 1 << bitPosition;

    if (value) {
      this.data[offset] = currentValue | mask;
    } else {
      this.data[offset] = currentValue & ~mask;
    }
  }

  /**
   * Get a specific bit from a byte at the given offset
   * @param offset Byte offset in the data
   * @param bitPosition Bit position (0-7)
   * @returns true if bit is 1, false if 0
   */
  /*
  private getBit(offset: number, bitPosition: number): boolean {
    if (bitPosition < 0 || bitPosition > 7) {
      throw new Error('Bit position must be between 0 and 7');
    }

    const currentValue = this.data[offset];
    const mask = 1 << bitPosition;
    return (currentValue & mask) !== 0;
  }
  */

  /**
   * Set NPC alive/dead state
   * @param npcBits Array of bit entries for the NPC
   * @param alive true to revive, false to kill
   */
  setNpcAlive(npcBits: Array<{ offset: string; bit: number; reverse: boolean }>, alive: boolean): void {
    const baseOffset = this.findPattern1();

    if (baseOffset === -1) {
      throw new Error('Pattern not found in character data');
    }

    for (const bitEntry of npcBits) {
      const offset = parseInt(bitEntry.offset, 16);
      const absoluteOffset = baseOffset + offset;

      if (absoluteOffset < 0 || absoluteOffset >= this.data.length) {
        throw new Error(`Calculated offset ${absoluteOffset} is out of bounds`);
      }

      const bitValue = bitEntry.reverse ? !alive : alive;
      this.setBit(absoluteOffset, bitEntry.bit, bitValue);
    }
  }

}