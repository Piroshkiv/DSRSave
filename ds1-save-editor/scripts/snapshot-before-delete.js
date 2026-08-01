const fs = require('fs');
const crypto = require('crypto');

const SAVE_FILE = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2';
const OUT_FILE  = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\scripts\\slot-snapshot-before.json';

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

const save = fs.readFileSync(SAVE_FILE);

const entry10 = decryptEntry(save, 10);
const slot0   = decryptEntry(save, 0);

const snapshot = {
  note: 'before deleting slot 0 (real character)',
  entry10_0x000_to_0x1ff: Array.from(entry10.slice(0, 0x200)),
  slot0_0x000_to_0x1ff:   Array.from(slot0.slice(0, 0x200)),
};

fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2));
console.log(`Snapshot saved to ${OUT_FILE}`);
console.log('Now delete your real character in-game, then run compare-after-delete.js');
