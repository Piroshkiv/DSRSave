# Quick Start Guide

## Prerequisites

You need to have Node.js (v18 or later) installed on your system.

Download from: https://nodejs.org/

## Installation

1. Open a terminal/command prompt
2. Navigate to this directory:
   ```bash
   cd ds1-save-editor
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

   **Note:** If you're updating from an older version, always run `npm install` to get the latest dependencies, including the critical MD5 fix.

## Running the Application

### Development Mode

```bash
npm run dev
```

The app will start at `http://localhost:5173`

Open your browser and navigate to that address.

### Production Build

```bash
npm run build
```

This creates an optimized build in the `dist` folder that you can deploy to any static hosting service.

## Project Structure

```
ds1-save-editor/
├── src/
│   ├── lib/              # Save file library (portable)
│   │   ├── Character.ts      # Character data class
│   │   ├── SaveFileEditor.ts # Main editor class
│   │   ├── constants.ts      # Game constants
│   │   ├── crypto.ts         # Encryption/decryption
│   │   ├── md5.ts           # MD5 implementation
│   │   └── index.ts         # Library exports
│   ├── components/       # React UI components
│   │   ├── CharacterList.tsx
│   │   ├── FileUpload.tsx
│   │   ├── GeneralTab.tsx
│   │   └── TabPanel.tsx
│   ├── App.tsx          # Main application
│   ├── App.css          # Dark theme styles
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies
└── vite.config.ts       # Build configuration
```

## Features Implemented

- ✅ Load Dark Souls save files (.sl2)
- ✅ Display all 11 character slots
- ✅ Edit character name
- ✅ Edit character level
- ✅ Edit all 8 stats (VIT, ATN, END, STR, DEX, RES, INT, FTH)
- ✅ Edit humanity
- ✅ Change character class
- ✅ Auto-calculate HP when VIT changes
- ✅ Auto-calculate Stamina when END changes
- ✅ Save and Save As functionality
- ✅ Dark theme UI
- ✅ Fully client-side (no server required)

## Library Usage

The library in `src/lib` can be used independently:

```typescript
import { SaveFileEditor, Character } from './lib';

// Load from File object
const editor = await SaveFileEditor.fromFile(file);

// Get all characters
const characters = editor.getCharacters();

// Edit a character
const char = characters[0];
char.name = "New Name";
char.level = 100;
char.setStat("STR", 40);

// Export modified save
const modifiedSave = await editor.exportSaveFile();
```

## Notes

- The library does NOT require JSON files to be loaded
- All game constants are embedded in the code
- The library is portable and can be used in other projects
- No external dependencies except React for the UI
