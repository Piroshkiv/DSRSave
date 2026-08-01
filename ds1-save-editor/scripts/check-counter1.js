const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (8).bin';

console.log('Reading DS3 save file...');
const data = fs.readFileSync(SAVE_FILE);

// Find the pattern
const pattern = [
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

// Find all occurrences of the pattern
const patternOffsets = [];
for (let i = 0; i <= data.length - pattern.length; i++) {
  let found = true;
  for (let j = 0; j < pattern.length; j++) {
    if (data[i + j] !== pattern[j]) {
      found = false;
      break;
    }
  }
  if (found) {
    patternOffsets.push(i);
  }
}

if (patternOffsets.length === 0) {
  console.log('Pattern not found!');
  console.log(`File size: ${data.length} bytes`);
  // Try to find partial pattern
  console.log('\nSearching for FF FF FF FF 00 00 00 00...');
  const partialPattern = [0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00];
  let count = 0;
  for (let i = 0; i <= data.length - partialPattern.length && count < 5; i++) {
    let found = true;
    for (let j = 0; j < partialPattern.length; j++) {
      if (data[i + j] !== partialPattern[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      console.log(`  Found at 0x${i.toString(16).toUpperCase()}`);
      count++;
    }
  }
  process.exit(1);
}

console.log(`Found ${patternOffsets.length} pattern occurrence(s)`);
patternOffsets.forEach((offset, index) => {
  console.log(`  [${index}] 0x${offset.toString(16).toUpperCase()}`);
});

// Use the first pattern (or you can choose a specific one)
const patternOffset = patternOffsets[0];

console.log(`\nPattern found at offset: 0x${patternOffset.toString(16).toUpperCase()}`);

// Read Counter1 (Pattern + 472)
const counter1Offset = patternOffset + 472;
const counter1 = data[counter1Offset] | (data[counter1Offset + 1] << 8);
console.log(`Counter1 (Pattern + 472): 0x${counter1.toString(16).toUpperCase()} (${counter1})`);

// Read Counter2 (Pattern + 474)
const counter2Offset = patternOffset + 474;
const counter2 = data[counter2Offset] | (data[counter2Offset + 1] << 8);
console.log(`Counter2 (Pattern + 474): 0x${counter2.toString(16).toUpperCase()} (${counter2})`);

// Read inventory start (Pattern + 0x9C = Pattern + 156)
const inventoryStart = patternOffset + 0x9C;
console.log(`\nInventory starts at: 0x${inventoryStart.toString(16).toUpperCase()}`);

// Read first 10 non-empty weapon items
console.log('\n=== First 10 Weapons ===');
let weaponCount = 0;
for (let i = 0; i < 256 && weaponCount < 10; i++) {
  const itemOffset = inventoryStart + (i * 16);

  // Read all 16 bytes
  const bytes = Array.from(data.slice(itemOffset, itemOffset + 16));

  // Check if not empty
  const isEmpty = bytes.every(b => b === 0x00);
  if (isEmpty) continue;

  // Check if weapon (separator 0x80)
  const separator = bytes[2];
  if (separator !== 0x80) continue;

  weaponCount++;

  const bytes01 = bytes[0] | (bytes[1] << 8);
  const itemId = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  const byte12 = bytes[12];
  const bytes1415 = bytes[14] | (bytes[15] << 8);

  console.log(`\n[Weapon ${weaponCount}] Slot ${i}`);
  console.log(`  Bytes 0-1: 0x${bytes01.toString(16).toUpperCase().padStart(4, '0')}`);
  console.log(`  Item ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
  console.log(`  Byte 12: 0x${byte12.toString(16).toUpperCase().padStart(2, '0')}`);
  console.log(`  Bytes 14-15: 0x${bytes1415.toString(16).toUpperCase().padStart(4, '0')}`);
  console.log(`  Full: ${bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
}

// Count total non-empty items
let totalItems = 0;
let lastNonEmptyBytes01 = 0;
let lastNonEmptySlot = -1;
for (let i = 0; i < 256; i++) {
  const itemOffset = inventoryStart + (i * 16);
  const bytes = Array.from(data.slice(itemOffset, itemOffset + 16));
  const isEmpty = bytes.every(b => b === 0x00);
  if (!isEmpty) {
    totalItems++;
    lastNonEmptyBytes01 = bytes[0] | (bytes[1] << 8);
    lastNonEmptySlot = i;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Total non-empty items: ${totalItems}`);
console.log(`Last non-empty item at slot ${lastNonEmptySlot}, bytes 0-1: 0x${lastNonEmptyBytes01.toString(16).toUpperCase()}`);
console.log(`Counter1: 0x${counter1.toString(16).toUpperCase()} (${counter1})`);
console.log(`Counter2: 0x${counter2.toString(16).toUpperCase()} (${counter2})`);
console.log(`\nDoes Counter1 match last item + 1? ${counter1 === lastNonEmptyBytes01 + 1 ? 'YES ✓' : 'NO ✗'}`);
