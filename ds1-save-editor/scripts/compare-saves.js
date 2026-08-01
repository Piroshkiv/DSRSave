const fs = require('fs');

const SAVE_FILE_1 = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (10).bin'; // Save editor
const SAVE_FILE_2 = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (11).bin'; // Manual

console.log('Reading save files...');
const data1 = fs.readFileSync(SAVE_FILE_1);
const data2 = fs.readFileSync(SAVE_FILE_2);

console.log(`File 1 size: ${data1.length} bytes`);
console.log(`File 2 size: ${data2.length} bytes`);

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

const patternOffset1 = findPattern(data1);
const patternOffset2 = findPattern(data2);

if (patternOffset1 === -1 || patternOffset2 === -1) {
  console.log('Pattern not found in one or both files!');
  process.exit(1);
}

console.log(`\nPattern offset 1: 0x${patternOffset1.toString(16).toUpperCase()}`);
console.log(`Pattern offset 2: 0x${patternOffset2.toString(16).toUpperCase()}`);

// Read Counter1 and Counter2
const counter1Offset1 = patternOffset1 + 472;
const counter1_1 = data1[counter1Offset1] | (data1[counter1Offset1 + 1] << 8);
const counter2Offset1 = patternOffset1 + 474;
const counter2_1 = data1[counter2Offset1] | (data1[counter2Offset1 + 1] << 8);

const counter1Offset2 = patternOffset2 + 472;
const counter1_2 = data2[counter1Offset2] | (data2[counter1Offset2 + 1] << 8);
const counter2Offset2 = patternOffset2 + 474;
const counter2_2 = data2[counter2Offset2] | (data2[counter2Offset2 + 1] << 8);

console.log(`\nFile 1 Counter1: 0x${counter1_1.toString(16).toUpperCase()} (${counter1_1})`);
console.log(`File 1 Counter2: 0x${counter2_1.toString(16).toUpperCase()} (${counter2_1})`);
console.log(`File 2 Counter1: 0x${counter1_2.toString(16).toUpperCase()} (${counter1_2})`);
console.log(`File 2 Counter2: 0x${counter2_2.toString(16).toUpperCase()} (${counter2_2})`);

// Read inventory
const inventoryStart1 = patternOffset1 + 0x9C;
const inventoryStart2 = patternOffset2 + 0x9C;

console.log(`\nInventory start 1: 0x${inventoryStart1.toString(16).toUpperCase()}`);
console.log(`Inventory start 2: 0x${inventoryStart2.toString(16).toUpperCase()}`);

// Compare inventories
console.log('\n=== Comparing Inventories ===');

// Find all non-empty items in both inventories
const items1 = [];
const items2 = [];

for (let i = 0; i < 256; i++) {
  const offset1 = inventoryStart1 + (i * 16);
  const offset2 = inventoryStart2 + (i * 16);

  const bytes1 = Array.from(data1.slice(offset1, offset1 + 16));
  const bytes2 = Array.from(data2.slice(offset2, offset2 + 16));

  const isEmpty1 = bytes1.every(b => b === 0x00);
  const isEmpty2 = bytes2.every(b => b === 0x00);

  if (!isEmpty1) {
    items1.push({ slot: i, bytes: bytes1 });
  }
  if (!isEmpty2) {
    items2.push({ slot: i, bytes: bytes2 });
  }
}

console.log(`File 1 has ${items1.length} items`);
console.log(`File 2 has ${items2.length} items`);

// Find differences
const differences = [];

for (let i = 0; i < 256; i++) {
  const offset1 = inventoryStart1 + (i * 16);
  const offset2 = inventoryStart2 + (i * 16);

  const bytes1 = Array.from(data1.slice(offset1, offset1 + 16));
  const bytes2 = Array.from(data2.slice(offset2, offset2 + 16));

  const isEmpty1 = bytes1.every(b => b === 0x00);
  const isEmpty2 = bytes2.every(b => b === 0x00);

  if (isEmpty1 !== isEmpty2 || !bytes1.every((b, idx) => b === bytes2[idx])) {
    differences.push({
      slot: i,
      bytes1,
      bytes2,
      isEmpty1,
      isEmpty2
    });
  }
}

console.log(`\nFound ${differences.length} differences`);

