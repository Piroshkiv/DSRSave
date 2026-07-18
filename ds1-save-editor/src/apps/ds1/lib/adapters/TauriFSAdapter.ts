// Tauri file system adapter
// Uses @tauri-apps/plugin-dialog and @tauri-apps/plugin-fs

import { IFileSystemAdapter, FileHandle, FileData, SaveOptions } from './IFileSystemAdapter';
import { watchFileMtime, MtimeWatcher } from '../../../../shared/utils/watchFileMtime';

// Tauri imports - these will be available when running in Tauri environment
// To install: npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
// Note: These imports are commented out and loaded dynamically to avoid build errors in non-Tauri builds

interface TauriFileHandle {
  path: string;
}

export class TauriFSAdapter extends IFileSystemAdapter {
  private dialog: any = null;
  private fs: any = null;
  private pluginsLoaded: Promise<void> | null = null;
  private readonly storageKey: string;
  private watcher: MtimeWatcher | null = null;

  constructor(storageKey = 'ds1_last_file_path') {
    super();
    this.storageKey = storageKey;

    // Start loading Tauri plugins asynchronously
    // Check if window.__TAURI__ or __TAURI_INTERNALS__ exists
    if (typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) {
      this.pluginsLoaded = this.loadTauriPlugins();
    }
  }

  private async loadTauriPlugins() {
    try {
      console.log('[TauriFSAdapter] Loading Tauri plugins...');

      // Use direct dynamic imports - Vite will handle them correctly in Tauri
      const [dialogModule, fsModule] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs')
      ]);

      console.log('[TauriFSAdapter] Plugin modules loaded:', {
        dialog: !!dialogModule,
        fs: !!fsModule
      });

