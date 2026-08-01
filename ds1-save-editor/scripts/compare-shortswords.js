const fs = require('fs');

const SAVE_FILE_1 = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (10).bin'; // Save editor
const SAVE_FILE_2 = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (11).bin'; // Manual

console.log('Reading save files...');
const data1 = fs.readFileSync(SAVE_FILE_1);
const data2 = fs.readFileSync(SAVE_FILE_2);

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

const inventoryStart1 = patternOffset1 + 0x9C;
const inventoryStart2 = patternOffset2 + 0x9C;

const counter1Offset1 = patternOffset1 + 472;
const counter1_1 = data1[counter1Offset1] | (data1[counter1Offset1 + 1] << 8);

const counter1Offset2 = patternOffset2 + 472;
const counter1_2 = data2[counter1Offset2] | (data2[counter1Offset2 + 1] << 8);

console.log(`\nFile 1 (Save Editor) Counter1: 0x${counter1_1.toString(16).toUpperCase()} (${counter1_1})`);
console.log(`File 2 (Manual) Counter1: 0x${counter1_2.toString(16).toUpperCase()} (${counter1_2})`);

// Read Shortsword from Slot 39 in File 1
const slot39Offset1 = inventoryStart1 + (39 * 16);
const slot39Bytes1 = Array.from(data1.slice(slot39Offset1, slot39Offset1 + 16));

