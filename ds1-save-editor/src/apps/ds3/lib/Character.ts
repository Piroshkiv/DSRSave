import {
  MAX_VALUES,
  CHARACTER_PATTERN,
  RELATIVE_OFFSETS,
  PLAYTIME_OFFSET,
  PLAYTIME_MS_PER_LEVEL_MIN,
  PLAYTIME_MS_PER_LEVEL_MAX,
  minSoulMemoryForLevel,
  PlayerClass,
  CLASS_NAMES,
  CLASS_STARTING_STATS,
  VIGOR_TO_HP,
  ATTUNEMENT_TO_FP,
  ENDURANCE_TO_STAMINA,
} from './constants';

/**
 * Represents a DS3 character save data
 * Based on DS3Character.cs from DS3SaveEditor
 */
export class DS3Character {
  private data: Uint8Array;
  public slotIndex: number;
  private patternOffset: number | null = null;
  private patternSearched: boolean = false;

  constructor(data: Uint8Array, slotIndex: number) {
    if (!data) {
      throw new Error('Character data cannot be null');
    }
    this.data = data;
    this.slotIndex = slotIndex;
    // Don't search for pattern on initialization - do it lazily when needed
  }

  /**
   * Ensure pattern has been found (lazy initialization)
   * Only searches once, then caches the result
   */
  private ensurePatternFound(): void {
    if (this.patternSearched) {
      return;
    }

    this.patternSearched = true;
    this.patternOffset = this.findCharacterPattern();

    if (this.patternOffset === -1) {
      throw new Error(`[DS3] Character ${this.slotIndex}: Pattern not found in save data. This may not be a valid Dark Souls 3 save file or the character slot is empty.`);
    }

    console.log(`[DS3] Character ${this.slotIndex}: Pattern found at 0x${this.patternOffset.toString(16)}`);
  }

