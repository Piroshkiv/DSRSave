const fs = require('fs');

// Find the base save (before adding Shortsword)
// Assuming character_slot1_raw (9).bin or check file list
const SAVE_DIR = 'C:\\Users\\Iho\\Downloads';

console.log('Checking for base save files...');

// List files
const files = fs.readdirSync(SAVE_DIR).filter(f => f.startsWith('character_slot1_raw'));
console.log('Found files:');
files.forEach(f => console.log(`  ${f}`));

// Try (9).bin as the base
const BASE_FILE = SAVE_DIR + '\\character_slot1_raw (9).bin';

if (!fs.existsSync(BASE_FILE)) {
  console.log(`\n${BASE_FILE} not found!`);
  process.exit(1);
}

console.log(`\nReading ${BASE_FILE}...`);
const data = fs.readFileSync(BASE_FILE);

// Find pattern
const pattern = [
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

function findPattern(data) {
  for (let i = 0; i <= data.length - pattern.length; i++) {
    let found = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      return i;
    }
  }
  return -1;
}

const patternOffset = findPattern(data);

if (patternOffset === -1) {
  console.log('Pattern not found!');
  process.exit(1);
}

console.log(`Pattern offset: 0x${patternOffset.toString(16).toUpperCase()}`);

// Read Counter1 (Pattern + 472)
const counter1Offset = patternOffset + 472;
const counter1 = data[counter1Offset] | (data[counter1Offset + 1] << 8);
console.log(`Counter1 (Pattern + 472): 0x${counter1.toString(16).toUpperCase()} (${counter1})`);

// Read Counter2 (Pattern + 474)
const counter2Offset = patternOffset + 474;
const counter2 = data[counter2Offset] | (data[counter2Offset + 1] << 8);
console.log(`Counter2 (Pattern + 474): 0x${counter2.toString(16).toUpperCase()} (${counter2})`);

// Find all items and get max bytes 0-1
const inventoryStart = patternOffset + 0x9C;
let maxBytes01 = 0;
let maxSlot = -1;

console.log('\n=== Scanning inventory for max Bytes 0-1 ===');
for (let i = 0; i < 256; i++) {
  const offset = inventoryStart + (i * 16);
  const bytes = Array.from(data.slice(offset, offset + 16));

  const isEmpty = bytes.every(b => b === 0x00);
  if (isEmpty) continue;

  const bytes01 = bytes[0] | (bytes[1] << 8);
  if (bytes01 > maxBytes01) {
    maxBytes01 = bytes01;
    maxSlot = i;
  }
}

console.log(`Max Bytes 0-1: ${maxBytes01} (0x${maxBytes01.toString(16).toUpperCase()}) at Slot ${maxSlot}`);
console.log(`Counter1: ${counter1}`);
console.log(`Max Bytes 0-1 + 1 = ${maxBytes01 + 1}`);
console.log(`Does Counter1 match max bytes 0-1 + 1? ${counter1 === maxBytes01 + 1 ? 'YES ✓' : 'NO ✗'}`);

// Check if there's another counter or value that equals maxBytes01 + 1
console.log('\n=== Searching for value ${maxBytes01 + 1} (0x${(maxBytes01 + 1).toString(16).toUpperCase()}) in save ===');
const searchValue = maxBytes01 + 1;
const searchByte0 = searchValue & 0xFF;
const searchByte1 = (searchValue >> 8) & 0xFF;

let found = 0;
for (let i = 0; i < data.length - 1 && found < 5; i++) {
  if (data[i] === searchByte0 && data[i + 1] === searchByte1) {
    console.log(`  Found at offset 0x${i.toString(16).toUpperCase()} (pattern + ${i - patternOffset})`);
    found++;
  }
}
