const fs = require('fs');

const JSON_FILE = 'C:\\Users\\Iho\\source\\repos\\DSRSave\\ds1-save-editor\\dist\\json\\ds3_items.json';

console.log('Loading items database...');
const db = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

const targetId = 0x001E8480;
const shortswordId = 0x00F42400;

console.log(`\nLooking for item with ID 0x${targetId.toString(16).toUpperCase().padStart(8, '0')}...`);
console.log(`Also looking for Shortsword with ID 0x${shortswordId.toString(16).toUpperCase().padStart(8, '0')}...`);

function findItemById(id) {
  const categories = [
    'weapon_items',
    'armor_items',
    'ring_items',
    'magic_items',
    'consumable_items',
    'ore_items',
    'key_items',
    'ammunition_items',
    'covenant_items'
  ];

  for (const category of categories) {
    if (!db[category]) continue;
    for (const item of db[category]) {
      const itemId = parseInt(item.Id.replace(/^0x/, ''), 16);
      if (itemId === id) {
        return { item, category };
      }
    }
  }
  return null;
}

const result1 = findItemById(targetId);
if (result1) {
  console.log(`\nFound item with ID 0x${targetId.toString(16).toUpperCase()}:`);
  console.log(`  Name: ${result1.item.Name}`);
  console.log(`  Category: ${result1.category}`);
  console.log(`  MaxStackCount: ${result1.item.MaxStackCount}`);
} else {
  console.log(`\nItem with ID 0x${targetId.toString(16).toUpperCase()} NOT FOUND in database`);
}

const result2 = findItemById(shortswordId);
if (result2) {
  console.log(`\nFound Shortsword with ID 0x${shortswordId.toString(16).toUpperCase()}:`);
  console.log(`  Name: ${result2.item.Name}`);
  console.log(`  Category: ${result2.category}`);
  console.log(`  MaxStackCount: ${result2.item.MaxStackCount}`);
} else {
  console.log(`\nShortsword with ID 0x${shortswordId.toString(16).toUpperCase()} NOT FOUND in database`);
}

// Try to find by name
console.log('\n\nSearching for "Shortsword" by name...');
let foundByName = false;
for (const category of ['weapon_items', 'armor_items']) {
  if (!db[category]) continue;
  for (const item of db[category]) {
    if (item.Name.toLowerCase().includes('shortsword')) {
      console.log(`  Found: ${item.Name} (ID: ${item.Id}) in ${category}`);
      foundByName = true;
    }
  }
}
if (!foundByName) {
  console.log('  No items found with "shortsword" in name');
}
