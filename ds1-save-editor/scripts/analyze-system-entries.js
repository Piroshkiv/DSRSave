const fs = require('fs');
const crypto = require('crypto');

const SAVE_FILE = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2';

const AES_KEY = Buffer.from([
  0xFD, 0x46, 0x4D, 0x69, 0x5E, 0x69, 0xA3, 0x9A,
  0x10, 0xE3, 0x19, 0xA7, 0xAC, 0xE8, 0xB7, 0xFA
]);

const BND4_HEADER_SIZE = 0x40;
const ENTRY_HEADER_SIZE = 0x20;

function hex(buf, from, len) {
  const slice = buf.slice(from, from + len);
  return Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function decryptEntry(save, idx) {
  const view = save;
  const entryOff = BND4_HEADER_SIZE + idx * ENTRY_HEADER_SIZE;
  const entrySize = Number(view.readBigUInt64LE(entryOff + 0x08));
  const dataOff   = view.readUInt32LE(entryOff + 0x10);
  const nameOff   = view.readUInt32LE(entryOff + 0x18);

  // Read entry name (null-terminated ASCII)
  let name = '';
  for (let i = nameOff; i < save.length && save[i] !== 0; i++) name += String.fromCharCode(save[i]);

  const iv            = save.slice(dataOff + 16, dataOff + 32);
  const encSize       = entrySize - 32;
  const encrypted     = save.slice(dataOff + 32, dataOff + 32 + encSize);

  const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
  decipher.setAutoPadding(false);
  const dec = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return { dec, name, entrySize, dataOff };
}

const save = fs.readFileSync(SAVE_FILE);
const entryCount = save.readUInt32LE(0x0C);
console.log(`Entry count: ${entryCount}\n`);

// Dump entries 10 and 11 (system entries)
for (let idx = 10; idx < entryCount; idx++) {
  try {
    const { dec, name, entrySize } = decryptEntry(save, idx);
    console.log(`=== ENTRY ${idx} name="${name}" size=0x${entrySize.toString(16)} decrypted=0x${dec.length.toString(16)} ===`);

    // Print non-zero blocks
    for (let i = 0; i < Math.min(dec.length, 0x400); i += 16) {
      const row = dec.slice(i, i + 16);
      if (row.some(b => b !== 0)) {
        console.log(`  [${i.toString(16).padStart(4,'0')}] ${hex(dec, i, 16)}`);
      }
    }
    console.log('');
  } catch(e) {
    console.log(`Entry ${idx} error: ${e.message}\n`);
  }
}

// Also look at what's right around the first 10 entries - look for a "slot present" table
// DS3 save editors often find this at a fixed location in entry 10
console.log('\n=== Looking for "slot present" pattern in entry 10 ===');
try {
  const { dec } = decryptEntry(save, 10);

  // The slot-active flags are often a sequence of 10 bytes (0x01=active, 0x00=deleted)
  // Look for patterns of 10 bytes where some are 0x01 and some 0x00
  for (let i = 0; i < dec.length - 10; i++) {
    const slice = dec.slice(i, i + 10);
    const ones  = slice.filter(b => b === 0x01).length;
    const zeros = slice.filter(b => b === 0x00).length;
    // We expect: exactly 1 active (slot 0) and a few deleted (slots 1-3)
    // So look for something like: 01 00 00 00 00 00 00 00 00 00
    if (ones === 1 && zeros === 9) {
      if (slice[0] === 0x01) {
        console.log(`  Candidate at 0x${i.toString(16)}: ${hex(dec, i, 10)} ← slot 0 active only`);
      }
    }
    // Or: first 4 are non-zero, rest zero (if slots 0-3 all have data)
    if (slice[0] > 0 && slice[4] === 0 && slice[5] === 0 && slice[6] === 0) {
      if (slice.slice(4).every(b => b === 0)) {
        console.log(`  Candidate4 at 0x${i.toString(16)}: ${hex(dec, i, 10)}`);
      }
    }
  }
} catch(e) {
  console.log('Error:', e.message);
}
