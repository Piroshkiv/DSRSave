const fs = require('fs');
const path = require('path');

// Пути к файлам
const CT_FILE = 'C:\\Users\\Iho\\Desktop\\DS3_TGA_v3.4.0.CT';
const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\public\\json\\ds3_items.json';

// Маппинг типов для категорий
const CATEGORY_MAP = {
  // Weapons
  'Torches': 'torches',
  'Daggers': 'daggers',
  'StraightSwords': 'straightswords',
  'Greatswords': 'greatswords',
  'UltraGreatswords': 'ultragreatswords',
  'CurvedSwords': 'curvedswords',
  'CurvedGreatswords': 'curvedgreatswords',
  'Katanas': 'katanas',
  'Rapiers': 'rapiers',
  'Axes': 'axes',
  'Greataxes': 'greataxes',
  'Hammers': 'hammers',
  'GreatHammers': 'greathammers',
  'Fists': 'fists',
  'Spears': 'spears',
  'Halberds': 'halberds',
  'Reapers': 'reapers',
  'Whips': 'whips',
  'Bows': 'bows',
  'Greatbows': 'greatbows',
  'Crossbows': 'crossbows',
  'Staves': 'staves',
  'Flames': 'flames',
  'Talismans': 'talismans',
  'Chimes': 'chimes',

  // Armor
  'Helms': 'helms',
  'Chests': 'chests',
  'Gauntlets': 'gauntlets',
  'Leggings': 'leggings',

  // Magic
  'Sorceries': 'sorceries',
  'Miracles': 'miracles',
  'Pyromancies': 'pyromancies',

  // Shields
  'SmallShields': 'smallshields',
  'StandardShields': 'standardshields',
  'Greatshields': 'greatshields',
  'Standard Shields': 'standardshields',
  'Small Shields': 'smallshields',

  // Consumables
  'Consumables': 'consumables',
  'Tools': 'tools',
  'Projectiles': 'projectiles',
  'Ammunition': 'ammunition',
  'Souls': 'souls',
  'BossSouls': 'bosssouls',
  'Keys': 'keys',
  'Ores': 'ores',
  'Ashes': 'ashes',
  'QuestItems': 'questitems',
  'Multiplayer': 'multiplayer',
  'Covenants': 'covenants',
  'CovenantItems': 'covenantitems'
};

// Функция для нормализации hex ID (0x00062B4C)
function normalizeId(hexId) {
  const num = parseInt(hexId, 16);
  return '0x' + num.toString(16).toUpperCase().padStart(8, '0');
}

// Функция для конвертации hex ID в число
function hexToInt(hexId) {
  return parseInt(hexId, 16);
}

// Функция для определения категории по ID
function getCategoryByIdPrefix(id) {
  const idStr = id.toUpperCase();

  // Rings (0x20XXXXXX)
  if (idStr.startsWith('0X20')) return 'rings';

  // Armor (0x11XXXXXX - 0x12XXXXXX)
  if (idStr.startsWith('0X11') || idStr.startsWith('0X12')) return 'armor';

  // Weapons (0x00XXXXXX - 0x01XXXXXX)
  if (idStr.startsWith('0X00') || idStr.startsWith('0X01')) return 'weapons';

  // Magic/Consumables (0x40XXXXXX)
  if (idStr.startsWith('0X40')) {
    const idInt = parseInt(id, 16);
    // Magic обычно в диапазоне 0x40100000 - 0x40400000
    if (idInt >= 0x40100000 && idInt <= 0x40400000) return 'magic';
    return 'consumables';
  }

  return null;
}

