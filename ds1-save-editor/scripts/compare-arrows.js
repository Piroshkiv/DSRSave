'use strict';
const fs = require('fs');
const path = require('path');

const WRONG   = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (16).bin';
const CORRECT = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const ammoIds = new Set((j.ammunition_items||[]).map(i=>parseInt(i.Id,16)));
const ammoMap = new Map((j.ammunition_items||[]).map(i=>[parseInt(i.Id,16), i.Name]));

const GA_SMALL=8,GA_LARGE=60,GA_W=0x80000000>>>0,GA_A=0x90000000>>>0;
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

function scanAll(data, label) {
  const inv = gaEnd(data) + 0x13F + 0x1DD;
  console.log(`\n=== ${label} ===`);
  console.log(`inv start: 0x${inv.toString(16).toUpperCase()}`);

  // Find ammo by ID in regular slots
  const found = [];
  for (let i = 0; i < 1920; i++) {
    const off = inv + i*16;
    if (off+16 > data.length) break;
    if (!data[off+3]) continue;
    const id = u32(data, off+4);
    if (ammoIds.has(id)) {
      found.push({ slot: i, off, id, sep: data[off+3], bytes: Array.from(data.slice(off, off+16)) });
    }
  }
  console.log(`Ammo found in regular slots: ${found.length}`);
  found.forEach(e => {
    const hex = e.bytes.map((b,i)=>{
      const h = b.toString(16).toUpperCase().padStart(2,'0');
      if(i===3) return `[${h}]`;
      if(i>=4&&i<=7) return `{${h}}`;
      return h;
    }).join(' ');
    console.log(`  slot=${e.slot} sep=0x${e.sep.toString(16).toUpperCase()} ${(ammoMap.get(e.id)||'?').padEnd(30)} ${hex}`);
  });

  // Also check GA table for ammo entries
  console.log(`\nAmmo GA entries (0x80000000 range in weapon slots):`);
  let gaOff = 0x70, gaCount = 0;
  for (let i = 0; i < 6144; i++) {
    if (gaOff + GA_SMALL > data.length) break;
    const gh = u32(data, gaOff);
    const tp = (gh & 0xF0000000) >>> 0;
    if (gh === 0) { gaOff += GA_SMALL; continue; }
    if (tp === GA_W) {
      // Large 60-byte entry — check if it's ammo
      const itemId = u32(data, gaOff+4);
      if (ammoIds.has(itemId)) {
        const qty = u32(data, gaOff+8);
        console.log(`  GA[${i}] off=0x${gaOff.toString(16).toUpperCase()} id=0x${itemId.toString(16).toUpperCase()} qty=${qty}  ${ammoMap.get(itemId)||'?'}`);
        gaCount++;
      }
      gaOff += GA_LARGE;
    } else if (tp === GA_A) {
      gaOff += GA_LARGE;
    } else {
      gaOff += GA_SMALL;
    }
  }
  if (gaCount === 0) console.log('  (none)');
}

scanAll(new Uint8Array(fs.readFileSync(WRONG)),   'WRONG  (slot1)');
scanAll(new Uint8Array(fs.readFileSync(CORRECT)), 'CORRECT (slot2)');
