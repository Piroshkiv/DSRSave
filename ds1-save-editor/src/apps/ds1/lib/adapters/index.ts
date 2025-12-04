// File system adapter factory
// Automatically detects environment (Web/Electron/Tauri) and returns appropriate adapter

import { IFileSystemAdapter } from './IFileSystemAdapter';
import { WebFSAdapter } from './WebFSAdapter';
import { TauriFSAdapter } from './TauriFSAdapter';

// Re-export types
export type { IFileSystemAdapter, FileHandle, FileData, SaveOptions } from './IFileSystemAdapter';

/**
 * Detects the current environment
 */
export function detectEnvironment(): 'tauri' | 'web' {
  // Check if running in Tauri
  if (typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)) {
    console.log('[FS Adapter] Detected environment: Tauri');
    return 'tauri';
  }

  // Default to web (includes Electron, since it uses web APIs)
  console.log('[FS Adapter] Detected environment: Web/Electron');
  return 'web';
}

/**
 * Creates and returns the appropriate file system adapter for the current environment
 */
export function createFileSystemAdapter(): IFileSystemAdapter {
  const env = detectEnvironment();

  console.log(`Initializing file system adapter for environment: ${env}`);

  switch (env) {
    case 'tauri':
      return new TauriFSAdapter();
    case 'web':
    default:
      return new WebFSAdapter();
  }
}

// Singleton instance
let adapterInstance: IFileSystemAdapter | null = null;

/**
 * Gets the singleton file system adapter instance
 */
export function getFileSystemAdapter(): IFileSystemAdapter {
  if (!adapterInstance) {
    adapterInstance = createFileSystemAdapter();
  }
  return adapterInstance;
}
