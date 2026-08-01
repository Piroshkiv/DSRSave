const fs = require('fs');

const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\dist\\json\\ds3_items.json';

console.log('Step 1: Reading JSON file...');
const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

const allCategories = [
  'weapon_items',
  'armor_items',
  'ring_items',
  'magic_items',
  'consumable_items'
];

let countUpdated21to99 = 0;
let countUpdatedSoulOf = 0;

console.log('\nStep 2: Applying rules...');

for (const category of allCategories) {
  if (!jsonData[category]) continue;

  jsonData[category].forEach(item => {
    // Правило 1: Если MaxStackCount от 21 до 98 - ставим 99
    if (item.MaxStackCount >= 21 && item.MaxStackCount <= 98) {
      item.MaxStackCount = 99;
      countUpdated21to99++;
    }

    // Правило 2: Если имя начинается с "Soul of a" - ставим 99
    if (item.Name && item.Name.startsWith('Soul of a')) {
      if (item.MaxStackCount !== 99) {
        item.MaxStackCount = 99;
        countUpdatedSoulOf++;
      }
    }
  });
}

console.log(`Updated items with MaxStackCount 21-98 to 99: ${countUpdated21to99}`);
console.log(`Updated "Soul of a" items to 99: ${countUpdatedSoulOf}`);

console.log('\nStep 3: Saving updated JSON...');
fs.writeFileSync(JSON_FILE, JSON.stringify(jsonData, null, 2), 'utf-8');

console.log('\n✓ Done!');
