import { DS3Character } from './Character';
import { decryptAesCbc, encryptAesCbc, calculateMD5 } from './crypto';
import {
  BND4_HEADER_SIZE,
  ENTRY_HEADER_SIZE,
  BND4_SIGNATURE,
  CLASS_STARTING_STATS,
  SYSTEM_ENTRY_STEAMID_OFFSET,
  SLOT_ACTIVE_FLAGS_OFFSET,
  ONLINE_FLAG_OFFSET,
  SLOT_SUMMARY_BASE,
  SLOT_SUMMARY_SIZE,
  SLOT_COUNT,
  STAT_ORDER
} from './constants';
import type { SteamIdSummary } from './steamId';
import { getFileSystemAdapter, FileHandle } from '../../ds1/lib/adapters';
import { toArrayBuffer } from '../../../shared/binary';

/**
 * DS3 Save File Editor
 * Handles BND4 format with AES-CBC encryption
 * Based on DS3SaveEditor.cs ReadSave and WriteSave methods
 */
/**
 * Index of the BND4 entry holding save-wide (non-character) state: per-slot
 * active flags, and other global settings such as the online/offline flag.
 * It is decrypted on load and kept in memory so any feature can read or patch
 * it without a second decrypt pass — see getSystemEntryData()/writeSystemEntryBytes().
 */
const SYSTEM_ENTRY_INDEX = 10;

export class DS3SaveFileEditor {
  private saveData: Uint8Array;
  private characters: DS3Character[] = [];
  private fileHandle: FileHandle | null = null;
  /** Decrypted system entry, kept live so it can be read and patched at any time. */
  private systemEntryData: Uint8Array | null = null;
  /** Set when the system entry was modified and must be re-encrypted on export. */
  private systemEntryDirty = false;

  private constructor(saveData: Uint8Array, fileHandle?: FileHandle) {
    this.saveData = saveData;
    this.fileHandle = fileHandle || null;
  }

  /**
   * Load save file from File object (deprecated - use fromFileData)
   */
  static async fromFile(file: File): Promise<DS3SaveFileEditor> {
    return DS3SaveFileEditor.fromFileData(file, null);
  }

  /**
   * Load save file from File object with FileHandle support
   */
  static async fromFileData(file: File, fileHandle: FileHandle | null): Promise<DS3SaveFileEditor> {
    const arrayBuffer = await file.arrayBuffer();
    const saveData = new Uint8Array(arrayBuffer);

    // Validate BND4 signature
    if (saveData.length < BND4_HEADER_SIZE) {
      throw new Error('File too small to be a valid DS3 save');
    }

    for (let i = 0; i < BND4_SIGNATURE.length; i++) {
      if (saveData[i] !== BND4_SIGNATURE[i]) {
        throw new Error('Not a valid BND4 file (invalid signature)');
      }
    }

    const editor = new DS3SaveFileEditor(saveData, fileHandle || undefined);
    await editor.loadCharacters();
    await editor.loadSystemEntry();
    return editor;
  }

  /**
   * Decrypt the system entry once at load time and keep it in memory.
   * Never throws: if the entry is missing or fails to decrypt the editor stays
   * usable and every system-entry feature reports itself as unavailable.
   */
  private async loadSystemEntry(): Promise<void> {
    try {
      if (this.getEntryCount() <= SYSTEM_ENTRY_INDEX) return;

      const entry = await this.loadCharacter(SYSTEM_ENTRY_INDEX); // same decrypt logic
      this.systemEntryData = entry.getRawData();
    } catch (err) {
      console.warn('[DS3] Could not decrypt the system entry:', err);
    }
  }

  /**
   * True when the system entry is decrypted and available for reading/patching.
   */
  hasSystemEntry(): boolean {
    return this.systemEntryData !== null;
  }

  /**
   * Live reference to the decrypted system entry, or null when unavailable.
   * Mutating it directly requires a markSystemEntryDirty() call so the change
   * is re-encrypted on export; prefer writeSystemEntryBytes(), which does both.
   */
  getSystemEntryData(): Uint8Array | null {
    return this.systemEntryData;
  }

