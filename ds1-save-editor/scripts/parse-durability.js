const fs = require('fs');

// Пути к файлам
const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (7).bin';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\public\\json\\ds3_items.json';
const OUTPUT_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\scripts\\durability-analysis.json';

// Паттерн для поиска
const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const INVENTORY_OFFSET = 0x09C;
const ITEM_SIZE = 16; // Правильный размер предмета - 16 байт!
const MAX_SLOTS = 3000;

/**
 * Правильная структура предмета (16 байт):
 * Bytes 0-2: Prefix/Unknown
 * Byte 3: Separator (0x80=Weapons, 0x90=Armor, 0xA0=Rings, 0xB0=Consumables)
 * Bytes 4-7: Item ID (4 bytes, little-endian)
 * Byte 8: Quantity (1 byte)
 * Bytes 9-15: Unknown/Additional data (возможно durability?)
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
  console.log('DS3 Inventory Durability Analysis');
  console.log('='.repeat(80));
  console.log('\nStep 1: Reading files...');
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  const saveData = fs.readFileSync(SAVE_FILE);

  console.log('\nStep 2: Finding inventory pattern...');
  const patternOffset = findPattern(saveData, PATTERN);

  if (patternOffset === -1) {
    console.error('ERROR: Pattern not found in save file!');
    process.exit(1);
  }

  const inventoryStart = patternOffset + INVENTORY_OFFSET;
  console.log(`Pattern found at: 0x${patternOffset.toString(16).toUpperCase()}`);
  console.log(`Inventory found at: 0x${inventoryStart.toString(16).toUpperCase()}`);

  // Шаг 3: Создаем карты ID->item для всех типов предметов
  console.log('\nStep 3: Building item maps...');
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

  console.log(`Loaded ${weaponMap.size} weapons, ${armorMap.size} armor, ${ringMap.size} rings from JSON`);

  // Шаг 4: Анализ структуры инвентаря
  console.log('\nStep 4: Analyzing inventory structure...');
  console.log('Correct item structure (16 bytes per item):');
  console.log('  Bytes 0-2:   Prefix/Unknown');
  console.log('  Byte 3:      Separator (0x80=Weapons, 0x90=Armor, 0xA0=Rings, 0xB0=Consumables)');
  console.log('  Bytes 4-7:   Item ID (4 bytes, little-endian)');
  console.log('  Byte 8:      Quantity (1 byte)');
  console.log('  Bytes 9-15:  Unknown/Additional data (DURABILITY?)');
  console.log('');

  // Собираем примеры для анализа
  const examples = [];
  let totalScanned = 0;
  let emptySlots = 0;

  for (let slotIdx = 0; slotIdx < MAX_SLOTS; slotIdx++) {
    const itemOffset = inventoryStart + slotIdx * ITEM_SIZE;

    if (itemOffset + ITEM_SIZE > saveData.length) {
      console.log(`Reached end of file at slot ${slotIdx}`);
      break;
    }

    totalScanned++;

    // Правильное чтение по структуре
    const separator = saveData[itemOffset + 3];
    const itemIdRaw = saveData.readUInt32LE(itemOffset + 4); // Читаем с offset 4!
    const quantity = saveData[itemOffset + 8];

    // Пропускаем пустые слоты
    if (itemIdRaw === 0 || itemIdRaw === 0xFFFFFFFF || quantity === 0) {
      emptySlots++;
      continue;
    }

    // Читаем все 16 байт для анализа
    const allBytes = [];
    for (let i = 0; i < ITEM_SIZE; i++) {
      allBytes.push(saveData[itemOffset + i]);
    }

    // Читаем байты 9-15 (возможная область durability)
    const unknownBytes = [];
    for (let i = 9; i < ITEM_SIZE; i++) {
      unknownBytes.push(saveData[itemOffset + i]);
    }

    const parsed = parseRawId(itemIdRaw);
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
      for (const { baseId, upgradeLevel: upgrade } of parsed.possibleBaseIds) {
        if (armorMap.has(baseId)) {
          foundItem = armorMap.get(baseId).item;
          itemType = 'armor';
          upgradeLevel = upgrade;
          break;
        }
      }
    }

    // Ищем в кольцах
    if (!foundItem) {
      for (const { baseId, upgradeLevel: upgrade } of parsed.possibleBaseIds) {
        if (ringMap.has(baseId)) {
          foundItem = ringMap.get(baseId).item;
          itemType = 'ring';
          upgradeLevel = upgrade;
          break;
        }
      }
    }

    if (foundItem) {
      // Интерпретируем возможные значения durability в байтах 9-15
      const possibleDurability = {};
      if (unknownBytes.length >= 2) {
        possibleDurability.uint16_at_9 = unknownBytes[0] | (unknownBytes[1] << 8);
        possibleDurability.uint16_at_11 = unknownBytes[2] | (unknownBytes[3] << 8);
        possibleDurability.uint16_at_13 = unknownBytes[4] | (unknownBytes[5] << 8);
        possibleDurability.float_at_9 = saveData.readFloatLE(itemOffset + 9);
        possibleDurability.float_at_11 = unknownBytes.length >= 6 ? saveData.readFloatLE(itemOffset + 11) : null;
      }

      examples.push({
        slotIdx,
        offset: itemOffset,
        name: foundItem.Name,
        category: foundItem.Category || 'Unknown',
        type: itemType,
        separator: separator,
        separatorHex: `0x${separator.toString(16).toUpperCase()}`,
        rawId: itemIdRaw,
        rawHex: itemIdRaw.toString(16).toUpperCase().padStart(8, '0'),
        upgradeLevel,
        quantity,
        durability: foundItem.Durability || null,
        allBytes,
        unknownBytes,
        possibleDurability
      });
    }
  }

  console.log(`Total slots scanned: ${totalScanned}`);
  console.log(`Empty slots: ${emptySlots}`);
  console.log(`Found ${examples.length} items for analysis\n`);

  // Шаг 5: Вывод результатов анализа
  console.log('Step 5: Displaying analysis results...\n');
  console.log('=== Item Structure Analysis (first 40 items) ===\n');

  examples.slice(0, 40).forEach((ex, i) => {
    const hexBytes = ex.allBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const unknownHex = ex.unknownBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    console.log(`${(i + 1).toString().padStart(2, ' ')}. ${ex.name} (${ex.type})`);
    console.log(`    Category: ${ex.category}`);
    console.log(`    Offset: 0x${ex.offset.toString(16).toUpperCase()}`);
    console.log(`    Separator: ${ex.separatorHex} (${getSeparatorName(ex.separator)})`);
    console.log(`    Raw ID: 0x${ex.rawHex}, Upgrade: +${ex.upgradeLevel}, Qty: ${ex.quantity}`);
    console.log(`    Durability (from JSON): ${ex.durability || 'N/A'}`);
    console.log(`    All 16 bytes: ${hexBytes}`);
    console.log(`    Bytes 9-15 (unknown): ${unknownHex}`);
    console.log(`    Possible durability interpretations:`);
    console.log(`      uint16 at byte 9:  ${ex.possibleDurability.uint16_at_9}`);
    console.log(`      uint16 at byte 11: ${ex.possibleDurability.uint16_at_11}`);
    console.log(`      uint16 at byte 13: ${ex.possibleDurability.uint16_at_13}`);
    console.log(`      float  at byte 9:  ${ex.possibleDurability.float_at_9?.toFixed(2)}`);
    console.log('');
  });

  if (examples.length > 40) {
    console.log(`... and ${examples.length - 40} more items (see ${OUTPUT_FILE})\n`);
  }

  // Шаг 6: Сохраняем результаты
  console.log('Step 6: Saving analysis results...');

  const analysisData = {
    metadata: {
      saveFile: SAVE_FILE,
      jsonFile: JSON_FILE,
      patternOffset: `0x${patternOffset.toString(16).toUpperCase()}`,
      inventoryStart: `0x${inventoryStart.toString(16).toUpperCase()}`,
      totalScanned: totalScanned,
      emptySlots: emptySlots,
      itemsFound: examples.length,
      analysisDate: new Date().toISOString()
    },
    structure: {
      itemSize: ITEM_SIZE,
      description: 'Each item is 16 bytes: [0-2]=prefix, [3]=separator, [4-7]=ID, [8]=quantity, [9-15]=unknown'
    },
    examples: examples.map(ex => ({
      name: ex.name,
      category: ex.category,
      type: ex.type,
      offset: `0x${ex.offset.toString(16).toUpperCase()}`,
      separator: ex.separatorHex,
      rawId: `0x${ex.rawHex}`,
      upgradeLevel: ex.upgradeLevel,
      quantity: ex.quantity,
      durability: ex.durability,
      allBytesHex: ex.allBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      unknownBytesHex: ex.unknownBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      possibleDurability: ex.possibleDurability
    }))
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(analysisData, null, 2), 'utf-8');
  console.log(`Saved analysis to: ${OUTPUT_FILE}`);

  // Шаг 7: Статистика
  console.log('\n' + '='.repeat(80));
  console.log('Analysis Summary');
  console.log('='.repeat(80));
  console.log(`Total slots scanned: ${totalScanned}`);
  console.log(`Empty slots: ${emptySlots}`);
  console.log(`Items found and analyzed: ${examples.length}`);

  const byType = examples.reduce((acc, ex) => {
    acc[ex.type] = (acc[ex.type] || 0) + 1;
    return acc;
  }, {});

  const bySeparator = examples.reduce((acc, ex) => {
    const name = getSeparatorName(ex.separator);
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});

  console.log('\nItems by type:');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\nItems by separator:');
  Object.entries(bySeparator).forEach(([sep, count]) => {
    console.log(`  ${sep}: ${count}`);
  });

  const itemsWithDurability = examples.filter(ex => ex.durability !== null);
  const itemsWithoutDurability = examples.filter(ex => ex.durability === null);

  console.log(`\nItems with Durability field: ${itemsWithDurability.length}`);
  console.log(`Items WITHOUT Durability field: ${itemsWithoutDurability.length}`);

  // Анализ паттернов в unknown bytes
  console.log('\n' + '='.repeat(80));
  console.log('Unknown Bytes Patterns Analysis');
  console.log('='.repeat(80));

  // Группируем по паттернам байтов 9-15
  const patterns = new Map();
  examples.forEach(ex => {
    const pattern = ex.unknownBytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    if (!patterns.has(pattern)) {
      patterns.set(pattern, []);
    }
    patterns.get(pattern).push(ex.name);
  });

  console.log(`\nFound ${patterns.size} unique patterns in bytes 9-15`);
  console.log('\nMost common patterns:');

  const sortedPatterns = [...patterns.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  sortedPatterns.forEach(([pattern, items], i) => {
    console.log(`\n${i + 1}. Pattern: ${pattern}`);
    console.log(`   Count: ${items.length}`);
    console.log(`   Examples: ${items.slice(0, 3).join(', ')}${items.length > 3 ? '...' : ''}`);
  });

  console.log('\n✓ Done!');
  console.log('\nNext steps:');
  console.log('  1. Review durability-analysis.json');
  console.log('  2. Look for patterns in bytes 9-15 that might indicate durability');
  console.log('  3. Compare items with similar durability to find the byte offset');
  console.log('  4. Test by modifying durability values and observing changes');
}

function getSeparatorName(sep) {
  switch(sep) {
    case 0x80: return '0x80 (Weapons)';
    case 0x90: return '0x90 (Armor)';
    case 0xA0: return '0xA0 (Rings)';
    case 0xB0: return '0xB0 (Consumables)';
    default: return `0x${sep.toString(16).toUpperCase()} (Unknown)`;
  }
}

main();
