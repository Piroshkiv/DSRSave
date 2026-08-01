'use strict';
const fs   = require('fs');
const path = require('path');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j    = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const data = new Uint8Array(fs.readFileSync(SAVE_FILE));

const GA_SMALL=8,GA_LARGE=60,GA_W=0x80000000>>>0,GA_A=0x90000000>>>0;
function u32(b,o){return((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0);}
function gaEnd(d){let off=0x70;for(let i=0;i<6144;i++){if(off+GA_SMALL>d.length)break;const gh=u32(d,off),tp=(gh&0xF0000000)>>>0;if(gh===0)off+=GA_SMALL;else if(tp===GA_W||tp===GA_A)off+=GA_LARGE;else off+=GA_SMALL;}return off;}
const inv = gaEnd(data) + 0x13F + 0x1DD;
const ITEM_SIZE=16, REGULAR_SLOTS=1920;

const ammoMap = new Map((j.ammunition_items||[]).map(i=>[parseInt(i.Id,16), i.Name]));

console.log('=== Ammunition items in save (raw 16 bytes) ===\n');
for(let i=0;i<REGULAR_SLOTS;i++){
  const off=inv+i*ITEM_SIZE;
  if(off+ITEM_SIZE>data.length) break;
  if(!data[off+3]) continue;
  const raw=u32(data,off+4);
  if(!ammoMap.has(raw)) continue;

  const bytes = Array.from(data.slice(off, off+ITEM_SIZE))
    .map((b,idx)=>{
      const h = b.toString(16).toUpperCase().padStart(2,'0');
      if(idx===3) return `[${h}]`; // separator
      if(idx>=4&&idx<=7) return `{${h}}`; // item id
      return h;
    }).join(' ');

  console.log(`${ammoMap.get(raw).padEnd(30)} sep=0x${data[off+3].toString(16).toUpperCase()} bytes14-15=${data[off+14].toString(16).toUpperCase().padStart(2,'0')} ${data[off+15].toString(16).toUpperCase().padStart(2,'0')}`);
  console.log(`  ${bytes}`);
}

// Also show what separator ammo items use
console.log('\n=== Ammo separator distribution ===');
const sepMap = {};
for(let i=0;i<REGULAR_SLOTS;i++){
  const off=inv+i*ITEM_SIZE;
  if(off+ITEM_SIZE>data.length) break;
  if(!data[off+3]) continue;
  const raw=u32(data,off+4);
  if(!ammoMap.has(raw)) continue;
  const s=`0x${data[off+3].toString(16).toUpperCase()}`;
  sepMap[s]=(sepMap[s]||0)+1;
}
console.log(sepMap);

// Show bytes14-15 pattern for existing items — look for formula
console.log('\n=== bytes14-15 vs lower16bits of ID (first 30 consumables) ===');
let count=0;
for(let i=0;i<REGULAR_SLOTS&&count<30;i++){
  const off=inv+i*ITEM_SIZE;
  if(off+ITEM_SIZE>data.length) break;
  if(data[off+3]!==0xB0) continue;
  const raw=u32(data,off+4); if(!raw||raw===0xFFFFFFFF) continue;
  const lo16=raw&0xFFFF;
  const b1415=(data[off+14])|(data[off+15]<<8);
  const match=(lo16===b1415)?'✓ lo16':'';
  const name=(j.consumable_items||[]).find(it=>parseInt(it.Id,16)===raw)?.Name||`0x${raw.toString(16).toUpperCase()}`;
  console.log(`  ${name.slice(0,38).padEnd(39)} id_lo16=0x${lo16.toString(16).toUpperCase().padStart(4,'0')}  b14-15=0x${b1415.toString(16).toUpperCase().padStart(4,'0')}  ${match}`);
  count++;
}
