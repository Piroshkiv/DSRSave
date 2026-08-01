const fs = require('fs');

// Пути к файлам
const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (6).bin';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\public\\json\\ds3_items.json';

// Паттерн для поиска начала инвентаря
const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const INVENTORY_OFFSET_FROM_PATTERN_1 = 0x09C; // Первый вариант
const INVENTORY_OFFSET_FROM_PATTERN_2 = 0x12C; // Второй вариант
const ITEM_SIZE = 16;
const MAX_SLOTS = 300;

// Separators для категорий
const SEPARATOR = {
  WEAPON: 0x80,
  ARMOR: 0x90,
  RING: 0xA0,
  CONSUMABLE: 0xB0
};

/**
 * Найти паттерн в буфере
 */
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

/**
 * Парсинг предмета из 16 байт
 */
function parseItem(itemData, slotIndex) {
  const separator = itemData[3];

  // Item ID (4 байта, little-endian)
  const itemId = itemData.readUInt32LE(4);

  // Для оружия: byte 8 содержит upgrade level в первых 4 битах
  const upgradeByte = itemData[8];
  const upgradeLevel = upgradeByte & 0x0F; // Младшие 4 бита

  // Durability может быть в bytes 9-11 (нужно проверить)
  // Обычно это float32 или uint16
  let durability = null;

  // Попробуем прочитать как float32 из байт 9-12
  if (separator === SEPARATOR.WEAPON || separator === SEPARATOR.ARMOR || separator === SEPARATOR.RING) {
    const durabilityBytes = itemData.slice(9, 13);
    if (durabilityBytes.every(b => b === 0)) {
      durability = null; // Пустое значение
    } else {
      // Попробуем прочитать как uint16 little-endian (байты 9-10)
      durability = itemData.readUInt16LE(9);
      // Если значение выглядит странным (> 10000), попробуем float
      if (durability > 10000 || durability === 0) {
        durability = itemData.readFloatLE(9);
        // Округлим до 2 знаков
        durability = Math.round(durability * 100) / 100;
      }
    }
  }

  // Проверка пустого слота
  const isEmpty = itemData.every(b => b === 0x00) ||
                 itemData.every(b => b === 0xFF) ||
                 itemId === 0 || itemId === 0xFFFFFFFF;

  return {
    slotIndex,
    isEmpty,
    separator,
    itemId,
    upgradeLevel: separator === SEPARATOR.WEAPON ? upgradeLevel : null,
    durability,
    raw: itemData.toString('hex').match(/.{1,2}/g).join(' ').toUpperCase()
  };
}

/**
 * Получить тип категории по separator
 */
function getCategoryName(separator) {
  switch (separator) {
    case SEPARATOR.WEAPON: return 'Weapon';
    case SEPARATOR.ARMOR: return 'Armor';
    case SEPARATOR.RING: return 'Ring';
    case SEPARATOR.CONSUMABLE: return 'Consumable';
    default: return 'Unknown';
  }
}

/**
 * Парсинг инвентаря с заданного offset
 */
function parseInventoryFrom(saveData, inventoryStart) {
  const items = [];
  const stats = {
    total: 0,
    weapons: 0,
    armor: 0,
    rings: 0,
    consumables: 0,
    empty: 0
  };

  for (let i = 0; i < MAX_SLOTS; i++) {
    const offset = inventoryStart + i * ITEM_SIZE;
    if (offset + ITEM_SIZE > saveData.length) break;

    const itemData = saveData.slice(offset, offset + ITEM_SIZE);
    const item = parseItem(itemData, i);

    if (!item.isEmpty) {
      items.push(item);
      stats.total++;

      const category = getCategoryName(item.separator);
      if (category === 'Weapon') stats.weapons++;
      else if (category === 'Armor') stats.armor++;
      else if (category === 'Ring') stats.rings++;
      else if (category === 'Consumable') stats.consumables++;
    } else {
      stats.empty++;
    }
  }

  return { items, stats };
}

/**
 * Главная функция
 */
