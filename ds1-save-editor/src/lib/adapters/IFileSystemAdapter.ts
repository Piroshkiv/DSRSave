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
   * @returns FileData with File object and handle (if supported)
   */
  abstract openFile(): Promise<FileData>;

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
}
