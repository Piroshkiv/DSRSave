'use strict';
const fs = require('fs');
const path = require('path');

const ORIG = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const NEW  = 'C:\\Users\\Iho\\Downloads\\character_slot2_all_items.bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const nameMap = new Map();
for (const arr of Object.values(j)) if (Array.isArray(arr)) for (const it of arr)
  nameMap.set(parseInt(it.Id, 16), it.Name);

const GA_SMALL=8,GA_LARGE=60,GA_W=0x80000000>>>0,GA_A=0x90000000>>>0;
function u32(b,o){return((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0);}
function gaEnd(d){let off=0x70;for(let i=0;i<6144;i++){if(off+GA_SMALL>d.length)break;const gh=u32(d,off),tp=(gh&0xF0000000)>>>0;if(gh===0)off+=GA_SMALL;else if(tp===GA_W||tp===GA_A)off+=GA_LARGE;else off+=GA_SMALL;}return off;}

function getItems(data) {
  const inv = gaEnd(data) + 0x13F + 0x1DD;
  const map = new Map();
  for (let i = 0; i < 1920; i++) {
    const off = inv + i * 16;
    if (off + 16 > data.length) break;
    if (!data[off+3]) continue;
    const id = u32(data, off+4);
    if (!id || id === 0xFFFFFFFF) continue;
    map.set(id, { sep: data[off+3], b14: data[off+14], b15: data[off+15] });
  }
  return map;
}

const orig  = getItems(new Uint8Array(fs.readFileSync(ORIG)));
const newer = getItems(new Uint8Array(fs.readFileSync(NEW)));

console.log('=== Items in NEW but not in ORIG ===');
let count = 0;
const genericItems = [];
for (const [id, v] of newer) {
  if (!orig.has(id)) {
    const name = nameMap.get(id) || ('0x' + id.toString(16).toUpperCase());
    const b1415 = v.b14.toString(16).toUpperCase().padStart(2,'0') + ' ' + v.b15.toString(16).toUpperCase().padStart(2,'0');
    const isGeneric = v.b14 === 0xCF && v.b15 === 0x1F;
    const marker = isGeneric ? ' <-- generic CF 1F' : '';
    console.log(`  sep=0x${v.sep.toString(16).toUpperCase()} b14-15=${b1415}${marker}  ${name}`);
    if (isGeneric) genericItems.push(name);
    count++;
  }
}
console.log(`\nTotal added: ${count}`);
console.log(`Items with generic CF 1F bytes: ${genericItems.length}`);
