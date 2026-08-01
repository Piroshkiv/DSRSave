const fs = require('fs');

// Пути к файлам
const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (6).bin';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\public\\json\\ds3_items.json';

// Паттерн для поиска
const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const INVENTORY_OFFSET = 0x12C;
const SLOT_SIZE = 16; // 16 байт на слот (4 предмета по 4 байта)
const ITEMS_PER_SLOT = 4;
const ITEM_SIZE = 4;
const MAX_SLOTS = 75; // 75 слотов * 4 предмета = 300 предметов

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

/**
 * Получить базовый ID без upgrade level и infusion
 * Основываясь на логике из Final.py:
 * - Upgrade level хранится в первом байте (byte 0)
 * - Базовый ID нужно найти округлив вниз
 */
function getBaseItemId(rawId) {
  // Для оружия: первый байт = base + upgrade level
  // Округляем первый байт вниз до ближайшего кратного 10 (или другая логика)
  // Проще: просто обнуляем младшие биты первого байта

  const bytes = [
    rawId & 0xFF,
    (rawId >> 8) & 0xFF,
    (rawId >> 16) & 0xFF,
    (rawId >> 24) & 0xFF
  ];

  // Вариант 1: обнуляем первый байт (самый простой)
  const baseId1 = (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);

  // Вариант 2: округляем первый байт вниз (кратно 16 или 10)
  const baseByte0 = bytes[0] - (bytes[0] % 16);
  const baseId2 = baseByte0 | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24);

  // Вариант 3: просто отнимаем возможный upgrade (0-10)
  const bases = [];
  for (let i = 0; i <= 15; i++) {
    const testBase = rawId - i;
    bases.push(testBase);
  }

  return { rawId, baseId1, baseId2, possibleBases: bases };
}

function main() {
  console.log('Reading files...');
  const saveData = fs.readFileSync(SAVE_FILE);
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

  const patternOffset = findPattern(saveData, PATTERN);
  if (patternOffset === -1) {
    console.error('Pattern not found!');
    process.exit(1);
  }

  console.log(`Pattern found at: 0x${patternOffset.toString(16).toUpperCase()}`);

  const inventoryStart = patternOffset + INVENTORY_OFFSET;
  console.log(`Inventory starts at: 0x${inventoryStart.toString(16).toUpperCase()}`);

  // Создаем карту ID->item
  const itemMap = new Map();

  function addItems(items, category) {
    if (!items) return;
    items.forEach(item => {
      const id = hexToInt(item.Id);
      if (!itemMap.has(id)) {
        itemMap.set(id, { ...item, category, instances: [] });
      }
    });
  }

  addItems(jsonData.weapon_items, 'weapon');
  addItems(jsonData.armor_items, 'armor');
  addItems(jsonData.ring_items, 'ring');

  console.log(`Loaded ${itemMap.size} items from database\n`);

  // Парсим инвентарь
  console.log('Parsing inventory...\n');

  const items = [];
  let matched = 0;

  for (let slotIdx = 0; slotIdx < MAX_SLOTS; slotIdx++) {
    const slotOffset = inventoryStart + slotIdx * SLOT_SIZE;

    for (let itemIdx = 0; itemIdx < ITEMS_PER_SLOT; itemIdx++) {
      const itemOffset = slotOffset + itemIdx * ITEM_SIZE;

      // Читаем 4 байта как uint32 little-endian
      const itemIdRaw = saveData.readUInt32LE(itemOffset);

      if (itemIdRaw === 0 || itemIdRaw === 0xFFFFFFFF) continue;

      // Пробуем найти в базе
      const baseInfo = getBaseItemId(itemIdRaw);
      let dbItem = null;

      // Пробуем точное совпадение
      dbItem = itemMap.get(itemIdRaw);

      // Если не нашли, пробуем возможные базовые ID
      if (!dbItem) {
        for (const baseId of baseInfo.possibleBases) {
          if (itemMap.has(baseId)) {
            dbItem = itemMap.get(baseId);
            break;
          }
        }
      }

      const item = {
        slotIdx,
        itemIdx,
        offset: itemOffset,
        rawId: itemIdRaw,
        rawHex: itemIdRaw.toString(16).toUpperCase().padStart(8, '0'),
        upgradeLevel: dbItem ? (itemIdRaw - hexToInt(dbItem.Id)) : null,
        dbItem
      };

      items.push(item);

      if (dbItem) {
        matched++;
        dbItem.instances.push(item);
      }
    }
  }

  console.log(`Total items found: ${items.length}`);
  console.log(`Matched with database: ${matched}`);
  console.log(`Unmatched: ${items.length - matched}\n`);

  // Показываем примеры
  console.log('=== Sample Matched Items (first 20) ===');
  items.filter(i => i.dbItem).slice(0, 20).forEach(item => {
    console.log(`Slot ${item.slotIdx}.${item.itemIdx}: ${item.dbItem.Name}`);
    console.log(`  Raw ID: 0x${item.rawHex}`);
    if (item.upgradeLevel !== null && item.upgradeLevel > 0) {
      console.log(`  Upgrade: +${item.upgradeLevel}`);
    }
  });

  console.log('\n=== Sample Unmatched Items (first 10) ===');
  items.filter(i => !i.dbItem).slice(0, 10).forEach(item => {
    console.log(`Slot ${item.slotIdx}.${item.itemIdx}: Unknown`);
    console.log(`  Raw ID: 0x${item.rawHex}`);
  });

  // Анализируем MaxUpgrade
  console.log('\n=== Weapons with Upgrade ===');
  const weaponUpgrades = new Map();

  items.filter(i => i.dbItem && i.dbItem.category === 'weapon' && i.upgradeLevel !== null).forEach(item => {
    const baseId = hexToInt(item.dbItem.Id);
    const current = weaponUpgrades.get(baseId) || { name: item.dbItem.Name, maxUpgrade: 0 };
    current.maxUpgrade = Math.max(current.maxUpgrade, Math.abs(item.upgradeLevel));
    weaponUpgrades.set(baseId, current);
  });

  let count = 0;
  for (const [id, data] of weaponUpgrades.entries()) {
    if (data.maxUpgrade > 0 && count < 15) {
      console.log(`${data.name}: max +${data.maxUpgrade}`);
      count++;
    }
  }

  // Обновляем JSON с MaxUpgrade
  console.log('\n=== Updating JSON with MaxUpgrade ===');

  let updated = 0;

  if (jsonData.weapon_items) {
    jsonData.weapon_items.forEach(item => {
      const id = hexToInt(item.Id);
      const upgradeData = weaponUpgrades.get(id);

      if (upgradeData && upgradeData.maxUpgrade > 0) {
        item.MaxUpgrade = upgradeData.maxUpgrade;
        updated++;
      }
    });
  }

  console.log(`Updated ${updated} weapons with MaxUpgrade`);

  // Сохраняем
  console.log('\nSaving updated JSON...');
  fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');

  console.log('✓ Done!');
}

main();
