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
const SLOT_SIZE = 16;
const ITEMS_PER_SLOT = 4;
const ITEM_SIZE = 4;
const MAX_SLOTS = 75;

// Максимальный upgrade для каждого типа оружия (обычно +10, для boss/unique +5)
const DEFAULT_MAX_UPGRADE = 10;
const BOSS_WEAPON_MAX_UPGRADE = 5;

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
 * Конвертация raw ID в базовый ID
 * Младшие 2 байта содержат ID + upgrade level
 * Старшие 2 байта - префикс/флаги (обычно 0x8080 для оружия, 0x8090 для брони, etc)
 */
function parseRawId(rawId) {
  // Извлекаем младшие 2 байта
  const lowerBytes = rawId & 0xFFFF;
  const upperBytes = (rawId >> 16) & 0xFFFF;

  // Первый байт младших 2-х байт содержит базовое значение + upgrade
  const byte0 = lowerBytes & 0xFF;
  const byte1 = (lowerBytes >> 8) & 0xFF;

  // Для поиска базового ID пробуем варианты upgrade 0-15
  const possibleBaseIds = [];
  for (let upgrade = 0; upgrade <= 15; upgrade++) {
    const baseByte0 = byte0 - upgrade;
    if (baseByte0 >= 0) {
      const baseId = baseByte0 | (byte1 << 8) | (upperBytes << 16);
      possibleBaseIds.push({ baseId, upgradeLevel: upgrade });
    }
  }

  return { rawId, lowerBytes, upperBytes, byte0, byte1, possibleBaseIds };
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
  console.log(`Inventory starts at: 0x${inventoryStart.toString(16).toUpperCase()}\n`);

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

  console.log(`Loaded ${itemMap.size} items from database`);

  // Парсим инвентарь
  console.log('Parsing inventory...\n');

  const items = [];
  let matched = 0;

  for (let slotIdx = 0; slotIdx < MAX_SLOTS; slotIdx++) {
    const slotOffset = inventoryStart + slotIdx * SLOT_SIZE;

    for (let itemIdx = 0; itemIdx < ITEMS_PER_SLOT; itemIdx++) {
      const itemOffset = slotOffset + itemIdx * ITEM_SIZE;
      const itemIdRaw = saveData.readUInt32LE(itemOffset);

      if (itemIdRaw === 0 || itemIdRaw === 0xFFFFFFFF) continue;

      const parsed = parseRawId(itemIdRaw);
      let dbItem = null;
      let upgradeLevel = 0;

      // Пробуем найти в базе по всем возможным baseId
      for (const { baseId, upgradeLevel: upgrade } of parsed.possibleBaseIds) {
        if (itemMap.has(baseId)) {
          dbItem = itemMap.get(baseId);
          upgradeLevel = upgrade;
          break;
        }
      }

      const item = {
        slotIdx,
        itemIdx,
        offset: itemOffset,
        rawId: itemIdRaw,
        rawHex: itemIdRaw.toString(16).toUpperCase().padStart(8, '0'),
        upgradeLevel,
        dbItem,
        parsed
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

  // Примеры
  console.log('=== Sample Matched Items (first 20) ===');
  items.filter(i => i.dbItem).slice(0, 20).forEach(item => {
    let name = item.dbItem.Name;
    if (item.upgradeLevel > 0 && item.dbItem.category === 'weapon') {
      name += ` +${item.upgradeLevel}`;
    }
    console.log(`${name} (0x${item.rawHex})`);
  });

  // Анализ MaxUpgrade
  console.log('\n=== Analyzing MaxUpgrade ===');

  const weaponUpgrades = new Map();

  items.filter(i => i.dbItem && i.dbItem.category === 'weapon').forEach(item => {
    const baseId = hexToInt(item.dbItem.Id);
    const current = weaponUpgrades.get(baseId) || {
      name: item.dbItem.Name,
      maxUpgrade: 0,
      count: 0
    };
    current.maxUpgrade = Math.max(current.maxUpgrade, item.upgradeLevel);
    current.count++;
    weaponUpgrades.set(baseId, current);
  });

  console.log(`Found ${weaponUpgrades.size} unique weapons in inventory`);
  console.log('Top upgraded weapons:');
  [...weaponUpgrades.values()]
    .filter(w => w.maxUpgrade > 0)
    .sort((a, b) => b.maxUpgrade - a.maxUpgrade)
    .slice(0, 15)
    .forEach(w => {
      console.log(`  ${w.name}: +${w.maxUpgrade}`);
    });

  // Обновляем JSON с MaxUpgrade
  console.log('\n=== Updating JSON ===');

  let weaponsUpdated = 0;
  let armorUpdated = 0;
  let ringsUpdated = 0;

  // Для оружия: добавляем MaxUpgrade
  if (jsonData.weapon_items) {
    jsonData.weapon_items.forEach(item => {
      const id = hexToInt(item.Id);
      const upgradeData = weaponUpgrades.get(id);

      if (upgradeData && upgradeData.maxUpgrade > 0) {
        // Определяем максимальный upgrade: обычно +10, но для boss/unique оружия +5
        // Если видим что реальный maxUpgrade <= 5, ставим 5, иначе 10
        const maxUpgrade = upgradeData.maxUpgrade <= 5 ? BOSS_WEAPON_MAX_UPGRADE : DEFAULT_MAX_UPGRADE;
        item.MaxUpgrade = maxUpgrade;
        weaponsUpdated++;
      } else {
        // Если не нашли в инвентаре, ставим дефолтное значение
        item.MaxUpgrade = DEFAULT_MAX_UPGRADE;
      }

      // Durability - пока оставляем null (нужно больше анализа структуры)
      if (!item.Durability) {
        item.Durability = null;
      }
    });
  }

  // Для брони и колец: добавляем Durability (пока null)
  if (jsonData.armor_items) {
    jsonData.armor_items.forEach(item => {
      if (!item.Durability) {
        item.Durability = null;
        armorUpdated++;
      }
    });
  }

  if (jsonData.ring_items) {
    jsonData.ring_items.forEach(item => {
      if (!item.Durability) {
        item.Durability = null;
        ringsUpdated++;
      }
    });
  }

  console.log(`Updated weapons: ${weaponsUpdated}`);
  console.log(`Updated armor: ${armorUpdated}`);
  console.log(`Updated rings: ${ringsUpdated}`);

  // Сохраняем
  console.log('\nSaving updated JSON...');
  fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');

  console.log('✓ Done!');
  console.log('\nNote: Durability values are set to null (needs more analysis of save structure)');
  console.log('MaxUpgrade is set based on inventory data or defaults (10 for normal, 5 for boss weapons)');
}

main();
