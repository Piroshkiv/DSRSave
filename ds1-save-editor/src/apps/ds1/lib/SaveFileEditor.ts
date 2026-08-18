import { Character } from './Character';
import { decryptAesCbc, encryptAesCbc, calculateMD5 } from './crypto';
import { toArrayBuffer } from '../../../shared/binary';
import {
  SAVE_FILE_SIZE,
  SAVE_SLOT_SIZE,
  BASE_SLOT_OFFSET,
  USER_DATA_SIZE,
  USER_DATA_FILE_COUNT,
  AES_KEY
} from './constants';
import { getFileSystemAdapter, FileHandle } from './adapters';

/**
 * On-disk layout of one DSR slot, verified byte-exact against a real
 * `DRAKS0005.sl2` (all 11 entries):
 *
 *   [ MD5 (16) ][ IV (16) ][ AES-128-CBC ciphertext ]
 *   \________ SAVE_SLOT_SIZE = 0x60030 ________/
 *
 * with `MD5 = md5(IV ‖ ciphertext)` — the same scheme DS3 uses, see
 * `apps/ds3/lib/SaveFileEditor.writeEntry`.
 *
 * This editor deliberately reads it one field "late": the stored MD5 is fed to
 * AES as the IV, and the real IV is swallowed as the first ciphertext block.
 * That is self-consistent rather than broken:
 *
 *   decrypt: block0 = D(IV) ⊕ MD5  ← phantom, not save data
 *            blockN = correct plaintext, shifted 16 bytes later
 *   encrypt: E(block0 ⊕ MD5) = E(D(IV)) = IV  ← the real IV is restored exactly
 *
 * so an export reproduces a byte-identical, game-valid file, and the checksum
 * written over `[offset+16 …]` covers exactly `IV ‖ ciphertext` as the game
 * expects. Two consequences worth knowing:
 *
 *   1. Every offset in this app (`constants.ts`, `Character`, `slotDuplicator`)
 *      is 16 bytes higher than the same field in tools that parse the entry
 *      properly — e.g. the character name sits at 0x108 here, 0xF8 there.
 *   2. Bytes 0x00–0x0F of a decrypted slot are that phantom block, never save
 *      data. Writing to them is harmless (it only re-rolls the stored IV, and
 *      the ciphertext is re-derived from it in the same pass) but reading them
 *      as character data is meaningless.
 *
 * Fixing the shift would mean re-basing every offset in the DS1 editor for no
 * behavioural gain, so it stays — documented and pinned by tests in
 * `tests/ds1/saveFile.test.ts`.
 */
export class SaveFileEditor {
  private saveData: Uint8Array;
  private characters: Character[];
  private fileHandle: FileHandle | null = null;

  constructor(saveData: Uint8Array, fileHandle?: FileHandle) {
    if (saveData.length < SAVE_FILE_SIZE) {
      throw new Error('Invalid save file size');
    }
    this.saveData = saveData;
    this.characters = [];
    this.fileHandle = fileHandle || null;
  }

  static async fromFile(file: File): Promise<SaveFileEditor> {
    const arrayBuffer = await file.arrayBuffer();
    const saveData = new Uint8Array(arrayBuffer);
    const editor = new SaveFileEditor(saveData);
    await editor.loadCharacters();
    return editor;
  }

  static async fromFileData(file: File, fileHandle: FileHandle | null): Promise<SaveFileEditor> {
    const arrayBuffer = await file.arrayBuffer();
    const saveData = new Uint8Array(arrayBuffer);
    const editor = new SaveFileEditor(saveData, fileHandle || undefined);
    await editor.loadCharacters();
    return editor;
  }

  private async loadCharacters(): Promise<void> {
    this.characters = [];

    for (let i = 0; i < USER_DATA_FILE_COUNT; i++) {
      const offset = BASE_SLOT_OFFSET + i * SAVE_SLOT_SIZE;

      // The stored MD5 doubles as the AES IV here — see the class comment.
      const checksum = this.saveData.slice(offset, offset + 16);
      const encrypted = this.saveData.slice(offset + 16, offset + 16 + USER_DATA_SIZE);

      const decrypted = await decryptAesCbc(encrypted, AES_KEY, checksum);
      this.characters.push(new Character(decrypted, i));
    }
  }

  getCharacters(): Character[] {
    return this.characters;
  }

  getCharacter(index: number): Character | undefined {
    return this.characters[index];
  }

  async exportSaveFile(): Promise<Uint8Array> {
    const newSaveData = new Uint8Array(this.saveData);

    for (const character of this.characters) {
      const offset = BASE_SLOT_OFFSET + character.slotNumber * SAVE_SLOT_SIZE;

      // Encrypt with the checksum the slot was *decrypted* with, not the one
      // about to be written: that is what makes the phantom first block
      // re-encrypt into the slot's original IV (see the class comment).
      // `newSaveData` is still a pristine copy here — each slot is visited once.
      const decryptChecksum = newSaveData.slice(offset, offset + 16);
      const encrypted = await encryptAesCbc(character.getRawData(), AES_KEY, decryptChecksum);

      // md5 over the whole re-encrypted region, i.e. over IV ‖ ciphertext.
      const checksum = await calculateMD5(encrypted);

      // Write checksum
      newSaveData.set(checksum, offset);
      // Write encrypted data
      newSaveData.set(encrypted, offset + 16);
    }

    return newSaveData;
  }

  async saveToOriginalFile(): Promise<void> {
    if (!this.fileHandle) {
      throw new Error('No file handle available. Use saveToNewFile instead.');
    }

    const data = await this.exportSaveFile();
    const adapter = getFileSystemAdapter();
    await adapter.saveToFile(this.fileHandle, data);
  }

  async saveToNewFile(suggestedName?: string): Promise<void> {
    const data = await this.exportSaveFile();
    const adapter = getFileSystemAdapter();

    try {
      await adapter.saveAsNewFile(data, { suggestedName: suggestedName || 'edited_save.sl2' });
    } catch (err: any) {
      if (err.message === 'User cancelled file save') {
        return; // User cancelled
      }
      throw err;
    }
  }

  private downloadFile(data: Uint8Array, filename: string): void {
    const blob = new Blob([toArrayBuffer(data)], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  async downloadSaveFile(filename: string = 'DRAKS0005.sl2'): Promise<void> {
    const data = await this.exportSaveFile();
    this.downloadFile(data, filename);
  }

  hasFileHandle(): boolean {
    return this.fileHandle !== null;
  }

  getFileHandle(): FileHandle | null {
    return this.fileHandle;
  }
}
