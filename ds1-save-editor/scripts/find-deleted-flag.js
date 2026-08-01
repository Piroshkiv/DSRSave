const fs = require('fs');
const crypto = require('crypto');

const SAVE_FILE = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2';

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
  const enc       = save.slice(dataOff + 32, dataOff + 32 + entrySize - 32);
  const d = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(enc), d.final()]);
}

const save = fs.readFileSync(SAVE_FILE);

// --- 1. Compare slot0 vs slot1 byte-by-byte ---
// slot0 was just deleted, slot1 was deleted before.
// Any byte that differs between them BUT is the same between slot1/slot2/slot3
// is likely NOT the "deleted" flag. We want bytes where slot0 DIFFERS from all of 1,2,3.
const s = [0,1,2,3].map(i => decryptEntry(save, i));

console.log('=== Bytes that differ between slot0 and slot1 (both deleted) ===');
const diffs01 = [];
for (let i = 0; i < s[0].length; i++) {
  if (s[0][i] !== s[1][i]) diffs01.push(i);
}
console.log(`Total differing bytes between slot0 and slot1: ${diffs01.length}`);

// Among those, find ones where slot1==slot2==slot3 (i.e. already-deleted slots agree)
const candidateBytes = diffs01.filter(i => s[1][i] === s[2][i] && s[2][i] === s[3][i]);
console.log(`Bytes where slot0 differs from all of slot1/2/3: ${candidateBytes.length}`);
if (candidateBytes.length < 200) {
  for (const i of candidateBytes) {
    console.log(`  [0x${i.toString(16).padStart(5,'0')}]  s0=0x${s[0][i].toString(16).padStart(2,'0')}  s1=0x${s[1][i].toString(16).padStart(2,'0')}  s2=0x${s[2][i].toString(16).padStart(2,'0')}  s3=0x${s[3][i].toString(16).padStart(2,'0')}`);
  }
}

// --- 2. Scan entry10 fully for the "10 consecutive bytes with exactly N active slots" pattern ---
console.log('\n=== entry10: scanning for 10-slot active array ===');
const e10 = decryptEntry(save, 10);

// Before deletion: expected pattern was "01 01 01 01 00 00 00 00 00 00" (4 slots had data)
// After deletion:  might be "00 00 00 00 00 00 00 00 00 00" or some other combo
for (let i = 0; i < e10.length - 10; i++) {
  const slice = e10.slice(i, i + 10);
  const vals = Array.from(slice);
  // Look for exactly N non-zero + (10-N) zeros where the non-zeros are at the start
  for (let n = 1; n <= 5; n++) {
    const firstN  = vals.slice(0, n).every(b => b !== 0);
    const restZero = vals.slice(n).every(b => b === 0);
    if (firstN && restZero) {
      console.log(`  N=${n} at 0x${i.toString(16).padStart(4,'0')}: ${vals.map(b=>'0x'+b.toString(16).padStart(2,'0')).join(' ')}`);
    }
  }
}

// --- 3. Save full entry10 snapshot for future comparison ---
const OUT = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\scripts\\entry10-after-delete.bin';
fs.writeFileSync(OUT, e10);
console.log(`\nFull entry10 (after delete) saved to ${OUT}`);
