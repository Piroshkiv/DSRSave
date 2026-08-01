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
const ITEM_SIZE = 16;
const MAX_SLOTS = 3000;

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
  console.log('='.repeat(80));
  console.log('DS3 Durability Analysis - WEAPONS & ARMOR ONLY');
  console.log('='.repeat(80));

  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  const saveData = fs.readFileSync(SAVE_FILE);

  const patternOffset = findPattern(saveData, PATTERN);
  if (patternOffset === -1) {
    console.error('ERROR: Pattern not found!');
    process.exit(1);
  }

  const inventoryStart = patternOffset + INVENTORY_OFFSET;
  console.log(`Inventory start: 0x${inventoryStart.toString(16).toUpperCase()}\n`);

  // Создаем карты
  const weaponMap = new Map();
  const armorMap = new Map();

  if (jsonData.weapon_items) {
    jsonData.weapon_items.forEach((item) => {
      const id = hexToInt(item.Id);
      weaponMap.set(id, item);
    });
  }

  if (jsonData.armor_items) {
    jsonData.armor_items.forEach((item) => {
      const id = hexToInt(item.Id);
      armorMap.set(id, item);
    });
  }

  console.log(`Loaded ${weaponMap.size} weapons, ${armorMap.size} armor\n`);

  // Собираем ТОЛЬКО оружие и броню
  const weaponsAndArmor = [];

  for (let slotIdx = 0; slotIdx < MAX_SLOTS; slotIdx++) {
    const itemOffset = inventoryStart + slotIdx * ITEM_SIZE;
    if (itemOffset + ITEM_SIZE > saveData.length) break;

    const separator = saveData[itemOffset + 3];
    const itemIdRaw = saveData.readUInt32LE(itemOffset + 4);
    const quantity = saveData[itemOffset + 8];

    // ФИЛЬТР: только оружие (0x80) и броня (0x90)
    if (separator !== 0x80 && separator !== 0x90) continue;
    if (itemIdRaw === 0 || itemIdRaw === 0xFFFFFFFF || quantity === 0) continue;

    // Читаем все байты
    const allBytes = Array.from(saveData.slice(itemOffset, itemOffset + ITEM_SIZE));

    // Bytes 9-15 (последние 7 байт)
    const durabilityBytes = allBytes.slice(9, 16);

    const parsed = parseRawId(itemIdRaw);
    let foundItem = null;
    let itemType = null;
    let upgradeLevel = 0;

    // Ищем в оружии
    for (const { baseId, upgradeLevel: upgrade } of parsed.possibleBaseIds) {
      if (weaponMap.has(baseId)) {
        foundItem = weaponMap.get(baseId);
        itemType = 'weapon';
        upgradeLevel = upgrade;
        break;
      }
    }

    // Ищем в броне
    if (!foundItem) {
      for (const { baseId, upgradeLevel: upgrade } of parsed.possibleBaseIds) {
        if (armorMap.has(baseId)) {
          foundItem = armorMap.get(baseId);
          itemType = 'armor';
          upgradeLevel = upgrade;
          break;
        }
      }
    }

    if (foundItem) {
      // Интерпретируем bytes 9-15 как durability
      const interpretations = {
        // uint16 в разных позициях
        uint16_at_9: durabilityBytes[0] | (durabilityBytes[1] << 8),
        uint16_at_10: durabilityBytes[1] | (durabilityBytes[2] << 8),
        uint16_at_11: durabilityBytes[2] | (durabilityBytes[3] << 8),

        // uint32 в разных позициях
        uint32_at_9: saveData.readUInt32LE(itemOffset + 9),
        uint32_at_10: saveData.readUInt32LE(itemOffset + 10),
        uint32_at_11: saveData.readUInt32LE(itemOffset + 11),

        // float в разных позициях
        float_at_9: saveData.readFloatLE(itemOffset + 9),
        float_at_10: saveData.readFloatLE(itemOffset + 10),
        float_at_11: saveData.readFloatLE(itemOffset + 11),

        // Сами байты
        bytes: durabilityBytes
      };

      weaponsAndArmor.push({
        slotIdx,
        offset: itemOffset,
        name: foundItem.Name,
        category: foundItem.Category || 'Unknown',
        type: itemType,
        separator,
        upgradeLevel,
        quantity,
        allBytes,
        durabilityBytes,
        interpretations
      });
    }
  }

  console.log(`Found ${weaponsAndArmor.length} weapons/armor items\n`);
  console.log('='.repeat(80));
  console.log('DURABILITY BYTES ANALYSIS (bytes 9-15)');
  console.log('='.repeat(80));
  console.log('');

  // Показываем первые 50 предметов с детальным анализом
  weaponsAndArmor.slice(0, 50).forEach((item, i) => {
    const hexAll = item.allBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const hexDur = item.durabilityBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

    console.log(`${(i + 1).toString().padStart(3, ' ')}. ${item.name} (${item.type}) +${item.upgradeLevel}`);
    console.log(`     Offset: 0x${item.offset.toString(16).toUpperCase()}, Sep: 0x${item.separator.toString(16).toUpperCase()}`);
    console.log(`     All 16 bytes: ${hexAll}`);
    console.log(`     Bytes 9-15:   ${hexDur}`);
    console.log(`     Interpretations:`);
    console.log(`       uint16 @ 9:  ${item.interpretations.uint16_at_9.toString().padStart(6, ' ')}`);
    console.log(`       uint16 @ 10: ${item.interpretations.uint16_at_10.toString().padStart(6, ' ')}`);
    console.log(`       uint16 @ 11: ${item.interpretations.uint16_at_11.toString().padStart(6, ' ')}`);
    console.log(`       uint32 @ 9:  ${item.interpretations.uint32_at_9.toString().padStart(10, ' ')}`);
    console.log(`       float  @ 9:  ${item.interpretations.float_at_9.toFixed(4).padStart(10, ' ')}`);
    console.log(`       float  @ 10: ${item.interpretations.float_at_10.toFixed(4).padStart(10, ' ')}`);
    console.log('');
  });

  // Анализ паттернов в bytes 9-11 (первые 3 байта durability области)
  console.log('='.repeat(80));
  console.log('PATTERN ANALYSIS - Bytes 9-11');
  console.log('='.repeat(80));

  const patterns911 = new Map();
  weaponsAndArmor.forEach(item => {
    const pattern = item.durabilityBytes.slice(0, 3).map(b =>
      b.toString(16).toUpperCase().padStart(2, '0')
    ).join(' ');

    if (!patterns911.has(pattern)) {
      patterns911.set(pattern, []);
    }
    patterns911.get(pattern).push(item.name);
  });

  const sorted911 = [...patterns911.entries()]
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`\nFound ${patterns911.size} unique patterns in bytes 9-11:`);
  sorted911.slice(0, 20).forEach(([pattern, items], i) => {
    console.log(`${(i + 1).toString().padStart(2, ' ')}. ${pattern} - ${items.length} items`);
    console.log(`    Examples: ${items.slice(0, 5).join(', ')}${items.length > 5 ? '...' : ''}`);
  });

  // Анализ bytes 9-15 (все 7 байтов)
  console.log('\n' + '='.repeat(80));
  console.log('PATTERN ANALYSIS - Bytes 9-15 (Full)');
  console.log('='.repeat(80));

  const patternsFull = new Map();
  weaponsAndArmor.forEach(item => {
    const pattern = item.durabilityBytes.map(b =>
      b.toString(16).toUpperCase().padStart(2, '0')
    ).join(' ');

    if (!patternsFull.has(pattern)) {
      patternsFull.set(pattern, []);
    }
    patternsFull.get(pattern).push(item.name);
  });

  const sortedFull = [...patternsFull.entries()]
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`\nFound ${patternsFull.size} unique patterns in bytes 9-15:`);
  sortedFull.slice(0, 20).forEach(([pattern, items], i) => {
    console.log(`${(i + 1).toString().padStart(2, ' ')}. ${pattern} - ${items.length} items`);
    console.log(`    Examples: ${items.slice(0, 3).join(', ')}${items.length > 3 ? '...' : ''}`);
  });

  // Статистика
  console.log('\n' + '='.repeat(80));
  console.log('STATISTICS');
  console.log('='.repeat(80));

  const weapons = weaponsAndArmor.filter(i => i.separator === 0x80);
  const armor = weaponsAndArmor.filter(i => i.separator === 0x90);

  console.log(`Total weapons: ${weapons.length}`);
  console.log(`Total armor: ${armor.length}`);

  // Проверка: все ли bytes 9-11 равны 00 00 00?
  const withZeros911 = weaponsAndArmor.filter(i =>
    i.durabilityBytes[0] === 0 &&
    i.durabilityBytes[1] === 0 &&
    i.durabilityBytes[2] === 0
  );

  console.log(`\nItems with bytes 9-11 = 00 00 00: ${withZeros911.length} / ${weaponsAndArmor.length}`);
  console.log(`Items with NON-ZERO bytes 9-11: ${weaponsAndArmor.length - withZeros911.length}`);

  if (weaponsAndArmor.length - withZeros911.length > 0) {
    console.log('\nItems with NON-ZERO bytes 9-11:');
    const nonZero = weaponsAndArmor.filter(i =>
      i.durabilityBytes[0] !== 0 ||
      i.durabilityBytes[1] !== 0 ||
      i.durabilityBytes[2] !== 0
    );

    nonZero.slice(0, 20).forEach(item => {
      const hex = item.durabilityBytes.slice(0, 3).map(b =>
        b.toString(16).toUpperCase().padStart(2, '0')
      ).join(' ');
      console.log(`  ${item.name}: ${hex}`);
    });
  }

  console.log('\n✓ Done!');
}

main();
