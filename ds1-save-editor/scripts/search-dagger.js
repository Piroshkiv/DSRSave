const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (6).bin';
const DAGGER_ID = 0x000F4240;

console.log(`Searching for Dagger (base ID: 0x${DAGGER_ID.toString(16).toUpperCase()})...`);

const saveData = fs.readFileSync(SAVE_FILE);

// Search for exact ID and variations with upgrade levels
const found = [];

for (let upgrade = 0; upgrade <= 15; upgrade++) {
  // Try different byte arrangements
  // Method 1: First byte + upgrade
  const id1 = DAGGER_ID + upgrade;

  // Method 2: Just the lower 2 bytes with upper bytes 0x8080
  const lowerBytes = DAGGER_ID & 0xFFFF;
  const id2 = (lowerBytes + upgrade) | 0x80800000;

  const testIds = [id1, id2];

  for (const testId of testIds) {
    const searchBytes = Buffer.allocUnsafe(4);
    searchBytes.writeUInt32LE(testId, 0);

    for (let offset = 0; offset < saveData.length - 4; offset++) {
      let match = true;
      for (let i = 0; i < 4; i++) {
        if (saveData[offset + i] !== searchBytes[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        found.push({
          offset: offset,
          testId: testId,
          upgrade: upgrade,
          hex: testId.toString(16).toUpperCase().padStart(8, '0'),
          bytes: [
            saveData[offset].toString(16).toUpperCase().padStart(2, '0'),
            saveData[offset + 1].toString(16).toUpperCase().padStart(2, '0'),
            saveData[offset + 2].toString(16).toUpperCase().padStart(2, '0'),
            saveData[offset + 3].toString(16).toUpperCase().padStart(2, '0')
          ].join(' ')
        });
      }
    }
  }
}

if (found.length === 0) {
  console.log('Dagger NOT found in save file');

  // Let's search for the raw bytes in different arrangements
  console.log('\nSearching for byte patterns...');

  // Dagger ID = 0x000F4240 = bytes: 40 42 0F 00
  const patterns = [
    [0x40, 0x42, 0x0F, 0x00], // Little endian exact
    [0x00, 0x0F, 0x42, 0x40], // Big endian
    [0x40, 0x42, 0x0F], // First 3 bytes
    [0x42, 0x0F, 0x00], // Last 3 bytes
  ];

  for (let patIdx = 0; patIdx < patterns.length; patIdx++) {
    const pattern = patterns[patIdx];
    let patternFound = 0;

    for (let offset = 0; offset < saveData.length - pattern.length; offset++) {
      let match = true;
      for (let i = 0; i < pattern.length; i++) {
        if (saveData[offset + i] !== pattern[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        patternFound++;
        if (patternFound <= 5) {
          console.log(`Pattern ${patIdx + 1} found at 0x${offset.toString(16).toUpperCase()}: ${pattern.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
        }
      }
    }

    if (patternFound > 0) {
      console.log(`  Total: ${patternFound} occurrences`);
    }
  }
} else {
  console.log(`Found ${found.length} occurrences of Dagger:`);
  found.forEach((f, i) => {
    console.log(`${i + 1}. Offset: 0x${f.offset.toString(16).toUpperCase()}, ID: 0x${f.hex}, Upgrade: +${f.upgrade}, Bytes: ${f.bytes}`);
  });
}
