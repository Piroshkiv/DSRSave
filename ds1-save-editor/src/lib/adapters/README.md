# File System Adapters

This directory contains the file system abstraction layer that allows the DS1 Save Editor to work across multiple platforms (Web, Electron, Tauri) without code duplication.

## Architecture

The adapter pattern is used to abstract file system operations:

```
┌─────────────────────────────────────────┐
│         Application Code                │
│  (Components, SaveFileEditor, etc.)     │
└─────────────┬───────────────────────────┘
              │
              │ Uses interface
              ▼
┌─────────────────────────────────────────┐
│     IFileSystemAdapter (Abstract)       │
│  - openFile()                           │
│  - saveToFile()                         │
│  - saveAsNewFile()                      │
│  - loadLastFile()                       │
│  - saveLastFile()                       │
└─────────────┬───────────────────────────┘
              │
        ┌─────┴──────┐
        │            │
        ▼            ▼
┌──────────────┐  ┌──────────────┐
│ WebFSAdapter │  │TauriFSAdapter│
└──────────────┘  └──────────────┘
     Web/Electron       Tauri
```

## Files

### `IFileSystemAdapter.ts`
Abstract base class defining the interface for file operations.

**Key types:**
- `FileHandle` - Opaque handle representing an open file
- `FileData` - Contains File object and optional handle
- `SaveOptions` - Options for saving files

**Key methods:**
- `openFile()` - Opens file picker and returns selected file
- `saveToFile(handle, data)` - Saves to existing file using handle
- `saveAsNewFile(data, options)` - Opens save dialog and saves to new file
- `supportsAutoLoad()` - Returns true if auto-loading last file is supported
- `saveLastFile(handle, name)` - Remembers the last opened file
- `loadLastFile()` - Auto-loads the last opened file

### `WebFSAdapter.ts`
Implementation for Web browsers and Electron using the **File System Access API**.

**Features:**
- Uses `showOpenFilePicker()` for opening files
- Uses `showSaveFilePicker()` for saving files
- Stores `FileSystemFileHandle` in IndexedDB for auto-reload
- Falls back to `<input type="file">` if API not available

**Browser support:**
- ✅ Chrome 86+
- ✅ Edge 86+
- ✅ Safari 15.2+
- ✅ Electron (with `nodeIntegration: false`)
- ❌ Firefox (no File System Access API support)

### `TauriFSAdapter.ts`
Implementation for Tauri desktop apps using **Tauri plugins**.

**Features:**
- Uses `@tauri-apps/plugin-dialog` for file dialogs
- Uses `@tauri-apps/plugin-fs` for file I/O
- Stores file path in `localStorage` for auto-reload
- Dynamic plugin loading to avoid build errors in non-Tauri builds

**Requirements:**
- `@tauri-apps/plugin-dialog` package
- `@tauri-apps/plugin-fs` package
- Proper permissions in `capabilities/default.json`

### `index.ts`
Factory module that automatically detects the environment and returns the appropriate adapter.

**Detection logic:**
```typescript
if (window.__TAURI__ || window.__TAURI_INTERNALS__) {
  return new TauriFSAdapter();
} else {
  return new WebFSAdapter();
}
```

**Usage:**
```typescript
import { getFileSystemAdapter } from './lib/adapters';

const adapter = getFileSystemAdapter();
const fileData = await adapter.openFile();
```

## Usage Examples

### Opening a file
```typescript
const adapter = getFileSystemAdapter();
const fileData = await adapter.openFile();

// fileData.file - File object
// fileData.handle - FileHandle (may be null)
```

### Saving to existing file
```typescript
const adapter = getFileSystemAdapter();
await adapter.saveToFile(fileHandle, saveData);
```

### Save As (new file)
```typescript
const adapter = getFileSystemAdapter();
await adapter.saveAsNewFile(saveData, {
  suggestedName: 'edited_save.sl2'
});
```

### Auto-load last file
```typescript
const adapter = getFileSystemAdapter();

if (adapter.supportsAutoLoad()) {
  const fileData = await adapter.loadLastFile();
  if (fileData) {
    // File loaded successfully
  }
}
```

## Adding a New Adapter

To add support for a new platform:

1. Create a new file (e.g., `ElectronIPCAdapter.ts`)
2. Extend `IFileSystemAdapter`
3. Implement all abstract methods
4. Add detection logic in `index.ts`

Example:
```typescript
export class MyNewAdapter extends IFileSystemAdapter {
  getAdapterName(): string {
    return 'MyAdapter';
  }

  supportsAutoLoad(): boolean {
    return true;
  }

  async openFile(): Promise<FileData> {
    // Implementation
  }

  // ... implement other methods
}
```

## Platform Differences

| Feature | WebFS | Tauri |
|---------|-------|-------|
| Open file dialog | Browser API | Native dialog |
| Save file dialog | Browser API | Native dialog |
| File handle type | FileSystemFileHandle | Path string |
| Handle storage | IndexedDB | localStorage |
| Permissions | Browser prompts | OS picker |
| Offline support | Yes | Yes |

## Design Decisions

### Why not use Node.js fs module in Electron?
We keep Electron using the File System Access API (same as web) to:
1. Maintain security with `nodeIntegration: false`
2. Share the same code path as web version
3. Use browser's permission system

### Why dynamic imports in TauriFSAdapter?
Tauri plugins are not available in web/electron builds. Using dynamic imports with `new Function()` prevents Vite from bundling these imports, avoiding build errors.

### Why opaque FileHandle type?
The `FileHandle` type is opaque (`_brand: 'FileHandle'`) to prevent mixing handles between adapters. Each adapter casts it internally to its specific type.

## Testing

Test each adapter independently:

```bash
# Web version (WebFSAdapter)
npm run dev

# Electron version (WebFSAdapter)
npm run electron:dev

# Tauri version (TauriFSAdapter)
npm run tauri:dev
```

All versions should have identical functionality.
