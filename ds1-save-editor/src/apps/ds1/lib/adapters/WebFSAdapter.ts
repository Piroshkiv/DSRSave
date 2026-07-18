// Web File System Access API adapter
// Works in modern browsers (Chrome, Edge, Safari) and Electron

import { IFileSystemAdapter, FileHandle, FileData, SaveOptions } from './IFileSystemAdapter';

const DB_NAME = 'DS1SaveEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

interface Settings {
  lastFileHandle?: FileSystemFileHandle;
  lastFileName?: string;
}

export class WebFSAdapter extends IFileSystemAdapter {
  private db: IDBDatabase | null = null;
  private observer: any = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastModified: number = 0;

  getAdapterName(): string {
    return 'WebFS (File System Access API)';
  }

  supportsAutoLoad(): boolean {
    return 'showOpenFilePicker' in window;
  }

  private async initDB(): Promise<void> {
    if (this.db) return;

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

  async openFile(_options?: { defaultPath?: string }): Promise<FileData> {
    console.log('[WebFSAdapter] openFile() called');

    // Try File System Access API first
    if ('showOpenFilePicker' in window) {
      console.log('[WebFSAdapter] Using File System Access API');
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{
            description: 'Dark Souls Save File',
            accept: { 'application/x-dark-souls-save': ['.sl2', '.co2'] }
          }],
          multiple: false
        });

