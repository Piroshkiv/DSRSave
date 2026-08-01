const fs = require('fs');
const crypto = require('crypto');

const SAVE_FILE   = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2';
const BEFORE_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\scripts\\slot-snapshot-before.json';

const AES_KEY = Buffer.from([
  0xFD, 0x46, 0x4D, 0x69, 0x5E, 0x69, 0xA3, 0x9A,
  0x10, 0xE3, 0x19, 0xA7, 0xAC, 0xE8, 0xB7, 0xFA
]);
const BND4_HEADER_SIZE = 0x40;
const ENTRY_HEADER_SIZE = 0x20;

function decryptEntry(save, idx) {
  const entryOff  = BND4_HEADER_SIZE + idx * ENTRY_HEADER_SIZE;
  const entrySize = Number(save.readBigUInt64LE(entryOff + 0x08));
  const dataOff   = save.readUInt32LE(entryOff + 0x10);
  const iv        = save.slice(dataOff + 16, dataOff + 32);
  const encrypted = save.slice(dataOff + 32, dataOff + 32 + entrySize - 32);
  const decipher  = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function diffBufs(label, before, after) {
  console.log(`\n=== DIFF ${label} (len ${before.length}) ===`);
  let count = 0;
  const len = Math.min(before.length, after.length);
  for (let i = 0; i < len; i++) {
    if (before[i] !== after[i]) {
      // print surrounding context
      const ctx = 4;
      if (count === 0 || true) {
        console.log(`  [0x${i.toString(16).padStart(5,'0')}]  0x${before[i].toString(16).padStart(2,'0')} → 0x${after[i].toString(16).padStart(2,'0')}`);
      }
      count++;
    }
  }
  if (count === 0) console.log('  No differences.');
  else console.log(`  Total: ${count} byte(s) changed`);
}

const saveAfter  = fs.readFileSync(SAVE_FILE);
const before     = JSON.parse(fs.readFileSync(BEFORE_FILE));

// Re-take snapshot now for full entries
const saveBefore = Buffer.from(before.entry10_0x000_to_0x1ff); // just to reuse later

// Decrypt full entries now
const entry10After  = decryptEntry(saveAfter, 10);
const entry11After  = decryptEntry(saveAfter, 11);
const slot0After    = decryptEntry(saveAfter, 0);

// We need before snapshots of the full entries — re-read from file if we saved them,
// otherwise just show what changed in slot0 fully
// For entry10 and entry11, snapshot only has 0x200 bytes — so let's compare those
diffBufs(
  'entry10[0x000..0x1FF]',
  Buffer.from(before.entry10_0x000_to_0x1ff),
  entry10After.slice(0, 0x200)
);

diffBufs(
  'slot0[0x000..0x1FF]',
  Buffer.from(before.slot0_0x000_to_0x1ff),
  slot0After.slice(0, 0x200)
);

// Now do a FULL scan of slot0 (the character that was deleted)
// Compare all bytes, show ranges with changes
console.log('\n=== FULL SCAN: slot0 non-zero regions AFTER delete ===');
let inZeroRun = true;
for (let i = 0; i < slot0After.length; i += 16) {
  const row = slot0After.slice(i, i + 16);
  if (row.some(b => b !== 0)) {
    if (inZeroRun && i > 0) console.log(`  ... (zeros up to 0x${i.toString(16)}) ...`);
    inZeroRun = false;
    const hex = Array.from(row).map(b => b.toString(16).padStart(2,'0')).join(' ');
    console.log(`  [0x${i.toString(16).padStart(5,'0')}] ${hex}`);
  } else {
    inZeroRun = true;
  }
}

// Check entry 11 for differences by comparing to itself decoded
console.log('\n=== entry11 first 0x100 bytes (after delete) ===');
for (let i = 0; i < Math.min(0x100, entry11After.length); i += 16) {
  const row = entry11After.slice(i, i + 16);
  if (row.some(b => b !== 0)) {
    const hex = Array.from(row).map(b => b.toString(16).padStart(2,'0')).join(' ');
    console.log(`  [${i.toString(16).padStart(4,'0')}] ${hex}`);
  }
}

// Also check: is slot0 now "empty" (first32 all zeros)?
const first32 = slot0After.slice(0x10, 0x40);
console.log(`\nslot0 first32AllZero (0x10..0x40): ${first32.every(b => b === 0)}`);
console.log(`slot0 first byte: 0x${slot0After[0].toString(16)}`);
