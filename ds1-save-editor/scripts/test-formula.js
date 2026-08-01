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

console.log('Testing formula: byte0_modifier = (infusion * 100) + upgrade\n');

let count = 0;
for (let i = 0; i < 3000 && count < 30; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);
  if (itemId === 0 || itemId === 0xFFFFFFFF) continue;

  const byte0 = itemId & 0xFF;
  const byte1 = (itemId >> 8) & 0xFF;
  const byte2 = (itemId >> 16) & 0xFF;
  const byte3 = (itemId >> 24) & 0xFF;

  // Try subtracting byte0_modifier values to find base
  let found = false;
  for (let infusion = 0; infusion <= 15 && !found; infusion++) {
    for (let upgrade = 0; upgrade <= 15 && !found; upgrade++) {
      const byte0_modifier = (infusion * 100) + upgrade;
      const testByte0 = (byte0 - byte0_modifier) & 0xFF;
      const testId = testByte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24);

      const weapon = itemsData.weapon_items.find(w => parseInt(w.Id, 16) === testId);
      if (weapon) {
        console.log(`${count + 1}. ${INFUSION_NAMES[infusion]} ${weapon.Name} +${upgrade}`);
        console.log(`   Raw ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
        console.log(`   Base ID: 0x${testId.toString(16).toUpperCase().padStart(8, '0')}`);
        console.log(`   Byte 0: ${byte0} = base ${testByte0} + (${infusion} * 100 + ${upgrade})`);
        console.log();
        count++;
        found = true;
      }
    }
  }
}