  /**
   * Find the character data pattern in the save file
   * Pattern: 32 bytes - FF FF FF FF 00 00 00 00 00 00 00 00 00 00 00 00 (repeated twice)
   * Searches through entire data buffer without range limits
   * @returns Pattern position or -1 if not found
   */
  private findCharacterPattern(): number {
    const pattern = CHARACTER_PATTERN;

    if (this.data.length < pattern.length) {
      return -1;
    }

    const maxStart = this.data.length - pattern.length;
    const matches: number[] = [];

    for (let i = 0; i <= maxStart; i++) {
      let found = true;
      for (let j = 0; j < pattern.length; j++) {
        if (this.data[i + j] !== pattern[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        matches.push(i);
      }
    }

    if (matches.length === 0) {
      return -1;
    }

    const lastMatch = matches[0];
    console.log(`[DS3] Found ${matches.length} pattern match(es), using first at 0x${lastMatch.toString(16)}`);
    return lastMatch;
  }

  /**
   * Get the actual offset for a given stat/value
   * Uses pattern-based offset calculation
   * For large positive offsets (> 0x1000), treats them as pattern + offset
   */
  private getOffset(key: keyof typeof RELATIVE_OFFSETS): number {
    this.ensurePatternFound(); // Lazy initialization of pattern

    const relativeOffset = RELATIVE_OFFSETS[key];
    if (relativeOffset === undefined) {
      throw new Error(`Unknown offset key: ${key}`);
    }
    return this.patternOffset! + relativeOffset;
  }

  /**
   * Get raw decrypted character data
   */
  getRawData(): Uint8Array {
    return this.data;
  }

  /**
   * Invalidate the cached pattern offset.
   * Must be called after any operation that shifts bytes in the data buffer
   * (e.g. GA table manipulation inserts/deletes bytes, moving the pattern).
   */
  invalidatePatternCache(): void {
    this.patternOffset = null;
    this.patternSearched = false;
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

  // ===== NAME =====
  get name(): string {
    if (this.isEmpty) return '';
    try {
      const offset = this.getOffset('NAME');
      let result = '';
      for (let i = 0; i < 32; i += 2) {
        const charCode = this.data[offset + i] | (this.data[offset + i + 1] << 8);
        if (charCode === 0) break;
        result += String.fromCharCode(charCode);
      }
      return result;
    } catch {
      return '';
    }
  }

  set name(value: string) {
    if (this.isEmpty) return;
    const offset = this.getOffset('NAME');
    for (let i = 0; i < 32; i++) this.data[offset + i] = 0;
    const maxChars = Math.min(value.length, 16);
    for (let i = 0; i < maxChars; i++) {
      const code = value.charCodeAt(i);
      this.data[offset + i * 2] = code & 0xFF;
      this.data[offset + i * 2 + 1] = (code >> 8) & 0xFF;
    }
  }

  // ===== LEVEL =====
  /**
   * Get character level (2 bytes, Little-Endian)
   */
  get level(): number {
    if (this.isEmpty) return 0;
    const offset = this.getOffset('LEVEL');
    return this.data[offset] | (this.data[offset + 1] << 8);
  }

  /**
   * Set character level (2 bytes, Little-Endian)
   */
  set level(value: number) {
    value = Math.max(1, Math.min(MAX_VALUES.LEVEL, value));
    const offset = this.getOffset('LEVEL');
    this.data[offset] = value & 0xFF;
    this.data[offset + 1] = (value >> 8) & 0xFF;
  }

  // ===== SOULS =====
  /**
   * Get souls count (4 bytes, Little-Endian)
   */
  get souls(): number {
    if (this.isEmpty) return 0;
    const offset = this.getOffset('SOULS');
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

    const offset = this.getOffset('SOULS');
    this.data[offset] = value & 0xFF;           // Byte 0: bits 0-7
    this.data[offset + 1] = (value >> 8) & 0xFF;   // Byte 1: bits 8-15
    this.data[offset + 2] = (value >> 16) & 0xFF;  // Byte 2: bits 16-23
    this.data[offset + 3] = (value >> 24) & 0xFF;  // Byte 3: bits 24-31
  }

  // ===== STATS =====
  /**
   * Mapping of stat names to offset keys
   */
  private static readonly STAT_MAP: Record<string, keyof typeof RELATIVE_OFFSETS> = {
    'VIG': 'VIGOR',
    'ATN': 'ATTUNEMENT',
    'END': 'ENDURANCE',
    'VIT': 'VITALITY',
    'STR': 'STRENGTH',
    'DEX': 'DEXTERITY',
    'INT': 'INTELLIGENCE',
    'FTH': 'FAITH',
    'LCK': 'LUCK',
  };

  /**
   * Get stat value (1 byte)
   */
  getStat(statName: string): number {
    if (this.isEmpty) return 0;
    const offsetKey = DS3Character.STAT_MAP[statName];
    if (!offsetKey) {
      console.warn(`Unknown stat: ${statName}`);
      return 0;
    }
    const offset = this.getOffset(offsetKey as keyof typeof RELATIVE_OFFSETS);
    return this.data[offset];
  }

  /**
   * Set stat value (1 byte). Always recalculates HP/FP/Stamina for VIG/ATN/END.
   */
  setStat(statName: string, value: number): void {
    const offsetKey = DS3Character.STAT_MAP[statName];
    if (!offsetKey) {
      console.warn(`Unknown stat: ${statName}`);
      return;
    }
    const maxKey = offsetKey as keyof typeof MAX_VALUES;
    const max = MAX_VALUES[maxKey] as number || 99;
    value = Math.max(0, Math.min(max, value));
    const offset = this.getOffset(offsetKey as keyof typeof RELATIVE_OFFSETS);
    this.data[offset] = value & 0xFF;

    if (statName === 'VIG') {
      const hp = VIGOR_TO_HP[value];
      if (typeof hp === 'number') this.hp = hp;
    } else if (statName === 'ATN') {
      const fp = ATTUNEMENT_TO_FP[value];
      if (typeof fp === 'number') this.fp = fp;
    } else if (statName === 'END') {
      const stamina = ENDURANCE_TO_STAMINA[value];
      if (typeof stamina === 'number') this.stamina = stamina;
    }
  }

  // ===== DERIVED STATS =====
  /**
   * Get HP (4 bytes, Little-Endian)
   */
  get hp(): number {
    if (this.isEmpty) return 0;
    const offset = this.getOffset('HP');
    return (
      this.data[offset] |
      (this.data[offset + 1] << 8) |
      (this.data[offset + 2] << 16) |
      (this.data[offset + 3] << 24)
    ) >>> 0;
  }

  /**
   * Set HP (4 bytes, Little-Endian)
   */
  set hp(value: number) {
    value = Math.max(0, Math.min(9999, value));
    const offset = this.getOffset('HP');
    this.data[offset] = value & 0xFF;
    this.data[offset + 1] = (value >> 8) & 0xFF;
    this.data[offset + 2] = (value >> 16) & 0xFF;
    this.data[offset + 3] = (value >> 24) & 0xFF;
  }

  /**
   * Get FP (4 bytes, Little-Endian)
   */
  get fp(): number {
    if (this.isEmpty) return 0;
    const offset = this.getOffset('FP');
    return (
      this.data[offset] |
      (this.data[offset + 1] << 8) |
      (this.data[offset + 2] << 16) |
      (this.data[offset + 3] << 24)
    ) >>> 0;
  }

  /**
   * Set FP (4 bytes, Little-Endian)
   */
  set fp(value: number) {
    value = Math.max(0, Math.min(999, value));
    const offset = this.getOffset('FP');
    this.data[offset] = value & 0xFF;
    this.data[offset + 1] = (value >> 8) & 0xFF;
    this.data[offset + 2] = (value >> 16) & 0xFF;
    this.data[offset + 3] = (value >> 24) & 0xFF;
  }

  /**
   * Get Stamina (4 bytes, Little-Endian)
   */
  get stamina(): number {
    if (this.isEmpty) return 0;
    const offset = this.getOffset('STAMINA');
    return (
      this.data[offset] |
      (this.data[offset + 1] << 8) |
      (this.data[offset + 2] << 16) |
      (this.data[offset + 3] << 24)
    ) >>> 0;
  }

  /**
   * Set Stamina (4 bytes, Little-Endian)
   */
  set stamina(value: number) {
    value = Math.max(0, Math.min(999, value));
    const offset = this.getOffset('STAMINA');
    this.data[offset] = value & 0xFF;
    this.data[offset + 1] = (value >> 8) & 0xFF;
    this.data[offset + 2] = (value >> 16) & 0xFF;
    this.data[offset + 3] = (value >> 24) & 0xFF;
  }

  // ===== SOUL MEMORY (Total Get Soul) =====
  /**
   * Get soul memory — total souls ever collected (4 bytes, Little-Endian)
   */
  get soulMemory(): number {
    if (this.isEmpty) return 0;
    const offset = this.getOffset('SOUL_MEMORY');
    return (
      this.data[offset] |
      (this.data[offset + 1] << 8) |
      (this.data[offset + 2] << 16) |
      (this.data[offset + 3] << 24)
    ) >>> 0;
  }

  /**
   * Set soul memory (4 bytes, Little-Endian)
   */
  set soulMemory(value: number) {
    // soul memory is a genuine u32 — allow the full range (level-802 floor ~3.16B > the souls cap)
    value = Math.max(0, Math.min(0xFFFFFFFF, Math.floor(value)));
    const offset = this.getOffset('SOUL_MEMORY');
    this.data[offset] = value & 0xFF;
    this.data[offset + 1] = (value >>> 8) & 0xFF;
    this.data[offset + 2] = (value >>> 16) & 0xFF;
    this.data[offset + 3] = (value >>> 24) & 0xFF;
  }

  /**
   * Raise soul memory to at least the plausible minimum for the current level
   * ((cumulative level-up cost + 20%) plus the souls currently held, since those
   * were also collected). Never lowers an already-higher value.
   */
  enforceSoulMemoryFloor(): void {
    if (this.isEmpty) return;
    const floor = minSoulMemoryForLevel(this.level) + this.souls;
    if (this.soulMemory < floor) this.soulMemory = floor;
  }

  /**
   * Apply the side effects of a soul-level increase: credit plausible play time
   * (random 3-5 min per level) and raise the soul-memory floor. Call with the
   * level before an edit; if the current level is higher, the difference is credited.
   */
  applyLevelProgression(previousLevel: number): void {
    if (this.isEmpty) return;
    const gained = this.level - previousLevel;
    if (gained > 0) {
      let extraMs = 0;
      for (let i = 0; i < gained; i++) {
        extraMs += PLAYTIME_MS_PER_LEVEL_MIN +
          Math.random() * (PLAYTIME_MS_PER_LEVEL_MAX - PLAYTIME_MS_PER_LEVEL_MIN);
      }
      this.playtimeMs = this.playtimeMs + Math.floor(extraMs);
    }
    this.enforceSoulMemoryFloor();
  }

  /**
   * Apply the side effects of a held-souls edit: souls added by the editor count
   * as collected, so soul memory grows by the same amount (it never shrinks when
   * souls are removed — spending souls doesn't reduce Total Get Soul). Call with
   * the souls value before the edit.
   */
  applySoulsProgression(previousSouls: number): void {
    if (this.isEmpty) return;
    const gained = this.souls - previousSouls;
    if (gained > 0) {
      this.soulMemory = this.soulMemory + gained;
    }
    this.enforceSoulMemoryFloor();
  }

  // ===== PLAY TIME =====
  /**
   * Get play time in milliseconds (4 bytes, Little-Endian, slot header offset — not pattern-relative)
   */
  get playtimeMs(): number {
    if (this.isEmpty) return 0;
    return (
      this.data[PLAYTIME_OFFSET] |
      (this.data[PLAYTIME_OFFSET + 1] << 8) |
      (this.data[PLAYTIME_OFFSET + 2] << 16) |
      (this.data[PLAYTIME_OFFSET + 3] << 24)
    ) >>> 0;
  }

  /**
   * Set play time in milliseconds (4 bytes, Little-Endian)
   */
  set playtimeMs(value: number) {
    value = Math.max(0, Math.min(0xFFFFFFFF, Math.floor(value)));
    this.data[PLAYTIME_OFFSET] = value & 0xFF;
    this.data[PLAYTIME_OFFSET + 1] = (value >>> 8) & 0xFF;
    this.data[PLAYTIME_OFFSET + 2] = (value >>> 16) & 0xFF;
    this.data[PLAYTIME_OFFSET + 3] = (value >>> 24) & 0xFF;
  }

  // ===== PROGRESSION =====
  /**
   * Get NG+ Cycle (1 byte)
   */
  get ngCycle(): number {
    if (this.isEmpty) return 0;
    return this.data[this.getOffset('NG_CYCLE')];
  }

  /**
   * Set NG+ Cycle (1 byte)
   */
  set ngCycle(value: number) {
    value = Math.max(0, Math.min(MAX_VALUES.NG_CYCLE, value));
    this.data[this.getOffset('NG_CYCLE')] = value & 0xFF;
  }

  // ===== ESTUS =====
  /**
   * Get Estus Flask Max Count (1 byte)
   */
  get estusMax(): number {
    if (this.isEmpty) return 0;
    return this.data[this.getOffset('ESTUS_MAX')];
  }

  /**
   * Set Estus Flask Max Count (1 byte)
   */
  set estusMax(value: number) {
    value = Math.max(0, Math.min(20, value)); // Max 20 in unsafe mode
    this.data[this.getOffset('ESTUS_MAX')] = value & 0xFF;
  }

  /**
   * Get Ashen Estus Flask Max Count (1 byte)
   */
  get ashenEstusMax(): number {
    if (this.isEmpty) return 0;
    return this.data[this.getOffset('ASHEN_ESTUS_MAX')];
  }

  /**
   * Set Ashen Estus Flask Max Count (1 byte)
   */
  set ashenEstusMax(value: number) {
    value = Math.max(0, Math.min(20, value)); // Max 20 in unsafe mode
    this.data[this.getOffset('ASHEN_ESTUS_MAX')] = value & 0xFF;
  }

  // ===== WEAPON MEMORY =====
  get weaponMemory(): number {
    if (this.isEmpty) return 0;
    return this.data[this.getOffset('WEAPON_MEMORY')];
  }

  set weaponMemory(value: number) {
    value = Math.max(0, Math.min(10, value));
    this.data[this.getOffset('WEAPON_MEMORY')] = value & 0xFF;
  }

  // ===== CLASS =====
  /**
   * Get character class (1 byte)
   */
  get playerClass(): PlayerClass {
    if (this.isEmpty) return PlayerClass.Knight;
    return this.data[this.getOffset('CLASS')] as PlayerClass;
  }

  /**
   * Set character class (1 byte)
   */
  set playerClass(value: PlayerClass) {
    this.data[this.getOffset('CLASS')] = value & 0xFF;
  }

  /**
   * Get character class name
   */
  get className(): string {
    return CLASS_NAMES[this.playerClass] || 'Unknown';
  }

  // ===== HELPER METHODS =====
  /**
   * Calculate level based on stats and class starting stats
   * Level = Current Total Stats - Total Stats at Zero Level
   * Same algorithm as DSR
   */
  calculateLevel(): number {
    const playerClass = this.playerClass;
    const startingStats = CLASS_STARTING_STATS[playerClass];

    if (!startingStats) {
      console.warn('Unknown class, cannot calculate level');
      return this.level;
    }

    // Calculate current total stats
    let currentTotalStats = 0;
    currentTotalStats += this.getStat('VIG');
    currentTotalStats += this.getStat('ATN');
    currentTotalStats += this.getStat('END');
    currentTotalStats += this.getStat('VIT');
    currentTotalStats += this.getStat('STR');
    currentTotalStats += this.getStat('DEX');
    currentTotalStats += this.getStat('INT');
    currentTotalStats += this.getStat('FTH');
    currentTotalStats += this.getStat('LCK');

    // Level = Current Total Stats - Total Stats at Zero Level
    return currentTotalStats - startingStats.totalStatsAtZero;
  }

  /**
   * Update all derived stats (HP, FP, Stamina, Level) based on current stats
   */
  updateDerivedStats(): void {
    const hp = VIGOR_TO_HP[this.getStat('VIG')];
    if (typeof hp === 'number') this.hp = hp;

    const fp = ATTUNEMENT_TO_FP[this.getStat('ATN')];
    if (typeof fp === 'number') this.fp = fp;

    const stamina = ENDURANCE_TO_STAMINA[this.getStat('END')];
    if (typeof stamina === 'number') this.stamina = stamina;

    this.level = this.calculateLevel();
  }
}
