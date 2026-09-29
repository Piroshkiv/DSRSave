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
  BONFIRE_PATTERN,
  BONFIRE_COARSE_FROM_INV,
  BONFIRE_ANCHOR_TO_BLOCK,
  BONFIRE_BLOCK_TO_NG_CYCLE,
  BONFIRE_UNLOCK_ALL,
  GESTURE_COUNT,
  GESTURE_RECORD_COUNT,
  GESTURE_RECORD_SIZE,
  GESTURE_COARSE_FROM_BONFIRE,
  GESTURE_SEARCH_RADIUS,
  FACE_BLOCK_SIZE,
  FACE_COARSE_FROM_BONFIRE,
  FACE_SEARCH_RADIUS,
  FACE_ID_COUNT,
  FACE_COLORS_OFFSET,
  FACE_COLOR_COUNT,
  APPEARANCE_PRESET_MAGIC,
  APPEARANCE_PRESET_VERSION,
  APPEARANCE_PRESET_HEADER_SIZE,
  APPEARANCE_PRESET_SIZE,
  FACE_BUILD_OFFSET,
  FACE_AGE_NAMES,
  FACE_PUPIL_ID_OFFSETS,
  FACE_PUPIL_COLOR_OFFSETS,
} from './constants';
import { findSteamIdOffset } from './offsetPatterns';

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

  // ===== STEAM ID =====

  /**
   * SteamID64 stored in this slot, or null when the slot has none (empty slot,
   * or a save whose layout we can't recognise). Located by findSteamIdOffset —
   * pointer at 0x58 first, STEAMID_PATTERN as confirmation/fallback.
   */
  getSteamId(): bigint | null {
    const offset = findSteamIdOffset(this.data);
    if (offset === null) return null;
    return new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength)
      .getBigUint64(offset, true);
  }

  /**
   * Rebind this slot to another Steam account. Returns false when the slot has
   * no ID field to write (nothing is changed in that case).
   *
   * Only the low 4 bytes actually differ between accounts, but all 8 are
   * written so a save from a hypothetical non-Steam namespace can't keep a
   * stale prefix.
   */
  setSteamId(steamId: bigint): boolean {
    const offset = findSteamIdOffset(this.data);
    if (offset === null) return false;
    new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength)
      .setBigUint64(offset, BigInt.asUintN(64, steamId), true);
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
   * Offset of the NG+ cycle (u32 LE), or -1 when the bonfire block can't be located.
   * Recomputed per call, like every other bonfire-anchored offset.
   */
  private findNGCycleOffset(): number {
    const rec0 = this.findBonfireBlock();
    if (rec0 === -1) return -1;
    const offset = rec0 + BONFIRE_BLOCK_TO_NG_CYCLE;
    return (offset >= 0 && offset + 4 <= this.data.length) ? offset : -1;
  }

  /**
   * Get NG+ Cycle (u32 LE): 0 = NG, 1 = NG+1, ... Anchored to the bonfire /
   * event-flag block — see BONFIRE_BLOCK_TO_NG_CYCLE.
   */
  get ngCycle(): number {
    const offset = this.findNGCycleOffset();
    if (offset === -1) return 0;
    return (
      this.data[offset] |
      (this.data[offset + 1] << 8) |
      (this.data[offset + 2] << 16) |
      (this.data[offset + 3] << 24)
    ) >>> 0;
  }

  /**
   * Set NG+ Cycle (u32 LE). No-op when the bonfire block can't be located.
   */
  set ngCycle(value: number) {
    const offset = this.findNGCycleOffset();
    if (offset === -1) return;
    value = Math.max(0, Math.min(MAX_VALUES.NG_CYCLE, value));
    this.data[offset] = value & 0xFF;
    this.data[offset + 1] = (value >>> 8) & 0xFF;
    this.data[offset + 2] = (value >>> 16) & 0xFF;
    this.data[offset + 3] = (value >>> 24) & 0xFF;
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

  // ===== BONFIRES / event-flag block =====

  /**
   * Locate the inventory start via the GA-table scan (same logic as
   * offsetPatterns.findInventoryStart). Used as the coarse anchor for the bonfire block.
   */
  private findInventoryStartOffset(): number {
    const GA_TABLE_OFFSET = 0x70;
    const GA_ENTRY_SMALL = 8;
    const GA_ENTRY_LARGE = 60;
    const GA_MAX_ENTRIES = 6144;

    let offset = GA_TABLE_OFFSET;
    let count = 0;
    while (count < GA_MAX_ENTRIES) {
      if (offset + GA_ENTRY_SMALL > this.data.length) break;
      const b3 = this.data[offset + 3];
      offset += (b3 === 0x80 || b3 === 0x90 || b3 === 0xA0 || b3 === 0xB0)
        ? GA_ENTRY_LARGE
        : GA_ENTRY_SMALL;
      count++;
    }
    return offset + 0x13F + 0x1DD;
  }

  /**
   * Find the start of the bonfire / event-flag block (rec0).
   * DS1-style windowed anchor search (see docs/ds3-bonfire-anchor.md):
   * coarse estimate from the inventory start, then the LAST BONFIRE_PATTERN before the
   * block, offset by BONFIRE_ANCHOR_TO_BLOCK. Recomputed each call, so it survives the
   * inventory shifts that GA-table edits cause.
   * @returns block start offset, or -1 if not found.
   */
  findBonfireBlock(): number {
    if (this.isEmpty) return -1;

    const est = this.findInventoryStartOffset() + BONFIRE_COARSE_FROM_INV;
    const lo = Math.max(0, est - 0x1500);
    const hi = Math.min(this.data.length, est + 0x200);

    const pat = BONFIRE_PATTERN;
    const plen = pat.length;
    let anchor = -1;
    for (let i = lo; i + plen <= hi; i++) {
      let match = true;
      for (let j = 0; j < plen; j++) {
        if (this.data[i + j] !== pat[j]) { match = false; break; }
      }
      if (match) anchor = i; // keep the last match in the window
    }
    if (anchor === -1) return -1;

    const rec0 = anchor + BONFIRE_ANCHOR_TO_BLOCK;
    if (rec0 < 0 || rec0 >= this.data.length) return -1;
    return rec0;
  }

  /**
   * True when every bit of the "unlock all" bitmask is already set.
   */
  get allBonfiresUnlocked(): boolean {
    const rec0 = this.findBonfireBlock();
    if (rec0 === -1) return false;
    for (const [off, val] of BONFIRE_UNLOCK_ALL) {
      const p = rec0 + off;
      if (p >= this.data.length) return false;
      if ((this.data[p] & val) !== val) return false;
    }
    return true;
  }

  /**
   * Unlock all bonfires by OR-ing the verified bitmask into the block. Never clears a flag.
   */
  unlockAllBonfires(): void {
    if (this.isEmpty) throw new Error('Character slot is empty');
    const rec0 = this.findBonfireBlock();
    if (rec0 === -1) {
      throw new Error('Could not locate the bonfire block in this save. It may not be a valid Dark Souls 3 save, or the slot is empty.');
    }
    const maxOff = BONFIRE_UNLOCK_ALL.reduce((m, [o]) => Math.max(m, o), 0);
    if (rec0 + maxOff >= this.data.length) {
      throw new Error('Bonfire block is out of range — the save may be corrupted.');
    }
    for (const [off, val] of BONFIRE_UNLOCK_ALL) {
      this.data[rec0 + off] |= val;
    }
  }

  // ===== GESTURES =====

  /** True when `offset` holds all GESTURE_RECORD_COUNT well-formed gesture records. */
  private isGestureTableAt(offset: number): boolean {
    if (offset < 0 || offset + GESTURE_RECORD_COUNT * GESTURE_RECORD_SIZE > this.data.length) {
      return false;
    }
    for (let i = 0; i < GESTURE_RECORD_COUNT; i++) {
      const o = offset + i * GESTURE_RECORD_SIZE;
      const value = this.data[o] | (this.data[o + 1] << 8);
      const index = this.data[o + 2] | (this.data[o + 3] << 8);
      // value carries the unlock flag in bit 0, so compare it shifted out
      if (index !== i || (value >> 1) !== i + 1) return false;
    }
    return true;
  }

  /** First offset at or after `from` (below `to`) that holds the table, else -1. */
  private scanForGestureTable(from: number, to: number): number {
    const limit = Math.min(to, this.data.length - GESTURE_RECORD_COUNT * GESTURE_RECORD_SIZE);
    for (let i = Math.max(0, from); i <= limit; i += GESTURE_RECORD_SIZE) {
      // Cheap reject: record 0 is always `02 00 00 00` or `03 00 00 00`.
      if ((this.data[i] | 1) !== 0x03 || this.data[i + 1] !== 0x00 ||
          this.data[i + 2] !== 0x00 || this.data[i + 3] !== 0x00) {
        continue;
      }
      if (this.isGestureTableAt(i)) return i;
    }
    return -1;
  }

  /**
   * Find the gesture table, or -1 when this slot has none.
   *
   * The table has no fixed offset — it moves between characters and even
   * between two saves of the same character — so it is located the way the
   * bonfire block is: a coarse estimate from the bonfire block, a windowed
   * search around it, and a full scan as the fallback. See the GESTURES block
   * in constants.ts for the measurements behind GESTURE_COARSE_FROM_BONFIRE.
   *
   * The first match wins. Copies of the table also appear in the slot's runtime
   * scratch tail, but those sit far later (0x819F8 / 0x9B528 in a 0xC0010-byte
   * slot) and float between saves, so taking the lowest match keeps the real
   * one — verified on all 43 captures of the sweep.
   */
  findGestureTable(): number {
    if (this.isEmpty) return -1;

    const rec0 = this.findBonfireBlock();
    if (rec0 !== -1) {
      const est = rec0 + GESTURE_COARSE_FROM_BONFIRE;
      const hit = this.scanForGestureTable(est - GESTURE_SEARCH_RADIUS,
                                           est + GESTURE_SEARCH_RADIUS);
      if (hit !== -1) return hit;
    }
    return this.scanForGestureTable(0, this.data.length);
  }

  /** Unlock state of the real, usable gestures, in game order. */
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
      throw new Error('Could not locate the gesture table in this save. It may not be a valid Dark Souls 3 save, or the slot is empty.');
    }
    const offset = base + index * GESTURE_RECORD_SIZE;
    this.data[offset] = unlocked
      ? this.data[offset] | 1
      : this.data[offset] & ~1;
  }

  /**
   * Unlock the usable gestures (records 0-33) and clear the cut ones (34-40).
   *
   * The trailing records — "Lord of Cinder" and the FDP_MenuText placeholders —
   * have no gesture behind them and show up broken in the in-game menu. They are
   * cleared rather than skipped, so this also repairs a save that already had
   * them unlocked. See the GESTURES block in constants.ts.
   */
  unlockAllGestures(): void {
    const base = this.findGestureTable();
    if (base === -1) {
      throw new Error('Could not locate the gesture table in this save. It may not be a valid Dark Souls 3 save, or the slot is empty.');
    }
    for (let i = 0; i < GESTURE_RECORD_COUNT; i++) {
      const offset = base + i * GESTURE_RECORD_SIZE;
      if (i < GESTURE_COUNT) {
        this.data[offset] |= 1;
      } else {
        this.data[offset] &= ~1;
      }
    }
  }

  get allGesturesUnlocked(): boolean {
    const base = this.findGestureTable();
    if (base === -1) return false;
    return this.getGestureFlags().every(Boolean);
  }

  // ===== APPEARANCE =====

  /** Gender: 0 = female, 1 = male. */
  get gender(): number {
    if (this.isEmpty) return 0;
    return this.data[this.getOffset('GENDER')] & 1;
  }

  set gender(value: number) {
    this.data[this.getOffset('GENDER')] = value ? 1 : 0;
  }

  /** Voice: 0 = young, 1 = mature, 2 = aged. */
  get voice(): number {
    if (this.isEmpty) return 0;
    return this.data[this.getOffset('VOICE')];
  }

  set voice(value: number) {
    this.data[this.getOffset('VOICE')] = Math.max(0, Math.min(2, value)) & 0xFF;
  }

  /**
   * Age, muscular build and chest hair share face block byte 0 as decimal
   * digits: 100 * muscular + 10 * chestHair + age. See FACE_BUILD_OFFSET.
   */
  private getBuildDigit(divisor: number): number {
    return Math.floor(this.getFaceId(FACE_BUILD_OFFSET) / divisor) % 10;
  }

  private setBuild(age: number, muscular: boolean, chestHair: boolean): void {
    const clamped = Math.max(0, Math.min(FACE_AGE_NAMES.length - 1, age));
    this.setFaceId(FACE_BUILD_OFFSET, (muscular ? 100 : 0) + (chestHair ? 10 : 0) + clamped);
  }

  /** Face age: 0 young, 1 mature, 2 aged. */
  get faceAge(): number {
    return Math.min(FACE_AGE_NAMES.length - 1, this.getBuildDigit(1));
  }

  set faceAge(value: number) {
    this.setBuild(value, this.muscular, this.chestHair);
  }

  get muscular(): boolean {
    return this.getBuildDigit(100) === 1;
  }

  set muscular(value: boolean) {
    this.setBuild(this.faceAge, value, this.chestHair);
  }

  get chestHair(): boolean {
    return this.getBuildDigit(10) === 1;
  }

  set chestHair(value: boolean) {
    this.setBuild(this.faceAge, this.muscular, value);
  }

  /**
   * Both pupils as one value, the way the creator's "Pupils" control works, or
   * null when the two eyes currently differ. See FACE_PUPIL_ID_OFFSETS.
   */
  getPupilId(): number | null {
    const [left, right] = FACE_PUPIL_ID_OFFSETS.map((o) => this.getFaceId(o));
    return left === right ? left : null;
  }

  setPupilId(value: number): void {
    for (const offset of FACE_PUPIL_ID_OFFSETS) this.setFaceId(offset, value);
  }

  /** Both pupil colors as one, or null when the eyes differ. */
  getPupilColor(): [number, number, number] | null {
    const [left, right] = FACE_PUPIL_COLOR_OFFSETS.map((o) => this.getFaceColor(o));
    return left.every((v, i) => v === right[i]) ? left : null;
  }

  setPupilColor(r: number, g: number, b: number): void {
    for (const offset of FACE_PUPIL_COLOR_OFFSETS) this.setFaceColor(offset, r, g, b);
  }

  /** True when `offset` holds a well-formed face block — see FACE_ID_COUNT. */
  private isFaceBlockAt(offset: number): boolean {
    if (offset < 0 || offset + FACE_BLOCK_SIZE > this.data.length) return false;
    for (let i = 0; i < FACE_ID_COUNT; i++) {
      const o = offset + i * 4;
      // model IDs are small, so the upper three bytes of each u32 are zero
      if (this.data[o + 1] !== 0 || this.data[o + 2] !== 0 || this.data[o + 3] !== 0) {
        return false;
      }
    }
    for (let i = 0; i < FACE_COLOR_COUNT; i++) {
      if (this.data[offset + FACE_COLORS_OFFSET + i * 4 + 3] !== 0xFF) return false;
    }
    return true;
  }

  /** Every offset in [from, to) that holds a face block. */
  private scanForFaceBlocks(from: number, to: number): number[] {
    const hits: number[] = [];
    const limit = Math.min(to, this.data.length - FACE_BLOCK_SIZE);
    for (let i = Math.max(0, from); i <= limit; i++) {
      // cheap reject: the first color's alpha byte
      if (this.data[i + FACE_COLORS_OFFSET + 3] !== 0xFF) continue;
      if (this.isFaceBlockAt(i)) hits.push(i);
    }
    return hits;
  }

  /**
   * Find the appearance block, or -1 when this slot has none.
   *
   * Same shape as findGestureTable: the block has no fixed offset, so it is a
   * coarse estimate off the bonfire block, a windowed signature search around
   * it, and a full scan as the fallback. When more than one candidate lands in
   * the window the closest to the estimate wins.
   *
   * A full scan alone would not do: the signature also matches clusters spaced
   * 0x1B8 apart deeper in the slot (up to 40 in a levelled character), which
   * look like a cache of other players' faces. On 99 characters across 15 save
   * files the window held exactly one candidate every time and the fallback
   * never ran.
   */
  findFaceBlock(): number {
    if (this.isEmpty) return -1;

    const rec0 = this.findBonfireBlock();
    let est = -1;
    if (rec0 !== -1) {
      est = rec0 + FACE_COARSE_FROM_BONFIRE;
      const hits = this.scanForFaceBlocks(est - FACE_SEARCH_RADIUS, est + FACE_SEARCH_RADIUS);
      if (hits.length === 1) return hits[0];
      if (hits.length > 1) {
        return hits.reduce((a, b) => (Math.abs(a - est) <= Math.abs(b - est) ? a : b));
      }
    }

    const all = this.scanForFaceBlocks(0, this.data.length);
    if (all.length === 0) return -1;
    if (est === -1) return all[0];
    return all.reduce((a, b) => (Math.abs(a - est) <= Math.abs(b - est) ? a : b));
  }

  /** Copy of the face block, or an empty array when it can't be located. */
  getFaceBlock(): Uint8Array {
    const base = this.findFaceBlock();
    if (base === -1) return new Uint8Array(0);
    return this.data.slice(base, base + FACE_BLOCK_SIZE);
  }

  /** Overwrite the whole face block. */
  setFaceBlock(block: Uint8Array): void {
    if (block.length !== FACE_BLOCK_SIZE) {
      throw new Error(`Face block must be ${FACE_BLOCK_SIZE} bytes, got ${block.length}`);
    }
    const base = this.findFaceBlock();
    if (base === -1) {
      throw new Error('Could not locate the appearance block in this save. It may not be a valid Dark Souls 3 save, or the slot is empty.');
    }
    this.data.set(block, base);
  }

  /** One 0..255 slider, by its offset inside the face block. */
  getFaceByte(offset: number): number {
    const base = this.findFaceBlock();
    if (base === -1 || offset < 0 || offset >= FACE_BLOCK_SIZE) return 0;
    return this.data[base + offset];
  }

  setFaceByte(offset: number, value: number): void {
    const base = this.findFaceBlock();
    if (base === -1 || offset < 0 || offset >= FACE_BLOCK_SIZE) return;
    this.data[base + offset] = Math.max(0, Math.min(255, value)) & 0xFF;
  }

  /**
   * One model ID (u32 LE) by its offset inside the face block.
   *
   * Writing a value the game has no model for makes it crash on load, so the UI
   * must offer only IDs seen in real saves — see APPEARANCE_IDS in constants.ts.
   */
  getFaceId(offset: number): number {
    const base = this.findFaceBlock();
    if (base === -1) return 0;
    const o = base + offset;
    return (
      this.data[o] |
      (this.data[o + 1] << 8) |
      (this.data[o + 2] << 16) |
      (this.data[o + 3] << 24)
    ) >>> 0;
  }

  setFaceId(offset: number, value: number): void {
    const base = this.findFaceBlock();
    if (base === -1) return;
    const o = base + offset;
    const v = value >>> 0;
    this.data[o] = v & 0xFF;
    this.data[o + 1] = (v >>> 8) & 0xFF;
    this.data[o + 2] = (v >>> 16) & 0xFF;
    this.data[o + 3] = (v >>> 24) & 0xFF;
  }

  /** RGB of one color; the alpha byte that follows it is left alone. */
  getFaceColor(offset: number): [number, number, number] {
    const base = this.findFaceBlock();
    if (base === -1) return [0, 0, 0];
    return [this.data[base + offset], this.data[base + offset + 1], this.data[base + offset + 2]];
  }

  setFaceColor(offset: number, r: number, g: number, b: number): void {
    const base = this.findFaceBlock();
    if (base === -1) return;
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v))) & 0xFF;
    this.data[base + offset] = clamp(r);
    this.data[base + offset + 1] = clamp(g);
    this.data[base + offset + 2] = clamp(b);
  }

  /** Pack the current look into a .ds3chr preset. */
  exportAppearancePreset(): Uint8Array {
    const face = this.getFaceBlock();
    if (face.length === 0) {
      throw new Error('Could not locate the appearance block in this save.');
    }
    const out = new Uint8Array(APPEARANCE_PRESET_SIZE);
    for (let i = 0; i < 4; i++) out[i] = APPEARANCE_PRESET_MAGIC.charCodeAt(i);
    out[4] = APPEARANCE_PRESET_VERSION;
    out[5] = this.gender;
    out[6] = this.voice;
    out[7] = 0;
    out.set(face, APPEARANCE_PRESET_HEADER_SIZE);
    return out;
  }

  /** Apply a .ds3chr preset. Throws with a readable reason on a bad file. */
  importAppearancePreset(bytes: Uint8Array): void {
    if (bytes.length < APPEARANCE_PRESET_HEADER_SIZE) {
      throw new Error('File is too short to be an appearance preset.');
    }
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== APPEARANCE_PRESET_MAGIC) {
      throw new Error(bytes.length === 130
        ? 'This looks like a DS1 .dsrchr preset, which does not fit DS3.'
        : 'Not a DS3 appearance preset.');
    }
    if (bytes[4] !== APPEARANCE_PRESET_VERSION) {
      throw new Error(`Preset version ${bytes[4]} is not supported (expected ${APPEARANCE_PRESET_VERSION}).`);
    }
    if (bytes.length < APPEARANCE_PRESET_SIZE) {
      throw new Error('Preset file is truncated.');
    }
    this.setFaceBlock(bytes.slice(APPEARANCE_PRESET_HEADER_SIZE, APPEARANCE_PRESET_SIZE));
    this.gender = bytes[5];
    this.voice = bytes[6];
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
