const fs   = require('fs');
const crypto = require('crypto');

const SAVE_FILE = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2';
const OUT_FILE  = 'C:\\Users\\Iho\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000_patched.sl2';

const KEY = Buffer.from([0xFD,0x46,0x4D,0x69,0x5E,0x69,0xA3,0x9A,0x10,0xE3,0x19,0xA7,0xAC,0xE8,0xB7,0xFA]);

// Set these slot indices to 0x01 (active)
const SLOTS_TO_ACTIVATE = [0, 1, 2, 3]; // the 4 "deleted" slots
const SLOT_FLAGS_OFFSET  = 0x1098;

function decryptEntry(save, idx) {
  const off = 0x40 + idx * 0x20;
  const sz  = Number(save.readBigUInt64LE(off + 8));
  const do_ = save.readUInt32LE(off + 0x10);
  const iv  = save.slice(do_ + 16, do_ + 32);
  const enc = save.slice(do_ + 32, do_ + 32 + sz - 32);
  const d = crypto.createDecipheriv('aes-128-cbc', KEY, iv);
  d.setAutoPadding(false);
  return { dec: Buffer.concat([d.update(enc), d.final()]), iv, do_, sz };
}

function encryptEntry(plain, iv) {
  const e = crypto.createCipheriv('aes-128-cbc', KEY, iv);
  e.setAutoPadding(false);
  return Buffer.concat([e.update(plain), e.final()]);
}

const save = fs.readFileSync(SAVE_FILE);
const result = Buffer.from(save);

// Patch entry10
const { dec, iv, do_, sz } = decryptEntry(save, 10);
const patched = Buffer.from(dec);

console.log('Before patch:');
for (let i = 0; i < 10; i++) {
  console.log(`  slot ${i}: 0x${patched[SLOT_FLAGS_OFFSET + i].toString(16).padStart(2,'0')}`);
}

for (const s of SLOTS_TO_ACTIVATE) {
  patched[SLOT_FLAGS_OFFSET + s] = 0x01;
}

console.log('\nAfter patch:');
for (let i = 0; i < 10; i++) {
  console.log(`  slot ${i}: 0x${patched[SLOT_FLAGS_OFFSET + i].toString(16).padStart(2,'0')}`);
}

// Re-encrypt
const reEncrypted = encryptEntry(patched, iv);
if (reEncrypted.length !== sz - 32) {
  console.error(`Size mismatch: expected ${sz - 32}, got ${reEncrypted.length}`);
  process.exit(1);
}

// Recalculate MD5: MD5(IV + encryptedData)
const toHash = Buffer.concat([iv, reEncrypted]);
const newMd5 = crypto.createHash('md5').update(toHash).digest();

// Write back: [MD5][IV][EncryptedData]
result.set(newMd5,        do_);
result.set(iv,            do_ + 16);
result.set(reEncrypted,   do_ + 32);

fs.writeFileSync(OUT_FILE, result);
console.log(`\nPatched save written to: ${OUT_FILE}`);
console.log('Load DS30000_patched.sl2 in the editor to test.');
