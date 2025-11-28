# Update Notes - File System Access API & UTF-16 Fixes

## Version 1.2 - File System Access API Integration

### Major Changes

#### 1. File System Access API Integration
The application now uses the modern File System Access API for better file handling:

**Features:**
- **Save Button**: Overwrites the original file directly (no download)
- **Save As Button**: Opens a system file picker to choose save location
- **Automatic Fallback**: Falls back to traditional download if API is not supported

**Browser Support:**
- Chrome/Edge 86+
- Safari 15.2+
- Not supported in Firefox (automatic fallback to download)

**How it works:**
1. Click "Load Save File" - Uses native file picker instead of input element
2. Edit your character
3. Click "Save" - Directly updates the original file
4. Click "Save As" - Choose a new location with system dialog

#### 2. UTF-16 String Handling Fixed
Fixed critical bug with character names:

**Problem:**
- Empty character names displayed as squares (□□□)
- Unable to edit or clear character names

**Solution:**
- Completely rewrote `readUtf16String()` and `writeUtf16String()` methods
- Proper UTF-16 Little Endian encoding/decoding
- Empty strings now handled correctly
- Null terminator properly placed

**Technical Details:**
```typescript
// Now correctly encodes to UTF-16LE
for (let i = 0; i < maxChars; i++) {
  const charCode = value.charCodeAt(i);
  this.data[offset + bytePos] = charCode & 0xFF;        // Low byte
  this.data[offset + bytePos + 1] = (charCode >> 8) & 0xFF; // High byte
  bytePos += 2;
}
```

### Updated Files
- `src/lib/SaveFileEditor.ts` - File System Access API implementation
- `src/lib/Character.ts` - UTF-16 string handling fixes
- `src/components/FileUpload.tsx` - File picker integration
- `src/App.tsx` - Save/Save As handlers
- `src/types/file-system-access.d.ts` - TypeScript definitions (new)

### API Methods

#### SaveFileEditor
```typescript
// Save to original file (File System Access API)
await editor.saveToOriginalFile();

// Save to new location with picker
await editor.saveToNewFile('edited_save.sl2');

// Check if file handle is available
editor.hasFileHandle(); // returns boolean

// Create from file handle
const editor = await SaveFileEditor.fromFileHandle(fileHandle);
```

### Testing Notes
- Tested with characters having empty names
- Tested with special characters in names
- Tested save/load cycle preserves all data
- Verified fallback works in unsupported browsers

### Known Limitations
- File System Access API requires HTTPS in production (works on localhost)
- Firefox users will still download files (no API support)
- Some browsers may show permission prompts

### Migration Notes
No breaking changes - all existing functionality preserved with graceful fallbacks.
