'use strict';
const fs   = require('fs');
const path = require('path');

const ORIG = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const NEW  = 'C:\\Users\\Iho\\Downloads\\character_slot2_all_items.bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j    = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const ammoMap = new Map((j.ammunition_items||[]).map(i=>[parseInt(i.Id,16), i.Name]));

const GA_SMALL=8,GA_LARGE=60,GA_W=0x80000000>>>0,GA_A=0x90000000>>>0;
function u32(b,o){return((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0);}
function gaEnd(d){let off=0x70;for(let i=0;i<6144;i++){if(off+GA_SMALL>d.length)break;const gh=u32(d,off),tp=(gh&0xF0000000)>>>0;if(gh===0)off+=GA_SMALL;else if(tp===GA_W||tp===GA_A)off+=GA_LARGE;else off+=GA_SMALL;}return off;}

function scanAmmo(data, label) {
  const inv = gaEnd(data) + 0x13F + 0x1DD;
  const ITEM_SIZE=16, SLOTS=1920;
  const results = [];
  for(let i=0;i<SLOTS;i++){
    const off=inv+i*ITEM_SIZE;
    if(off+ITEM_SIZE>data.length) break;
    if(!data[off+3]) continue;
    const raw=u32(data,off+4);
    if(ammoMap.has(raw)) results.push({ name: ammoMap.get(raw), sep: data[off+3], raw });
  }
  console.log(`\n=== ${label} — ammo found: ${results.length}/19 ===`);
  results.forEach(r=>console.log(`  ${r.name.padEnd(35)} sep=0x${r.sep.toString(16).toUpperCase()} ${r.sep===0x80?'✓ weapon':'✗ CONSUMABLE'}`));
  const wrong = results.filter(r=>r.sep!==0x80);
  if(wrong.length) console.log(`  !! ${wrong.length} items have WRONG separator (0xB0)!`);
}

scanAmmo(new Uint8Array(fs.readFileSync(ORIG)), 'ORIGINAL');
scanAmmo(new Uint8Array(fs.readFileSync(NEW)),  'NEW (after script)');
