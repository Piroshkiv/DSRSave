const fs = require('fs');

const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const INFUSION_NAMES = [
  'Standard', 'Heavy', 'Sharp', 'Refined', 'Simple',
  'Crystal', 'Fire', 'Chaos', 'Lightning', 'Deep',
  'Dark', 'Poison', 'Blood', 'Raw', 'Blessed', 'Hollow'
];

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

console.log('All weapons with Sharp infusion (upper nibble = 2):\n');

for (let i = 0; i < 3000; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);
  if (itemId === 0 || itemId === 0xFFFFFFFF) continue;

  const byte0 = itemId & 0xFF;
  const lowerNibble = byte0 & 0x0F;
  const upperNibble = (byte0 >> 4) & 0x0F;

  if (upperNibble === 2) {
    const baseId = itemId & 0xFFFFFFF0;

    const weapon = itemsData.weapon_items.find(w => {
      const dbId = parseInt(w.Id, 16);
      const dbBase = dbId & 0xFFFFFFF0;
      return dbBase === baseId;
    });

    console.log(`Slot ${i}:`);
    console.log(`  ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`  Byte 0: 0x${byte0.toString(16).toUpperCase().padStart(2, '0')} (Sharp +${lowerNibble})`);
    console.log(`  Base ID: 0x${baseId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`  Name: ${weapon ? weapon.Name : 'NOT FOUND IN DB'}`);

    // Also try searching in Sellsword range
    if (!weapon && itemId >= 0x00F42400 && itemId <= 0x00F424FF) {
      console.log(`  -> This might be Sellsword Twinblades!`);
    }
    console.log();
  }
}