      this.dialog = dialogModule;
      this.fs = fsModule;
      console.log('[TauriFSAdapter] Tauri plugins loaded successfully');
    } catch (err) {
      console.error('[TauriFSAdapter] Failed to load Tauri plugins:', err);
      throw new Error('Tauri plugins not available. Make sure to install @tauri-apps/plugin-dialog and @tauri-apps/plugin-fs');
    }
  }

  private async ensurePluginsLoaded(): Promise<void> {
    if (this.pluginsLoaded) {
      await this.pluginsLoaded;
    } else {
      throw new Error('Tauri plugins not initialized. This adapter should only be used in Tauri environment.');
    }
  }

  getAdapterName(): string {
    return 'Tauri';
  }

  supportsAutoLoad(): boolean {
    return true; // Tauri supports auto-loading via localStorage + file path
  }

  async openFile(options?: { defaultPath?: string }): Promise<FileData> {
    console.log('[TauriFSAdapter] openFile() called');

    try {
      await this.ensurePluginsLoaded();
      console.log('[TauriFSAdapter] Plugins loaded successfully');
    } catch (err) {
      console.error('[TauriFSAdapter] Failed to load plugins:', err);
      throw err;
    }

    console.log('[TauriFSAdapter] Opening file dialog...');
    // Open file dialog
    const filePath = await this.dialog.open({
      title: 'Open Dark Souls Save File',
      filters: [{
        name: 'Dark Souls Save File',
        extensions: ['sl2', 'co2']
      }],
      multiple: false,
      ...(options?.defaultPath ? { defaultPath: options.defaultPath } : {})
    });

    if (!filePath) {
      throw new Error('User cancelled file selection');
    }

    // Read file as binary
    const fileData = await this.fs.readFile(filePath);

    // Convert Uint8Array to File object
    const blob = new Blob([fileData], { type: 'application/octet-stream' });
    const fileName = this.getFileNameFromPath(filePath);
    const file = new File([blob], fileName, { type: 'application/octet-stream' });

    const handle: TauriFileHandle = { path: filePath };

    return {
      file,
      handle: handle as unknown as FileHandle
    };
  }

  async saveToFile(handle: FileHandle, data: Uint8Array): Promise<void> {
    await this.ensurePluginsLoaded();

    const tauriHandle = handle as unknown as TauriFileHandle;

    if (!tauriHandle.path) {
      throw new Error('Invalid file handle');
    }

    // Write file
    await this.fs.writeFile(tauriHandle.path, data);
  }

  async readFile(handle: FileHandle): Promise<File> {
    await this.ensurePluginsLoaded();

    const tauriHandle = handle as unknown as TauriFileHandle;
    if (!tauriHandle.path) {
      throw new Error('Invalid file handle');
    }

    const fileData = await this.fs.readFile(tauriHandle.path);
    const blob = new Blob([fileData], { type: 'application/octet-stream' });
    const fileName = this.getFileNameFromPath(tauriHandle.path);
    return new File([blob], fileName, { type: 'application/octet-stream' });
  }

  async saveAsNewFile(data: Uint8Array, options?: SaveOptions): Promise<FileHandle | null> {
    await this.ensurePluginsLoaded();

    // Open save dialog
    const filePath = await this.dialog.save({
      title: 'Save Dark Souls Save File',
      defaultPath: options?.suggestedName || 'edited_save.sl2',
      filters: [{
        name: 'Dark Souls Save File',
        extensions: ['sl2']
      }]
    });

    if (!filePath) {
      throw new Error('User cancelled file save');
    }

    // Write file
    await this.fs.writeFile(filePath, data);

    const handle: TauriFileHandle = { path: filePath };
    return handle as unknown as FileHandle;
  }

  async saveLastFile(handle: FileHandle, fileName: string): Promise<void> {
    const tauriHandle = handle as unknown as TauriFileHandle;

    if (!tauriHandle.path) {
      return;
    }

    // Store file path in localStorage
    const lastFileInfo = {
      path: tauriHandle.path,
      fileName: fileName,
      timestamp: Date.now()
    };

    localStorage.setItem(this.storageKey, JSON.stringify(lastFileInfo));
  }

  async loadLastFile(): Promise<FileData | null> {
    await this.ensurePluginsLoaded();

    // Get last file path from localStorage
    const lastFileInfoStr = localStorage.getItem(this.storageKey);
    if (!lastFileInfoStr) {
      return null;
    }

    try {
      const lastFileInfo = JSON.parse(lastFileInfoStr);
      const filePath = lastFileInfo.path;

      // Check if file still exists
      const exists = await this.fs.exists(filePath);
      if (!exists) {
        console.log('Last file no longer exists:', filePath);
        localStorage.removeItem(this.storageKey);
        return null;
      }

      // Read file
      const fileData = await this.fs.readFile(filePath);

      // Convert to File object
      const blob = new Blob([fileData], { type: 'application/octet-stream' });
      const fileName = this.getFileNameFromPath(filePath);
      const file = new File([blob], fileName, { type: 'application/octet-stream' });

      const handle: TauriFileHandle = { path: filePath };

      return {
        file,
        handle: handle as unknown as FileHandle
      };
    } catch (err) {
      console.warn('Failed to load last file:', err);
      localStorage.removeItem(this.storageKey);
      return null;
    }
  }

  async getLastFileName(): Promise<string | null> {
    const lastFileInfoStr = localStorage.getItem(this.storageKey);
    if (!lastFileInfoStr) {
      return null;
    }

    try {
      const lastFileInfo = JSON.parse(lastFileInfoStr);
      return lastFileInfo.fileName || null;
    } catch {
      return null;
    }
  }

  async requestLastFilePermission(): Promise<FileData | null> {
    // Tauri doesn't need permission requests, just load the file
    return this.loadLastFile();
  }

  private getFileNameFromPath(path: string): string {
    // Handle both Windows and Unix paths
    const parts = path.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || 'unknown.sl2';
  }

  async watchFile(handle: FileHandle, callback: () => void): Promise<() => void> {
    await this.unwatchFile();

    const tauriHandle = handle as unknown as TauriFileHandle;
    if (!tauriHandle.path) {
      return () => {};
    }

    this.watcher = await watchFileMtime(tauriHandle.path, () => {
      console.log('[TauriFSAdapter] Detected file change via polling');
      callback();
    }, 3000);

    console.log('[TauriFSAdapter] File watching started (3s polling)');
    return () => this.unwatchFile();
  }

  async unwatchFile(): Promise<void> {
    if (this.watcher) {
      this.watcher.stop();
      this.watcher = null;
    }
  }
}
