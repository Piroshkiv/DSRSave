const fs = require('fs');

const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (4).bin';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\dist\\json\\ds3_items.json';

const INFUSION_NAMES = [
  'Standard', 'Heavy', 'Sharp', 'Refined', 'Simple',
  'Crystal', 'Fire', 'Chaos', 'Lightning', 'Deep',
  'Dark', 'Poison', 'Blood', 'Raw', 'Blessed', 'Hollow'
];

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

function parseWeapon(itemId, weapons) {
  const byte0 = itemId & 0xFF;
  const byte1 = (itemId >> 8) & 0xFF;
  const byte2 = (itemId >> 16) & 0xFF;
  const byte3 = (itemId >> 24) & 0xFF;

  // Formula: byte0 = base_byte0 + (infusion * 100) + upgrade
  for (let infusion = 0; infusion <= 15; infusion++) {
    for (let upgrade = 0; upgrade <= 15; upgrade++) {
      const byte0_modifier = (infusion * 100) + upgrade;
      const testByte0 = (byte0 - byte0_modifier) & 0xFF;
      const testId = testByte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24);

      const found = weapons.find(w => parseInt(w.Id, 16) === testId);
      if (found) {
        return {
          weapon: found,
          upgrade: upgrade,
          infusion: infusion,
          baseId: testId
        };
      }
    }
  }

  return null;
}

const saveData = fs.readFileSync(SAVE_FILE);
const patternOffset = findPattern(saveData, PATTERN);
const inventoryStart = patternOffset + 0x09C;

console.log('=== Testing New Weapon Parsing Logic ===\n');

let count = 0;
for (let i = 0; i < 3000 && count < 30; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);
  const quantity = saveData[offset + 8];

  if (itemId === 0 || itemId === 0xFFFFFFFF || quantity === 0) continue;

  const parsed = parseWeapon(itemId, itemsData.weapon_items);

  if (parsed) {
    const infusionName = INFUSION_NAMES[parsed.infusion] || 'Unknown';
    const displayName = infusionName !== 'Standard' ? `${infusionName} ${parsed.weapon.Name}` : parsed.weapon.Name;

    console.log(`${count + 1}. ${displayName} +${parsed.upgrade}`);
    console.log(`   Raw ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`   Base ID: 0x${parsed.baseId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`   Infusion: ${parsed.infusion} (${infusionName})`);
    console.log();

    count++;
  }
}