console.log('\n=== File 1 (Save Editor) - Shortsword at Slot 39 ===');
console.log(`Full: ${slot39Bytes1.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

const itemId1 = slot39Bytes1[4] | (slot39Bytes1[5] << 8) | (slot39Bytes1[6] << 16) | (slot39Bytes1[7] << 24);
const bytes01_1 = slot39Bytes1[0] | (slot39Bytes1[1] << 8);
const separator1 = slot39Bytes1[2] | (slot39Bytes1[3] << 8);
const quantity1 = slot39Bytes1[8];
const byte12_1 = slot39Bytes1[12];
const bytes1415_1 = slot39Bytes1[14] | (slot39Bytes1[15] << 8);

console.log(`  Item ID: 0x${itemId1.toString(16).toUpperCase().padStart(8, '0')}`);
console.log(`  Bytes 0-1 (counter): 0x${bytes01_1.toString(16).toUpperCase().padStart(4, '0')} (${bytes01_1})`);
console.log(`  Separator: 0x${separator1.toString(16).toUpperCase().padStart(4, '0')}`);
console.log(`  Quantity: ${quantity1}`);
console.log(`  Byte 12 (slot counter): 0x${byte12_1.toString(16).toUpperCase().padStart(2, '0')} (${byte12_1})`);
console.log(`  Bytes 14-15 (signature): 0x${bytes1415_1.toString(16).toUpperCase().padStart(4, '0')}`);

// Read Shortsword from Slot 26 in File 2
const slot26Offset2 = inventoryStart2 + (26 * 16);
const slot26Bytes2 = Array.from(data2.slice(slot26Offset2, slot26Offset2 + 16));

console.log('\n=== File 2 (Manual) - Shortsword at Slot 26 ===');
console.log(`Full: ${slot26Bytes2.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

const itemId2 = slot26Bytes2[4] | (slot26Bytes2[5] << 8) | (slot26Bytes2[6] << 16) | (slot26Bytes2[7] << 24);
const bytes01_2 = slot26Bytes2[0] | (slot26Bytes2[1] << 8);
const separator2 = slot26Bytes2[2] | (slot26Bytes2[3] << 8);
const quantity2 = slot26Bytes2[8];
const byte12_2 = slot26Bytes2[12];
const bytes1415_2 = slot26Bytes2[14] | (slot26Bytes2[15] << 8);

console.log(`  Item ID: 0x${itemId2.toString(16).toUpperCase().padStart(8, '0')}`);
console.log(`  Bytes 0-1 (counter): 0x${bytes01_2.toString(16).toUpperCase().padStart(4, '0')} (${bytes01_2})`);
console.log(`  Separator: 0x${separator2.toString(16).toUpperCase().padStart(4, '0')}`);
console.log(`  Quantity: ${quantity2}`);
console.log(`  Byte 12 (slot counter): 0x${byte12_2.toString(16).toUpperCase().padStart(2, '0')} (${byte12_2})`);
console.log(`  Bytes 14-15 (signature): 0x${bytes1415_2.toString(16).toUpperCase().padStart(4, '0')}`);

// Compare
console.log('\n=== Comparison ===');
console.log(`Item ID: ${itemId1 === itemId2 ? '✓ SAME' : '✗ DIFFERENT'} (${itemId1 === itemId2 ? 'both 0x' + itemId1.toString(16).toUpperCase() : '0x' + itemId1.toString(16).toUpperCase() + ' vs 0x' + itemId2.toString(16).toUpperCase()})`);
console.log(`Bytes 0-1: ${bytes01_1} vs ${bytes01_2} ${bytes01_1 === bytes01_2 ? '✓' : '✗'}`);
console.log(`  Note: Counter1 in File 1 is ${counter1_1}, in File 2 is ${counter1_2}`);
console.log(`  File 1: Bytes 0-1 (${bytes01_1}) vs Counter1 (${counter1_1}) - ${bytes01_1 === counter1_1 ? 'MATCH ✓' : 'NO MATCH ✗, diff = ' + (counter1_1 - bytes01_1)}`);
console.log(`  File 2: Bytes 0-1 (${bytes01_2}) vs Counter1 (${counter1_2}) - ${bytes01_2 === counter1_2 ? 'MATCH ✓' : 'NO MATCH ✗, diff = ' + (counter1_2 - bytes01_2)}`);
console.log(`Separator: ${separator1 === separator2 ? '✓ SAME' : '✗ DIFFERENT'}`);
console.log(`Quantity: ${quantity1 === quantity2 ? '✓ SAME' : '✗ DIFFERENT'}`);
console.log(`Byte 12: ${byte12_1} vs ${byte12_2} ${byte12_1 === byte12_2 ? '✓' : '✗'}`);
console.log(`Bytes 14-15: ${bytes1415_1 === bytes1415_2 ? '✓ SAME' : '✗ DIFFERENT'} (${bytes1415_1 === bytes1415_2 ? '0x' + bytes1415_1.toString(16).toUpperCase() : '0x' + bytes1415_1.toString(16).toUpperCase() + ' vs 0x' + bytes1415_2.toString(16).toUpperCase()})`);

// Check previous items in both slots
console.log('\n=== Checking Previous Items ===');

// Find previous non-empty item before Slot 39 in File 1
let prevSlot1 = -1;
let prevByte12_1 = -1;
for (let i = 38; i >= 0; i--) {
  const offset = inventoryStart1 + (i * 16);
  const bytes = Array.from(data1.slice(offset, offset + 16));
  const isEmpty = bytes.every(b => b === 0x00);
  if (!isEmpty) {
    prevSlot1 = i;
    prevByte12_1 = bytes[12];
    console.log(`File 1: Previous non-empty item at Slot ${i}, Byte 12 = 0x${prevByte12_1.toString(16).toUpperCase()} (${prevByte12_1})`);
    console.log(`  Expected Byte 12 for new item: 0x${((prevByte12_1 + 1) & 0xFF).toString(16).toUpperCase()} (${(prevByte12_1 + 1) & 0xFF})`);
    console.log(`  Actual Byte 12 in Slot 39: 0x${byte12_1.toString(16).toUpperCase()} (${byte12_1})`);
    console.log(`  Match: ${((prevByte12_1 + 1) & 0xFF) === byte12_1 ? '✓' : '✗'}`);
    break;
  }
}

// Find previous non-empty item before Slot 26 in File 2
let prevSlot2 = -1;
let prevByte12_2 = -1;
for (let i = 25; i >= 0; i--) {
  const offset = inventoryStart2 + (i * 16);
  const bytes = Array.from(data2.slice(offset, offset + 16));
  const isEmpty = bytes.every(b => b === 0x00);
  if (!isEmpty) {
    prevSlot2 = i;
    prevByte12_2 = bytes[12];
    console.log(`File 2: Previous non-empty item at Slot ${i}, Byte 12 = 0x${prevByte12_2.toString(16).toUpperCase()} (${prevByte12_2})`);
    console.log(`  Expected Byte 12 for new item: 0x${((prevByte12_2 + 1) & 0xFF).toString(16).toUpperCase()} (${(prevByte12_2 + 1) & 0xFF})`);
    console.log(`  Actual Byte 12 in Slot 26: 0x${byte12_2.toString(16).toUpperCase()} (${byte12_2})`);
    console.log(`  Match: ${((prevByte12_2 + 1) & 0xFF) === byte12_2 ? '✓' : '✗'}`);
    break;
  }
}