function main() {
  console.log('Reading save file...');
  const saveData = fs.readFileSync(SAVE_FILE);
  console.log(`Save file size: ${saveData.length} bytes`);

  console.log('\nSearching for inventory pattern...');
  const patternOffset = findPattern(saveData, PATTERN);

  if (patternOffset === -1) {
    console.error('ERROR: Pattern not found in save file!');
    process.exit(1);
  }

  console.log(`Pattern found at offset: 0x${patternOffset.toString(16).toUpperCase()}`);

  // Попробуем оба offset
  const inventoryStart1 = patternOffset + INVENTORY_OFFSET_FROM_PATTERN_1;
  const inventoryStart2 = patternOffset + INVENTORY_OFFSET_FROM_PATTERN_2;

  console.log(`\nTrying offset 1: 0x${inventoryStart1.toString(16).toUpperCase()} (Pattern + 0x09C)`);
  console.log(`Trying offset 2: 0x${inventoryStart2.toString(16).toUpperCase()} (Pattern + 0x12C)`);

  // Пробуем оба offset и смотрим какой дает больше распознанных предметов
  const results1 = parseInventoryFrom(saveData, inventoryStart1);
  const results2 = parseInventoryFrom(saveData, inventoryStart2);

  console.log(`\nOffset 1 results: ${results1.items.length} items, ${results1.stats.weapons} weapons`);
  console.log(`Offset 2 results: ${results2.items.length} items, ${results2.stats.weapons} weapons`);

  // Выбираем лучший результат
  const { items, stats, inventoryStart } = results1.items.length > results2.items.length ?
    { ...results1, inventoryStart: inventoryStart1 } :
    { ...results2, inventoryStart: inventoryStart2 };

  console.log(`\nSelected offset: 0x${inventoryStart.toString(16).toUpperCase()}`);

  console.log('\n=== Inventory Statistics ===');
  console.log(`Total items: ${stats.total}`);
  console.log(`Weapons: ${stats.weapons}`);
  console.log(`Armor: ${stats.armor}`);
  console.log(`Rings: ${stats.rings}`);
  console.log(`Consumables: ${stats.consumables}`);
  console.log(`Empty slots: ${stats.empty}`);

  console.log('\n=== Sample Items (first 20) ===');
  items.slice(0, 20).forEach(item => {
    const category = getCategoryName(item.separator);
    console.log(`Slot ${item.slotIndex}: [${category}] ID=0x${item.itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    if (item.upgradeLevel !== null) console.log(`  Upgrade: +${item.upgradeLevel}`);
    if (item.durability !== null) console.log(`  Durability: ${item.durability}`);
    console.log(`  Raw: ${item.raw}`);
  });

  console.log('\nReading JSON database...');
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

  console.log('\nMatching items with database...');

  // Создаем карту ID -> item info
  const idMap = new Map();

  // Helper для добавления в карту
  function addToMap(items, category) {
    if (!items) return;
    items.forEach(item => {
      const id = parseInt(item.Id, 16);
      if (!idMap.has(id)) {
        idMap.set(id, { ...item, dbCategory: category, instances: [] });
      }
    });
  }

  addToMap(jsonData.weapon_items, 'weapon');
  addToMap(jsonData.armor_items, 'armor');
  addToMap(jsonData.ring_items, 'ring');
  addToMap(jsonData.consumable_items, 'consumable');

  console.log(`Database has ${idMap.size} unique items`);

  // Сопоставляем найденные предметы с базой
  let matched = 0;
  let withDurability = 0;
  let withUpgrade = 0;

  items.forEach(item => {
    const dbItem = idMap.get(item.itemId);
    if (dbItem) {
      matched++;
      dbItem.instances.push(item);

      if (item.durability !== null && item.durability !== 0) withDurability++;
      if (item.upgradeLevel !== null && item.upgradeLevel > 0) withUpgrade++;
    }
  });

  console.log(`\nMatched ${matched} out of ${items.length} items`);
  console.log(`Items with durability data: ${withDurability}`);
  console.log(`Items with upgrade level > 0: ${withUpgrade}`);

  // Показываем примеры с durability и upgrade
  console.log('\n=== Weapons with Upgrade ===');
  items.filter(i => i.separator === SEPARATOR.WEAPON && i.upgradeLevel > 0).slice(0, 10).forEach(item => {
    const dbItem = idMap.get(item.itemId);
    if (dbItem) {
      console.log(`${dbItem.Name} +${item.upgradeLevel}`);
      if (item.durability !== null) console.log(`  Durability: ${item.durability}`);
    }
  });

  console.log('\n=== Armor with Durability ===');
  items.filter(i => i.separator === SEPARATOR.ARMOR && i.durability !== null && i.durability > 0).slice(0, 10).forEach(item => {
    const dbItem = idMap.get(item.itemId);
    if (dbItem) {
      console.log(`${dbItem.Name}`);
      console.log(`  Durability: ${item.durability}`);
      console.log(`  Raw: ${item.raw}`);
    }
  });

  // Анализ структуры для определения максимального upgrade
  console.log('\n=== Analyzing Max Upgrade Levels ===');

  const weaponUpgrades = new Map();

  items.filter(i => i.separator === SEPARATOR.WEAPON).forEach(item => {
    const baseId = item.itemId - (item.itemId % 256); // Убираем upgrade level
    const current = weaponUpgrades.get(baseId) || { maxUpgrade: 0, count: 0 };
    current.maxUpgrade = Math.max(current.maxUpgrade, item.upgradeLevel);
    current.count++;
    weaponUpgrades.set(baseId, current);
  });

  console.log(`Found ${weaponUpgrades.size} unique weapon types`);
  console.log('Sample max upgrades:');
  let count = 0;
  for (const [baseId, data] of weaponUpgrades.entries()) {
    const dbItem = idMap.get(baseId);
    if (dbItem && data.maxUpgrade > 0 && count < 10) {
      console.log(`  ${dbItem.Name}: max +${data.maxUpgrade} (found ${data.count} instances)`);
      count++;
    }
  }

  console.log('\nDone! Check output above for durability and upgrade patterns.');
}

main();
