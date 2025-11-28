# ⚠️ IMPORTANT - Critical Bug Fix

## Save File Corruption Fixed in v1.2.1

If you're upgrading from an earlier version, **you MUST run `npm install`** to install the fixed MD5 library.

### What was wrong?
The custom MD5 implementation was producing incorrect checksums, which caused save file corruption.

### What's fixed?
Now using the proven `js-md5` library for correct MD5 calculation.

### How to update:
```bash
cd ds1-save-editor
npm install
npm run dev
```

### If your saves were corrupted:
Unfortunately, corrupted saves cannot be recovered. Please use a backup. Always backup your saves before editing!

### Dark Souls save location:
Windows: `%USERPROFILE%\Documents\NBGI\DARK SOULS REMASTERED\<user_id>\`

## Technical Details
See [BUGFIX.md](BUGFIX.md) for complete technical explanation.
