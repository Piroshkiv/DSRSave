const fs = require('fs');

// Пути к файлам
const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (7).bin';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\dist\\json\\ds3_items.json';

// Паттерн для поиска начала инвентаря
const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const INVENTORY_OFFSET = 0x09C;
const ITEM_SIZE = 16; // Один предмет = 16 байт
const SEPARATOR_OFFSET = 3; // Separator/Type на позиции байт 3
const ITEMID_OFFSET = 4; // Item ID на позиции байт 4-7 (4 байта LE)
const QUANTITY_OFFSET = 8; // Количество на позиции байт 8
const MAX_ITEMS = 3000; // Максимальное количество предметов для сканирования

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

function hexToInt(hex) {
  return parseInt(hex.replace(/0x/i, ''), 16);
}

function parseRawId(rawId) {
  const lowerBytes = rawId & 0xFFFF;
  const upperBytes = (rawId >> 16) & 0xFFFF;
  const byte0 = lowerBytes & 0xFF;
  const byte1 = (lowerBytes >> 8) & 0xFF;

  const possibleBaseIds = [];

  // Проверяем без upgrade
  possibleBaseIds.push({ baseId: rawId, upgradeLevel: 0 });

  // Для оружия: пробуем варианты с upgrade (byte0 может содержать уровень улучшения)
  for (let upgrade = 1; upgrade <= 15; upgrade++) {
    const baseByte0 = byte0 - upgrade;
    if (baseByte0 >= 0) {
      const baseId = baseByte0 | (byte1 << 8) | (upperBytes << 16);
      possibleBaseIds.push({ baseId, upgradeLevel: upgrade });
    }
  }

  return { rawId, possibleBaseIds };
}

