const fs = require('fs');

const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

function findPattern(buffer, pattern) {
  for (let i = 0; i <= buffer.length - pattern.length; i++) {
    let found = true;
    for (let j = 0; j < pattern.length; j++) {
      if (buffer[i + j] !== pattern[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

const saveData = fs.readFileSync('C:\\Users\\Iho\\Downloads\\character_slot1_raw (4).bin');
const patternOffset = findPattern(saveData, PATTERN);
const inventoryStart = patternOffset + 0x09C;

console.log('All Old Wolf Curved Sword in NEW SAVE:\n');

let count = 0;
for (let i = 0; i < 3000; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);

  // Old Wolf range 0x00610BC0 - 0x00610BCF
  if (itemId >= 0x00610BC0 && itemId <= 0x00610BCF) {
    count++;
    const byte0ID = itemId & 0xFF;
    console.log(`#${count} - Slot ${i}:`);
    console.log(`  Byte 0 (item structure): 0x${saveData[offset].toString(16).toUpperCase().padStart(2, '0')} (${saveData[offset]})`);
    console.log(`  ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`  ID byte 0: 0x${byte0ID.toString(16).toUpperCase().padStart(2, '0')} (${byte0ID})`);
    console.log(`  Difference from base 0xC0: ${byte0ID - 0xC0}`);
    console.log();
  }
}

console.log(`Total found: ${count}`);
