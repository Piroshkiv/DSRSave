import { DS3Character } from './Character';
import { decryptAesCbc, encryptAesCbc, calculateMD5 } from './crypto';
import {
  BND4_HEADER_SIZE,
  ENTRY_HEADER_SIZE,
  BND4_SIGNATURE,
  CLASS_STARTING_STATS
} from './constants';
import { getFileSystemAdapter, FileHandle } from '../../ds1/lib/adapters';
import { toArrayBuffer } from './bufferUtils';

// Stats order for level calculation
const STAT_ORDER = ['VIG', 'ATN', 'END', 'VIT', 'STR', 'DEX', 'INT', 'FTH', 'LCK'];

/**
 * DS3 Save File Editor
 * Handles BND4 format with AES-CBC encryption
 * Based on DS3SaveEditor.cs ReadSave and WriteSave methods
 */
// entry10 offset of the 10-byte per-slot active flag array.
// 0x01 = slot has an active (non-deleted) character, 0x00 = empty or deleted.
const SLOT_ACTIVE_FLAGS_OFFSET = 0x1098;

export class DS3SaveFileEditor {
  private saveData: Uint8Array;
  private characters: DS3Character[] = [];
  private fileHandle: FileHandle | null = null;
  /** Per-slot active flags read from entry10. Index = slot number. */
  private slotActiveFlags: boolean[] = [];

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
    await editor.loadSlotActiveFlags();
    return editor;
  }

  /**
   * Decrypt entry10 and read the 10-byte per-slot active flag array at offset 0x1098.
   * Falls back to all-true (show all non-empty slots) if entry10 is unavailable.
   */
  private async loadSlotActiveFlags(): Promise<void> {
    try {
      const entryCount = new DataView(this.saveData.buffer).getUint32(0x0C, true);
      if (entryCount < 11) return; // no entry10

      const entry10 = await this.loadCharacter(10); // same decrypt logic
      const data = entry10.getRawData();

      this.slotActiveFlags = [];
      for (let i = 0; i < 10; i++) {
        const off = SLOT_ACTIVE_FLAGS_OFFSET + i;
        this.slotActiveFlags[i] = off < data.length ? data[off] === 0x01 : false;
      }
      console.log('[DS3] Slot active flags:', this.slotActiveFlags);
    } catch (err) {
      console.warn('[DS3] Could not read slot active flags:', err);
      // fallback: treat all non-empty slots as active
      this.slotActiveFlags = Array(10).fill(true);
    }
  }

  /**
   * Returns true if the given character slot contains an active (non-deleted) character.
   */
  isSlotActive(slotIndex: number): boolean {
    return this.slotActiveFlags[slotIndex] === true;
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

      // Calculate entry header offset
      const entryHeaderOffset = BND4_HEADER_SIZE + (character.slotIndex * ENTRY_HEADER_SIZE);

      // Read entry size and data offset
      const entrySize = Number(view.getBigUint64(entryHeaderOffset + 0x08, true));
      const entryDataOffset = view.getUint32(entryHeaderOffset + 0x10, true);

      // Read existing IV (we reuse it)
      const iv = newSaveData.slice(
        entryDataOffset + 16,
        entryDataOffset + 32
      );

      // Encrypt modified character data
      const encryptedData = await encryptAesCbc(character.getRawData(), iv);

      // Verify encrypted data size matches expected size
      const expectedEncryptedSize = entrySize - 32;
      if (encryptedData.length !== expectedEncryptedSize) {
        throw new Error(
          `Data size mismatch for slot ${character.slotIndex}. ` +
          `Expected ${expectedEncryptedSize}, got ${encryptedData.length}`
        );
      }

      // Write encrypted data back to buffer
      newSaveData.set(encryptedData, entryDataOffset + 32);

      // Calculate new MD5 checksum (IV + EncryptedData)
      const dataToHash = new Uint8Array(16 + encryptedData.length);
      dataToHash.set(iv, 0);
      dataToHash.set(encryptedData, 16);

      const checksum = await calculateMD5(dataToHash);

      // Write checksum to beginning of entry
      newSaveData.set(checksum, entryDataOffset);
    }

    return newSaveData;
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