// Show first 10 differences
console.log('\n=== First 10 Differences ===');
differences.slice(0, 10).forEach(diff => {
  console.log(`\n[Slot ${diff.slot}]`);

  if (diff.isEmpty1 && !diff.isEmpty2) {
    console.log('  File 1: EMPTY');
    console.log(`  File 2: ${diff.bytes2.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

    const itemId2 = diff.bytes2[4] | (diff.bytes2[5] << 8) | (diff.bytes2[6] << 16) | (diff.bytes2[7] << 24);
    const bytes01_2 = diff.bytes2[0] | (diff.bytes2[1] << 8);
    const byte12_2 = diff.bytes2[12];
    const bytes1415_2 = diff.bytes2[14] | (diff.bytes2[15] << 8);

    console.log(`    Item ID: 0x${itemId2.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`    Bytes 0-1: 0x${bytes01_2.toString(16).toUpperCase().padStart(4, '0')}`);
    console.log(`    Byte 12: 0x${byte12_2.toString(16).toUpperCase().padStart(2, '0')}`);
    console.log(`    Bytes 14-15: 0x${bytes1415_2.toString(16).toUpperCase().padStart(4, '0')}`);
  } else if (!diff.isEmpty1 && diff.isEmpty2) {
    console.log(`  File 1: ${diff.bytes1.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    console.log('  File 2: EMPTY');

    const itemId1 = diff.bytes1[4] | (diff.bytes1[5] << 8) | (diff.bytes1[6] << 16) | (diff.bytes1[7] << 24);
    const bytes01_1 = diff.bytes1[0] | (diff.bytes1[1] << 8);
    const byte12_1 = diff.bytes1[12];
    const bytes1415_1 = diff.bytes1[14] | (diff.bytes1[15] << 8);

    console.log(`    Item ID: 0x${itemId1.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`    Bytes 0-1: 0x${bytes01_1.toString(16).toUpperCase().padStart(4, '0')}`);
    console.log(`    Byte 12: 0x${byte12_1.toString(16).toUpperCase().padStart(2, '0')}`);
    console.log(`    Bytes 14-15: 0x${bytes1415_1.toString(16).toUpperCase().padStart(4, '0')}`);
  } else {
    console.log(`  File 1: ${diff.bytes1.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    console.log(`  File 2: ${diff.bytes2.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

    // Highlight differences
    const diffs = [];
    for (let i = 0; i < 16; i++) {
      if (diff.bytes1[i] !== diff.bytes2[i]) {
        diffs.push(`Byte ${i}: 0x${diff.bytes1[i].toString(16).toUpperCase()} -> 0x${diff.bytes2[i].toString(16).toUpperCase()}`);
      }
    }
    console.log(`    Differences: ${diffs.join(', ')}`);
  }
});

// Look for Shortsword specifically (ID 0x00F42400)
console.log('\n=== Looking for Shortsword (Base ID 0x00F42400) ===');

const shortswords1 = [];
const shortswords2 = [];

for (const item of items1) {
  const itemId = item.bytes[4] | (item.bytes[5] << 8) | (item.bytes[6] << 16) | (item.bytes[7] << 24);
  const baseId = itemId & 0xFFFFFF00;
  if (baseId === 0x00F42400) {
    shortswords1.push({ slot: item.slot, bytes: item.bytes, itemId });
  }
}

for (const item of items2) {
  const itemId = item.bytes[4] | (item.bytes[5] << 8) | (item.bytes[6] << 16) | (item.bytes[7] << 24);
  const baseId = itemId & 0xFFFFFF00;
  if (baseId === 0x00F42400) {
    shortswords2.push({ slot: item.slot, bytes: item.bytes, itemId });
  }
}

console.log(`\nFile 1 has ${shortswords1.length} Shortsword(s)`);
console.log(`File 2 has ${shortswords2.length} Shortsword(s)`);

shortswords1.forEach((ss, idx) => {
  console.log(`\nFile 1 - Shortsword #${idx + 1} at slot ${ss.slot}:`);
  console.log(`  Full: ${ss.bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
  console.log(`  Item ID: 0x${ss.itemId.toString(16).toUpperCase().padStart(8, '0')}`);
  console.log(`  Bytes 0-1: 0x${(ss.bytes[0] | (ss.bytes[1] << 8)).toString(16).toUpperCase().padStart(4, '0')}`);
  console.log(`  Byte 12: 0x${ss.bytes[12].toString(16).toUpperCase().padStart(2, '0')}`);
  console.log(`  Bytes 14-15: 0x${(ss.bytes[14] | (ss.bytes[15] << 8)).toString(16).toUpperCase().padStart(4, '0')}`);
});

shortswords2.forEach((ss, idx) => {
  console.log(`\nFile 2 - Shortsword #${idx + 1} at slot ${ss.slot}:`);
  console.log(`  Full: ${ss.bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
  console.log(`  Item ID: 0x${ss.itemId.toString(16).toUpperCase().padStart(8, '0')}`);
  console.log(`  Bytes 0-1: 0x${(ss.bytes[0] | (ss.bytes[1] << 8)).toString(16).toUpperCase().padStart(4, '0')}`);
  console.log(`  Byte 12: 0x${ss.bytes[12].toString(16).toUpperCase().padStart(2, '0')}`);
  console.log(`  Bytes 14-15: 0x${(ss.bytes[14] | (ss.bytes[15] << 8)).toString(16).toUpperCase().padStart(4, '0')}`);
});

// Look for newly added item (different between files)
console.log('\n=== New Item in File 2 (Slot 26) ===');
if (differences.some(d => d.slot === 26)) {
  const diff = differences.find(d => d.slot === 26);
  if (!diff.isEmpty2) {
    const itemId = diff.bytes2[4] | (diff.bytes2[5] << 8) | (diff.bytes2[6] << 16) | (diff.bytes2[7] << 24);
    console.log(`Slot 26 in File 2:`);
    console.log(`  Full: ${diff.bytes2.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    console.log(`  Item ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`  Bytes 0-1: 0x${(diff.bytes2[0] | (diff.bytes2[1] << 8)).toString(16).toUpperCase().padStart(4, '0')} (${diff.bytes2[0] | (diff.bytes2[1] << 8)})`);
    console.log(`  Byte 12: 0x${diff.bytes2[12].toString(16).toUpperCase().padStart(2, '0')} (${diff.bytes2[12]})`);
    console.log(`  Bytes 14-15: 0x${(diff.bytes2[14] | (diff.bytes2[15] << 8)).toString(16).toUpperCase().padStart(4, '0')}`);
    console.log(`  Separator: 0x${diff.bytes2[2].toString(16).toUpperCase()}${diff.bytes2[3].toString(16).toUpperCase()}`);
  }
}
