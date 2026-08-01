const fs = require('fs');

const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

const INFUSION_NAMES = [
  'Standard', 'Heavy', 'Sharp', 'Refined', 'Simple',
  'Crystal', 'Fire', 'Chaos', 'Lightning', 'Deep',
  'Dark', 'Poison', 'Blood', 'Raw', 'Blessed', 'Hollow'
];

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

const saveData = fs.readFileSync('C:\\Users\\Iho\\Downloads\\character_slot1_raw (2).bin');
const patternOffset = findPattern(saveData, PATTERN);
const inventoryStart = patternOffset + 0x09C;

console.log('OLD SAVE - Looking for Gotthard (should be Sharp +10):\n');

for (let i = 0; i < 3000; i++) {
  const offset = inventoryStart + i * 16;
  if (offset + 16 > saveData.length) break;

  const separator = saveData[offset + 3];
  if (separator !== 0x80) continue;

  const itemId = saveData.readUInt32LE(offset + 4);

  // Gotthard range
  if (itemId >= 0x00F53500 && itemId <= 0x00F535FF) {
    const byte0 = itemId & 0xFF;
    const lowerNibble = byte0 & 0x0F;
    const upperNibble = (byte0 >> 4) & 0x0F;

    console.log(`Slot ${i}:`);
    console.log(`  ID: 0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`);
    console.log(`  Byte 0: 0x${byte0.toString(16).toUpperCase().padStart(2, '0')} (binary: ${byte0.toString(2).padStart(8, '0')})`);
    console.log(`  Lower nibble (upgrade): ${lowerNibble}`);
    console.log(`  Upper nibble (infusion): ${upperNibble} (${INFUSION_NAMES[upperNibble]})`);
    console.log();
    console.log('  Expected Sharp +10:');
    console.log(`    Sharp infusion = 2`);
    console.log(`    Expected byte 0: (2 << 4) | 10 = 0x${((2 << 4) | 10).toString(16).toUpperCase()} = ${(2 << 4) | 10}`);
  }
}
