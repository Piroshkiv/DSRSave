'use strict';
const fs   = require('fs');
const path = require('path');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j    = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const data = new Uint8Array(fs.readFileSync(SAVE_FILE));

const GA_SMALL=8, GA_LARGE=60, GA_W=0x80000000>>>0, GA_A=0x90000000>>>0;
function u32(b,o){return((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0);}
function gaEnd(d){
  let off=0x70;
  for(let i=0;i<6144;i++){
    if(off+GA_SMALL>d.length)break;
    const gh=u32(d,off),tp=(gh&0xF0000000)>>>0;
    if(gh===0)off+=GA_SMALL;
    else if(tp===GA_W||tp===GA_A)off+=GA_LARGE;
    else off+=GA_SMALL;
  }
  return off;
}

const inv = gaEnd(data) + 0x13F + 0x1DD;
const ITEM_SIZE=16, REGULAR_SLOTS=1920;

// Build ammo ID set
const ammoMap = new Map((j.ammunition_items||[]).map(i=>[parseInt(i.Id,16), i.Name]));

// Scan inventory
const sepCounts = {};
let ammoFound = 0;
const ammoFoundNames = [];

for(let i=0;i<REGULAR_SLOTS;i++){
  const off=inv+i*ITEM_SIZE;
  if(off+ITEM_SIZE>data.length) break;
  const sep=data[off+3]; if(!sep) continue;
  const raw=u32(data,off+4); if(!raw||raw===0xFFFFFFFF) continue;
  sepCounts[`0x${sep.toString(16).toUpperCase()}`]=(sepCounts[`0x${sep.toString(16).toUpperCase()}`]||0)+1;
  if(ammoMap.has(raw)){ ammoFound++; ammoFoundNames.push(ammoMap.get(raw)); }
}

console.log('Separator counts in inventory:', sepCounts);
console.log(`\nAmmo found in save: ${ammoFound} / ${ammoMap.size} total in JSON`);

// Show ammo NOT found
const missing = [...ammoMap.entries()].filter(([id])=>{
  for(let i=0;i<REGULAR_SLOTS;i++){
    const off=inv+i*ITEM_SIZE;
    if(off+ITEM_SIZE>data.length) break;
    if(data[off+3]===0) continue;
    if(u32(data,off+4)===id) return false;
  }
  return true;
});
console.log(`\nAmmo missing from save (${missing.length}):`);
missing.forEach(([id,name])=>console.log(`  ${name.padEnd(40)} 0x${id.toString(16).toUpperCase().padStart(8,'0')}`));
