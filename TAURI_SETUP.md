# Tauri Setup Guide

This guide explains how to add Tauri support to the DS1 Save Editor.

## Prerequisites

- Node.js and npm installed
- Rust toolchain installed (https://rustup.rs/)

## Architecture Overview

The application now uses an **Adapter Pattern** for file system operations:

- **IFileSystemAdapter** - Abstract interface for file operations
- **WebFSAdapter** - Uses File System Access API (Chrome, Edge, Safari, Electron)
- **TauriFSAdapter** - Uses Tauri plugins (Tauri desktop apps)

The adapter is automatically selected based on the environment at runtime.

## File System Operations

All file operations now go through the adapter:

1. **Opening files** - `adapter.openFile()`
2. **Saving files** - `adapter.saveToFile(handle, data)`
3. **Save As** - `adapter.saveAsNewFile(data, options)`
4. **Auto-load last file** - `adapter.loadLastFile()`

## Setting up Tauri

### Step 1: Install Tauri CLI

```bash
npm install -D @tauri-apps/cli
```

### Step 2: Initialize Tauri

```bash
npx tauri init
```

When prompted:
- App name: `DS1 Save Editor`
- Window title: `DS1 Save Editor`
- Web assets path: `../dist`
- Dev server URL: `http://localhost:5173`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

### Step 3: Install Tauri Plugins

```bash
npm install @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
```

### Step 4: Configure Tauri Permissions

Edit `src-tauri/capabilities/default.json` to add file system permissions:

```json
{
  "identifier": "default",
  "description": "Default permissions",
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:default",
    {
      "identifier": "fs:allow-read-file",
      "allow": []
    },
    {
      "identifier": "fs:allow-write-file",
      "allow": []
    },
    {
      "identifier": "fs:allow-exists",
      "allow": []
    }
  ]
}
```

### Step 5: Update Cargo.toml

Add the Tauri plugins to `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2.0", features = [] }
tauri-plugin-dialog = "2.0"
tauri-plugin-fs = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Step 6: Register Plugins in main.rs

Edit `src-tauri/src/main.rs`:

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Step 7: Add Build Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "npm run build && tauri build",
    "tauri:build:win": "npm run build && tauri build --target x86_64-pc-windows-msvc"
  }
}
```

## Building

### Development Mode

```bash
npm run tauri:dev
```

### Production Build

```bash
# Build for current platform
npm run tauri:build

# Build for Windows
npm run tauri:build:win
```

The built application will be in `src-tauri/target/release/bundle/`.

## Differences Between Web/Electron and Tauri

| Feature | Web/Electron | Tauri |
|---------|--------------|-------|
| File API | File System Access API | Tauri FS Plugin |
| File Handle Storage | IndexedDB | localStorage + file path |
| Auto-reload | Yes (via FileHandle) | Yes (via file path) |
| Permissions | Browser prompts | OS file picker |
| Bundle Size | Large (~100MB) | Small (~5-10MB) |

## Removed Features

The "Find save in folder" feature has been removed as it was complex to implement across platforms and not essential for core functionality.

## Testing

1. **Test Web version**: `npm run dev`
2. **Test Electron version**: `npm run electron:dev`
3. **Test Tauri version**: `npm run tauri:dev`

All three versions should have identical functionality:
- Open .sl2 files
- Edit character data
- Save changes
- Auto-load last file on restart

## Troubleshooting

### Tauri plugins not loading

Make sure:
1. Plugins are installed: `npm list @tauri-apps/plugin-dialog @tauri-apps/plugin-fs`
2. Plugins are registered in `main.rs`
3. Permissions are configured in `capabilities/default.json`

### Build errors

- Make sure Rust toolchain is installed: `rustc --version`
- Update Cargo dependencies: `cd src-tauri && cargo update`
- Clean build: `cd src-tauri && cargo clean`

## File Structure

```
ds1-save-editor/
├── src/
│   ├── lib/
│   │   ├── adapters/
│   │   │   ├── IFileSystemAdapter.ts      # Interface
│   │   │   ├── WebFSAdapter.ts            # Web/Electron
│   │   │   ├── TauriFSAdapter.ts          # Tauri
│   │   │   └── index.ts                   # Factory
│   │   └── ...
│   └── ...
├── electron/                               # Electron wrapper
├── src-tauri/                             # Tauri config (after setup)
└── package.json
```

## Next Steps

After Tauri is set up, you can:
1. Customize the app icon in `src-tauri/icons/`
2. Configure app metadata in `src-tauri/tauri.conf.json`
3. Add more Tauri plugins as needed
4. Set up code signing for production releases
