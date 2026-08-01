const fs = require('fs');
const crypto = require('crypto');

const AES_KEY = Buffer.from([0xFD,0x46,0x4D,0x69,0x5E,0x69,0xA3,0x9A,0x10,0xE3,0x19,0xA7,0xAC,0xE8,0xB7,0xFA]);
const PATTERN = Buffer.from([0xFF,0xFF,0xFF,0xFF,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xFF,0xFF,0xFF,0xFF,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]);
const VALID_SEP = new Set([0x00,0x80,0x90,0xA0,0xB0]);
const ITEM_SEP  = new Set([0x80,0x90,0xA0,0xB0]);

const save = fs.readFileSync('C:/Users/Iho/AppData/Roaming/DarkSoulsIII/0110000131bf8025/DS30000.sl2');
const hdr = 0x40;
const entrySize = Number(save.readBigUInt64LE(hdr + 8));
const dataOff   = save.readUInt32LE(hdr + 0x10);
const iv  = save.slice(dataOff + 16, dataOff + 32);
const enc = save.slice(dataOff + 32, dataOff + 32 + entrySize - 32);
const dec = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
dec.setAutoPadding(false);
const data = Buffer.concat([dec.update(enc), dec.final()]);

// find ALL pattern matches
const matches = [];
for (let i = 0; i <= data.length - PATTERN.length; i++) {
  let ok = true;
  for (let j = 0; j < PATTERN.length; j++) {
    if (data[i+j] !== PATTERN[j]) { ok = false; break; }
  }
  if (ok) matches.push(i);
}
console.log('All pattern matches (slot 0):', matches.map(x => '0x' + x.toString(16)));

// For each match, dump 30 slots from match+0x09C and count non-empty items
for (const m of matches) {
  const start = m + 0x09C;
  let nonEmpty = 0, valid = 0;
  for (let i = 0; i < 300; i++) {
    const off = start + i * 16;
    if (off + 16 > data.length) break;
    const sep = data[off + 3];
    if (!VALID_SEP.has(sep)) break;
    valid++;
    if (ITEM_SEP.has(sep)) nonEmpty++;
  }
  console.log('\n=== Pattern at 0x' + m.toString(16) + ', +0x09C → 0x' + start.toString(16) +
              ' | valid slots: ' + valid + ', non-empty items: ' + nonEmpty);

  // dump first 15 slots
  for (let i = 0; i < 15; i++) {
    const off = start + i * 16;
    if (off + 16 > data.length) break;
    const bytes = Array.from(data.slice(off, off + 16)).map(b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
    const sep   = data[off + 3];
    const id    = data.readUInt32LE(off + 4).toString(16).toUpperCase().padStart(8,'0');
    const qty   = data.readUInt32LE(off + 8);
    const mark  = ITEM_SEP.has(sep) ? ' <-- ITEM' : '';
    const inv   = !VALID_SEP.has(sep) ? ' <-- INVALID' : '';
    console.log('  [' + i + '] ' + bytes + '  sep=0x' + sep.toString(16).padStart(2,'0') + '  id=0x' + id + '  qty=' + qty + mark + inv);
  }
}