  /** Flag the system entry for re-encryption on the next export. */
  markSystemEntryDirty(): void {
    this.systemEntryDirty = true;
  }

  /**
   * Copy `length` bytes out of the system entry at `offset`.
   */
  readSystemEntryBytes(offset: number, length: number): Uint8Array {
    const data = this.requireSystemEntry(offset, length);
    return data.slice(offset, offset + length);
  }

  /**
   * Patch bytes into the system entry. Persisted by exportSaveFile().
   */
  writeSystemEntryBytes(offset: number, bytes: ArrayLike<number>): void {
    const data = this.requireSystemEntry(offset, bytes.length);
    data.set(bytes, offset);
    this.systemEntryDirty = true;
  }

  private requireSystemEntry(offset: number, length: number): Uint8Array {
    const data = this.systemEntryData;
    if (!data) {
      throw new Error('System entry is unavailable (it could not be decrypted)');
    }
    if (offset < 0 || offset + length > data.length) {
      throw new Error(
        `System entry range 0x${offset.toString(16)}+${length} is outside the entry ` +
        `(size 0x${data.length.toString(16)})`
      );
    }
    return data;
  }

  /**
   * Returns true if the given character slot contains an active (non-deleted) character.
   * Falls back to true (show every non-empty slot) when the flags cannot be read.
   */
  isSlotActive(slotIndex: number): boolean {
    const data = this.systemEntryData;
    if (!data) return true;

    const off = SLOT_ACTIVE_FLAGS_OFFSET + slotIndex;
    return off < data.length ? data[off] === 0x01 : false;
  }

  /**
   * True when slot flags come from the real save and may be edited.
   */
  canEditSlotFlags(): boolean {
    return this.hasSystemEntry();
  }

  /**
   * Mark a character slot as active (restore) or deleted.
   * Only flips the flag byte; the slot's own data is left untouched, so a
   * restored character comes back exactly as the game last wrote it.
   * The change is persisted by exportSaveFile().
   */
  setSlotActive(slotIndex: number, active: boolean): void {
    if (slotIndex < 0 || slotIndex >= SLOT_COUNT) {
      throw new Error(`Slot index ${slotIndex} out of range (0–9)`);
    }
    this.writeSystemEntryBytes(SLOT_ACTIVE_FLAGS_OFFSET + slotIndex, [active ? 0x01 : 0x00]);
  }

  // ===== ONLINE / OFFLINE =====

  /**
   * The save-wide network setting, or null when the system entry is unavailable.
   * true = Play Online, false = Play Offline.
   */
  isOnline(): boolean | null {
    const data = this.systemEntryData;
    if (!data || ONLINE_FLAG_OFFSET >= data.length) return null;
    return data[ONLINE_FLAG_OFFSET] === 0x01;
  }

  /**
   * Switch the save between online and offline play. Persisted by exportSaveFile().
   */
  setOnline(online: boolean): void {
    this.writeSystemEntryBytes(ONLINE_FLAG_OFFSET, [online ? 0x01 : 0x00]);
  }

  // ===== LOAD-MENU SUMMARY =====

  /**
   * One slot's load-menu summary block (name, soul level, appearance), or null
   * when the system entry is unavailable.
   *
   * This is what the load menu shows before a slot is opened. Copying a slot
   * without it leaves the menu describing whoever used to live there until the
   * character is loaded once and the game rewrites the block.
   */
  readSlotSummary(slotIndex: number): Uint8Array | null {
    if (slotIndex < 0 || slotIndex >= SLOT_COUNT) {
      throw new Error(`Slot index ${slotIndex} out of range (0–9)`);
    }
    if (!this.systemEntryData) return null;
    return this.readSystemEntryBytes(SLOT_SUMMARY_BASE + SLOT_SUMMARY_SIZE * slotIndex, SLOT_SUMMARY_SIZE);
  }

