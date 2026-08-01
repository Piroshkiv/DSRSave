'use strict';
const fs   = require('fs');
const path = require('path');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

const j    = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const data = new Uint8Array(fs.readFileSync(SAVE_FILE));

// CRC16-CCITT (from Inventory.ts _calculateItemCRC16)
function crc16(itemId) {
  const bytes = [itemId&0xFF,(itemId>>8)&0xFF,(itemId>>16)&0xFF,(itemId>>24)&0xFF];
  let crc = 0xFFFF;
  for (const b of bytes) {
    crc ^= (b << 8);
    for (let i = 0; i < 8; i++)
      crc = (crc & 0x8000) ? ((crc<<1)^0x1021)&0xFFFF : (crc<<1)&0xFFFF;
  }
  return crc & 0xFFFF;
}

// Build id→name map
const nameMap = new Map();
for (const arr of Object.values(j))
  if (Array.isArray(arr)) for (const it of arr)
    nameMap.set(parseInt(it.Id,16), it.Name);

// GA → inv start
const GA_SMALL=8,GA_LARGE=60,GA_W=0x80000000>>>0,GA_A=0x90000000>>>0;
function u32(b,o){return((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0);}
function gaEnd(d){let off=0x70;for(let i=0;i<6144;i++){if(off+GA_SMALL>d.length)break;const gh=u32(d,off),tp=(gh&0xF0000000)>>>0;if(gh===0)off+=GA_SMALL;else if(tp===GA_W||tp===GA_A)off+=GA_LARGE;else off+=GA_SMALL;}return off;}
const inv=gaEnd(data)+0x13F+0x1DD;

// Check CRC16 hypothesis against existing 0xB0 items
console.log('=== CRC16 check vs actual bytes 14-15 ===');
console.log('Name'.padEnd(45)+'ID'.padEnd(14)+'Actual 14-15'.padEnd(14)+'CRC16'.padEnd(8)+'Match');
console.log('-'.repeat(90));

let matches=0, misses=0;
const ITEM_SIZE=16, REGULAR_SLOTS=1920;
for(let i=0;i<REGULAR_SLOTS;i++){
  const off=inv+i*ITEM_SIZE;
  if(off+ITEM_SIZE>data.length) break;
  if(data[off+3]!==0xB0) continue;
  const raw=u32(data,off+4); if(!raw||raw===0xFFFFFFFF) continue;

  const b14=data[off+14], b15=data[off+15];
  const actual = b14|(b15<<8);
  const calc   = crc16(raw);
  const match  = actual===calc;
  if(match) matches++; else misses++;

  if(misses<=10 || i<50){
    const name=(nameMap.get(raw)||`0x${raw.toString(16).toUpperCase()}`).slice(0,44).padEnd(45);
    const idStr=`0x${raw.toString(16).toUpperCase().padStart(8,'0')}`.padEnd(14);
    const actStr=`${b14.toString(16).toUpperCase().padStart(2,'0')} ${b15.toString(16).toUpperCase().padStart(2,'0')}`.padEnd(14);
    const crcStr=`${(calc&0xFF).toString(16).toUpperCase().padStart(2,'0')} ${(calc>>8&0xFF).toString(16).toUpperCase().padStart(2,'0')}`.padEnd(8);
    console.log(name+idStr+actStr+crcStr+(match?'✓':'✗'));
  }
}
console.log(`\nResult: ${matches} match, ${misses} mismatch out of ${matches+misses} consumables`);
