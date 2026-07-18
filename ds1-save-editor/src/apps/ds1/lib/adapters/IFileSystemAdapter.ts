// Abstract interface for file system operations
// Provides platform-agnostic file handling for Web/Electron/Tauri

export interface FileHandle {
  // Opaque handle type - implementation-specific
  _brand: 'FileHandle';
}

export interface FileData {
  file: File;
  handle: FileHandle | null;
}

export interface SaveOptions {
  suggestedName?: string;
}

/**
 * Abstract file system adapter interface
 * Implementations: WebFSAdapter (File System Access API), TauriFSAdapter (Tauri plugins)
 */
export abstract class IFileSystemAdapter {
  /**
   * Opens a file picker dialog and returns the selected file
   * @param options - Optional: defaultPath to open the dialog in
   * @returns FileData with File object and handle (if supported)
   */
  abstract openFile(options?: { defaultPath?: string }): Promise<FileData>;

  /**
   * Saves data to the original file using the handle
   * @param handle - File handle from openFile()
   * @param data - Binary data to save
   */
  abstract saveToFile(handle: FileHandle, data: Uint8Array): Promise<void>;

  /**
   * Opens a save dialog and saves data to a new file
   * @param data - Binary data to save
   * @param options - Save options (suggested name, etc.)
   * @returns New file handle (if supported)
   */
  abstract saveAsNewFile(data: Uint8Array, options?: SaveOptions): Promise<FileHandle | null>;

  /**
   * Re-reads the current file contents from a handle (e.g. after an external change)
   * @param handle - File handle from openFile()
   */
  abstract readFile(handle: FileHandle): Promise<File>;

  /**
   * Checks if auto-loading last file is supported
   */
  abstract supportsAutoLoad(): boolean;

  /**
   * Saves information about the last opened file
   * @param handle - File handle to remember
   * @param fileName - Original file name
   */
  abstract saveLastFile(handle: FileHandle, fileName: string): Promise<void>;

  /**
   * Loads the last opened file automatically (if supported)
   * @returns FileData or null if not available
   */
  abstract loadLastFile(): Promise<FileData | null>;

  /**
   * Gets the adapter name for debugging
   */
  abstract getAdapterName(): string;

  /**
   * Check if there's a stored last file without requiring permission
   * @returns The file name if available, null otherwise
   */
  abstract getLastFileName(): Promise<string | null>;

  /**
   * Request permission for last file - MUST be called from user gesture context
   * @returns FileData if permission granted, null otherwise
   */
  abstract requestLastFilePermission(): Promise<FileData | null>;

  /**
   * Watch a file for external changes
   * @param handle - File handle to watch
   * @param callback - Called when the file changes
   * @returns Cleanup function to stop watching
   */
  abstract watchFile(handle: FileHandle, callback: () => void): Promise<() => void>;

  /**
   * Stop watching the current file
   */
  abstract unwatchFile(): Promise<void>;
}
