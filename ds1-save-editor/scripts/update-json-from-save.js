const fs = require('fs');

// Пути к файлам
const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (6).bin';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\public\\json\\ds3_items.json';

/**
 * Основываясь на анализе Python кода и данных в Final.py:
 * - Каждый слот = 4 байта (не 16!)
 * - Byte 0: upgrade level / quantity
 * - Byte 1: unknown
 * - Byte 2: separator (0x80=weapon, 0x90=armor, 0xA0=ring, 0xB0=consumable)
 * - Byte 3: некий флаг
 *
 * Item ID хранится отдельно в другом месте. Давайте попробуем другой подход:
 * смотрим на JSON из Python проекта - там weapon ID это 4 байта.
 *
 * Пример из weapons.json: "Dagger": "40 42 0F 00" (little-endian)
 * В нашем инвентаре мы ищем этот паттерн.
 */

// Паттерн для поиска начала character data
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

function hexToInt(hex) {
  return parseInt(hex, 16);
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

  console.log(`Pattern found at 0x${patternOffset.toString(16).toUpperCase()}`);

  // Создаем карту ID->item для быстрого поиска
  const itemMap = new Map();

  function addItems(items, category) {
    if (!items) return;
    items.forEach(item => {
      const id = hexToInt(item.Id);
      itemMap.set(id, { ...item, category });
    });
  }

  addItems(jsonData.weapon_items, 'weapon');
  addItems(jsonData.armor_items, 'armor');
  addItems(jsonData.ring_items, 'ring');

  console.log(`Loaded ${itemMap.size} items from database`);

  // Собираем статистику по MaxUpgrade и Durability из сохранения
  const stats = {
    durability: new Map(), // id -> array of durability values
    maxUpgrade: new Map()   // id -> max upgrade seen
  };

  // Сканируем весь файл сохранения в поисках известных ID
  console.log('\nScanning save file for items...');

  const SCAN_START = patternOffset;
  const SCAN_LENGTH = 100000; // Сканируем 100KB после паттерна

  for (const [id, item] of itemMap.entries()) {
    if (item.category !== 'weapon' && item.category !== 'armor' && item.category !== 'ring') continue;

    const idBytes = Buffer.allocUnsafe(4);
    idBytes.writeUInt32LE(id, 0);

    // Ищем базовый ID (без upgrade level)
    let baseId = id;
    if (item.category === 'weapon') {
      // Для оружия первый байт может быть изменен для upgrade level
      // Пробуем искать все варианты от +0 до +10
      for (let upgrade = 0; upgrade <= 10; upgrade++) {
        const modifiedId = id + upgrade; // Первый байт + upgrade
        const searchBytes = Buffer.allocUnsafe(4);
        searchBytes.writeUInt32LE(modifiedId, 0);

        let offset = SCAN_START;
        while (offset < SCAN_START + SCAN_LENGTH - 4) {
          let found = true;
          for (let i = 0; i < 4; i++) {
            if (saveData[offset + i] !== searchBytes[i]) {
              found = false;
              break;
            }
          }

          if (found) {
            // Нашли предмет! Обновляем maxUpgrade
            const current = stats.maxUpgrade.get(id) || 0;
            stats.maxUpgrade.set(id, Math.max(current, upgrade));

            // Пытаемся найти durability рядом (обычно в следующих байтах)
            // Проверяем bytes +4 до +12
            for (let durOffset = 4; durOffset <= 12; durOffset += 2) {
              const durVal = saveData.readUInt16LE(offset + durOffset);
              if (durVal > 0 && durVal < 10000) {
                if (!stats.durability.has(id)) {
                  stats.durability.set(id, []);
                }
                stats.durability.get(id).push(durVal);
              }
            }
          }

          offset++;
        }
      }
    } else {
      // Для брони и колец просто ищем базовый ID
      let offset = SCAN_START;
      while (offset < SCAN_START + SCAN_LENGTH - 4) {
        let found = true;
        for (let i = 0; i < 4; i++) {
          if (saveData[offset + i] !== idBytes[i]) {
            found = false;
            break;
          }
        }

        if (found) {
          // Пытаемся найти durability
          for (let durOffset = 4; durOffset <= 12; durOffset += 2) {
            const durVal = saveData.readUInt16LE(offset + durOffset);
            if (durVal > 0 && durVal < 10000) {
              if (!stats.durability.has(id)) {
                stats.durability.set(id, []);
              }
              stats.durability.get(id).push(durVal);
            }
          }
        }

        offset++;
      }
    }
  }

  console.log(`Found MaxUpgrade for ${stats.maxUpgrade.size} weapons`);
  console.log(`Found Durability for ${stats.durability.size} items`);

  // Обновляем JSON
  console.log('\nUpdating JSON...');

  let updatedWeapons = 0;
  let updatedArmor = 0;
  let updatedRings = 0;

  // Update weapons
  if (jsonData.weapon_items) {
    jsonData.weapon_items.forEach(item => {
      const id = hexToInt(item.Id);
      const maxUpgrade = stats.maxUpgrade.get(id);
      const durValues = stats.durability.get(id);

      if (maxUpgrade !== undefined && maxUpgrade > 0) {
        item.MaxUpgrade = maxUpgrade;
        updatedWeapons++;
      }

      if (durValues && durValues.length > 0) {
        // Берем максимальное значение (полная прочность)
        item.Durability = Math.max(...durValues);
      }
    });
  }

  // Update armor
  if (jsonData.armor_items) {
    jsonData.armor_items.forEach(item => {
      const id = hexToInt(item.Id);
      const durValues = stats.durability.get(id);

      if (durValues && durValues.length > 0) {
        item.Durability = Math.max(...durValues);
        updatedArmor++;
      }
    });
  }

  // Update rings
  if (jsonData.ring_items) {
    jsonData.ring_items.forEach(item => {
      const id = hexToInt(item.Id);
      const durValues = stats.durability.get(id);

      if (durValues && durValues.length > 0) {
        item.Durability = Math.max(...durValues);
        updatedRings++;
      }
    });
  }

  console.log(`\nUpdated:`);
  console.log(`  Weapons with MaxUpgrade: ${updatedWeapons}`);
  console.log(`  Armor with Durability: ${updatedArmor}`);
  console.log(`  Rings with Durability: ${updatedRings}`);

  // Сохраняем JSON
  console.log('\nWriting updated JSON...');
  fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');

  console.log('✓ Done!');
}

main();
