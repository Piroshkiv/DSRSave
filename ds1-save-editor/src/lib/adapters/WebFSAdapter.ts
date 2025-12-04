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

  async openFile(): Promise<FileData> {
    console.log('[WebFSAdapter] openFile() called');

    // Try File System Access API first
    if ('showOpenFilePicker' in window) {
      console.log('[WebFSAdapter] Using File System Access API');
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{
            description: 'Dark Souls Save File',
            accept: { 'application/octet-stream': ['.sl2'] }
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
        console.warn('File System Access API failed, falling back to input');
      }
    } else {
      console.log('[WebFSAdapter] File System Access API not available');
    }

    // Fallback to traditional file input
    console.log('[WebFSAdapter] Using traditional file input fallback');
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.sl2';

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

  async saveAsNewFile(data: Uint8Array, options?: SaveOptions): Promise<FileHandle | null> {
    // Try File System Access API
    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: options?.suggestedName || 'edited_save.sl2',
          types: [{
            description: 'Dark Souls Save File',
            accept: { 'application/octet-stream': ['.sl2'] }
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
          // Verify we still have permission
          const permission = await (fileHandle as any).queryPermission?.({ mode: 'read' });
          if (permission !== 'granted') {
            // Try to request permission
            const newPermission = await (fileHandle as any).requestPermission?.({ mode: 'read' });
            if (newPermission !== 'granted') {
              console.log('No permission to access last file');
              resolve(null);
              return;
            }
          }

          // Load the file
          const file = await fileHandle.getFile();
          resolve({
            file,
            handle: fileHandle as unknown as FileHandle
          });
        } catch (err) {
          console.warn('Failed to load last file:', err);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}
