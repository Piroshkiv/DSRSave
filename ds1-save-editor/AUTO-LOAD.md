# Auto-Load Feature

## How it Works

The save editor now automatically loads your last used save file when you open the application, similar to the C# version.

### Logic Flow

```
1. Check IndexedDB for last used FileSystemFileHandle
   ↓
2. If found → Request permission to access file
   ↓
3. If permission granted → Auto-load the file
   ↓
4. If any step fails → User manually loads file
```

This matches the C# logic:
```csharp
// 1. Try to load from settings (last used path)
if (!string.IsNullOrEmpty(_settings.SaveFilePath) && File.Exists(_settings.SaveFilePath))
{
    LoadSaveFile(_savePath);
}
```

### Features

**Auto-Load on Startup:**
- Remembers the last save file you edited
- Automatically loads it on next visit
- Asks for permission if needed (browser security)
- Shows "Loading last save file..." indicator

**Smart File Picker:**
- Opens in Documents folder by default (`startIn: 'documents'`)
- Helps you navigate to: `Documents/NBGI/DARK SOULS REMASTERED/<user_id>/`
- Remembers your selection for next time

**Persistent Storage:**
- Uses IndexedDB to store FileSystemFileHandle
- Survives browser restarts
- More reliable than localStorage

## Browser Requirements

**Required for Auto-Load:**
- Chrome/Edge 86+
- Safari 15.2+
- HTTPS or localhost

**Fallback:**
- Firefox and older browsers use traditional file input
- No auto-load, but manual selection still works

## Implementation Details

### Settings Helper (`src/lib/settings.ts`)

```typescript
// Save file handle after loading
await settingsHelper.saveLastFileHandle(fileHandle, fileName);

// Try to load on startup
const lastHandle = await settingsHelper.getLastFileHandle();
if (lastHandle) {
  // Request permission
  const permission = await lastHandle.requestPermission({ mode: 'read' });
  if (permission === 'granted') {
    const file = await lastHandle.getFile();
    // Load file...
  }
}
```

### File Upload Component

The `FileUpload` component now:
1. Runs auto-load on mount (once)
2. Checks for stored file handle
3. Requests permission if needed
4. Loads file automatically
5. Shows loading indicator during process

### Permissions

The browser will ask for permission to access the file again:
- First time: Always asks
- Subsequent visits: Usually remembers (depends on browser settings)
- User can revoke permission in browser settings

## User Experience

### First Visit
1. Click "Load Save File"
2. Navigate to save location
3. Select `DRAKS0005.sl2`
4. File loads and is remembered

### Next Visit
1. Open application
2. See "Loading last save file..."
3. (May see permission dialog)
4. File automatically loads
5. Continue editing immediately

### If Auto-Load Fails
- No error shown to user
- Just shows "Load Save File" button as normal
- User can manually select file

## Privacy & Security

- File handles stored locally in browser's IndexedDB
- Never sent to any server
- Completely client-side
- User controls all permissions
- Can clear storage to reset

### Clear Stored Data

To reset and remove stored file handles:

**Option 1: Browser DevTools**
```
F12 → Application → IndexedDB → DS1SaveEditorDB → Delete
```

**Option 2: Browser Settings**
```
Settings → Privacy → Clear browsing data → Site data
```

**Option 3: Programmatically**
```typescript
import { settingsHelper } from './lib/settings';
await settingsHelper.clearSettings();
```

## Comparison with C# Version

### C# Logic
```csharp
// 1. Try last used path
if (File.Exists(_settings.SaveFilePath))
    LoadSaveFile(_savePath);

// 2. Search in Documents/NBGI/DARK SOULS REMASTERED/
foreach (var folder in Directory.GetDirectories(baseDir))
{
    string candidate = Path.Combine(folder, "DRAKS0005.sl2");
    if (File.Exists(candidate))
        LoadSaveFile(candidate);
}
```

### Web Version
```typescript
// 1. Try last used file handle
const lastHandle = await settingsHelper.getLastFileHandle();
if (lastHandle) {
    const file = await lastHandle.getFile();
    loadFile(file, lastHandle);
}

// 2. If manual, suggest Documents folder
showOpenFilePicker({ startIn: 'documents' });
// User navigates to NBGI/DARK SOULS REMASTERED/<id>/
```

### Differences

**C#:** Can automatically search directories
**Web:** Cannot search without user permission (security)

**C#:** Direct file system access
**Web:** Requires File System Access API permissions

**C#:** Can find first available save
**Web:** User must select file first time

The web version provides the same convenience while respecting browser security constraints.
