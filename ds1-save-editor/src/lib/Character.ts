import { STATS_OFFSETS, PlayerClass, VIT_TO_HP, END_TO_STAMINA } from './constants';

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
}
