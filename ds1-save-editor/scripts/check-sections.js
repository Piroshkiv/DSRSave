const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (11).bin';

console.log('Проверка разных секций сохранения...\n');

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
const inventoryStart = patternOffset + 0x9C; // 156 bytes

console.log(`Pattern offset: 0x${patternOffset.toString(16).toUpperCase()}`);
console.log(`Inventory start (Pattern + 0x9C): 0x${inventoryStart.toString(16).toUpperCase()}\n`);

// Адрес где найдено 0xCC 0x06
const foundAddr = 0x7A40;
console.log(`Найденный адрес 0xCC 0x06: 0x${foundAddr.toString(16).toUpperCase()}`);
console.log(`Relative to pattern: Pattern + ${foundAddr - patternOffset} (0x${(foundAddr - patternOffset).toString(16).toUpperCase()})`);

// Прочитаем 16 байт с этого адреса
const foundBytes = Array.from(data.slice(foundAddr, foundAddr + 16));
console.log(`\nДанные по адресу 0x${foundAddr.toString(16).toUpperCase()}:`);
console.log(`  ${foundBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

const bytes01_found = foundBytes[0] | (foundBytes[1] << 8);
const separator_found = foundBytes[2] | (foundBytes[3] << 8);
const itemId_found = foundBytes[4] | (foundBytes[5] << 8) | (foundBytes[6] << 16) | (foundBytes[7] << 24);

console.log(`  Bytes 0-1: 0x${bytes01_found.toString(16).toUpperCase()} (${bytes01_found})`);
console.log(`  Separator: 0x${separator_found.toString(16).toUpperCase()}`);
console.log(`  Item ID: 0x${itemId_found.toString(16).toUpperCase().padStart(8, '0')}`);

// Проверим что это за секция - вероятно storage?
// В DS3 есть inventory (носимый) и storage (сундук)
console.log('\n=== Возможно это STORAGE (сундук), а не inventory ===');

// Попробуем найти все Shortsword в файле
console.log('\n=== Поиск всех Shortsword (0x80 0x84 0x1E 0x00) в файле ===');

const shortswordId = [0x80, 0x84, 0x1E, 0x00];
let count = 0;

for (let i = 0; i < data.length - 3; i++) {
  if (data[i] === shortswordId[0] &&
      data[i + 1] === shortswordId[1] &&
      data[i + 2] === shortswordId[2] &&
      data[i + 3] === shortswordId[3]) {

    const itemStart = i - 4; // Bytes 0-3 перед Item ID
    const itemBytes = Array.from(data.slice(itemStart, itemStart + 16));

    console.log(`\nНайдено по адресу 0x${i.toString(16).toUpperCase()} (item start 0x${itemStart.toString(16).toUpperCase()}):`);
    console.log(`  Relative to pattern: Pattern + ${itemStart - patternOffset}`);
    console.log(`  ${itemBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

    const b01 = itemBytes[0] | (itemBytes[1] << 8);
    const sep = itemBytes[2] | (itemBytes[3] << 8);
    const b12 = itemBytes[12];
    const b1415 = itemBytes[14] | (itemBytes[15] << 8);

    console.log(`    Bytes 0-1: ${b01}, Separator: 0x${sep.toString(16)}, Byte 12: ${b12}, Bytes 14-15: 0x${b1415.toString(16).toUpperCase()}`);

    count++;
    if (count >= 5) break;
  }
}
