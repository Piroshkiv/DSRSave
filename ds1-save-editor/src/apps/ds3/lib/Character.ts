import { OFFSETS, MAX_VALUES } from './constants';

/**
 * Represents a DS3 character save data
 * Based on DS3Character.cs from DS3SaveEditor
 */
export class DS3Character {
  private data: Uint8Array;
  public slotIndex: number;

  constructor(data: Uint8Array, slotIndex: number) {
    if (!data) {
      throw new Error('Character data cannot be null');
    }
    this.data = data;
    this.slotIndex = slotIndex;
  }

  /**
   * Get raw decrypted character data
   */
  getRawData(): Uint8Array {
    return this.data;
  }

  /**
   * Check if character slot is empty
   */
  get isEmpty(): boolean {
    if (this.data.length < 0x100) return true;

    // Check if first few bytes are all zeros
    for (let i = 0x10; i < 0x40; i++) {
      if (this.data[i] !== 0x00) return false;
    }
    return true;
  }

  /**
   * Direct byte access (like DS3Character.cs indexer)
   */
  getByte(offset: number): number {
    if (offset < 0 || offset >= this.data.length) {
      throw new RangeError(`Offset ${offset} is out of range`);
    }
    return this.data[offset];
  }

  setByte(offset: number, value: number): void {
    if (offset < 0 || offset >= this.data.length) {
      throw new RangeError(`Offset ${offset} is out of range`);
    }
    this.data[offset] = value & 0xFF;
  }

  /**
   * Set a specific bit at offset
   */
  setBit(offset: number, bitPosition: number, value: boolean): void {
    if (offset < 0 || offset >= this.data.length) {
      throw new RangeError(`Offset ${offset} is out of range`);
    }
    if (bitPosition < 0 || bitPosition > 7) {
      throw new Error('Bit position must be 0-7');
    }

    const mask = 1 << bitPosition;
    if (value) {
      this.data[offset] |= mask;
    } else {
      this.data[offset] &= ~mask;
    }
  }

  /**
   * Get a specific bit at offset
   */
  getBit(offset: number, bitPosition: number): boolean {
    if (offset < 0 || offset >= this.data.length) {
      throw new RangeError(`Offset ${offset} is out of range`);
    }
    if (bitPosition < 0 || bitPosition > 7) {
      throw new Error('Bit position must be 0-7');
    }

    const mask = 1 << bitPosition;
    return (this.data[offset] & mask) !== 0;
  }

  // ===== NAME (MOCK) =====
  /**
   * Get character name (MOCK - returns placeholder)
   * TODO: Implement actual name reading when offset is known
   */
  get name(): string {
    if (this.isEmpty) return '';
    return `Character ${this.slotIndex + 1}`;
  }

  /**
   * Set character name (MOCK - not implemented yet)
   * TODO: Implement actual name writing when offset is known
   */
  set name(_value: string) {
    // TODO: Implement when offset is known
    console.warn('Name setter not implemented yet');
  }

  // ===== LEVEL (MOCK) =====
  /**
   * Get character level (MOCK - returns placeholder)
   * TODO: Implement actual level reading when offset is known
   */
  get level(): number {
    if (this.isEmpty) return 0;
    // Mock: return a value based on slot index for variety
    return 1 + (this.slotIndex * 10);
  }

  /**
   * Set character level (MOCK - not implemented yet)
   * TODO: Implement actual level writing when offset is known
   */
  set level(_value: number) {
    // TODO: Implement when offset is known
    console.warn('Level setter not implemented yet');
  }

  // ===== SOULS =====
  /**
   * Get souls count (4 bytes, Little-Endian)
   * Offsets: 71100-71103 (0x115DC-0x115DF)
   * Example: [0xFF, 0xE0, 0xF5, 0x05] = 99,999,999
   */
  get souls(): number {
    const offset = OFFSETS.SOULS;
    return (
      this.data[offset] |
      (this.data[offset + 1] << 8) |
      (this.data[offset + 2] << 16) |
      (this.data[offset + 3] << 24)
    ) >>> 0; // Unsigned 32-bit integer
  }

  /**
   * Set souls count (4 bytes, Little-Endian)
   */
  set souls(value: number) {
    // Clamp to valid range
    value = Math.max(0, Math.min(MAX_VALUES.SOULS, value));

    const offset = OFFSETS.SOULS;
    this.data[offset] = value & 0xFF;           // Byte 0: bits 0-7
    this.data[offset + 1] = (value >> 8) & 0xFF;   // Byte 1: bits 8-15
    this.data[offset + 2] = (value >> 16) & 0xFF;  // Byte 2: bits 16-23
    this.data[offset + 3] = (value >> 24) & 0xFF;  // Byte 3: bits 24-31
  }

  // ===== STATS (MOCK) =====
  /**
   * Get stat value (MOCK - returns placeholder)
   * TODO: Implement actual stat reading when offsets are known
   */
  getStat(_statName: string): number {
    // Mock values
    return 10;
  }

  /**
   * Set stat value (MOCK - not implemented yet)
   * TODO: Implement actual stat writing when offsets are known
   */
  setStat(statName: string, _value: number): void {
    // TODO: Implement when offsets are known
    console.warn(`Stat setter for ${statName} not implemented yet`);
  }
}
