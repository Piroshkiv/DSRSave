const fs = require('fs');
const crypto = require('crypto');

const SAVE_FILE = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2';

const AES_KEY = Buffer.from([
  0xFD, 0x46, 0x4D, 0x69, 0x5E, 0x69, 0xA3, 0x9A,
  0x10, 0xE3, 0x19, 0xA7, 0xAC, 0xE8, 0xB7, 0xFA
]);

const BND4_HEADER_SIZE = 0x40;
const ENTRY_HEADER_SIZE = 0x20;

function decryptSlot(save, slotIndex) {
  const view = Buffer.from(save);
  const entryOff = BND4_HEADER_SIZE + slotIndex * ENTRY_HEADER_SIZE;
  const entrySize = Number(view.readBigUInt64LE(entryOff + 0x08));
  const dataOff   = view.readUInt32LE(entryOff + 0x10);

  const iv            = save.slice(dataOff + 16, dataOff + 32);
  const encryptedSize = entrySize - 32;
  const encrypted     = save.slice(dataOff + 32, dataOff + 32 + encryptedSize);

  const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function hex(buf, from, len) {
  return Array.from(buf.slice(from, from + len))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

function readUtf16LE(buf, offset, maxChars) {
  let s = '';
  for (let i = 0; i < maxChars; i++) {
    const code = buf.readUInt16LE(offset + i * 2);
    if (code === 0) break;
    s += String.fromCharCode(code);
  }
  return s;
}

const CHARACTER_PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

function findPattern(buf) {
  for (let i = 0; i <= buf.length - CHARACTER_PATTERN.length; i++) {
    if (buf.slice(i, i + CHARACTER_PATTERN.length).equals(CHARACTER_PATTERN)) return i;
  }
  return -1;
}

const save = fs.readFileSync(SAVE_FILE);
console.log(`File size: 0x${save.length.toString(16)} (${save.length} bytes)`);

const entryCount = save.readUInt32LE(0x0C);
console.log(`BND4 entry count: ${entryCount}\n`);

// Also dump the raw BND4 header area to find any "active slot" table
console.log('=== BND4 HEADER (first 0x40 bytes) ===');
console.log(hex(save, 0, 0x40));
console.log('');

// Look for a slot-status table outside the encrypted areas
// Many DS3 save editors reference a "summary" block with 10-slot flags
// It's often at a fixed offset late in the file
console.log('=== Last 0x200 bytes (may contain slot summary) ===');
const tail = save.slice(Math.max(0, save.length - 0x200));
for (let i = 0; i < tail.length; i += 16) {
  const row = Array.from(tail.slice(i, i + 16)).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const off = (save.length - 0x200 + i).toString(16).padStart(6, '0');
  if (tail.slice(i, i + 16).some(b => b !== 0x00)) {
    console.log(`  [${off}] ${row}`);
  }
}
console.log('');

for (let slot = 0; slot < Math.min(entryCount, 10); slot++) {
  try {
    const decrypted = decryptSlot(save, slot);

    // Check entry header flags
    const entryOff = BND4_HEADER_SIZE + slot * ENTRY_HEADER_SIZE;
    const flags = save.readUInt32LE(entryOff);
    const entrySize = Number(save.readBigUInt64LE(entryOff + 0x08));

    const patternOff = findPattern(decrypted);
    const hasPattern = patternOff !== -1;

    // Read name at pattern - 0xC8
    let name = '(no pattern)';
    let level = 0;
    let souls = 0;
    let ngCycle = 0;
    if (hasPattern) {
      name = readUtf16LE(decrypted, patternOff - 0xC8, 16);
      level = decrypted.readUInt16LE(patternOff - 0xE0);
      souls = decrypted.readUInt32LE(patternOff - 0xDC);
      ngCycle = decrypted[patternOff - 0x06];
    }

    // Check first 0x20 bytes for "all zeros" indicator
    const first32AllZero = decrypted.slice(0x10, 0x40).every(b => b === 0);

    // Look for possible "active" flags at known offsets
    const byte0  = `0x${decrypted[0].toString(16).padStart(2,'0')}`;
    const byte1  = `0x${decrypted[1].toString(16).padStart(2,'0')}`;

    console.log(`=== SLOT ${slot} (flags=0x${flags.toString(16).padStart(8,'0')}, entrySize=0x${entrySize.toString(16)}) ===`);
    console.log(`  first32AllZero: ${first32AllZero}`);
    console.log(`  hasPattern:     ${hasPattern} (at 0x${patternOff.toString(16)})`);
    console.log(`  name:           "${name}"`);
    console.log(`  level:          ${level}`);
    console.log(`  souls:          ${souls}`);
    console.log(`  ngCycle:        ${ngCycle}`);
    console.log(`  bytes[0..1]:    ${byte0} ${byte1}`);
    console.log(`  First 32 bytes: ${hex(decrypted, 0, 32)}`);
    console.log(`  Bytes 0x40-0x60:${hex(decrypted, 0x40, 32)}`);
    console.log('');
  } catch (e) {
    console.log(`=== SLOT ${slot} — ERROR: ${e.message} ===\n`);
  }
}
