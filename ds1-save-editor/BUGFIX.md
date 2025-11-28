# Bug Fix - Save File Corruption

## Issue
Save files were being corrupted after editing and saving.

## Root Cause
The custom MD5 implementation in `src/lib/md5.ts` was producing incorrect hash values. The MD5 checksum is critical because:

1. It's calculated from the encrypted data: `MD5(encrypted_data)`
2. It's written to the file **in place of the original IV** (first 16 bytes of each slot)
3. When loading the file again, this MD5 checksum **IS used as the IV** for decryption

This creates a self-validating loop:
- Save: `IV (from file) → Encrypt → MD5(encrypted) → Write MD5 as new IV`
- Load: `MD5 (from file, used as IV) → Decrypt → Success if MD5 was correct`

## Solution
Replaced custom MD5 implementation with the proven `js-md5` library.

### Changed Files
1. **package.json** - Added `js-md5` and `@types/js-md5` dependencies
2. **src/lib/crypto.ts** - Updated to use js-md5 library
3. **src/lib/md5.ts** - Removed (old broken implementation)

### Code Changes

**Before (broken):**
```typescript
import { md5 } from './md5';  // Custom implementation

export async function calculateMD5(data: Uint8Array): Promise<Uint8Array> {
  return md5(data);  // INCORRECT results
}
```

**After (fixed):**
```typescript
import md5 from 'js-md5';

export async function calculateMD5(data: Uint8Array): Promise<Uint8Array> {
  const hash = md5.create();
  hash.update(data);
  const hashArray = hash.array();
  return new Uint8Array(hashArray);  // CORRECT MD5
}
```

## How the Save Format Works

### File Structure (per character slot)
```
[Offset 0x00] - 16 bytes: MD5 checksum (used as IV for decryption)
[Offset 0x10] - 0x60020 bytes: AES-CBC encrypted character data
```

### Save Process
```typescript
// 1. Read current IV/checksum from save file
const iv = saveData.slice(offset, offset + 16);

// 2. Encrypt character data using that IV
const encrypted = encryptAesCbc(character.data, KEY, iv);

// 3. Calculate MD5 of encrypted data
const md5checksum = calculateMD5(encrypted);  // ← THIS WAS BROKEN

// 4. Write MD5 checksum in place of old IV
saveData.set(md5checksum, offset);  // Overwrites IV with checksum

// 5. Write encrypted data
saveData.set(encrypted, offset + 16);
```

### Load Process
```typescript
// 1. Read MD5 checksum (stored where IV was)
const iv = saveData.slice(offset, offset + 16);  // This is MD5, not original IV!

// 2. Read encrypted data
const encrypted = saveData.slice(offset + 16, offset + 16 + USER_DATA_SIZE);

// 3. Decrypt using MD5 as IV
const decrypted = decryptAesCbc(encrypted, KEY, iv);  // iv = MD5 checksum
```

## Testing
After fix:
1. Load save file
2. Edit character stats
3. Save
4. Reload save file
5. Verify all data intact

## Installation
After pulling these changes, run:
```bash
npm install
```

This will install the new `js-md5` dependency.
