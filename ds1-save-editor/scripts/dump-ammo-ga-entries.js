'use strict';
const fs = require('fs');
const path = require('path');

const CORRECT = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const ammoMap = new Map((j.ammunition_items||[]).map(i=>[parseInt(i.Id,16), i.Name]));

const data = new Uint8Array(fs.readFileSync(CORRECT));
const GA_SMALL=8,GA_LARGE=60,GA_W=0x80000000>>>0,GA_A=0x90000000>>>0;
function u32(b,o){return((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0);}

let off = 0x70, idx = 0;
console.log('=== Ammo GA entries (60 bytes each) ===\n');
while (off + GA_SMALL <= data.length && idx < 6144) {
  const gh = u32(data, off), tp = (gh & 0xF0000000)>>>0;
  if (gh === 0) { off += GA_SMALL; idx++; continue; }
  if (tp === GA_W) {
    const itemId = u32(data, off+4);
    if (ammoMap.has(itemId)) {
      const bytes = Array.from(data.slice(off, off+GA_LARGE)).map(b=>b.toString(16).toUpperCase().padStart(2,'0'));
      console.log(`GA[${idx}] off=0x${off.toString(16).toUpperCase()} ${ammoMap.get(itemId)}`);
      for (let i = 0; i < 60; i += 8)
        console.log(`  [${i.toString().padStart(2)}] ${bytes.slice(i, i+8).join(' ')}`);
      console.log('');
    }
    off += GA_LARGE; idx++;
  } else if (tp === GA_A) {
    off += GA_LARGE; idx++;
  } else {
    off += GA_SMALL; idx++;
  }
}