  /** Replace one slot's load-menu summary. Persisted by exportSaveFile(). */
  writeSlotSummary(slotIndex: number, block: Uint8Array): void {
    if (slotIndex < 0 || slotIndex >= SLOT_COUNT) {
      throw new Error(`Slot index ${slotIndex} out of range (0–9)`);
    }
    if (block.length !== SLOT_SUMMARY_SIZE) {
      throw new Error(
        `Summary block must be ${SLOT_SUMMARY_SIZE} bytes, got ${block.length}`
      );
    }
    this.writeSystemEntryBytes(SLOT_SUMMARY_BASE + SLOT_SUMMARY_SIZE * slotIndex, block);
  }

  /**
   * Swap in another character's decrypted bytes for a slot.
   *
   * The BND4 entry has a fixed size, so the replacement must be exactly as long
   * as what is there; anything else would only fail later, inside the export.
   */
  replaceCharacter(slotIndex: number, plainData: Uint8Array): DS3Character {
    if (slotIndex < 0 || slotIndex >= SLOT_COUNT) {
      throw new Error(`Slot index ${slotIndex} out of range (0–9)`);
    }

    const expected = this.getSlotDataSize();
    if (expected !== null && plainData.length !== expected) {
      throw new Error(
        `Slot data must be ${expected} bytes for this save, got ${plainData.length}`
      );
    }

    const replacement = new DS3Character(new Uint8Array(plainData), slotIndex);
    const index = this.characters.findIndex(c => c.slotIndex === slotIndex);
    if (index === -1) {
      throw new Error(`Slot ${slotIndex} is not loaded`);
    }
    this.characters[index] = replacement;
    return replacement;
  }

  /**
   * Decrypted size of a character slot in this save, or null when no slot could
   * be decrypted. Every character entry has the same size, so any loaded slot
   * answers for all of them.
   */
  getSlotDataSize(): number | null {
    for (const character of this.characters) {
      const size = character.getRawData().length;
      if (size > 0) return size;
    }
    return null;
  }

  // ===== STEAM ID =====

  /**
   * SteamID64 the save is bound to, read from the system entry, or null when
   * that entry is unavailable.
   */
  getSteamId(): bigint | null {
    const data = this.systemEntryData;
    if (!data || data.length < SYSTEM_ENTRY_STEAMID_OFFSET + 8) return null;
    return new DataView(data.buffer, data.byteOffset, data.byteLength)
      .getBigUint64(SYSTEM_ENTRY_STEAMID_OFFSET, true);
  }

  /**
   * Every SteamID64 in the save, so the UI can tell "this save belongs to one
   * account" from "this save is a mix" — the usual state of a file assembled
   * from downloaded characters.
   *
   * Only populated slots are listed; empty ones carry no ID and would force a
   * pointless full-slot scan.
   */
  getSteamIdSummary(): SteamIdSummary {
    const system = this.getSteamId();
    const slots = this.characters
      .filter((character) => !character.isEmpty)
      .map((character) => ({
        slotIndex: character.slotIndex,
        steamId: character.getSteamId(),
      }));

    const distinct = new Set<bigint | null>(slots.map((s) => s.steamId));
    if (system !== null) distinct.add(system);

    return { system, slots, mismatched: distinct.size > 1 };
  }

  /**
   * Rebind the whole save to another Steam account: the system entry plus every
   * populated character slot, which is what the game checks. Returns how many
   * character slots were rewritten; the system entry is not counted.
   *
   * This is the one edit a downloaded save actually needs — without it the game
   * refuses characters that belong to someone else.
   */
  setSteamId(steamId: bigint): number {
    const id = BigInt.asUintN(64, steamId);

    if (this.systemEntryData && this.systemEntryData.length >= SYSTEM_ENTRY_STEAMID_OFFSET + 8) {
      const bytes = new Uint8Array(8);
      new DataView(bytes.buffer).setBigUint64(0, id, true);
      this.writeSystemEntryBytes(SYSTEM_ENTRY_STEAMID_OFFSET, bytes);
    }

    let patched = 0;
    for (const character of this.characters) {
      if (character.isEmpty) continue;
      if (character.setSteamId(id)) patched++;
    }
    return patched;
  }

