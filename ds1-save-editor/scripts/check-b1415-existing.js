'use strict';
const fs = require('fs');
const path = require('path');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const nameMap = new Map();
for (const arr of Object.values(j)) if (Array.isArray(arr)) for (const it of arr)
  nameMap.set(parseInt(it.Id, 16), it.Name);

const GA_SMALL=8,GA_LARGE=60,GA_W=0x80000000>>>0,GA_A=0x90000000>>>0;
function u32(b,o){return((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0);}
function gaEnd(d){let off=0x70;for(let i=0;i<6144;i++){if(off+GA_SMALL>d.length)break;const gh=u32(d,off),tp=(gh&0xF0000000)>>>0;if(gh===0)off+=GA_SMALL;else if(tp===GA_W||tp===GA_A)off+=GA_LARGE;else off+=GA_SMALL;}return off;}

const data = new Uint8Array(fs.readFileSync(SAVE_FILE));
const inv = gaEnd(data) + 0x13F + 0x1DD;

// Check what bytes 14-15 existing consumables (0xB0) use
const b1415dist = new Map();
let total = 0;
for (let i = 0; i < 1920; i++) {
  const off = inv + i * 16;
  if (off + 16 > data.length) break;
  if (data[off+3] !== 0xB0) continue;
  const id = u32(data, off+4);
  if (!id || id === 0xFFFFFFFF) continue;
  const key = data[off+14].toString(16).toUpperCase().padStart(2,'0') + ' ' + data[off+15].toString(16).toUpperCase().padStart(2,'0');
  b1415dist.set(key, (b1415dist.get(key)||0)+1);
  total++;
}

console.log('=== bytes 14-15 distribution across existing consumables (0xB0) ===');
for (const [k,v] of [...b1415dist.entries()].sort((a,b)=>b[1]-a[1]))
  console.log(`  ${k}  ×${v}`);
console.log(`Total 0xB0 items: ${total}`);
