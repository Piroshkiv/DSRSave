const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (12).bin';

console.log('Проверка поврежденного сохранения...\n');

const data = fs.readFileSync(SAVE_FILE);

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

const patternOffset = findPattern(data);
const inventoryStart = patternOffset + 0x9C;

console.log(`Pattern offset: 0x${patternOffset.toString(16).toUpperCase()}`);
console.log(`Inventory start: 0x${inventoryStart.toString(16).toUpperCase()}\n`);

// Проверим Counter1
const counter1Offset = patternOffset + 472;
const counter1 = data[counter1Offset] | (data[counter1Offset + 1] << 8);
console.log(`Counter1: ${counter1} (0x${counter1.toString(16).toUpperCase()})\n`);

// Читаем слоты 18 и 19 (Heavy Dagger +79 и Long Sword)
console.log('=== Slot 18 (Heavy Dagger +79?) ===');
const slot18Offset = inventoryStart + (18 * 16);
const slot18Bytes = Array.from(data.slice(slot18Offset, slot18Offset + 16));
console.log(`Bytes: ${slot18Bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

const slot18_bytes01 = slot18Bytes[0] | (slot18Bytes[1] << 8);
const slot18_separator = slot18Bytes[2] | (slot18Bytes[3] << 8);
const slot18_itemId = slot18Bytes[4] | (slot18Bytes[5] << 8) | (slot18Bytes[6] << 16) | (slot18Bytes[7] << 24);
const slot18_qty = slot18Bytes[8];
const slot18_byte12 = slot18Bytes[12];
const slot18_bytes1415 = slot18Bytes[14] | (slot18Bytes[15] << 8);

console.log(`  Bytes 0-1: ${slot18_bytes01} (0x${slot18_bytes01.toString(16).toUpperCase()})`);
console.log(`  Separator: 0x${slot18_separator.toString(16).toUpperCase()}`);
console.log(`  Item ID: 0x${slot18_itemId.toString(16).toUpperCase().padStart(8, '0')}`);
console.log(`  Quantity: ${slot18_qty}`);
console.log(`  Byte 12: ${slot18_byte12}`);
console.log(`  Bytes 14-15: 0x${slot18_bytes1415.toString(16).toUpperCase()}`);

// Вычислим что должно быть
const byte0 = slot18_itemId & 0xFF;
console.log(`\n  Item ID byte 0: 0x${byte0.toString(16).toUpperCase()} (${byte0})`);
console.log(`  Если byte0 >= 100, то это upgrade + infusion!`);

if (byte0 >= 100) {
  const infusion = Math.floor(byte0 / 100);
  const upgrade = byte0 % 100;
  const baseId_byte0 = byte0 - (infusion * 100) - upgrade;
  console.log(`  Parsed: Infusion=${infusion} (${infusion === 1 ? 'Heavy' : 'Unknown'}), Upgrade=${upgrade}`);
  console.log(`  Base byte0 should be: 0x${baseId_byte0.toString(16).toUpperCase()}`);
}

console.log('\n=== Slot 19 (Long Sword) ===');
const slot19Offset = inventoryStart + (19 * 16);
const slot19Bytes = Array.from(data.slice(slot19Offset, slot19Offset + 16));
console.log(`Bytes: ${slot19Bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

const slot19_bytes01 = slot19Bytes[0] | (slot19Bytes[1] << 8);
const slot19_separator = slot19Bytes[2] | (slot19Bytes[3] << 8);
const slot19_itemId = slot19Bytes[4] | (slot19Bytes[5] << 8) | (slot19Bytes[6] << 16) | (slot19Bytes[7] << 24);
const slot19_qty = slot19Bytes[8];
const slot19_byte12 = slot19Bytes[12];
const slot19_bytes1415 = slot19Bytes[14] | (slot19Bytes[15] << 8);

console.log(`  Bytes 0-1: ${slot19_bytes01} (0x${slot19_bytes01.toString(16).toUpperCase()})`);
console.log(`  Separator: 0x${slot19_separator.toString(16).toUpperCase()}`);
console.log(`  Item ID: 0x${slot19_itemId.toString(16).toUpperCase().padStart(8, '0')}`);
console.log(`  Quantity: ${slot19_qty}`);
console.log(`  Byte 12: ${slot19_byte12}`);
console.log(`  Bytes 14-15: 0x${slot19_bytes1415.toString(16).toUpperCase()}`);

// Проверим все оружия
console.log('\n=== Все оружия в инвентаре (separator 0x80) ===');
let weaponCount = 0;

for (let i = 0; i < 256; i++) {
  const offset = inventoryStart + (i * 16);
  const bytes = Array.from(data.slice(offset, offset + 16));

  const isEmpty = bytes.every(b => b === 0x00);
  if (isEmpty) continue;

  const sep = bytes[2];
  if (sep !== 0x80) continue; // Only weapons

  weaponCount++;
  const itemId = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  const byte0 = itemId & 0xFF;

  console.log(`\nSlot ${i}:`);
  console.log(`  ${bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
  console.log(`  Item ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}, byte0: ${byte0}`);
}

console.log(`\nВсего оружий: ${weaponCount}`);
