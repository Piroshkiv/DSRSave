import { FileHandle } from '../../lib/adapters';

export interface GameCharacter {
  isEmpty: boolean;
  name: string;
  slotNumber: number;
  // Другие общие свойства персонажей
}

export interface GameEditor {
  getCharacters(): GameCharacter[];
  getCharacter(index: number): GameCharacter | undefined;
  exportSaveFile(): Promise<Uint8Array>;
  saveToOriginalFile(): Promise<void>;
  saveToNewFile(suggestedName?: string): Promise<void>;
  downloadSaveFile(filename: string): Promise<void>;
  hasFileHandle(): boolean;
  getFileHandle(): FileHandle | null;
}

export interface GameAdapter {
  id: string;
  name: string;
  displayName: string;
  version: string;

  // Работа с файлами
  saveFileExtension: string;
  defaultFileName: string;

  // Валидация
  validateSaveFile(data: Uint8Array): boolean;

  // Создание редактора
  createEditor(file: File, handle?: FileHandle | null): Promise<GameEditor>;
}

export interface GameConfig {
  enabled: boolean;
  name: string;
  route: string;
  icon: string;
  adapter: GameAdapter;
}
