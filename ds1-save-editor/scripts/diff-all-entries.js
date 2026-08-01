const fs = require('fs');
const crypto = require('crypto');

const SAVE_FILE    = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2';
const BEFORE_FILE  = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\scripts\\snapshot-all-before.json';

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

const save   = fs.readFileSync(SAVE_FILE);
const before = JSON.parse(fs.readFileSync(BEFORE_FILE));
const count  = save.readUInt32LE(0x0C);

let totalDiffs = 0;

for (let i = 0; i < count; i++) {
  const b = before.entries[i];
  const a = Array.from(decryptEntry(save, i));

  const diffs = [];
  const len = Math.min(b.length, a.length);
  for (let j = 0; j < len; j++) {
    if (b[j] !== a[j]) diffs.push({ off: j, before: b[j], after: a[j] });
  }

  if (diffs.length === 0) {
    console.log(`Entry ${i}: no changes`);
  } else {
    console.log(`\nEntry ${i}: ${diffs.length} byte(s) changed`);
    for (const { off, before: bv, after: av } of diffs) {
      console.log(`  [0x${off.toString(16).padStart(6,'0')}]  0x${bv.toString(16).padStart(2,'0')} → 0x${av.toString(16).padStart(2,'0')}`);
    }
    totalDiffs += diffs.length;
  }
}

console.log(`\nTotal: ${totalDiffs} byte(s) changed across all entries`);
