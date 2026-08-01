const fs = require('fs');

const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\dist\\json\\ds3_items.json';

console.log('Step 1: Reading JSON file...');
const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

console.log('\nStep 2: Extracting ammunition and covenants...');

// Создаем новые категории
jsonData.ammunition_items = [];
jsonData.covenant_items = [];

// Извлекаем ammunition из consumable_items
if (jsonData.consumable_items) {
  const remaining = [];

  jsonData.consumable_items.forEach(item => {
    if (item.Category === 'ammunition') {
      jsonData.ammunition_items.push(item);
    } else if (item.Category === 'covenants') {
      jsonData.covenant_items.push(item);
    } else {
      remaining.push(item);
    }
  });

  jsonData.consumable_items = remaining;
}

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
  ammunition_items: jsonData.ammunition_items,
  covenant_items: jsonData.covenant_items
};

console.log('\nStep 4: Saving updated JSON...');
fs.writeFileSync(JSON_FILE, JSON.stringify(orderedData, null, 2), 'utf-8');

console.log('\n✓ Done!');
console.log('\nNew structure:');
console.log(`  - weapon_items: ${orderedData.weapon_items.length}`);
console.log(`  - armor_items: ${orderedData.armor_items.length}`);
console.log(`  - ring_items: ${orderedData.ring_items.length}`);
console.log(`  - magic_items: ${orderedData.magic_items.length}`);
console.log(`  - consumable_items: ${orderedData.consumable_items.length}`);
console.log(`  - ammunition_items: ${orderedData.ammunition_items.length}`);
console.log(`  - covenant_items: ${orderedData.covenant_items.length}`);
