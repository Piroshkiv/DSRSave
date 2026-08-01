'use strict';
const fs   = require('fs');
const path = require('path');

// Compare ORIGINAL save vs newly written save to see bytes 14-15 differences
const ORIG_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const NEW_FILE  = 'C:\\Users\\Iho\\Downloads\\character_slot2_all_items.bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j      = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const orig   = new Uint8Array(fs.readFileSync(ORIG_FILE));
const newSave = new Uint8Array(fs.readFileSync(NEW_FILE));

const GA_SMALL=8,GA_LARGE=60,GA_W=0x80000000>>>0,GA_A=0x90000000>>>0;
function u32(b,o){return((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0);}
function gaEnd(d){
  let off=0x70;
  for(let i=0;i<6144;i++){
    if(off+GA_SMALL>d.length)break;
    const gh=u32(d,off),tp=(gh&0xF0000000)>>>0;
    if(gh===0)off+=GA_SMALL;else if(tp===GA_W||tp===GA_A)off+=GA_LARGE;else off+=GA_SMALL;
  }
  return off;
}

const inv = gaEnd(orig) + 0x13F + 0x1DD;
const ITEM_SIZE=16, REGULAR_SLOTS=1920;

// Build item name lookup
const nameMap = new Map();
for (const arr of Object.values(j)) {
  if (!Array.isArray(arr)) continue;
  for (const item of arr) nameMap.set(parseInt(item.Id,16), item.Name);
}

// --- Show bytes 14-15 for EXISTING 0xB0 consumables (first 20) ---
console.log('=== Existing consumable items (0xB0) - bytes 14-15 ===');
let shown = 0;
for(let i=0;i<REGULAR_SLOTS && shown<20;i++){
  const off=inv+i*ITEM_SIZE;
  if(off+ITEM_SIZE>orig.length) break;
  if(orig[off+3]!==0xB0) continue;
  const raw=u32(orig,off+4); if(!raw||raw===0xFFFFFFFF) continue;
  const b14=orig[off+14].toString(16).toUpperCase().padStart(2,'0');
  const b15=orig[off+15].toString(16).toUpperCase().padStart(2,'0');
  const name=nameMap.get(raw)||`0x${raw.toString(16).toUpperCase().padStart(8,'0')}`;
  console.log(`  ${name.padEnd(45)} bytes14-15: ${b14} ${b15}`);
  shown++;
}

// --- Show bytes 14-15 for NEWLY ADDED items (items in new save but not orig) ---
console.log('\n=== Newly added items - bytes 14-15 ===');
shown = 0;
for(let i=0;i<REGULAR_SLOTS && shown<30;i++){
  const off=inv+i*ITEM_SIZE;
  if(off+ITEM_SIZE>newSave.length) break;
  if(newSave[off+3]===0 || orig[off+3]!==0) continue; // slot empty in orig = newly added
  const raw=u32(newSave,off+4); if(!raw||raw===0xFFFFFFFF) continue;
  const b14=newSave[off+14].toString(16).toUpperCase().padStart(2,'0');
  const b15=newSave[off+15].toString(16).toUpperCase().padStart(2,'0');
  const name=nameMap.get(raw)||`0x${raw.toString(16).toUpperCase().padStart(8,'0')}`;
  const sep=newSave[off+3].toString(16).toUpperCase();
  console.log(`  [sep=0x${sep}] ${name.padEnd(45)} bytes14-15: ${b14} ${b15}`);
  shown++;
}
