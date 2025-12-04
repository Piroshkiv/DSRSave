// Settings helper for storing last used file information
// Uses IndexedDB to store FileSystemFileHandle (can't use localStorage for handles)

const DB_NAME = 'DS1SaveEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

interface Settings {
  lastFileHandle?: FileSystemFileHandle;
  lastFileName?: string;
  lastFilePath?: string;
  lastDirectoryHandle?: FileSystemDirectoryHandle;
}

class SettingsHelper {
  private db: IDBDatabase | null = null;

  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    });
  }

  async saveLastFileHandle(fileHandle: FileSystemFileHandle, fileName: string): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const settings: Settings = {
        lastFileHandle: fileHandle,
        lastFileName: fileName,
        lastFilePath: `Documents/NBGI/DARK SOULS REMASTERED/.../` + fileName // Virtual path for display
      };

      const request = store.put(settings, 'lastFile');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getLastFileHandle(): Promise<FileSystemFileHandle | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('lastFile');

      request.onsuccess = () => {
        const settings = request.result as Settings | undefined;
        resolve(settings?.lastFileHandle || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getLastFileName(): Promise<string | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('lastFile');

      request.onsuccess = () => {
        const settings = request.result as Settings | undefined;
        resolve(settings?.lastFileName || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveLastDirectory(dirHandle: FileSystemDirectoryHandle): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('lastFile');

      request.onsuccess = () => {
        const settings = (request.result as Settings | undefined) || {};
        settings.lastDirectoryHandle = dirHandle;

        const putRequest = store.put(settings, 'lastFile');
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getLastDirectory(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('lastFile');

      request.onsuccess = () => {
        const settings = request.result as Settings | undefined;
        resolve(settings?.lastDirectoryHandle || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearSettings(): Promise<void> {
    if (!this.db) await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const settingsHelper = new SettingsHelper();
