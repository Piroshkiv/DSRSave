const fs = require('fs');

const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]);

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

function findGotthard(savePath, title) {
  console.log(`\n${title}`);
  console.log('='.repeat(60));

  const saveData = fs.readFileSync(savePath);
  const patternOffset = findPattern(saveData, PATTERN);
  const inventoryStart = patternOffset + 0x09C;

  for (let i = 0; i < 3000; i++) {
    const offset = inventoryStart + i * 16;
    if (offset + 16 > saveData.length) break;

    const separator = saveData[offset + 3];
    if (separator !== 0x80) continue;

    const itemId = saveData.readUInt32LE(offset + 4);

    if (itemId === 0x00F53570) {
      console.log('\nGotthard Twinswords found at slot ' + i);
      console.log('Offset: 0x' + offset.toString(16).toUpperCase());
      console.log('\nAll 16 bytes:');

      for (let j = 0; j < 16; j++) {
        const val = saveData[offset + j];
        console.log(`  Byte ${j.toString().padStart(2)}: 0x${val.toString(16).toUpperCase().padStart(2, '0')} (${val.toString().padStart(3)}) binary: ${val.toString(2).padStart(8, '0')}`);
      }

      console.log('\nID (bytes 4-7): 0x' + itemId.toString(16).toUpperCase().padStart(8, '0'));
      console.log('Quantity (byte 8): ' + saveData[offset + 8]);
      console.log('Byte 9: 0x' + saveData[offset + 9].toString(16).toUpperCase().padStart(2, '0'));
      console.log('Byte 10: 0x' + saveData[offset + 10].toString(16).toUpperCase().padStart(2, '0'));
      console.log('Byte 11: 0x' + saveData[offset + 11].toString(16).toUpperCase().padStart(2, '0'));
      console.log('Byte 12: 0x' + saveData[offset + 12].toString(16).toUpperCase().padStart(2, '0'));
    }
  }
}

findGotthard('C:\\Users\\Iho\\Downloads\\character_slot1_raw (2).bin', 'OLD SAVE: Sharp +10');
findGotthard('C:\\Users\\Iho\\Downloads\\character_slot1_raw (4).bin', 'NEW SAVE: Standard +0');
