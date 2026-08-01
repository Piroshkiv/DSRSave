const fs = require('fs');

const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (7).bin';
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

const saveData = fs.readFileSync(SAVE_FILE);
const patternOffset = findPattern(saveData, PATTERN);
const inventoryStart = patternOffset + 0x09C;

console.log('=== Testing Different Matching Strategies ===\n');

// Берем первые несколько оружий из сохранения
const testCases = [];
for (let i = 0; i < 3000 && testCases.length < 10; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);
  const quantity = saveData[offset + 8];

  if (itemId === 0 || itemId === 0xFFFFFFFF || quantity === 0) continue;

  testCases.push({ itemId, offset });
}

console.log(`Found ${testCases.length} weapons to test\n`);

testCases.forEach((tc, idx) => {
  const itemId = tc.itemId;

  console.log(`\n=== Weapon #${idx + 1} ===`);
  console.log(`Raw ID from save: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);

  const byte0 = itemId & 0xFF;
  const byte1 = (itemId >> 8) & 0xFF;
  const byte2 = (itemId >> 16) & 0xFF;
  const byte3 = (itemId >> 24) & 0xFF;

  console.log(`Bytes: [0x${byte0.toString(16).toUpperCase().padStart(2, '0')}, 0x${byte1.toString(16).toUpperCase().padStart(2, '0')}, 0x${byte2.toString(16).toUpperCase().padStart(2, '0')}, 0x${byte3.toString(16).toUpperCase().padStart(2, '0')}]`);

  // Стратегия 1: Текущая (маска 0xFFFFFFF0)
  const strategy1 = itemId & 0xFFFFFFF0;
  const upgrade1 = itemId & 0x0F;
  const infusion1 = (byte0 >> 4) & 0x0F;

  console.log(`\nStrategy 1 (mask 0xFFFFFFF0):`);
  console.log(`  Base ID: 0x${strategy1.toString(16).toUpperCase().padStart(8, '0')}`);
  console.log(`  Upgrade: ${upgrade1}, Infusion: ${infusion1} (${INFUSION_NAMES[infusion1]})`);

  const match1 = itemsData.weapon_items.find(w => parseInt(w.Id, 16) === strategy1);
  console.log(`  Match: ${match1 ? match1.Name : 'NOT FOUND'}`);

  // Стратегия 2: Вычитаем upgrade из первого байта для разных уровней
  console.log(`\nStrategy 2 (subtract upgrade from byte0):`);
  for (let testUpgrade = 0; testUpgrade <= 10; testUpgrade++) {
    const newByte0 = (byte0 - testUpgrade) & 0xFF;
    const testId = newByte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24);
    const match = itemsData.weapon_items.find(w => parseInt(w.Id, 16) === testId);

    if (match) {
      // Теперь определяем infusion
      const baseByte0 = testId & 0xFF;
      const infusionOffset = baseByte0 & 0xF0; // старшие 4 бита
      const inferredInfusion = infusionOffset >> 4;

      console.log(`  ✓ Upgrade +${testUpgrade}: ${match.Name}`);
      console.log(`    Base ID: 0x${testId.toString(16).toUpperCase().padStart(8, '0')}`);
      console.log(`    Base byte0: 0x${baseByte0.toString(16).toUpperCase().padStart(2, '0')}`);
      console.log(`    Infusion: ${inferredInfusion} (${INFUSION_NAMES[inferredInfusion]})`);
    }
  }
});
