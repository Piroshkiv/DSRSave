const fs = require('fs');

// Паттерн для поиска
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

// Загружаем JSON
const itemsData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));
const weaponsById = new Map();
itemsData.weapon_items.forEach(w => {
  const id = parseInt(w.Id, 16);
  weaponsById.set(id, w);
});

console.log(`Loaded ${weaponsById.size} weapons from JSON\n`);

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

const inventoryStart = patternOffset + 0x09C;

console.log('=== Weapons with Infusion/Upgrade Analysis ===\n');

let count = 0;
for (let i = 0; i < 3000 && count < 30; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];

  // Только оружие (separator 0x80)
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);
  const quantity = saveData[offset + 8];

  if (itemId === 0 || itemId === 0xFFFFFFFF || quantity === 0) continue;

  // Парсинг по новой логике
  const lowerByte = itemId & 0xFF;
  const upgradeLevel = lowerByte & 0x0F;
  const infusion = (lowerByte >> 4) & 0x0F;
  const baseId = itemId & 0xFFFFFFF0;

  const weapon = weaponsById.get(baseId);

  if (weapon) {
    const infusionName = INFUSION_NAMES[infusion] || 'Unknown';

    console.log(`${count + 1}. ${infusionName} ${weapon.Name} +${upgradeLevel}`);
    console.log(`   Raw ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`   Base ID: 0x${baseId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`   Lower byte: 0x${lowerByte.toString(16).toUpperCase().padStart(2, '0')} (${lowerByte.toString(2).padStart(8, '0')})`);
    console.log(`   Upgrade: ${upgradeLevel}, Infusion: ${infusion} (${infusionName})`);
    console.log();

    count++;
  }
}

console.log('\n=== Special Cases Check ===');
console.log('Looking for Pyromancy Flame and other special weapons...\n');

// Проверяем перчатку пиромантии
const pyroFlames = itemsData.weapon_items.filter(w =>
  w.Name.toLowerCase().includes('pyromancy') ||
  w.Name.toLowerCase().includes('flame')
);

console.log('Pyromancy Flames in database:');
pyroFlames.forEach(w => {
  console.log(`  - ${w.Name}: ${w.Id}, MaxUpgrade: ${w.MaxUpgrade}`);
});
