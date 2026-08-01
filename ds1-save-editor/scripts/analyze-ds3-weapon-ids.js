const fs = require('fs');
const path = require('path');

// Паттерн для поиска
const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (7).bin';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\dist\\json\\ds3_items.json';

// Загружаем JSON
const itemsData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const weaponsById = new Map();
itemsData.weapon_items.forEach(w => {
  const id = parseInt(w.Id, 16);
  weaponsById.set(id, w);
});

console.log(`Loaded ${weaponsById.size} weapons from JSON`);

// Функция поиска паттерна
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

// Читаем сохранение
const saveData = fs.readFileSync(SAVE_FILE);
const patternOffset = findPattern(saveData, PATTERN);

if (patternOffset === -1) {
  console.error('Pattern not found!');
  process.exit(1);
}

console.log(`\nPattern found at: 0x${patternOffset.toString(16).toUpperCase()}`);

const inventoryStart = patternOffset + 0x09C;
console.log(`Inventory starts at: 0x${inventoryStart.toString(16).toUpperCase()}\n`);

console.log('=== First 20 weapons found in save ===\n');

let weaponsFound = 0;
for (let i = 0; i < 3000 && weaponsFound < 20; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];

  // Только оружие (separator 0x80)
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);
  const quantity = saveData[offset + 8];

  if (itemId === 0 || itemId === 0xFFFFFFFF || quantity === 0) continue;

  // Пробуем найти с разными вариантами маскирования
  const mask00 = itemId & 0xFFFFFF00;
  const maskF0 = itemId & 0xFFFFFFF0;
  const mask0F = itemId & 0xFFFFFF0F;

  const foundMask00 = weaponsById.get(mask00);
  const foundMaskF0 = weaponsById.get(maskF0);
  const foundMask0F = weaponsById.get(mask0F);

  console.log(`Weapon #${weaponsFound + 1}:`);
  console.log(`  Raw ID from save: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
  console.log(`  Last byte: 0x${(itemId & 0xFF).toString(16).toUpperCase().padStart(2, '0')} (binary: ${(itemId & 0xFF).toString(2).padStart(8, '0')})`);
  console.log(`  Masked 0xFFFFFF00: 0x${mask00.toString(16).toUpperCase().padStart(8, '0')} => ${foundMask00 ? foundMask00.Name : 'NOT FOUND'}`);
  console.log(`  Masked 0xFFFFFFF0: 0x${maskF0.toString(16).toUpperCase().padStart(8, '0')} => ${foundMaskF0 ? foundMaskF0.Name : 'NOT FOUND'}`);
  console.log(`  Masked 0xFFFFFF0F: 0x${mask0F.toString(16).toUpperCase().padStart(8, '0')} => ${foundMask0F ? foundMask0F.Name : 'NOT FOUND'}`);
  console.log();

  weaponsFound++;
}

console.log('\n=== Analysis ===');
console.log('Check which mask works best for matching weapons in database.');
