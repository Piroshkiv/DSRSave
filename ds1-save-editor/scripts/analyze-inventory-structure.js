const fs = require('fs');

// Пути к файлам
const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (7).bin';

// Паттерн для поиска
const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

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

function main() {
  const saveData = fs.readFileSync(SAVE_FILE);

  const patternOffset = findPattern(saveData, PATTERN);
  if (patternOffset === -1) {
    console.error('ERROR: Pattern not found!');
    process.exit(1);
  }

  console.log(`Pattern found at: 0x${patternOffset.toString(16).toUpperCase()}\n`);

  // Попробуем оба offset
  const offsets = [0x09C, 0x12C];

  for (const offset of offsets) {
    const startPos = patternOffset + offset;
    console.log(`\n=== Inventory at offset ${offset.toString(16).toUpperCase()} (absolute: 0x${startPos.toString(16).toUpperCase()}) ===\n`);

    // Читаем первые 10 слотов с разными размерами слота
    const slotSizes = [4, 8, 12, 16, 20];

    for (const slotSize of slotSizes) {
      console.log(`\n--- Slot size: ${slotSize} bytes ---`);

      for (let i = 0; i < 5; i++) {
        const slotOffset = startPos + i * slotSize;
        const bytes = [];

        for (let j = 0; j < slotSize; j++) {
          if (slotOffset + j < saveData.length) {
            bytes.push(saveData[slotOffset + j].toString(16).toUpperCase().padStart(2, '0'));
          }
        }

        // Читаем как uint32 LE первые 4 байта
        let itemId = 0;
        if (slotOffset + 4 <= saveData.length) {
          itemId = saveData.readUInt32LE(slotOffset);
        }

        console.log(`Slot ${i}: ${bytes.join(' ')} (ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')})`);
      }
    }
  }

  // Теперь давайте поищем известный ID в файле и посмотрим контекст вокруг
  console.log('\n\n=== Searching for known weapon IDs ===\n');

  // Bandit's Knife +10 = 0x000F695A (из предыдущего вывода)
  const knifeId = 0x000F695A;
  const knifeBuf = Buffer.allocUnsafe(4);
  knifeBuf.writeUInt32LE(knifeId, 0);

  console.log(`Searching for Bandit's Knife +10 (0x${knifeId.toString(16).toUpperCase()})...`);

  for (let i = 0; i < saveData.length - 4; i++) {
    if (saveData.readUInt32LE(i) === knifeId) {
      console.log(`\nFound at offset 0x${i.toString(16).toUpperCase()}`);

      // Показываем 32 байта до и 32 байта после
      const contextStart = Math.max(0, i - 32);
      const contextEnd = Math.min(saveData.length, i + 32);

      console.log('Context (32 bytes before and after):');
      for (let j = contextStart; j < contextEnd; j += 16) {
        const bytes = [];
        for (let k = 0; k < 16 && j + k < contextEnd; k++) {
          bytes.push(saveData[j + k].toString(16).toUpperCase().padStart(2, '0'));
        }
        const marker = (j <= i && i < j + 16) ? ` <- ID at offset ${i - j}` : '';
        console.log(`  0x${j.toString(16).toUpperCase()}: ${bytes.join(' ')}${marker}`);
      }
    }
  }
}

main();