// Функция для парсинга CT файла
function parseCTFile(ctContent) {
  const items = {
    weapons: [],
    armor: [],
    rings: [],
    magic: [],
    consumables: []
  };

  // Парсим Weapon:new
  const weaponRegex = /Weapon:new\({id\s*=\s*(0x[0-9A-Fa-f]+),\s*typ\s*=\s*'([^']+)'(?:,\s*dlc\s*=\s*(\d+))?(?:,\s*cutContent\s*=\s*true)?\}\),?\s*--(.+)/gi;
  let match;
  while ((match = weaponRegex.exec(ctContent)) !== null) {
    const [, id, typ, dlc, name] = match;
    items.weapons.push({
      id: normalizeId(id),
      idInt: hexToInt(id),
      category: CATEGORY_MAP[typ] || typ.toLowerCase(),
      name: name.trim(),
      dlc: dlc || null
    });
  }

  // Парсим Armor:new
  const armorRegex = /Armor:new\({id\s*=\s*(0x[0-9A-Fa-f]+),\s*typ\s*=\s*'([^']+)'(?:,\s*dlc\s*=\s*(\d+))?(?:,\s*cutContent\s*=\s*true)?\}\),?\s*--(.+)/gi;
  while ((match = armorRegex.exec(ctContent)) !== null) {
    const [, id, typ, dlc, name] = match;
    items.armor.push({
      id: normalizeId(id),
      idInt: hexToInt(id),
      category: CATEGORY_MAP[typ] || typ.toLowerCase(),
      name: name.trim(),
      dlc: dlc || null
    });
  }

  // Парсим Ring:new
  const ringRegex = /Ring:new\({id\s*=\s*(0x[0-9A-Fa-f]+)(?:,\s*dlc\s*=\s*(\d+))?(?:,\s*cutContent\s*=\s*true)?\}\),?\s*--(.+)/gi;
  while ((match = ringRegex.exec(ctContent)) !== null) {
    const [, id, dlc, name] = match;
    items.rings.push({
      id: normalizeId(id),
      idInt: hexToInt(id),
      category: 'rings',
      name: name.trim(),
      dlc: dlc || null
    });
  }

  // Парсим Magic:new (с одинарными и двойными кавычками)
  const magicRegex = /Magic:new\({id\s*=\s*(0x[0-9A-Fa-f]+),\s*typ\s*=\s*['"]([^'"]+)['"](?:,\s*dlc\s*=\s*(\d+))?(?:,\s*cutContent\s*=\s*true)?\}\),?\s*--(.+)/gi;
  while ((match = magicRegex.exec(ctContent)) !== null) {
    const [, id, typ, dlc, name] = match;
    items.magic.push({
      id: normalizeId(id),
      idInt: hexToInt(id),
      category: CATEGORY_MAP[typ] || typ.toLowerCase(),
      name: name.trim(),
      dlc: dlc || null
    });
  }

  // Парсим Consumable:new - построчный парсинг для надежности
  const consumableRegex = /Consumable:new\(\{id\s*=\s*(0x[0-9A-Fa-f]+)[^}]*typ\s*=\s*'([^']+)'[^}]*\}\)[,\s]*--(.+)/gi;
  while ((match = consumableRegex.exec(ctContent)) !== null) {
    const [fullMatch, id, typ, name] = match;

    // Извлекаем dlc из полного совпадения
    const dlcMatch = fullMatch.match(/dlc\s*=\s*(\d+)/i);
    const dlc = dlcMatch ? dlcMatch[1] : null;

    items.consumables.push({
      id: normalizeId(id),
      idInt: hexToInt(id),
      category: CATEGORY_MAP[typ] || typ.toLowerCase(),
      name: name.trim(),
      dlc: dlc
    });
  }

  return items;
}

// Функция для удаления дубликатов из JSON по числовому ID
function removeDuplicates(items) {
  const seen = new Map();
  const unique = [];

  for (const item of items) {
    const idInt = hexToInt(item.Id);
    if (!seen.has(idInt)) {
      seen.set(idInt, true);
      // Нормализуем ID
      item.Id = normalizeId(item.Id);
      unique.push(item);
    }
  }

  return unique;
}

// Функция для добавления недостающих элементов
function mergeItems(jsonData, ctItems) {
  const added = {
    weapons: [],
    armor: [],
    rings: [],
    magic: [],
    consumables: []
  };

  // Убираем дубликаты из JSON
  console.log('\nRemoving duplicates from JSON...');
  const weaponsBefore = jsonData.weapon_items.length;
  jsonData.weapon_items = removeDuplicates(jsonData.weapon_items);
  console.log(`Weapons: ${weaponsBefore} -> ${jsonData.weapon_items.length} (removed ${weaponsBefore - jsonData.weapon_items.length} duplicates)`);

  const armorBefore = jsonData.armor_items.length;
  jsonData.armor_items = removeDuplicates(jsonData.armor_items);
  console.log(`Armor: ${armorBefore} -> ${jsonData.armor_items.length} (removed ${armorBefore - jsonData.armor_items.length} duplicates)`);

  const ringsBefore = jsonData.ring_items.length;
  jsonData.ring_items = removeDuplicates(jsonData.ring_items);
  console.log(`Rings: ${ringsBefore} -> ${jsonData.ring_items.length} (removed ${ringsBefore - jsonData.ring_items.length} duplicates)`);

  const magicBefore = jsonData.magic_items.length;
  jsonData.magic_items = removeDuplicates(jsonData.magic_items);
  console.log(`Magic: ${magicBefore} -> ${jsonData.magic_items.length} (removed ${magicBefore - jsonData.magic_items.length} duplicates)`);

  const consumablesBefore = jsonData.consumable_items.length;
  jsonData.consumable_items = removeDuplicates(jsonData.consumable_items);
  console.log(`Consumables: ${consumablesBefore} -> ${jsonData.consumable_items.length} (removed ${consumablesBefore - jsonData.consumable_items.length} duplicates)`);

  // Добавляем оружие
  const existingWeaponIds = new Set(jsonData.weapon_items.map(item => hexToInt(item.Id)));
  for (const weapon of ctItems.weapons) {
    if (!existingWeaponIds.has(weapon.idInt)) {
      const newItem = {
        Type: '0x0',
        Id: weapon.id,
        MaxStackCount: 1,
        Category: weapon.category,
        Name: weapon.name
      };
      jsonData.weapon_items.push(newItem);
      added.weapons.push(weapon.name);
    }
  }

  // Добавляем броню
  const existingArmorIds = new Set(jsonData.armor_items.map(item => hexToInt(item.Id)));
  for (const armor of ctItems.armor) {
    if (!existingArmorIds.has(armor.idInt)) {
      const newItem = {
        Type: '0x10000000',
        Id: armor.id,
        MaxStackCount: 1,
        Category: armor.category,
        Name: armor.name
      };
      jsonData.armor_items.push(newItem);
      added.armor.push(armor.name);
    }
  }

  // Добавляем кольца
  const existingRingIds = new Set(jsonData.ring_items.map(item => hexToInt(item.Id)));
  for (const ring of ctItems.rings) {
    if (!existingRingIds.has(ring.idInt)) {
      const newItem = {
        Type: '0x20000000',
        Id: ring.id,
        MaxStackCount: 1,
        Category: 'rings',
        Name: ring.name
      };
      jsonData.ring_items.push(newItem);
      added.rings.push(ring.name);
    }
  }

  // Добавляем магию
  const existingMagicIds = new Set(jsonData.magic_items.map(item => hexToInt(item.Id)));
  for (const magic of ctItems.magic) {
    if (!existingMagicIds.has(magic.idInt)) {
      const newItem = {
        Type: '0x40000000',
        Id: magic.id,
        MaxStackCount: 1,
        Category: magic.category,
        Name: magic.name
      };
      jsonData.magic_items.push(newItem);
      added.magic.push(magic.name);
    }
  }

  // Добавляем расходники
  const existingConsumableIds = new Set(jsonData.consumable_items.map(item => hexToInt(item.Id)));
  for (const consumable of ctItems.consumables) {
    if (!existingConsumableIds.has(consumable.idInt)) {
      const newItem = {
        Type: '0x40000000',
        Id: consumable.id,
        MaxStackCount: 99,
        Category: consumable.category,
        Name: consumable.name
      };
      jsonData.consumable_items.push(newItem);
      added.consumables.push(consumable.name);
    }
  }

  return added;
}

