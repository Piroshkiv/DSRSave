# Feature Summary - Version 1.3.1

## 🎯 Main Features

### 1. Auto-Find Save (NEW in v1.3.1)
**Easiest way to start!**
- Click "Auto-Find Save" button
- Select any parent folder (Documents, NBGI, etc.)
- App searches recursively for .sl2 files
- Automatically loads first one found
- No manual navigation needed!

**How it works:**
```
Click "Auto-Find" → Select folder → App searches → File loads!
```

**Example:**
```
Select: Documents
App finds: Documents/NBGI/DARK SOULS REMASTERED/834633765/DRAKS0005.sl2
Auto-loads! ✓
```

### 2. Auto-Load (v1.3)
**Just like the C# version!**
- Opens your last edited save automatically
- No need to navigate to the file every time
- Works across browser sessions
- Shows "Loading last save file..." indicator

**How it works:**
```
First use:  Load file → Edit → Close
Next use:   Auto-loads! → Edit immediately
```

### 2. Direct File Editing
**No downloads needed!**
- Save button overwrites the original file
- Save As lets you pick a new location
- Uses modern File System Access API
- Fallback to download if not supported

### 3. Smart File Picker
**Opens in the right place!**
- Starts in Documents folder
- Easy navigation to Dark Souls saves
- Remembers your choice

### 4. Character Editing
**Complete stats management:**
- All 8 stats: VIT, ATN, END, STR, DEX, RES, INT, FTH
- Name, Level, Humanity
- 10 character slots (11th hidden - it's for settings)

### 5. Auto-Level Correction
**Optional, enabled by default:**
- Calculates level from stats automatically
- Based on class base stats
- Disable to set level manually
- Checkbox in General tab

### 6. Compact UI
**Efficient layout:**
- Left: Stats in vertical list
- Right: General info
- Dark theme
- No wasted space

## 🔧 Technical Features

### File Format Support
- AES-CBC encryption/decryption
- MD5 checksum validation
- UTF-16 LE character names
- Preserves all game data

### Browser Compatibility
**Full features (Chrome/Edge/Safari):**
- Auto-load
- Direct file editing
- Smart file picker

**Partial (Firefox):**
- Manual load only
- Download instead of save
- No auto-load

### Security & Privacy
- Completely client-side
- No data sent to servers
- File handles stored locally (IndexedDB)
- User controls all permissions

## 📋 Comparison with C# Version

| Feature | C# Version | Web Version |
|---------|-----------|-------------|
| Auto-load last save | ✅ | ✅ |
| Search for saves | ✅ | ✅* |
| Direct file editing | ✅ | ✅ |
| Remember file path | ✅ | ✅ |
| Offline usage | ✅ | ✅ |
| Cross-platform | ❌ (Windows only) | ✅ |

*Requires user to select parent folder first (browser security)

## 🚀 Quick Start

```bash
# Install (first time or after update)
npm install

# Run development server
npm run dev

# Open http://localhost:5173
# Your last save will auto-load!
```

## 📖 Documentation

- [AUTO-FIND.md](AUTO-FIND.md) - How auto-find works
- [AUTO-LOAD.md](AUTO-LOAD.md) - How auto-load works
- [BUGFIX.md](BUGFIX.md) - MD5 fix explanation
- [README.md](README.md) - Full documentation
- [README.RU.md](README.RU.md) - Russian version
- [CHANGELOG.md](CHANGELOG.md) - Version history

## ⚠️ Important Notes

1. **Always backup saves before editing!**
2. **Run `npm install` after updating** (for MD5 fix)
3. **Use Chrome/Edge/Safari** for best experience
4. **Grant permissions** when browser asks (for auto-load)
5. **HTTPS required in production** (localhost works on HTTP)

## 🎮 Dark Souls Save Location

```
Windows: %USERPROFILE%\Documents\NBGI\DARK SOULS REMASTERED\<user_id>\DRAKS0005.sl2
```

The `<user_id>` is usually a Steam ID (numeric folder).
