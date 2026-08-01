const fs = require('fs');

// Читаем из расшифрованного сохранения character_slot0_raw (8).bin
// где много правильно созданных предметов
const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (8).bin';

console.log('Reading save file with correct items...');
const data = fs.readFileSync(SAVE_FILE);

// Find pattern
const pattern = [
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

function findPattern(data) {
  for (let i = 0; i <= data.length - pattern.length; i++) {
    let found = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      return i;
    }
  }
  return -1;
}

const patternOffset = findPattern(data);
const inventoryStart = patternOffset + 0x9C;

console.log(`Pattern offset: 0x${patternOffset.toString(16).toUpperCase()}`);
console.log(`Inventory start: 0x${inventoryStart.toString(16).toUpperCase()}`);

// Collect all weapon items (separator 0x80) with their ID and signature
console.log('\n=== Collecting weapon items and their signatures ===');

const weapons = new Map(); // itemId -> signature

for (let i = 0; i < 256; i++) {
  const offset = inventoryStart + (i * 16);
  const bytes = Array.from(data.slice(offset, offset + 16));

  const isEmpty = bytes.every(b => b === 0x00);
  if (isEmpty) continue;

  const separator = bytes[2];
  if (separator !== 0x80) continue; // Only weapons

  const itemId = bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
  const baseId = itemId & 0xFFFFFF00; // Remove upgrade byte
  const signature = bytes[14] | (bytes[15] << 8);

  if (!weapons.has(baseId)) {
    weapons.set(baseId, []);
  }
  weapons.get(baseId).push({ itemId, signature, slot: i });
}

console.log(`Found ${weapons.size} unique base weapon IDs`);

// Show weapons with multiple instances
console.log('\n=== Weapons with multiple instances (showing signatures) ===');
let count = 0;
for (const [baseId, instances] of weapons.entries()) {
  if (instances.length > 1 && count < 10) {
    console.log(`\nBase ID: 0x${baseId.toString(16).toUpperCase().padStart(8, '0')}`);
    instances.forEach((inst, idx) => {
      console.log(`  [${idx + 1}] Slot ${inst.slot}: Item ID 0x${inst.itemId.toString(16).toUpperCase().padStart(8, '0')}, Signature 0x${inst.signature.toString(16).toUpperCase().padStart(4, '0')}`);
    });

    // Check if all have same signature
    const allSame = instances.every(inst => inst.signature === instances[0].signature);
    console.log(`  All same signature: ${allSame ? 'YES ✓' : 'NO ✗'}`);

    count++;
  }
}

// Check for Shortsword specifically
const shortswordBaseId = 0x001E8400;
console.log(`\n=== Shortsword (Base ID: 0x${shortswordBaseId.toString(16).toUpperCase()}) ===`);
if (weapons.has(shortswordBaseId)) {
  const instances = weapons.get(shortswordBaseId);
  instances.forEach((inst, idx) => {
    console.log(`  [${idx + 1}] Slot ${inst.slot}: Item ID 0x${inst.itemId.toString(16).toUpperCase().padStart(8, '0')}, Signature 0x${inst.signature.toString(16).toUpperCase().padStart(4, '0')}`);
  });
} else {
  console.log('  Not found in inventory');
}

// Show first 20 unique signatures
console.log('\n=== First 20 Base ID -> Signature mappings ===');
let shown = 0;
for (const [baseId, instances] of weapons.entries()) {
  if (shown >= 20) break;
  const signature = instances[0].signature;
  console.log(`0x${baseId.toString(16).toUpperCase().padStart(8, '0')} -> 0x${signature.toString(16).toUpperCase().padStart(4, '0')}`);
  shown++;
}