  /**
   * Load all character slots from the save file
   * Limit to 10 characters (DS3 has 10 character slots)
   */
  private async loadCharacters(): Promise<void> {
    // Read entry count from offset 0x0C (4 bytes, little-endian)
    const entryCount = new DataView(this.saveData.buffer).getUint32(0x0C, true);

    // Limit to 10 character slots
    const maxCharacters = Math.min(entryCount, 10);

    for (let i = 0; i < maxCharacters; i++) {
      try {
        const character = await this.loadCharacter(i);
        this.characters.push(character);
      } catch (error) {
        console.error(`Failed to load character slot ${i}:`, error);
        // Create empty character slot on error
        this.characters.push(new DS3Character(new Uint8Array(0), i));
      }
    }
  }

  /**
   * Load a single character from slot index
   */
  private async loadCharacter(slotIndex: number): Promise<DS3Character> {
    // Calculate entry header offset
    const entryHeaderOffset = BND4_HEADER_SIZE + (slotIndex * ENTRY_HEADER_SIZE);
    const view = new DataView(this.saveData.buffer);

    // Read entry size and data offset from header
    const entrySize = Number(view.getBigUint64(entryHeaderOffset + 0x08, true));
    const entryDataOffset = view.getUint32(entryHeaderOffset + 0x10, true);

    // Read structure: [MD5 (16 bytes)] [IV (16 bytes)] [Encrypted Data]
    const storedChecksum = this.saveData.slice(
      entryDataOffset,
      entryDataOffset + 16
    );

    const iv = this.saveData.slice(
      entryDataOffset + 16,
      entryDataOffset + 32
    );

    const encryptedDataSize = entrySize - 32; // Subtract MD5 and IV
    const encryptedData = this.saveData.slice(
      entryDataOffset + 32,
      entryDataOffset + 32 + encryptedDataSize
    );

    // Verify MD5 checksum (calculated from IV + EncryptedData)
    const dataToHash = this.saveData.slice(
      entryDataOffset + 16,
      entryDataOffset + 16 + 16 + encryptedDataSize
    );
    const computedChecksum = await calculateMD5(dataToHash);

    // Compare checksums
    let isValid = true;
    for (let i = 0; i < 16; i++) {
      if (storedChecksum[i] !== computedChecksum[i]) {
        isValid = false;
        break;
      }
    }

    if (!isValid) {
      throw new Error(`Checksum mismatch for slot ${slotIndex}`);
    }

    // Decrypt character data
    const decryptedData = await decryptAesCbc(encryptedData, iv);

    return new DS3Character(decryptedData, slotIndex);
  }

  /**
   * Get all loaded characters
   */
  getCharacters(): DS3Character[] {
    return this.characters;
  }

  /**
   * Get character by slot index
   */
  getCharacter(slotIndex: number): DS3Character | undefined {
    return this.characters.find(char => char.slotIndex === slotIndex);
  }

  /**
   * Total number of BND4 entries (character slots + system entries).
   */
  getEntryCount(): number {
    return new DataView(this.saveData.buffer).getUint32(0x0C, true);
  }

  /**
   * Decrypt any BND4 entry by index and return it as a DS3Character.
   * Works for all entries including system entries 10, 11, etc.
   * getRawData() on the result gives the raw decrypted bytes.
   */
  async getRawEntry(entryIndex: number): Promise<DS3Character> {
    const count = this.getEntryCount();
    if (entryIndex < 0 || entryIndex >= count) {
      throw new Error(`Entry index ${entryIndex} out of range (0–${count - 1})`);
    }
    return this.loadCharacter(entryIndex);
  }

  /**
   * Calculate level from stats (same as DSR)
   */
  private calculateLevelForCharacter(character: DS3Character): number {
    const classData = CLASS_STARTING_STATS[character.playerClass];
    if (!classData) return character.level;

    // Calculate current total stats
    let currentTotalStats = 0;
    for (const statName of STAT_ORDER) {
      currentTotalStats += character.getStat(statName);
    }

    // Level = Current Total Stats - Total Stats at Zero Level
    return currentTotalStats - classData.totalStatsAtZero;
  }

