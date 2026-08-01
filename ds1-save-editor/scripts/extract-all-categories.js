const fs = require('fs');

const SOURCE_FILE = 'C:\\Users\\Iho\\Downloads\\ds3_items.json';
const DIST_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\dist\\json\\ds3_items.json';
const PUBLIC_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\public\\json\\ds3_items.json';

console.log('Step 1: Reading JSON file from Downloads...');
const jsonData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf-8'));

console.log('\nStep 2: Extracting ores, keys, ammunition, and covenants from consumables...');

// Создаем новые категории
jsonData.ore_items = [];
jsonData.key_items = [];
jsonData.ammunition_items = [];
jsonData.covenant_items = [];

// Извлекаем все категории из consumable_items
if (jsonData.consumable_items) {
  const remaining = [];

  jsonData.consumable_items.forEach(item => {
    if (item.Category === 'ores') {
      // Set MaxStackCount to 99 for ores
      item.MaxStackCount = 99;
      jsonData.ore_items.push(item);
    } else if (item.Category === 'keys') {
      // Set MaxStackCount to 1 for keys
      item.MaxStackCount = 1;
      jsonData.key_items.push(item);
    } else if (item.Category === 'ammunition') {
      jsonData.ammunition_items.push(item);
    } else if (item.Category === 'covenants') {
      jsonData.covenant_items.push(item);
    } else {
      remaining.push(item);
    }
  });

  jsonData.consumable_items = remaining;
}

console.log(`Extracted ore_items: ${jsonData.ore_items.length}`);
console.log(`Extracted key_items: ${jsonData.key_items.length}`);
console.log(`Extracted ammunition_items: ${jsonData.ammunition_items.length}`);
console.log(`Extracted covenant_items: ${jsonData.covenant_items.length}`);
console.log(`Remaining consumable_items: ${jsonData.consumable_items.length}`);

console.log('\nStep 3: Reordering categories in JSON...');

// Пересоздаем объект в нужном порядке
const orderedData = {
  weapon_items: jsonData.weapon_items,
  armor_items: jsonData.armor_items,
  ring_items: jsonData.ring_items,
  magic_items: jsonData.magic_items,
  consumable_items: jsonData.consumable_items,
  ore_items: jsonData.ore_items,
  key_items: jsonData.key_items,
  ammunition_items: jsonData.ammunition_items,
  covenant_items: jsonData.covenant_items
};

console.log('\nStep 4: Saving updated JSON to dist and public...');
fs.writeFileSync(DIST_FILE, JSON.stringify(orderedData, null, 2), 'utf-8');
fs.writeFileSync(PUBLIC_FILE, JSON.stringify(orderedData, null, 2), 'utf-8');

console.log('\n✓ Done!');
console.log('\nNew structure:');
console.log(`  - weapon_items: ${orderedData.weapon_items.length}`);
console.log(`  - armor_items: ${orderedData.armor_items.length}`);
console.log(`  - ring_items: ${orderedData.ring_items.length}`);
console.log(`  - magic_items: ${orderedData.magic_items.length}`);
console.log(`  - consumable_items: ${orderedData.consumable_items.length}`);
console.log(`  - ore_items: ${orderedData.ore_items.length}`);
console.log(`  - key_items: ${orderedData.key_items.length}`);
console.log(`  - ammunition_items: ${orderedData.ammunition_items.length}`);
console.log(`  - covenant_items: ${orderedData.covenant_items.length}`);

// Показываем примеры
console.log('\n=== Sample Ore Items ===');
orderedData.ore_items.slice(0, 3).forEach(item => {
  console.log(`  - ${item.Name} (${item.Category})`);
});

console.log('\n=== Sample Key Items ===');
orderedData.key_items.slice(0, 3).forEach(item => {
  console.log(`  - ${item.Name} (${item.Category})`);
});

console.log('\n=== Sample Ammunition Items ===');
orderedData.ammunition_items.slice(0, 3).forEach(item => {
  console.log(`  - ${item.Name} (${item.Category})`);
});

console.log('\n=== Sample Covenant Items ===');
orderedData.covenant_items.slice(0, 3).forEach(item => {
  console.log(`  - ${item.Name} (${item.Category})`);
});
