const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (11).bin';

console.log('Ищем предмет с bytes 0-1 = 1740 (0x6CC)...\n');

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

// Ищем все предметы с bytes 0-1 около 1740
const target = 1740;

for (let i = 0; i < 256; i++) {
  const offset = inventoryStart + (i * 16);
  const bytes = Array.from(data.slice(offset, offset + 16));

  const isEmpty = bytes.every(b => b === 0x00);
  if (isEmpty) continue;

  const bytes01 = bytes[0] | (bytes[1] << 8);

  if (Math.abs(bytes01 - target) <= 10) {
    const itemId = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
    const byte12 = bytes[12];

    console.log(`Slot ${i}: Bytes 0-1 = 0x${bytes01.toString(16).toUpperCase()} (${bytes01})`);
    console.log(`  Item ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`  Byte 12: ${byte12}`);
    console.log(`  Full: ${bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    console.log('');
  }
}

// Попробуем найти где-то в файле последовательность 0xCC 0x06
console.log('=== Поиск 0xCC 0x06 в файле ===');
let found = 0;
for (let i = 0; i < data.length - 1 && found < 10; i++) {
  if (data[i] === 0xCC && data[i + 1] === 0x06) {
    console.log(`Найдено по адресу 0x${i.toString(16).toUpperCase()}`);
    // Показать контекст
    const start = Math.max(0, i - 8);
    const end = Math.min(data.length, i + 24);
    const context = Array.from(data.slice(start, end));
    console.log(`  ${context.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    found++;
  }
}

// Может где-то есть другой счетчик?
console.log('\n=== Проверка других возможных счетчиков ===');
const counter1Offset = patternOffset + 472;
const counter1 = data[counter1Offset] | (data[counter1Offset + 1] << 8);
console.log(`Counter1 (Pattern + 472): ${counter1} (0x${counter1.toString(16).toUpperCase()})`);

// Проверим другие возможные офсеты
const testOffsets = [470, 474, 476, 478, 480, 482];
testOffsets.forEach(off => {
  const val = data[patternOffset + off] | (data[patternOffset + off + 1] << 8);
  console.log(`Pattern + ${off}: ${val} (0x${val.toString(16).toUpperCase()})`);
});
