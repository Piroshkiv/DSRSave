import { Character } from './Character';
import { decryptAesCbc, encryptAesCbc, calculateMD5 } from './crypto';
import { toArrayBuffer } from './bufferUtils';
import {
  SAVE_FILE_SIZE,
  SAVE_SLOT_SIZE,
  BASE_SLOT_OFFSET,
  USER_DATA_SIZE,
  USER_DATA_FILE_COUNT,
  AES_KEY
} from './constants';
import { getFileSystemAdapter, FileHandle } from './adapters';

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

      const iv = this.saveData.slice(offset, offset + 16);
      const encrypted = this.saveData.slice(offset + 16, offset + 16 + USER_DATA_SIZE);

      const decrypted = await decryptAesCbc(encrypted, AES_KEY, iv);
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

      const iv = newSaveData.slice(offset, offset + 16);
      const encrypted = await encryptAesCbc(character.getRawData(), AES_KEY, iv);
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
