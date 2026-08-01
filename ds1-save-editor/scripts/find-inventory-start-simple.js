const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Константы из DS3
const BND4_HEADER_SIZE = 0x40;
const ENTRY_HEADER_SIZE = 0x20;
const BND4_SIGNATURE = [0x42, 0x4E, 0x44, 0x34]; // "BND4"

const AES_KEY = Buffer.from([
  0xFD, 0x46, 0x4D, 0x69, 0x5E, 0x69, 0xA3, 0x9A,
  0x10, 0xE3, 0x19, 0xA7, 0xAC, 0xE8, 0xB7, 0xFA
]);

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
        // Конвертируем hex string в число
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

// Функция декриптования AES-CBC
function decryptAesCbc(encryptedData, iv) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
  decipher.setAutoPadding(false);
  const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
  return decrypted;
}

// Функция извлечения слота из .sl2 файла
function extractSlot(saveBuffer, slotIndex) {
  // Проверяем BND4 сигнатуру
  for (let i = 0; i < BND4_SIGNATURE.length; i++) {
    if (saveBuffer[i] !== BND4_SIGNATURE[i]) {
      throw new Error('Not a valid BND4 file (invalid signature)');
    }
  }

  // Читаем количество слотов
  const entryCount = saveBuffer.readUInt32LE(0x0C);
  console.log(`Found ${entryCount} character slots in save file`);

  if (slotIndex >= entryCount) {
    throw new Error(`Slot ${slotIndex} not found (only ${entryCount} slots available)`);
  }

  // Вычисляем оффсет заголовка слота
  const entryHeaderOffset = BND4_HEADER_SIZE + (slotIndex * ENTRY_HEADER_SIZE);

  // Читаем размер и оффсет данных
  const entrySize = Number(saveBuffer.readBigUInt64LE(entryHeaderOffset + 0x08));
  const entryDataOffset = saveBuffer.readUInt32LE(entryHeaderOffset + 0x10);

  console.log(`Slot ${slotIndex} - Size: ${entrySize} bytes, Data offset: 0x${entryDataOffset.toString(16)}`);

  // Читаем MD5 (16 bytes)
  const storedChecksum = saveBuffer.slice(entryDataOffset, entryDataOffset + 16);

  // Читаем IV (16 bytes)
  const iv = saveBuffer.slice(entryDataOffset + 16, entryDataOffset + 32);

  // Читаем зашифрованные данные
  const encryptedDataSize = entrySize - 32;
  const encryptedData = saveBuffer.slice(
    entryDataOffset + 32,
    entryDataOffset + 32 + encryptedDataSize
  );

  // Проверяем MD5
  const dataToHash = saveBuffer.slice(
    entryDataOffset + 16,
    entryDataOffset + 16 + 16 + encryptedDataSize
  );
  const computedChecksum = crypto.createHash('md5').update(dataToHash).digest();

  if (!storedChecksum.equals(computedChecksum)) {
    console.warn('WARNING: MD5 checksum mismatch! Proceeding anyway...');
  } else {
    console.log('MD5 checksum OK!');
  }

  // Декриптуем данные
  const decryptedData = decryptAesCbc(encryptedData, iv);
  console.log(`Decrypted ${decryptedData.length} bytes\n`);

  return decryptedData;
}

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
function findInventoryStart(savePath, slotIndex) {
  const saveBuffer = fs.readFileSync(savePath);

  // Извлекаем и декриптуем слот
  const characterData = extractSlot(saveBuffer, slotIndex);

  // Ищем паттерн 1 в декриптованных данных
  const pattern1Offset = findPattern(characterData, PATTERN1);
  if (pattern1Offset === -1) {
    console.error('Паттерн 1 не найден!');
    return;
  }

  console.log(`Паттерн 1 найден на оффсете: 0x${pattern1Offset.toString(16).toUpperCase()}`);
  console.log(`Известный оффсет количества предмета: 0x404 (относительно паттерна 1)\n`);

  const knownQuantityOffset = 0x404;
  const absoluteQuantityOffset = pattern1Offset + knownQuantityOffset;

  console.log('=' .repeat(100));
  console.log('Идем НАЗАД от известного предмета, пытаясь парсить структуру предметов...');
  console.log('=' .repeat(100));
  console.log('');

  console.log('Offset (rel) | Offset (abs) | Hex Data (16 bytes)                              | Separator | ItemID     | Qty | Name');
  console.log('-'.repeat(150));

  const ITEM_STRUCT_SIZE = 16; // Размер структуры предмета в DS3

  // Идем назад с шагом 16 байт (размер структуры)
  // Начинаем с 0x404, но это оффсет КОЛИЧЕСТВА (байт 8), значит начало структуры на 8 байт раньше
  const firstItemStructStart = knownQuantityOffset - 8;

  for (let i = 0; i < 200; i++) { // 200 предметов максимум
    const relOffset = firstItemStructStart - (i * ITEM_STRUCT_SIZE);
    const absOffset = pattern1Offset + relOffset;

    if (absOffset < 0 || absOffset >= characterData.length - ITEM_STRUCT_SIZE) break;

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

    console.log(
      `${relOffsetHex.padEnd(12)} | ${absOffsetHex.padEnd(12)} | ${hexString.padEnd(48)} | ${separatorHex.padEnd(9)} | ${itemIdHex} | ${quantity.toString().padStart(3)} | ${itemName}`
    );
  }

  console.log('\n' + '='.repeat(100));
  console.log('Поиск завершен. Когда начнутся нулевые/неверные данные - это начало инвентаря!');
  console.log('='.repeat(100));
}

// Получаем путь к сейв файлу и слот из аргументов командной строки
const savePath = process.argv[2];
const slotIndex = parseInt(process.argv[3] || '0', 10);

if (!savePath) {
  console.error('Usage: node find-inventory-start-simple.js <path-to-save-file> [slot-index]');
  console.error('Example: node find-inventory-start-simple.js "C:\\Users\\...\\DS30000.sl2" 0');
  process.exit(1);
}

if (!fs.existsSync(savePath)) {
  console.error(`File not found: ${savePath}`);
  process.exit(1);
}

console.log(`Analyzing save file: ${savePath}`);
console.log(`Character slot: ${slotIndex}\n`);

findInventoryStart(savePath, slotIndex);
