const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (10).bin'; // Save editor

console.log('Проверка save editor файла...\n');

const data = fs.readFileSync(SAVE_FILE);

console.log('=== Поиск всех Shortsword (0x80 0x84 0x1E 0x00) ===\n');

let count = 0;
for (let i = 0; i < data.length - 3; i++) {
  if (data[i] === 0x80 && data[i + 1] === 0x84 && data[i + 2] === 0x1E && data[i + 3] === 0x00) {
    const start = i - 4;
    const bytes = Array.from(data.slice(start, start + 16));

    const b01 = bytes[0] | (bytes[1] << 8);
    const sep = bytes[2] | (bytes[3] << 8);
    const b12 = bytes[12];
    const b1415 = bytes[14] | (bytes[15] << 8);
    const qty = bytes[8];

    console.log(`Shortsword по адресу 0x${start.toString(16).toUpperCase()}:`);
    console.log(`  ${bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    console.log(`  Bytes 0-1: ${b01} (0x${b01.toString(16).toUpperCase()})`);
    console.log(`  Separator: 0x${sep.toString(16).toUpperCase()}`);
    console.log(`  Byte 12: ${b12}`);
    console.log(`  Bytes 14-15: 0x${b1415.toString(16).toUpperCase()}`);
    console.log(`  Quantity: ${qty}`);
    console.log('');

    count++;
    if (count >= 5) break;
  }
}

console.log(`Всего найдено: ${count} Shortsword(s)`);
