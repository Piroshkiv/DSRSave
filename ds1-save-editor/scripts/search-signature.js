const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (11).bin';

console.log('Reading save file...');
const data = fs.readFileSync(SAVE_FILE);

// Known signature for Shortsword: 0xC725 (bytes: 0x25 0xC7)
const shortswordId = 0x001E8480;
const knownSignature = 0xC725;

console.log(`\nShortsword ID: 0x${shortswordId.toString(16).toUpperCase()}`);
console.log(`Known signature: 0x${knownSignature.toString(16).toUpperCase()}`);

// Search for the signature bytes (0x25 0xC7) in the file
console.log('\n=== Searching for signature 0x25 0xC7 ===');

let found = 0;
for (let i = 0; i < data.length - 1; i++) {
  if (data[i] === 0x25 && data[i + 1] === 0xC7) {
    console.log(`Found at offset 0x${i.toString(16).toUpperCase()}`);

    // Show surrounding bytes
    const start = Math.max(0, i - 8);
    const end = Math.min(data.length, i + 10);
    const context = Array.from(data.slice(start, end));
    console.log(`  Context: ${context.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

    found++;
    if (found >= 10) {
      console.log('  ... (showing first 10)');
      break;
    }
  }
}

// Also search for the item ID
console.log(`\n=== Searching for Shortsword ID 0x80 0x84 0x1E 0x00 ===`);

let idFound = 0;
for (let i = 0; i < data.length - 3; i++) {
  if (data[i] === 0x80 && data[i + 1] === 0x84 && data[i + 2] === 0x1E && data[i + 3] === 0x00) {
    console.log(`Found at offset 0x${i.toString(16).toUpperCase()}`);

    // Show full 16 bytes (potential item slot)
    const context = Array.from(data.slice(i - 4, i + 12));
    console.log(`  Full item: ${context.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

    idFound++;
    if (idFound >= 5) {
      console.log('  ... (showing first 5)');
      break;
    }
  }
}

// Try to find a pattern table that might store signatures
console.log('\n=== Looking for potential signature table ===');
// Check if there's a section with many 2-byte values that could be signatures

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
console.log(`Pattern offset: 0x${patternOffset.toString(16).toUpperCase()}`);

// Check various offsets from pattern for signature table
const checkOffsets = [0, 476, 480, 500, 600, 700, 800, 1000, 1500, 2000, 5000, 10000];

console.log('\nChecking various offsets from pattern:');
checkOffsets.forEach(offset => {
  const addr = patternOffset + offset;
  if (addr + 15 < data.length) {
    const bytes = Array.from(data.slice(addr, addr + 16));
    // Check if bytes 14-15 are 0x25 0xC7
    if (bytes[14] === 0x25 && bytes[15] === 0xC7) {
      console.log(`  Pattern + ${offset}: ${bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
    }
  }
});