        const file = await fileHandle.getFile();
        console.log('[WebFSAdapter] File opened successfully:', file.name);
        return {
          file,
          handle: fileHandle as unknown as FileHandle
        };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[WebFSAdapter] User cancelled file selection');
          throw new Error('User cancelled file selection');
        }
        console.error('[WebFSAdapter] File System Access API failed:', err);
        console.error('[WebFSAdapter] Error name:', err.name, 'Error message:', err.message);
        console.warn('File System Access API failed, falling back to input');
        // Continue to fallback
      }
    } else {
      console.log('[WebFSAdapter] File System Access API not available');
    }

    // Fallback to traditional file input
    console.log('[WebFSAdapter] Using traditional file input fallback');
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.sl2,.co2';

      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          console.log('[WebFSAdapter] File selected via input:', file.name);
          resolve({ file, handle: null });
        } else {
          console.error('[WebFSAdapter] No file selected');
          reject(new Error('No file selected'));
        }
      };

      input.oncancel = () => {
        console.log('[WebFSAdapter] User cancelled file input');
        reject(new Error('User cancelled file selection'));
      };

      input.click();
    });
  }

  async saveToFile(handle: FileHandle, data: Uint8Array): Promise<void> {
    const fileHandle = handle as unknown as FileSystemFileHandle;

    if (!fileHandle || !fileHandle.createWritable) {
      throw new Error('Invalid file handle or File System Access API not supported');
    }

    const writable = await fileHandle.createWritable();
    await writable.write(data.buffer as ArrayBuffer);
    await writable.close();
  }

  async readFile(handle: FileHandle): Promise<File> {
    const fileHandle = handle as unknown as FileSystemFileHandle;

    if (!fileHandle || !fileHandle.getFile) {
      throw new Error('Invalid file handle or File System Access API not supported');
    }

    return fileHandle.getFile();
  }

  async saveAsNewFile(data: Uint8Array, options?: SaveOptions): Promise<FileHandle | null> {
    // Try File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: options?.suggestedName || 'edited_save.sl2',
          types: [{
            description: 'Dark Souls Save File',
            accept: { 'application/x-dark-souls-save': ['.sl2', '.co2'] }
          }]
        });

        const writable = await fileHandle.createWritable();
        await writable.write(data.buffer as ArrayBuffer);
        await writable.close();

        return fileHandle as unknown as FileHandle;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          throw new Error('User cancelled file save');
        }
        console.warn('File System Access API failed, falling back to download');
      }
    }

    // Fallback to traditional download
    this.downloadFile(data, options?.suggestedName || 'edited_save.sl2');
    return null;
  }

  private downloadFile(data: Uint8Array, filename: string): void {
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
  }

  async saveLastFile(handle: FileHandle, fileName: string): Promise<void> {
    await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const settings: Settings = {
        lastFileHandle: handle as unknown as FileSystemFileHandle,
        lastFileName: fileName
      };

      const request = store.put(settings, 'lastFile');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async loadLastFile(): Promise<FileData | null> {
    if (!this.supportsAutoLoad()) {
      return null;
    }

    await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('lastFile');

      request.onsuccess = async () => {
        const settings = request.result as Settings | undefined;
        const fileHandle = settings?.lastFileHandle;

        if (!fileHandle) {
          resolve(null);
          return;
        }

        try {
          // First check if permission is already granted (no user gesture needed)
          const permission = await (fileHandle as any).queryPermission?.({ mode: 'read' });
          console.log('[WebFSAdapter] Permission status:', permission);

          if (permission === 'granted') {
            // Permission already granted, can load without user gesture
            const file = await fileHandle.getFile();
            resolve({
              file,
              handle: fileHandle as unknown as FileHandle
            });
            return;
          }

          // Permission not granted - need user gesture for requestPermission()
          // Return null so UI can show a button for user to click
          console.log('[WebFSAdapter] Permission not granted, need user gesture');
          resolve(null);
        } catch (err) {
          console.warn('Failed to load last file:', err);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Request permission for last file - MUST be called from user gesture context
   */
  async requestLastFilePermission(): Promise<FileData | null> {
    if (!this.supportsAutoLoad()) {
      return null;
    }

    await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get('lastFile');

      request.onsuccess = async () => {
        const settings = request.result as Settings | undefined;
        const fileHandle = settings?.lastFileHandle;

        if (!fileHandle) {
          resolve(null);
          return;
        }

        try {
          // Request permission - this MUST be called from user gesture
          const newPermission = await (fileHandle as any).requestPermission?.({ mode: 'read' });
          console.log('[WebFSAdapter] Permission after request:', newPermission);

          if (newPermission === 'granted') {
            const file = await fileHandle.getFile();
            resolve({
              file,
              handle: fileHandle as unknown as FileHandle
            });
          } else {
            resolve(null);
          }
        } catch (err) {
          console.warn('Failed to request permission:', err);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getLastFileName(): Promise<string | null> {
    if (!this.supportsAutoLoad()) {
      return null;
    }

    await this.initDB();

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

  async watchFile(handle: FileHandle, callback: () => void): Promise<() => void> {
    await this.unwatchFile();

    const fileHandle = handle as unknown as FileSystemFileHandle;

    // Try FileSystemObserver API (Chrome 110+)
    if ('FileSystemObserver' in window) {
      try {
        const observer = new (window as any).FileSystemObserver(async (records: any[]) => {
          for (const record of records) {
            if (record.type === 'change') {
              console.log('[WebFSAdapter] FileSystemObserver detected change');
              callback();
            }
          }
        });

        await observer.observe(fileHandle);
        this.observer = observer;
        console.log('[WebFSAdapter] Using FileSystemObserver');
        return () => this.unwatchFile();
      } catch (err) {
        console.warn('[WebFSAdapter] FileSystemObserver failed, using polling:', err);
      }
    }

    // Fallback: polling via lastModified check
    const file = await fileHandle.getFile();
    this.lastModified = file.lastModified;

    this.pollInterval = setInterval(async () => {
      try {
        const currentFile = await fileHandle.getFile();
        if (currentFile.lastModified !== this.lastModified) {
          this.lastModified = currentFile.lastModified;
          console.log('[WebFSAdapter] Polling detected file change');
          callback();
        }
      } catch (err) {
        console.warn('[WebFSAdapter] Polling error:', err);
      }
    }, 3000);

    console.log('[WebFSAdapter] Using polling (3s interval)');
    return () => this.unwatchFile();
  }

  async unwatchFile(): Promise<void> {
    if (this.observer) {
      try {
        this.observer.disconnect();
      } catch {}
      this.observer = null;
    }

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.lastModified = 0;
  }
}
