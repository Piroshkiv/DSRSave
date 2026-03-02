import { Character } from './Character';
import { toArrayBuffer } from './bufferUtils';
import { getFileSystemAdapter, FileHandle } from './adapters';

// Nintendo Switch constants
export const NINTENDO_SAVE_FILE_SIZE = 0x4200A0; // 4,326,256 bytes
export const NINTENDO_SAVE_SLOT_SIZE = 0x060010;
export const NINTENDO_BASE_SLOT_OFFSET = 0x02C0;
export const NINTENDO_USER_DATA_SIZE = 0x060010;
export const NINTENDO_USER_DATA_FILE_COUNT = 11;
export const NINTENDO_TRIM_SIZE = 12; // Bytes to trim from start to align with PC Character offsets

// PC constants for reference
export const PC_SAVE_FILE_SIZE = 0x4204D0; // 4,326,608 bytes

// Platform detection
export type SavePlatform = 'pc' | 'nintendo' | 'unknown';

export function detectPlatform(fileSize: number): SavePlatform {
  if (fileSize === PC_SAVE_FILE_SIZE || fileSize >= PC_SAVE_FILE_SIZE) {
    return 'pc';
  }
  if (fileSize === NINTENDO_SAVE_FILE_SIZE || (fileSize >= NINTENDO_SAVE_FILE_SIZE && fileSize < PC_SAVE_FILE_SIZE)) {
    return 'nintendo';
  }
  return 'unknown';
}

export class SaveFileEditorNintendo {
  private saveData: Uint8Array;
  private characters: Character[];
  private fileHandle: FileHandle | null = null;

  constructor(saveData: Uint8Array, fileHandle?: FileHandle) {
    if (saveData.length < NINTENDO_SAVE_FILE_SIZE) {
      throw new Error(`Invalid Nintendo save file size. Expected ${NINTENDO_SAVE_FILE_SIZE}, got ${saveData.length}`);
    }
    this.saveData = saveData;
    this.characters = [];
    this.fileHandle = fileHandle || null;
  }

  static async fromFile(file: File): Promise<SaveFileEditorNintendo> {
    const arrayBuffer = await file.arrayBuffer();
    const saveData = new Uint8Array(arrayBuffer);
    const editor = new SaveFileEditorNintendo(saveData);
    await editor.loadCharacters();
    return editor;
  }

  static async fromFileData(file: File, fileHandle: FileHandle | null): Promise<SaveFileEditorNintendo> {
    const arrayBuffer = await file.arrayBuffer();
    const saveData = new Uint8Array(arrayBuffer);
    const editor = new SaveFileEditorNintendo(saveData, fileHandle || undefined);
    await editor.loadCharacters();
    return editor;
  }

  private async loadCharacters(): Promise<void> {
    this.characters = [];

    for (let i = 0; i < NINTENDO_USER_DATA_FILE_COUNT; i++) {
      const offset = NINTENDO_BASE_SLOT_OFFSET + i * NINTENDO_SAVE_SLOT_SIZE;

      // Nintendo data is not encrypted, read raw data
      const rawData = this.saveData.slice(offset, offset + NINTENDO_USER_DATA_SIZE);

      // Trim bytes from start to align with PC Character offsets
      const trimmedData = rawData.slice(NINTENDO_TRIM_SIZE);

      this.characters.push(new Character(trimmedData, i));
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
      const offset = NINTENDO_BASE_SLOT_OFFSET + character.slotNumber * NINTENDO_SAVE_SLOT_SIZE;

      // Get character data and prepend the trimmed bytes back (as zeros for now)
      const trimmedData = character.getRawData();
      const rawData = new Uint8Array(NINTENDO_USER_DATA_SIZE);
      rawData.set(trimmedData, NINTENDO_TRIM_SIZE);

      // Write raw data directly (no encryption for Nintendo)
      newSaveData.set(rawData, offset);
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
        return;
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