// Главная функция
async function main() {
  console.log('Reading CT file...');
  const ctContent = fs.readFileSync(CT_FILE, 'utf-8');

  console.log('Parsing CT file...');
  const ctItems = parseCTFile(ctContent);

  console.log('\n=== CT File Statistics ===');
  console.log(`Weapons found: ${ctItems.weapons.length}`);
  console.log(`Armor found: ${ctItems.armor.length}`);
  console.log(`Rings found: ${ctItems.rings.length}`);
  console.log(`Magic found: ${ctItems.magic.length}`);
  console.log(`Consumables found: ${ctItems.consumables.length}`);

  console.log('\nReading JSON file...');
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

  console.log('\n=== JSON File Statistics (Before) ===');
  console.log(`Weapons: ${jsonData.weapon_items.length}`);
  console.log(`Armor: ${jsonData.armor_items.length}`);
  console.log(`Rings: ${jsonData.ring_items.length}`);
  console.log(`Magic: ${jsonData.magic_items.length}`);
  console.log(`Consumables: ${jsonData.consumable_items.length}`);

  console.log('\nMerging items...');
  const added = mergeItems(jsonData, ctItems);

  console.log('\n=== Added Items ===');
  console.log(`\nWeapons added: ${added.weapons.length}`);
  if (added.weapons.length > 0) {
    added.weapons.forEach(name => console.log(`  + ${name}`));
  }

  console.log(`\nArmor added: ${added.armor.length}`);
  if (added.armor.length > 0) {
    added.armor.forEach(name => console.log(`  + ${name}`));
  }

  console.log(`\nRings added: ${added.rings.length}`);
  if (added.rings.length > 0) {
    added.rings.forEach(name => console.log(`  + ${name}`));
  }

  console.log(`\nMagic added: ${added.magic.length}`);
  if (added.magic.length > 0) {
    added.magic.forEach(name => console.log(`  + ${name}`));
  }

  console.log(`\nConsumables added: ${added.consumables.length}`);
  if (added.consumables.length > 0) {
    added.consumables.forEach(name => console.log(`  + ${name}`));
  }

  console.log('\n=== JSON File Statistics (After) ===');
  console.log(`Weapons: ${jsonData.weapon_items.length}`);
  console.log(`Armor: ${jsonData.armor_items.length}`);
  console.log(`Rings: ${jsonData.ring_items.length}`);
  console.log(`Magic: ${jsonData.magic_items.length}`);
  console.log(`Consumables: ${jsonData.consumable_items.length}`);

  console.log('\nWriting updated JSON file...');
  fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');

  console.log('\n✓ Done!');
  console.log(`\nTotal items added: ${
    added.weapons.length +
    added.armor.length +
    added.rings.length +
    added.magic.length +
    added.consumables.length
  }`);
}

main().catch(console.error);