function main() {
  console.log('Step 1: Reading JSON file...');
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

  // Собираем все предметы из всех категорий
  const allCategories = [
    'weapon_items',
    'armor_items',
    'ring_items',
    'magic_items',
    'consumable_items'
  ];

  // Создаем карту ID->item для быстрого поиска
  const itemMap = new Map();
  let totalItems = 0;

  for (const category of allCategories) {
    if (!jsonData[category]) {
      console.log(`Warning: Category ${category} not found`);
      continue;
    }

    jsonData[category].forEach((item, index) => {
      const id = hexToInt(item.Id);
      itemMap.set(id, {
        item,
        category,
        index
      });
      totalItems++;
    });
  }

  console.log(`Loaded ${totalItems} items from JSON across ${allCategories.length} categories`);

  console.log('\nStep 2: Reading save file...');
  const saveData = fs.readFileSync(SAVE_FILE);
  const patternOffset = findPattern(saveData, PATTERN);

  if (patternOffset === -1) {
    console.error('ERROR: Pattern not found in save file!');
    process.exit(1);
  }

  const inventoryStart = patternOffset + INVENTORY_OFFSET;
  console.log(`Inventory found at: 0x${inventoryStart.toString(16).toUpperCase()}`);

  console.log('\nStep 3: Parsing inventory and extracting MaxStackCount...');

  // Карта для хранения найденного максимального количества для каждого ID
  const maxStackMap = new Map(); // id -> maxCount

  let totalItemsScanned = 0;
  let emptySlots = 0;
  let foundItems = 0;
  const notFoundIds = new Set();
  const notFoundSamples = [];

  for (let itemIdx = 0; itemIdx < MAX_ITEMS; itemIdx++) {
    const itemOffset = inventoryStart + itemIdx * ITEM_SIZE;

    // Проверяем не вышли ли за границы файла
    if (itemOffset + ITEM_SIZE > saveData.length) {
      console.log(`Reached end of file at item ${itemIdx}`);
      break;
    }

    // Читаем separator (байт 3)
    const separator = saveData.readUInt8(itemOffset + SEPARATOR_OFFSET);
    // Читаем Item ID (4 байта с позиции 4, Little Endian)
    const itemIdRaw = saveData.readUInt32LE(itemOffset + ITEMID_OFFSET);
    // Читаем количество (1 байт с позиции 8)
    const stackCount = saveData.readUInt8(itemOffset + QUANTITY_OFFSET);

    totalItemsScanned++;

    if (itemIdRaw === 0 || itemIdRaw === 0xFFFFFFFF) {
      emptySlots++;
      continue;
    }

    // Ограничиваем количество от 1 до 99
    let clampedCount = Math.max(1, Math.min(99, stackCount));

    // Ищем предмет по точному совпадению ID
    if (itemMap.has(itemIdRaw)) {
      const current = maxStackMap.get(itemIdRaw) || 0;
      maxStackMap.set(itemIdRaw, Math.max(current, clampedCount));
      foundItems++;
    } else {
      // Если точное совпадение не найдено, пробуем варианты с upgrade level (только для оружия)
      const parsed = parseRawId(itemIdRaw);
      let foundInDb = false;

      for (const { baseId } of parsed.possibleBaseIds) {
        if (itemMap.has(baseId)) {
          const current = maxStackMap.get(baseId) || 0;
          maxStackMap.set(baseId, Math.max(current, clampedCount));
          foundInDb = true;
          foundItems++;
          break;
        }
      }

      // Если не нашли - добавляем в список не найденных
      if (!foundInDb) {
        notFoundIds.add(itemIdRaw);
        if (notFoundSamples.length < 50) {
          notFoundSamples.push({
            id: '0x' + itemIdRaw.toString(16).toUpperCase().padStart(8, '0'),
            count: stackCount,
            offset: '0x' + itemOffset.toString(16).toUpperCase()
          });
        }
      }
    }
  }

  console.log(`Total items scanned: ${totalItemsScanned}`);
  console.log(`Empty items: ${emptySlots}`);
  console.log(`Non-empty items: ${totalItemsScanned - emptySlots}`);
  console.log(`Items matching database: ${foundItems}`);
  console.log(`Unique items found: ${maxStackMap.size}`);
  console.log(`Unique NOT found IDs: ${notFoundIds.size}`);

  // Показываем примеры не найденных ID
  if (notFoundSamples.length > 0) {
    console.log('\n=== First 50 NOT found items (samples) ===');
    notFoundSamples.forEach((sample, i) => {
      console.log(`${i + 1}. ID: ${sample.id}, Count: ${sample.count}, Offset: ${sample.offset}`);
    });
  }

  console.log('\nStep 4: Updating MaxStackCount in JSON...');

  let updatedCount = 0;
  let notFoundCount = 0;
  const notFoundByCategory = {};

  for (const category of allCategories) {
    if (!jsonData[category]) continue;

    notFoundByCategory[category] = 0;

    jsonData[category].forEach(item => {
      const id = hexToInt(item.Id);

      if (maxStackMap.has(id)) {
        item.MaxStackCount = maxStackMap.get(id);
        updatedCount++;
      } else {
        // Если не нашли в сейве - ставим 1
        item.MaxStackCount = 1;
        notFoundCount++;
        notFoundByCategory[category]++;
      }
    });
  }

  console.log(`Updated MaxStackCount for ${updatedCount} items from save`);
  console.log(`Set MaxStackCount=1 for ${notFoundCount} items not found in save`);

  console.log('\n=== Not found items breakdown by category ===');
  for (const category of allCategories) {
    if (notFoundByCategory[category] > 0) {
      const totalInCategory = jsonData[category] ? jsonData[category].length : 0;
      const percentage = totalInCategory > 0 ? ((notFoundByCategory[category] / totalInCategory) * 100).toFixed(1) : 0;
      console.log(`  ${category}: ${notFoundByCategory[category]} / ${totalInCategory} (${percentage}%)`);
    }
  }

  // Показываем статистику по найденным количествам
  console.log('\n=== Items with MaxStackCount > 1 ===');
  const stackableItems = [...maxStackMap.entries()]
    .filter(([id, count]) => count > 1)
    .map(([id, count]) => {
      const itemData = itemMap.get(id);
      return {
        id,
        count,
        name: itemData ? itemData.item.Name : 'Unknown',
        category: itemData ? itemData.category : 'Unknown'
      };
    })
    .sort((a, b) => b.count - a.count);

  console.log(`Found ${stackableItems.length} stackable items:`);
  stackableItems.slice(0, 30).forEach((item, i) => {
    console.log(`${i + 1}. ${item.name} - MaxStackCount: ${item.count} (${item.category})`);
  });

  if (stackableItems.length > 30) {
    console.log(`... and ${stackableItems.length - 30} more`);
  }

  // Сохраняем обновленный JSON
  console.log('\nStep 5: Saving updated JSON...');
  fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');

  console.log('\n✓ Done!');
  console.log(`\nSummary:`);
  console.log(`  - Total items in database: ${totalItems}`);
  console.log(`  - Items found in save: ${updatedCount}`);
  console.log(`  - Items NOT found in save (set to 1): ${notFoundCount}`);
  console.log(`  - Stackable items (>1): ${stackableItems.length}`);
}

main();
