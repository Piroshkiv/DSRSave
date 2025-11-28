# Find Save in Folder Feature

## Overview

The "Find save in folder" button automatically searches for Dark Souls save files (.sl2) in any folder you select. You can point it to `NBGI`, `DARK SOULS REMASTERED`, or any folder containing saves, and it will find the first .sl2 file.

**UI Features:**
- Green button labeled "Find save in folder"
- Help icon (?) with tooltip showing usage instructions
- Changes to "Searching..." while searching

## How It Works

### User Flow
```
1. Hover over ? icon to see help
   ↓
2. Click "Find save in folder"
   ↓
3. Browser shows folder picker
   ↓
4. Select folder: NBGI, DARK SOULS REMASTERED, or user ID folder
   ↓
5. App searches recursively for first .sl2 file
   ↓
6. File found → Auto-loads!
   ↓
7. File saved for next auto-load
```

### Search Algorithm

```typescript
async function findFirstSL2File(directory) {
  // Search current directory
  for each entry in directory {
    if (entry is .sl2 file) {
      return entry; // Found!
    }
  }

  // Search subdirectories recursively
  for each subdirectory in directory {
    result = findFirstSL2File(subdirectory);
    if (result) return result;
  }

  return null; // Not found
}
```

**Features:**
- Recursive search (up to 10 levels deep)
- Finds ANY .sl2 file (not just DRAKS0005.sl2)
- Searches subdirectories automatically
- Returns first match found
- Shows full path in console

## Usage Examples

### Example 1: Select NBGI
```
You select: C:\Users\YourName\Documents\NBGI\
App searches:
  └── NBGI/
      └── DARK SOULS REMASTERED/
          └── 834633765/
              └── DRAKS0005.sl2 ✓ FOUND!
```

### Example 3: Select User ID Folder
```
You select: ...\DARK SOULS REMASTERED\834633765\
App searches:
  └── 834633765/
      └── DRAKS0005.sl2 ✓ FOUND!
```

### Example 4: Multiple User IDs
```
You select: ...\DARK SOULS REMASTERED\
App searches:
  └── DARK SOULS REMASTERED/
      ├── 834633765/
      │   └── DRAKS0005.sl2 ✓ FOUND! (stops here)
      └── 1874967625/
          └── DRAKS0005.sl2 (not searched - already found)
```

## Why This Approach?

**Compared to C# version:**
```csharp
// C# can automatically navigate to Documents
string docs = Environment.GetFolderPath(SpecialFolder.MyDocuments);
string baseDir = Path.Combine(docs, @"NBGI\DARK SOULS REMASTERED");
// No user interaction needed!
```

**Web version requires user selection:**
- Browser security prevents automatic folder access
- User must grant permission to a folder
- But then we can search recursively inside it

**Advantage of web approach:**
- Works with ANY folder structure
- Not limited to specific paths
- Finds ANY .sl2 file (even custom locations)
- User has full control

## Technical Implementation

### File Search (`src/lib/fileSearch.ts`)

```typescript
export async function findFirstSL2File(
  dirHandle: FileSystemDirectoryHandle,
  maxDepth: number = 10
): Promise<SearchResult | null> {
  // Recursive search with depth limit
  // Returns { fileHandle, path: ['folder', 'subfolder', 'file.sl2'] }
}
```

**Features:**
- `maxDepth` prevents infinite recursion
- Skips inaccessible directories
- Logs search progress to console
- Returns full path for debugging

### FileUpload Component

```typescript
const handleAutoFind = async () => {
  // 1. Ask user to pick a folder
  const dirHandle = await showDirectoryPicker({
    startIn: 'documents'
  });

  // 2. Search for .sl2 file
  const result = await findFirstSL2File(dirHandle);

  // 3. Load if found
  if (result) {
    const file = await result.fileHandle.getFile();
    loadFile(file, result.fileHandle);
  }
};
```

## Performance

**Search Speed:**
- Local files: Very fast (milliseconds)
- Network drives: Can be slow
- Deep folder structures: Limited to 10 levels

**Memory:**
- Async iteration - doesn't load all entries at once
- Early exit when file found
- Minimal memory footprint

## Browser Support

**Required API:**
- `showDirectoryPicker()` - Chrome 86+, Edge 86+, Safari 15.2+
- Not supported in Firefox (button hidden automatically)

**Fallback:**
- If not supported, button is disabled
- Shows alert explaining to use manual load
- Feature degrades gracefully

## Privacy & Security

**Permissions:**
- User must select folder manually
- Browser asks for read permission
- Permission persists for session
- User can revoke at any time

**What we access:**
- Only the folder user selects
- Read-only access
- Cannot access parent folders
- Cannot write/modify files during search

**Data:**
- File handles stored in IndexedDB
- No data sent to servers
- Completely client-side
- User can clear at any time

## Comparison with Manual Load

| Feature | Manual Load | Auto-Find |
|---------|-------------|-----------|
| User selects | File | Folder |
| Navigation required | Yes, to exact file | No, any parent folder |
| Finds file | User navigates | Automatic search |
| Best for | Quick access | First time setup |
| Works in | All browsers | Chrome/Edge/Safari |

## Tips

**Best folders to select:**
1. `Documents` - Searches everything
2. `NBGI` - Faster, less to search
3. `DARK SOULS REMASTERED` - Even faster
4. User ID folder - Instant

**When to use:**
- First time using the app
- Changed save location
- Multiple user IDs (finds first one)
- Forgot exact save location

**When to use Manual Load:**
- You know exact file location
- Want to select specific save (multiple found)
- Browser doesn't support auto-find
- Faster if you know the path

## Troubleshooting

**"No .sl2 files found"**
- Selected wrong folder
- Save file is somewhere else
- File has different extension
- Solution: Try selecting a higher-level folder

**"Auto-find is not supported"**
- Using Firefox or old browser
- Solution: Use manual "Load Save File" button

**Search takes too long**
- Selected folder with many files (like C:\)
- Network drive is slow
- Solution: Select more specific folder (like NBGI)

**Permission denied**
- Browser blocked access
- Antivirus interference
- Solution: Grant permission when browser asks

## Future Enhancements

Potential improvements:
- Show list of ALL found .sl2 files (let user choose)
- Remember last search folder
- Search progress indicator
- Cancel search button
- Filter by filename pattern
- Exclude certain folders from search

## Example Console Output

```
Searching for .sl2 files in: Documents
Found .sl2 file: NBGI/DARK SOULS REMASTERED/834633765/DRAKS0005.sl2
Auto-loading last used file: DRAKS0005.sl2
```
