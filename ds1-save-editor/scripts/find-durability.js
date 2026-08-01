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
  const saveData = fs.readFileSync(SAVE_FILE);

  const patternOffset = findPattern(saveData, PATTERN);
  if (patternOffset === -1) {
    console.error('ERROR: Pattern not found!');
    process.exit(1);
  }

  const inventoryStart = patternOffset + INVENTORY_OFFSET;
  console.log(`Pattern found at: 0x${patternOffset.toString(16).toUpperCase()}`);
  console.log(`Inventory found at: 0x${inventoryStart.toString(16).toUpperCase()}\n`);

  // Создаем карты
  const weaponMap = new Map();
  const armorMap = new Map();
  const ringMap = new Map();

  if (jsonData.weapon_items) {
    jsonData.weapon_items.forEach((item, index) => {
      const id = hexToInt(item.Id);
      weaponMap.set(id, { item, index });
    });
  }

  if (jsonData.armor_items) {
    jsonData.armor_items.forEach((item, index) => {
      const id = hexToInt(item.Id);
      armorMap.set(id, { item, index });
    });
  }

  if (jsonData.ring_items) {
    jsonData.ring_items.forEach((item, index) => {
      const id = hexToInt(item.Id);
      ringMap.set(id, { item, index });
    });
  }

  console.log(`Loaded ${weaponMap.size} weapons, ${armorMap.size} armor, ${ringMap.size} rings\n`);

  // Структура слота после анализа:
  // Offset +0-3: Item ID (4 байта)
  // Offset +4-7: Quantity (4 байта, uint32)
  // Offset +8: Index/Flag (1 байт)
  // Offset +9: Unknown (1 байт)
  // Offset +10-11: DURABILITY? (2 байта, uint16)
  // Offset +12-15: Unknown (4 байта)
  //
  // Всего: 16 байт на слот

  const SLOT_SIZE = 16;
  const MAX_ITEMS = 1000;

  console.log('Step 2: Parsing inventory with durability...\n');

  const foundItems = [];
  let offset = inventoryStart;

  for (let i = 0; i < MAX_ITEMS; i++) {
    if (offset + SLOT_SIZE > saveData.length) break;

    const itemId = saveData.readUInt32LE(offset);
    const quantity = saveData.readUInt32LE(offset + 4);
    const indexByte = saveData[offset + 8];
    const unknownByte = saveData[offset + 9];
    const durability = saveData.readUInt16LE(offset + 10);
    const unknown2 = saveData.readUInt32LE(offset + 12);

    // Пропускаем пустые слоты
    if (itemId === 0 || itemId === 0xFFFFFFFF || quantity === 0) {
      offset += SLOT_SIZE;
      continue;
    }

    const parsed = parseRawId(itemId);
    let foundItem = null;
    let itemType = null;
    let upgradeLevel = 0;

    // Ищем в оружии
    for (const { baseId, upgradeLevel: upgrade } of parsed.possibleBaseIds) {
      if (weaponMap.has(baseId)) {
        foundItem = weaponMap.get(baseId).item;
        itemType = 'weapon';
        upgradeLevel = upgrade;
        break;
      }
    }

    // Ищем в броне
    if (!foundItem) {
      for (const { baseId } of parsed.possibleBaseIds) {
        if (armorMap.has(baseId)) {
          foundItem = armorMap.get(baseId).item;
          itemType = 'armor';
          break;
        }
      }
    }

    // Ищем в кольцах
    if (!foundItem) {
      for (const { baseId } of parsed.possibleBaseIds) {
        if (ringMap.has(baseId)) {
          foundItem = ringMap.get(baseId).item;
          itemType = 'ring';
          break;
        }
      }
    }

    if (foundItem) {
      foundItems.push({
        name: foundItem.Name,
        type: itemType,
        itemId: itemId,
        quantity: quantity,
        durability: durability,
        upgradeLevel: upgradeLevel,
        offset: offset,
        indexByte: indexByte,
        unknownByte: unknownByte,
        unknown2: unknown2
      });
    }

    offset += SLOT_SIZE;
  }

  console.log(`Found ${foundItems.length} items\n`);

  // Показываем первые 30 items с durability
  console.log('=== First 30 items with durability ===\n');
  foundItems.slice(0, 30).forEach((item, i) => {
    let name = item.name;
    if (item.upgradeLevel > 0 && item.type === 'weapon') {
      name += ` +${item.upgradeLevel}`;
    }

    console.log(`${i + 1}. ${name} (${item.type})`);
    console.log(`   Quantity: ${item.quantity}, Durability: ${item.durability}`);
    console.log(`   Offset: 0x${item.offset.toString(16).toUpperCase()}`);
  });

  // Статистика по durability
  console.log('\n=== Durability statistics ===\n');

  const durabilityByType = {
    weapon: new Map(),
    armor: new Map(),
    ring: new Map()
  };

  foundItems.forEach(item => {
    if (!durabilityByType[item.type].has(item.name)) {
      durabilityByType[item.type].set(item.name, []);
    }
    durabilityByType[item.type].get(item.name).push(item.durability);
  });

  console.log('Weapons with durability:');
  let count = 0;
  for (const [name, durabilities] of durabilityByType.weapon.entries()) {
    const maxDur = Math.max(...durabilities);
    if (maxDur > 0 && count < 20) {
      console.log(`  ${name}: ${maxDur} (found ${durabilities.length} instances)`);
      count++;
    }
  }

  console.log('\nArmor with durability:');
  count = 0;
  for (const [name, durabilities] of durabilityByType.armor.entries()) {
    const maxDur = Math.max(...durabilities);
    if (maxDur > 0 && count < 20) {
      console.log(`  ${name}: ${maxDur} (found ${durabilities.length} instances)`);
      count++;
    }
  }

  console.log('\nRings with durability:');
  count = 0;
  for (const [name, durabilities] of durabilityByType.ring.entries()) {
    const maxDur = Math.max(...durabilities);
    if (maxDur > 0 && count < 10) {
      console.log(`  ${name}: ${maxDur} (found ${durabilities.length} instances)`);
      count++;
    }
  }
}

main();
