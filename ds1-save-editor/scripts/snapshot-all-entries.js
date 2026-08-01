const fs = require('fs');
const crypto = require('crypto');

const SAVE_FILE = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2';
const OUT_FILE  = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\scripts\\snapshot-all-before.json';

const KEY = Buffer.from([0xFD,0x46,0x4D,0x69,0x5E,0x69,0xA3,0x9A,0x10,0xE3,0x19,0xA7,0xAC,0xE8,0xB7,0xFA]);

function decryptEntry(save, idx) {
  const off = 0x40 + idx * 0x20;
  const sz  = Number(save.readBigUInt64LE(off + 8));
  const do_ = save.readUInt32LE(off + 0x10);
  const iv  = save.slice(do_ + 16, do_ + 32);
  const enc = save.slice(do_ + 32, do_ + 32 + sz - 32);
  const d = crypto.createDecipheriv('aes-128-cbc', KEY, iv);
  d.setAutoPadding(false);
  return Buffer.concat([d.update(enc), d.final()]);
}

const save = fs.readFileSync(SAVE_FILE);
const count = save.readUInt32LE(0x0C);
console.log(`Entries: ${count}  File: ${save.length} bytes`);

const snapshot = { note: 'before deleting 2 new characters', entries: {} };

for (let i = 0; i < count; i++) {
  const dec = decryptEntry(save, i);
  snapshot.entries[i] = Array.from(dec);
  console.log(`  Entry ${i}: ${dec.length} bytes saved`);
}

fs.writeFileSync(OUT_FILE, JSON.stringify(snapshot));
console.log(`\nSnapshot saved → ${OUT_FILE}`);
console.log('Now delete the 2 new characters, then run diff-all-entries.js');