  /**
   * Export modified save file as Uint8Array
   */
  async exportSaveFile(): Promise<Uint8Array> {
    // Recalculate level for all characters before export
    for (const character of this.characters) {
      if (!character.isEmpty) {
        const prevLevel = character.level;
        character.level = this.calculateLevelForCharacter(character);
        // Credit playtime/soul memory if the level changed outside the UI handlers
        character.applyLevelProgression(prevLevel);
      }
    }

    // Create copy of original save data
    const newSaveData = new Uint8Array(this.saveData);
    const view = new DataView(newSaveData.buffer);

    // Get entry count
    const entryCount = view.getUint32(0x0C, true);

    for (const character of this.characters) {
      // Skip if slot index is invalid
      if (character.slotIndex < 0 || character.slotIndex >= entryCount) {
        continue;
      }

      await this.writeEntry(newSaveData, view, character.slotIndex, character.getRawData());
    }

    // Persist system-entry edits (slot active/deleted flags, and anything else patched there)
    if (this.systemEntryDirty && this.systemEntryData && entryCount > SYSTEM_ENTRY_INDEX) {
      await this.writeEntry(newSaveData, view, SYSTEM_ENTRY_INDEX, this.systemEntryData);
    }

    return newSaveData;
  }

  /**
   * Re-encrypt a BND4 entry in place using its existing IV and refresh its MD5.
   * Entry layout: [MD5 (16)] [IV (16)] [Encrypted Data]
   */
  private async writeEntry(
    saveData: Uint8Array,
    view: DataView,
    entryIndex: number,
    plainData: Uint8Array
  ): Promise<void> {
    const entryHeaderOffset = BND4_HEADER_SIZE + (entryIndex * ENTRY_HEADER_SIZE);
    const entrySize = Number(view.getBigUint64(entryHeaderOffset + 0x08, true));
    const entryDataOffset = view.getUint32(entryHeaderOffset + 0x10, true);

    // Reuse the existing IV
    const iv = saveData.slice(entryDataOffset + 16, entryDataOffset + 32);

    const encryptedData = await encryptAesCbc(plainData, iv);

    const expectedEncryptedSize = entrySize - 32;
    if (encryptedData.length !== expectedEncryptedSize) {
      throw new Error(
        `Data size mismatch for entry ${entryIndex}. ` +
        `Expected ${expectedEncryptedSize}, got ${encryptedData.length}`
      );
    }

    saveData.set(encryptedData, entryDataOffset + 32);

    // MD5 is calculated over IV + EncryptedData
    const dataToHash = new Uint8Array(16 + encryptedData.length);
    dataToHash.set(iv, 0);
    dataToHash.set(encryptedData, 16);

    saveData.set(await calculateMD5(dataToHash), entryDataOffset);
  }

  /**
   * Save to original file using FileHandle
   */
  async saveToOriginalFile(): Promise<void> {
    if (!this.fileHandle) {
      throw new Error('No file handle available. Use downloadSaveFile instead.');
    }

    const data = await this.exportSaveFile();
    const adapter = getFileSystemAdapter();
    await adapter.saveToFile(this.fileHandle, data);
  }

  /**
   * Save to new file using File System Access API or fallback to download
   */
  async saveToNewFile(suggestedName?: string): Promise<void> {
    const data = await this.exportSaveFile();
    const adapter = getFileSystemAdapter();
    await adapter.saveAsNewFile(data, { suggestedName: suggestedName || 'DS30000.sl2' });
  }

  /**
   * Download save file (fallback method)
   */
  async downloadSaveFile(filename: string): Promise<void> {
    const data = await this.exportSaveFile();
    const blob = new Blob([toArrayBuffer(data)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  /**
   * Check if editor has a file handle
   */
  hasFileHandle(): boolean {
    return this.fileHandle !== null;
  }

  /**
   * Get file handle
   */
  getFileHandle(): FileHandle | null {
    return this.fileHandle;
  }
}
