const fs = require('fs');

// Constants from the codebase
const SAVE_FILE_SIZE = 0x4204D0;
const SAVE_SLOT_SIZE = 0x060030;
const BASE_SLOT_OFFSET = 0x02C0;
const USER_DATA_SIZE = 0x060020;
const USER_DATA_FILE_COUNT = 11;

console.log('=== Dark Souls Save File Structure ===\n');

console.log('File Layout:');
console.log(`- Total file size: 0x${SAVE_FILE_SIZE.toString(16)} (${SAVE_FILE_SIZE} bytes)`);
console.log(`- Header size: 0x${BASE_SLOT_OFFSET.toString(16)} (${BASE_SLOT_OFFSET} bytes)`);
console.log(`- Number of slots: ${USER_DATA_FILE_COUNT} (10 characters + 1 metadata)\n`);

console.log('Slot Structure (each slot):');
console.log(`- Total slot size: 0x${SAVE_SLOT_SIZE.toString(16)} (${SAVE_SLOT_SIZE} bytes)`);
console.log('- Bytes 0x00-0x0F (16 bytes): MD5 checksum (also used as AES IV)');
console.log(`- Bytes 0x10-0x${(USER_DATA_SIZE + 16).toString(16)} (${USER_DATA_SIZE} bytes): Encrypted character data (AES-CBC)\n`);

console.log('Slot Offsets:');
for (let i = 0; i < USER_DATA_FILE_COUNT; i++) {
  const slotStart = BASE_SLOT_OFFSET + i * SAVE_SLOT_SIZE;
  const slotEnd = slotStart + SAVE_SLOT_SIZE;
  const slotType = i < 10 ? `Character ${i}` : 'Metadata';
  console.log(`  Slot ${i} (${slotType}): 0x${slotStart.toString(16)} - 0x${slotEnd.toString(16)}`);
}

// Calculate where 0x55fc0 is
const targetOffset = 0x55fc0;
console.log(`\n=== Analyzing offset 0x${targetOffset.toString(16)} ===`);
console.log(`Offset in decimal: ${targetOffset} bytes`);

if (targetOffset < BASE_SLOT_OFFSET) {
  console.log('Location: In file header/metadata');
} else {
  const offsetInSlots = targetOffset - BASE_SLOT_OFFSET;
  const slotNumber = Math.floor(offsetInSlots / SAVE_SLOT_SIZE);
  const offsetInSlot = offsetInSlots % SAVE_SLOT_SIZE;

  console.log(`Location: Slot ${slotNumber}`);
  console.log(`Offset within slot: 0x${offsetInSlot.toString(16)} (${offsetInSlot} bytes)`);

  if (offsetInSlot < 16) {
    console.log('Position: In MD5 checksum/IV');
  } else if (offsetInSlot < 16 + USER_DATA_SIZE) {
    const offsetInData = offsetInSlot - 16;
    console.log(`Position: In encrypted data (0x${offsetInData.toString(16)} bytes into data)`);
    console.log(`Remaining encrypted data: ${USER_DATA_SIZE - offsetInData} bytes`);
  } else {
    console.log('Position: After encrypted data (padding/unused area)');
  }
}

console.log('\n=== How Signature Works ===');
console.log('1. Character data (393248 bytes) is encrypted with AES-CBC');
console.log('2. AES key: 01 23 45 67 89 AB CD EF FE DC BA 98 76 54 32 10');
console.log('3. IV (Initialization Vector): First 16 bytes of each slot');
console.log('4. MD5 checksum is calculated from encrypted data');
console.log('5. Checksum is stored in the first 16 bytes (same as IV)');
console.log('6. When loading: IV is used to decrypt, checksum validates integrity');
console.log('\nNote: The "garbage" after certain offset might be:');
console.log('  - Unused space in character data (game only uses part of 393248 bytes)');
console.log('  - AES padding bytes');
console.log('  - Reserved space for future use');
