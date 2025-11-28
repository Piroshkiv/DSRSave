# Dark Souls Save Editor

A web-based save file editor for Dark Souls 1 (Remastered).

## Features

- **Find in folder** - Automatically searches for save files in selected folder (NBGI, etc.)
- **Auto-load** - Automatically loads your last edited save on startup
- Load and edit Dark Souls save files (.sl2)
- Edit character stats (VIT, ATN, END, STR, DEX, RES, INT, FTH)
- Modify character name, level, and humanity
- Auto-level correction based on stats (optional)
- **Direct file editing** - Save button overwrites original file (no downloads!)
- **File System Access API** - Modern file handling with system dialogs
- **Smart file picker** - Opens in Documents folder by default
- Compact two-column layout for efficient editing
- Dark theme UI
- Fully client-side - no server required

## Installation

First, make sure you have Node.js installed. Then:

```bash
npm install
```

## Usage

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Build

Build for production:

```bash
npm run build
```

The built files will be in the `dist` folder.

### Preview Production Build

```bash
npm run preview
```

## How to Use

### First Time - Easy Way (Find in Folder)
1. Click "Find save in folder" button (has ? icon with help)
2. Select folder: NBGI, DARK SOULS REMASTERED, or any folder containing saves
3. App automatically searches recursively for .sl2 files
4. Done! File loads and is remembered

### First Time - Manual Way
1. Click "Load Save File" button (has ? icon with help)
2. Navigate to: `NBGI\DARK SOULS REMASTERED\<user_id>\DRAKS0005.sl2`
3. Select the file
4. File loads and is remembered for next time

### Next Time
1. Open the app - Your last save auto-loads!
2. (May see permission dialog first time)
3. Start editing immediately

### Editing
1. Choose a character from the list on the left (10 slots shown)
2. Edit character stats and info:
   - **Left column**: All 8 stats (VIT, ATN, END, STR, DEX, RES, INT, FTH)
   - **Right column**: Name, Level, Humanity
   - **Auto-correct Level**: Enabled by default, calculates level based on stats
3. Click **Save** to update the original file directly
4. Click **Save As** to save to a new location

**Important:** Always backup your save file before editing!

### Browser Compatibility

**File System Access API** (direct file editing):
- ✅ Chrome/Edge 86+
- ✅ Safari 15.2+
- ❌ Firefox (auto-falls back to download)

The app automatically detects support and falls back to traditional download if needed.

## Save File Location

Dark Souls Remastered save files are typically located at:
- Windows: `%USERPROFILE%\Documents\NBGI\DARK SOULS REMASTERED\<user_id>\`

## Library

The save file parsing and editing logic is located in the `src/lib` folder and can be used independently:

- `SaveFileEditor.ts` - Main class for loading and saving .sl2 files
- `Character.ts` - Character data manipulation
- `constants.ts` - Game constants and stat tables
- `crypto.ts` - AES encryption/decryption functions

## Technical Details

### Save File Format
- Encrypted using AES-CBC encryption
- Each character slot stored separately with unique IV (Initialization Vector)
- 11 total slots: 10 for characters, 1 for settings (hidden in UI)
- Character names stored as UTF-16 Little Endian

### Auto-Level Correction
When enabled (default), level is calculated as:
```
Level = Base Level + (Current Stats - Starting Stats)
```
Each class has predefined base stats and starting level.

### File System Access API
- Uses modern `showOpenFilePicker()` and `showSaveFilePicker()` APIs
- Requires HTTPS in production (works on localhost HTTP)
- Gracefully falls back to traditional file input/download

## License

This project is for educational purposes only. Dark Souls is property of FromSoftware and Bandai Namco.
