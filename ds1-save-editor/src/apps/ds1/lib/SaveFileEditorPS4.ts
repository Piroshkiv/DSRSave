import { Character } from './Character';
import { toArrayBuffer } from '../../../shared/binary';
import { getFileSystemAdapter, FileHandle } from './adapters';

export const PS4_HEADER_SIZE = 4;
export const PS4_SLOT_DATA_SIZE = 0x60000;
export const PS4_MIN_FILE_SIZE = PS4_HEADER_SIZE + PS4_SLOT_DATA_SIZE; // 0x60004

export class SaveFileEditorPS4 {
  private saveData: Uint8Array;
  private characters: Character[];
  private fileHandle: FileHandle | null = null;

  constructor(saveData: Uint8Array, fileHandle?: FileHandle) {
    if (saveData.length < PS4_MIN_FILE_SIZE) {
      throw new Error(
        `Invalid PS4 save file size. Expected at least ${PS4_MIN_FILE_SIZE}, got ${saveData.length}`
      );
    }
    this.saveData = saveData;
    this.characters = [];
    this.fileHandle = fileHandle || null;
  }

  static async fromFileData(file: File, fileHandle: FileHandle | null): Promise<SaveFileEditorPS4> {
    const arrayBuffer = await file.arrayBuffer();
    const saveData = new Uint8Array(arrayBuffer);
    const editor = new SaveFileEditorPS4(saveData, fileHandle || undefined);
    await editor.loadCharacters();
    return editor;
  }

  private async loadCharacters(): Promise<void> {
    this.characters = [];
    // PS4: один файл = один слот персонажа, данные сразу после 4-байтного заголовка
    const rawData = this.saveData.slice(PS4_HEADER_SIZE, PS4_HEADER_SIZE + PS4_SLOT_DATA_SIZE);
    this.characters.push(new Character(rawData, 0));
  }

  getCharacters(): Character[] {
    return this.characters;
  }

  getCharacter(index: number): Character | undefined {
    return this.characters[index];
  }

  async exportSaveFile(): Promise<Uint8Array> {
    const newSaveData = new Uint8Array(this.saveData);
    const character = this.characters[0];
    if (character) {
      newSaveData.set(character.getRawData(), PS4_HEADER_SIZE);
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
      await adapter.saveAsNewFile(data, { suggestedName: suggestedName || 'userdata' });
    } catch (err: any) {
      if (err.message === 'User cancelled file save') return;
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

  async downloadSaveFile(filename: string = 'userdata'): Promise<void> {
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
