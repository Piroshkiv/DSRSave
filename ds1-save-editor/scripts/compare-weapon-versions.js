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

function analyzeSave(savePath, title) {
  console.log(`\n=== ${title} ===\n`);

  const saveData = fs.readFileSync(savePath);
  const patternOffset = findPattern(saveData, PATTERN);
  const inventoryStart = patternOffset + 0x09C;

  const targetNames = ['Old Wolf Curved Sword', 'Gotthard Twinswords'];

  for (let i = 0; i < 3000; i++) {
    const offset = inventoryStart + i * 16;
    if (offset + 16 > saveData.length) break;

    const separator = saveData[offset + 3];
    if (separator !== 0x80) continue;

    const itemId = saveData.readUInt32LE(offset + 4);
    if (itemId === 0 || itemId === 0xFFFFFFFF) continue;

    const weapon = itemsData.weapon_items.find(w => parseInt(w.Id, 16) === itemId);
    if (!weapon) continue;

    if (targetNames.some(name => weapon.Name.includes(name))) {
      console.log(`${weapon.Name}`);
      console.log(`   ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);

      const bytes = [];
      for (let j = 0; j < 16; j++) {
        bytes.push(saveData[offset + j].toString(16).toUpperCase().padStart(2, '0'));
      }
      console.log(`   Bytes: [${bytes.join(' ')}]`);

      const byte0 = itemId & 0xFF;
      const byte1 = (itemId >> 8) & 0xFF;
      const byte2 = (itemId >> 16) & 0xFF;
      const byte3 = (itemId >> 24) & 0xFF;

      console.log(`   ID bytes: [0x${byte0.toString(16).toUpperCase().padStart(2, '0')}, 0x${byte1.toString(16).toUpperCase().padStart(2, '0')}, 0x${byte2.toString(16).toUpperCase().padStart(2, '0')}, 0x${byte3.toString(16).toUpperCase().padStart(2, '0')}]`);
      console.log(`   Byte 0 binary: ${byte0.toString(2).padStart(8, '0')}`);
      console.log(`   Lower nibble (upgrade?): ${byte0 & 0x0F}`);
      console.log(`   Upper nibble (infusion?): ${(byte0 >> 4) & 0x0F}`);
      console.log();
    }
  }
}

analyzeSave('C:\\Users\\Iho\\Downloads\\character_slot1_raw (2).bin', 'Old Save (Sharp +5 and Sharp +10)');
analyzeSave('C:\\Users\\Iho\\Downloads\\character_slot1_raw (4).bin', 'New Save (Added +0 Standard versions)');
