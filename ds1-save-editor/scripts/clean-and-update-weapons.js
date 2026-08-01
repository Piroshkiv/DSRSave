const fs = require('fs');

// Пути к файлам
const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (7).bin';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\public\\json\\ds3_items.json';

// Паттерн для поиска
const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const INVENTORY_OFFSET = 0x09C;
const SLOT_SIZE = 16;
const ITEMS_PER_SLOT = 4;
const ITEM_SIZE = 4;
const MAX_SLOTS = 3000; // Увеличиваем до 2000 чтобы точно захватить весь инвентарь

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
  for (let upgrade = 0; upgrade <= 15; upgrade++) {
    const baseByte0 = byte0 - upgrade;
    if (baseByte0 >= 0) {
      const baseId = baseByte0 | (byte1 << 8) | (upperBytes << 16);
      possibleBaseIds.push({ baseId, upgradeLevel: upgrade });
    }
  }

  return { rawId, possibleBaseIds };
}

function main() {
  console.log('Step 1: Reading files...');
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

  // Шаг 1: Очистка weapon_items от не-оружий
  console.log('\nStep 2: Cleaning weapon_items from non-weapons...');

  const originalWeaponCount = jsonData.weapon_items ? jsonData.weapon_items.length : 0;
  const removedItems = [];

  if (jsonData.weapon_items) {
    // Фильтруем только оружие (Type = 0x0)
    // Кольца имеют Type = 0x20000000
    jsonData.weapon_items = jsonData.weapon_items.filter(item => {
      const type = hexToInt(item.Type);
      // Оружие должно иметь Type = 0x0 или похожий
      if (type === 0x0 || type === 0) {
        return true;
      } else {
        removedItems.push({ ...item, reason: `Wrong Type: ${item.Type}` });
        return false;
      }
    });
  }

  console.log(`Original weapon_items count: ${originalWeaponCount}`);
  console.log(`Removed non-weapons: ${removedItems.length}`);
  console.log(`Current weapon_items count: ${jsonData.weapon_items.length}`);

  if (removedItems.length > 0) {
    console.log('\nRemoved items:');
    removedItems.slice(0, 20).forEach(item => {
      console.log(`  - ${item.Name} (${item.Type}) - ${item.reason}`);
    });
    if (removedItems.length > 20) {
      console.log(`  ... and ${removedItems.length - 20} more`);
    }
  }

  // Шаг 2: Обнуляем MaxUpgrade
  console.log('\nStep 3: Resetting MaxUpgrade to 0...');
  let resetCount = 0;
  if (jsonData.weapon_items) {
    jsonData.weapon_items.forEach(item => {
      if (item.MaxUpgrade !== undefined) {
        item.MaxUpgrade = 0;
        resetCount++;
      }
    });
  }
  console.log(`Reset MaxUpgrade for ${resetCount} weapons`);

  // Шаг 3: Читаем сейв и обновляем MaxUpgrade
  console.log('\nStep 4: Reading save file and updating MaxUpgrade...');

  const saveData = fs.readFileSync(SAVE_FILE);
  const patternOffset = findPattern(saveData, PATTERN);

  if (patternOffset === -1) {
    console.error('ERROR: Pattern not found in save file!');
    process.exit(1);
  }

  const inventoryStart = patternOffset + INVENTORY_OFFSET;
  console.log(`Inventory found at: 0x${inventoryStart.toString(16).toUpperCase()}`);

  // Создаем карту ID->item для быстрого поиска
  const weaponMap = new Map();
  if (jsonData.weapon_items) {
    jsonData.weapon_items.forEach((item, index) => {
      const id = hexToInt(item.Id);
      weaponMap.set(id, { item, index });
    });
  }

  console.log(`Loaded ${weaponMap.size} weapons from JSON`);

  // Парсим инвентарь
  const foundWeapons = new Map(); // id -> max upgrade level
  let totalItemsScanned = 0;
  let emptySlots = 0;

  for (let slotIdx = 0; slotIdx < MAX_SLOTS; slotIdx++) {
    const slotOffset = inventoryStart + slotIdx * SLOT_SIZE;

    // Проверяем не вышли ли за границы файла
    if (slotOffset + SLOT_SIZE > saveData.length) {
      console.log(`Reached end of file at slot ${slotIdx}`);
      break;
    }

    for (let itemIdx = 0; itemIdx < ITEMS_PER_SLOT; itemIdx++) {
      const itemOffset = slotOffset + itemIdx * ITEM_SIZE;
      const itemIdRaw = saveData.readUInt32LE(itemOffset);

      totalItemsScanned++;

      if (itemIdRaw === 0 || itemIdRaw === 0xFFFFFFFF) {
        emptySlots++;
        continue;
      }

      const parsed = parseRawId(itemIdRaw);

      // Пробуем найти в базе
      for (const { baseId, upgradeLevel } of parsed.possibleBaseIds) {
        if (weaponMap.has(baseId)) {
          const current = foundWeapons.get(baseId) || 0;
          foundWeapons.set(baseId, Math.max(current, upgradeLevel));
          break;
        }
      }
    }
  }

  console.log(`Total items scanned: ${totalItemsScanned}`);
  console.log(`Empty slots: ${emptySlots}`);
  console.log(`Non-empty items: ${totalItemsScanned - emptySlots}`);

  console.log(`Found ${foundWeapons.size} weapons in inventory`);

  // Обновляем MaxUpgrade
  let updatedCount = 0;
  for (const [id, maxUpgrade] of foundWeapons.entries()) {
    const weaponData = weaponMap.get(id);
    if (weaponData && maxUpgrade > 0) {
      weaponData.item.MaxUpgrade = maxUpgrade;
      updatedCount++;
    }
  }

  console.log(`Updated MaxUpgrade for ${updatedCount} weapons`);

  // Шаг 4: Список ненайденных
  console.log('\nStep 5: Generating list of weapons NOT found in save...');

  const notFound = [];
  if (jsonData.weapon_items) {
    jsonData.weapon_items.forEach(item => {
      const id = hexToInt(item.Id);
      if (!foundWeapons.has(id)) {
        notFound.push(item);
        // Добавляем флаг Unsave для ненайденных
        item.Unsave = true;
      }
    });
  }

  console.log(`\nWeapons NOT found in save: ${notFound.length}`);
  console.log(`Weapons FOUND in save: ${foundWeapons.size}`);

  // Сохраняем список ненайденных
  const notFoundList = notFound.map(item => ({
    Id: item.Id,
    Name: item.Name,
    Category: item.Category,
    MaxUpgrade: item.MaxUpgrade
  }));

  fs.writeFileSync(
    'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\scripts\\weapons-not-found.json',
    JSON.stringify(notFoundList, null, 2),
    'utf-8'
  );

  console.log('\nSaved list to: weapons-not-found.json');

  // Показываем первые 50
  console.log('\n=== First 50 weapons NOT found ===');
  notFound.slice(0, 50).forEach((item, i) => {
    console.log(`${i + 1}. ${item.Name} (${item.Id}) - Category: ${item.Category}`);
  });

  if (notFound.length > 50) {
    console.log(`\n... and ${notFound.length - 50} more (see weapons-not-found.json)`);
  }

  // Показываем статистику по найденным
  console.log('\n=== Top 20 upgraded weapons found ===');
  const sortedFound = [...foundWeapons.entries()]
    .map(([id, upgrade]) => {
      const weaponData = weaponMap.get(id);
      return {
        id,
        upgrade,
        name: weaponData ? weaponData.item.Name : 'Unknown'
      };
    })
    .sort((a, b) => b.upgrade - a.upgrade);

  sortedFound.slice(0, 20).forEach((w, i) => {
    console.log(`${i + 1}. ${w.name} +${w.upgrade}`);
  });

  // Сохраняем обновленный JSON
  console.log('\n\nStep 6: Saving updated JSON...');
  fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');

  console.log('\n✓ Done!');
  console.log(`\nSummary:`);
  console.log(`  - Removed ${removedItems.length} non-weapons from weapon_items`);
  console.log(`  - Updated MaxUpgrade for ${updatedCount} weapons found in save`);
  console.log(`  - ${notFound.length} weapons NOT found in save (MaxUpgrade = 0)`);
  console.log(`  - Total weapons in JSON: ${jsonData.weapon_items.length}`);
}

main();
