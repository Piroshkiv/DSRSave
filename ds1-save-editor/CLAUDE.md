# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dark Souls Remastered (DSR/DS1) save file editor - a multi-platform application for editing encrypted `.sl2` save files. Supports editing character stats, inventory, appearance, bonfires, NPCs, bosses, and world events.

## Tech Stack

- **Frontend:** React 18.2 + TypeScript (strict mode, ES2020 target)
- **Build Tool:** Vite 5
- **Desktop:** Electron 39 (primary) + Tauri 2.9 (secondary, Rust-based)
- **Routing:** react-router-dom v7.10
- **Crypto:** Web Crypto API (AES-CBC) + js-md5 for checksums
- **No test framework or linter configured** - TypeScript strict mode is the primary type-checking tool

## Commands

```bash
# Development
npm install              # Install dependencies
npm run dev              # Vite dev server (localhost:5173)
npm run preview          # Preview production build

# Build
npm run build            # Web build (absolute paths) - for Cloudflare Pages
npm run build:static     # Static build (relative paths) - for Electron

# Electron
npm run electron         # Build static + launch Electron
npm run electron:dev     # Launch Electron without rebuilding
npm run electron:debug   # Build + launch with devtools
npm run electron:debug:dev  # Launch with devtools only

# Distribution
npm run dist             # Package for current platform (electron-builder)
npm run dist:win         # Package for Windows
npm run dist:linux       # Package for Linux
npm run dist:mac         # Package for macOS

# Tauri
npm run tauri:dev        # Tauri dev mode
npm run tauri:build      # Tauri production build
```

## Architecture

### Directory Structure

```
src/
├── apps/
│   ├── ds1/              # DS1 editor (primary, full-featured)
│   │   ├── components/   # UI components (TabPanel, GeneralTab, InventoryTab, etc.)
│   │   ├── hooks/        # Custom hooks (useDS1SaveEditor)
│   │   ├── lib/          # Core logic (SaveFileEditor, Character, Inventory, crypto)
│   │   └── DS1App.tsx    # Main DS1 editor component
│   └── ds3/              # DS3 editor (beta, similar structure)
├── core/
│   ├── context/          # React contexts (GameContext, LanguageContext)
│   ├── config.ts         # Game registry (DS1, DS3, Elden Ring)
│   ├── Router.tsx        # Route definitions
│   └── ErrorBoundary.tsx
├── shared/
│   ├── components/       # Shared UI (Button, Layout, FileSystem)
│   └── types/            # Shared TypeScript types
└── main.tsx              # Entry point (wraps app in LanguageProvider)
```

### Key Patterns

1. **Save File Format:** DS1 saves are AES-CBC encrypted. Each character slot has unique IV. 11 slots total (10 characters + 1 settings).

2. **Platform Detection:** Save files auto-detected as PC (0x4204D0 bytes), Nintendo Switch (0x4200A0 bytes), or PS4 (filename starts with "userdata").

3. **File System Adapter Pattern:** `src/apps/ds1/lib/adapters/` provides platform-agnostic file handling:
   - `WebFSAdapter` - Uses File System Access API (Chrome/Edge) with download fallback
   - `TauriFSAdapter` - Uses Tauri plugins for desktop
   - Factory pattern in `adapters/index.ts` auto-selects based on environment

4. **Character Data Model:** `Character` class wraps raw `Uint8Array` with getter/setter properties for stats, name, appearance, bonfires, etc.

5. **Internationalization:** Custom i18n in `src/apps/ds1/lib/i18n.ts` with `Lang` type ('en' | 'zh'). Chinese item names loaded from `public/json/item_names_zh.json`.

6. **Tab-based UI:** `TabPanel` component manages tabs: Help, General, Appearance, Inventory, Bonfires, NPCs, Bosses, World Events, Table (hex editor).

### Save File Editing Flow

1. `FileUpload` component loads `.sl2` file
2. `SaveFileEditor` decrypts AES-CBC using Web Crypto API
3. `Character` objects created from decrypted data (10 character slots)
4. User edits via tabbed interface
5. `SaveFileEditor.exportSaveFile()` re-encrypts and writes checksums
6. Save via File System Access API (direct) or download fallback

### Router (Desktop vs Web)

- **Web:** `BrowserRouter` with clean URLs
- **Electron/Tauri:** `HashRouter` with `file://` protocol support

Detection in `App.tsx`:
```typescript
const isElectron = navigator.userAgent.toLowerCase().includes('electron');
const isTauri = window.__TAURI__ !== undefined;
```

### Context Providers

- `GameProvider` - Tracks selected game (DS1/DS3/ER)
- `LanguageProvider` - i18n with localStorage persistence (`ds1-lang` key)

## Key Files

| File | Purpose |
|------|---------|
| `src/apps/ds1/lib/SaveFileEditor.ts` | Main save file read/write logic |
| `src/apps/ds1/lib/Character.ts` | Character data model (stats, name, bonfires) |
| `src/apps/ds1/lib/Inventory.ts` | Inventory item management |
| `src/apps/ds1/lib/constants.ts` | Game constants, offsets, stat tables |
| `src/apps/ds1/lib/crypto.ts` | AES-CBC encrypt/decrypt + MD5 |
| `src/apps/ds1/hooks/useDS1SaveEditor.ts` | Main state management hook |
| `src/apps/ds1/components/TabPanel.tsx` | Tabbed editing interface |
| `src/core/config.ts` | Game registry and metadata |
| `electron/main.js` | Electron main process |

## Important Notes

- **No test framework** - TypeScript strict mode is the primary validation
- **No ESLint/Prettier** - Code style maintained manually
- **Static assets** in `public/` (logos, item databases, screenshots)
- **SEO generation** via `scripts/generate-seo-pages.js` (run after `npm run build`)
- **Electron packaging** outputs to `release/` directory
- **Tauri** requires Rust toolchain (min 1.77.2)

## Build Modes

- `npm run build` - Web deployment (Cloudflare Pages) with absolute paths
- `npm run build:static` - Desktop apps with relative paths
- Vite config in `vite.config.ts` switches `base` based on `--mode static`
