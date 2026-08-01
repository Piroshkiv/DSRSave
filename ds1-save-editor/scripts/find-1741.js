const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (11).bin'; // Manual

console.log('Reading save file...');
const data = fs.readFileSync(SAVE_FILE);

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
const inventoryStart = patternOffset + 0x9C;

console.log(`Pattern offset: 0x${patternOffset.toString(16).toUpperCase()}`);
console.log(`Inventory start: 0x${inventoryStart.toString(16).toUpperCase()}`);

// Find all items with bytes 0-1 close to 1741
const target = 1741;
console.log(`\n=== Looking for items with Bytes 0-1 near ${target} (0x${target.toString(16).toUpperCase()}) ===`);

for (let i = 0; i < 256; i++) {
  const offset = inventoryStart + (i * 16);
  const bytes = Array.from(data.slice(offset, offset + 16));

  const isEmpty = bytes.every(b => b === 0x00);
  if (isEmpty) continue;

  const bytes01 = bytes[0] | (bytes[1] << 8);

  if (Math.abs(bytes01 - target) <= 10) {
    const itemId = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const byte12 = bytes[12];

    console.log(`\nSlot ${i}: Bytes 0-1 = 0x${bytes01.toString(16).toUpperCase()} (${bytes01})`);
    console.log(`  Item ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`  Byte 12: ${byte12}`);
    console.log(`  Full: ${bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
  }
}

// Find the last non-empty item before Slot 26
console.log('\n=== Last 5 non-empty items before Slot 26 ===');
const itemsBefore = [];
for (let i = 25; i >= 0; i--) {
  const offset = inventoryStart + (i * 16);
  const bytes = Array.from(data.slice(offset, offset + 16));

  const isEmpty = bytes.every(b => b === 0x00);
  if (!isEmpty) {
    const bytes01 = bytes[0] | (bytes[1] << 8);
    const byte12 = bytes[12];
    const itemId = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);

    itemsBefore.push({ slot: i, bytes01, byte12, itemId });

    if (itemsBefore.length >= 5) break;
  }
}

itemsBefore.forEach((item, idx) => {
  console.log(`\n${idx + 1}. Slot ${item.slot}:`);
  console.log(`   Bytes 0-1: 0x${item.bytes01.toString(16).toUpperCase()} (${item.bytes01})`);
  console.log(`   Byte 12: ${item.byte12}`);
  console.log(`   Item ID: 0x${item.itemId.toString(16).toUpperCase().padStart(8, '0')}`);
});

// Check if 1741 might be coming from last item bytes 0-1
if (itemsBefore.length > 0) {
  const lastItem = itemsBefore[0];
  console.log(`\n=== Analysis ===`);
  console.log(`Last item before Slot 26 (Slot ${lastItem.slot}):`);
  console.log(`  Bytes 0-1: ${lastItem.bytes01}`);
  console.log(`  New item Bytes 0-1: ${target}`);
  console.log(`  Difference: ${target - lastItem.bytes01}`);
  console.log(`  Is it +1? ${target === lastItem.bytes01 + 1 ? 'YES ✓' : 'NO ✗'}`);
}
