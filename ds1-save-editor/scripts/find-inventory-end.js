const fs = require('fs');
const path = require('path');

// Паттерн 1 из constants.ts
const PATTERN1 = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

// Загружаем ds3_items.json
const itemsJsonPath = path.join(__dirname, '../public/json/ds3_items.json');
const itemsData = JSON.parse(fs.readFileSync(itemsJsonPath, 'utf8'));

// Создаем Map для быстрого поиска по ID
const itemsById = new Map();

// Обрабатываем все категории предметов
Object.keys(itemsData).forEach(category => {
  if (Array.isArray(itemsData[category])) {
    itemsData[category].forEach(item => {
      if (item.Id) {
        const id = parseInt(item.Id, 16);
        itemsById.set(id, {
          name: item.Name,
          category: category,
          maxStack: item.MaxStackCount || 1
        });
      }
    });
  }
});

console.log(`Loaded ${itemsById.size} items from ds3_items.json\n`);

// Функция поиска паттерна в буфере
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

// Основная функция
function findInventoryEnd(binPath) {
  const characterData = fs.readFileSync(binPath);

  console.log(`Character data size: ${characterData.length} bytes\n`);

  // Ищем паттерн 1 в данных
  const pattern1Offset = findPattern(characterData, PATTERN1);
  if (pattern1Offset === -1) {
    console.error('Паттерн 1 не найден!');
    return;
  }

  console.log(`Паттерн 1 найден на оффсете: 0x${pattern1Offset.toString(16).toUpperCase()}`);

  const inventoryStartOffset = 0x09C; // Предполагаемое начало инвентаря

  console.log(`Начало инвентаря (предположительно): 0x09C (относительно паттерна 1)\n`);

  console.log('=' .repeat(100));
  console.log('Идем ВПЕРЁД от начала инвентаря (0x09C), ищем конец...');
  console.log('=' .repeat(100));
  console.log('');

  console.log('Offset (rel) | Offset (abs) | Hex Data (16 bytes)                              | Separator | ItemID     | Qty | Name');
  console.log('-'.repeat(150));

  const ITEM_STRUCT_SIZE = 16; // Размер структуры предмета в DS3

  // Идем вперёд с шагом 16 байт (размер структуры)
  for (let i = 0; i < 2000; i++) { // 300 структур (достаточно чтобы дойти до конца)
    const relOffset = inventoryStartOffset + (i * ITEM_STRUCT_SIZE);
    const absOffset = pattern1Offset + relOffset;

    if (absOffset >= characterData.length - ITEM_STRUCT_SIZE) break;

    // Читаем 16 байт структуры
    const structData = characterData.slice(absOffset, absOffset + ITEM_STRUCT_SIZE);
    const hexString = Array.from(structData)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    // Парсим структуру согласно формату DS3:
    // Байт 3: Разделитель (0xB0 или 0xA0)
    const separator = structData[3];

    // Байты 4-7: Item ID (little-endian)
    const itemId = structData.readUInt32LE(4);

    // Байт 8: Количество
    const quantity = structData[8];

    // Ищем предмет
    const item = itemsById.get(itemId);

    const relOffsetHex = `0x${relOffset.toString(16).toUpperCase().padStart(3, '0')}`;
    const absOffsetHex = `0x${absOffset.toString(16).toUpperCase()}`;
    const separatorHex = `0x${separator.toString(16).toUpperCase().padStart(2, '0')}`;
    const itemIdHex = `0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`;
    const itemName = item ? item.name : '[UNKNOWN/GARBAGE]';

    // Выводим только интересные строки (не пустые нулевые блоки подряд)
    const isZeroBlock = structData.every(b => b === 0x00);
    const isFFBlock = structData.slice(0, 4).every(b => b === 0xFF) &&
                      structData.slice(4, 8).every(b => b === 0x00);

    // Пропускаем повторяющиеся блоки мусора, но показываем первый и последний
    if (!isZeroBlock && !isFFBlock) {
      console.log(
        `${relOffsetHex.padEnd(12)} | ${absOffsetHex.padEnd(12)} | ${hexString.padEnd(48)} | ${separatorHex.padEnd(9)} | ${itemIdHex} | ${quantity.toString().padStart(3)} | ${itemName}`
      );
    } else if (i === 0 || i < 5) {
      // Показываем первые несколько блоков мусора
      console.log(
        `${relOffsetHex.padEnd(12)} | ${absOffsetHex.padEnd(12)} | ${hexString.padEnd(48)} | ${separatorHex.padEnd(9)} | ${itemIdHex} | ${quantity.toString().padStart(3)} | [GARBAGE/EMPTY]`
      );
    } else if (i > 5 && i < 10) {
      // Пропускаем, но показываем точки
      if (i === 6) {
        console.log('... (repeating garbage blocks) ...');
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('Поиск завершен!');
  console.log('='.repeat(100));
}

// Получаем путь к bin файлу из аргументов командной строки
const binPath = process.argv[2];

if (!binPath) {
  console.error('Usage: node find-inventory-end.js <path-to-bin-file>');
  console.error('Example: node find-inventory-end.js "C:\\Users\\...\\character_slot1_raw.bin"');
  process.exit(1);
}

if (!fs.existsSync(binPath)) {
  console.error(`File not found: ${binPath}`);
  process.exit(1);
}

console.log(`Analyzing bin file: ${binPath}\n`);

findInventoryEnd(binPath);
