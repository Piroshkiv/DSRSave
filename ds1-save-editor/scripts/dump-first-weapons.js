const fs = require('fs');

const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\dist\\json\\ds3_items.json';
const itemsData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

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

const saveData = fs.readFileSync('C:\\Users\\Iho\\Downloads\\character_slot1_raw (2).bin');
const patternOffset = findPattern(saveData, PATTERN);
const inventoryStart = patternOffset + 0x09C;

console.log('First 50 weapons in save (unfiltered):\n');

let count = 0;
for (let i = 0; i < 3000 && count < 50; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);
  if (itemId === 0 || itemId === 0xFFFFFFFF) continue;

  count++;
  const byte0 = itemId & 0xFF;

  // Try to find exact match first
  let weapon = itemsData.weapon_items.find(w => parseInt(w.Id, 16) === itemId);

  console.log(`${count}. Slot ${i}:`);
  console.log(`   ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
  console.log(`   Byte 0: 0x${byte0.toString(16).toUpperCase().padStart(2, '0')}`);
  console.log(`   Match: ${weapon ? weapon.Name : 'NOT FOUND'}`);

  if (!weapon) {
    // Try nibble logic
    const lowerNibble = byte0 & 0x0F;
    const upperNibble = (byte0 >> 4) & 0x0F;
    console.log(`   Lower nibble: ${lowerNibble}, Upper nibble: ${upperNibble}`);
  }
  console.log();
}
