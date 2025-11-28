# Changelog

## Version 1.3.1 - Find Save in Folder

### New Feature: Find Save in Folder

**Automatic Save File Detection:**
- New "Find save in folder" button searches for .sl2 files
- Just select any folder containing saves (NBGI, DARK SOULS REMASTERED, etc.)
- Recursively searches all subdirectories
- Finds first .sl2 file automatically
- No need to navigate to exact file location
- Help icons (?) show usage hints for both buttons

**How to use:**
1. Click "Find save in folder"
2. Select folder: NBGI, DARK SOULS REMASTERED, or user ID folder
3. App searches recursively for first .sl2 file
4. File auto-loads!

**Benefits:**
- Even easier than manual selection
- Works with any folder structure
- Finds ANY .sl2 file (not just specific names)
- Great for first-time setup

See [AUTO-FIND.md](AUTO-FIND.md) for detailed documentation.

---

## Version 1.3 - Auto-Load Feature

### New Features

**Auto-Load Last Used Save:**
- Automatically loads your last edited save file on startup
- Uses IndexedDB to remember file handle
- Shows "Loading last save file..." indicator
- Requests permission if needed
- Matches C# version behavior

**Smart File Picker:**
- Opens in Documents folder by default
- Easier navigation to Dark Souls save location
- Remembers your selection

**Implementation:**
- New `settingsHelper` for persistent storage
- Auto-load on component mount
- Permission handling with fallback

See [AUTO-LOAD.md](AUTO-LOAD.md) for details.

---

## Version 1.2.1 - Critical Bug Fix (REQUIRED UPDATE)

### 🔴 CRITICAL FIX: Save File Corruption
**Issue:** Custom MD5 implementation was producing incorrect checksums, causing save file corruption.

**Fix:** Replaced custom MD5 with proven `js-md5` library.

**Action Required:**
```bash
npm install  # Install new dependencies
```

**Important:**
- This fix prevents future corruption
- Already corrupted saves cannot be recovered - use backups
- Always backup saves before editing!

See [BUGFIX.md](BUGFIX.md) and [IMPORTANT.md](IMPORTANT.md) for details.

### Dependencies Added
- `js-md5`: ^0.8.3
- `@types/js-md5`: ^0.7.2

---

## Version 1.2 - File System Access API & UTF-16 Fixes

### File System Access API
- Save button now overwrites original file directly (no downloads)
- Save As uses system file picker
- Automatic fallback for unsupported browsers

### UTF-16 String Fix
- Fixed character name display issues (squares/boxes)
- Proper UTF-16 Little Endian encoding
- Empty names handled correctly

---

## Version 1.1 - Compact UI Update

### Changes
- **Compact Layout**: Redesigned General tab with two-column layout
  - Left column: All stats (VIT, ATN, END, STR, DEX, RES, INT, FTH) in vertical list
  - Right column: Character info (Name, Level, Humanity)
- **Auto-Level Correction**: Added checkbox (enabled by default) to automatically calculate level based on stats
- **UI Simplification**: Removed class selector from UI (class is still preserved in save file)
- **Character Slots**: Only showing 10 character slots (slot 11 is reserved for game settings)
- **Save Behavior**:
  - Save: Downloads with original filename
  - Save As: Downloads with "edited_" prefix

### Technical Details
- Auto-level calculation formula: `BaseLevel + (CurrentStats - BaseStats)`
- Each class has predefined base stats and starting level
- When auto-correct is enabled, level input is disabled and calculated automatically

## Version 1.0 - Initial Release

### Features
- Load and edit Dark Souls save files (.sl2)
- Edit character stats and attributes
- Dark theme UI
- Fully client-side operation
