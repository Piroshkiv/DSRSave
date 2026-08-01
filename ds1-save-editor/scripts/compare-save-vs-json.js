/**
 * compare-save-vs-json.js
 *
 * Parses DS3 inventory from a raw character .bin file and compares against ds3_items.json.
 * Uses the correct GA-table-based inventory offset (mirrors Inventory.ts logic).
 *
 * Filters:  Safe=false (unsafe/debug), gestures (ID>=0x40002300), boss souls,
 *           duplicate Estus variants, covenant items (listed separately).
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const JSON_FILE = path.join(__dirname, '../public/json/ds3_items.json');

// ── GA table constants (mirrors Inventory.ts) ─────────────────────────────────
const GA_START       = 0x70;
const GA_SLOTS       = 6144;
const GA_SMALL       = 8;
const GA_LARGE       = 60;
const GA_TYPE_WEAPON = 0x80000000 >>> 0;
const GA_TYPE_ARMOR  = 0x90000000 >>> 0;
const INV_DELTA      = 0x13F + 0x1DD; // 0x31C

const ITEM_SIZE       = 16;
const REGULAR_SLOTS   = 1920;
const KEY_SECTION_OFF = 0x7800;
const MAX_KEY_SLOTS   = 256;

// ── primitives ────────────────────────────────────────────────────────────────
function readU32LE(b, o) {
  return ((b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24)) >>> 0);
}

function gaTableEnd(data) {
  let off = GA_START;
  for (let i = 0; i < GA_SLOTS; i++) {
    if (off + GA_SMALL > data.length) break;
    const gh = readU32LE(data, off);
    const tp = (gh & 0xF0000000) >>> 0;
    if (gh === 0)                                    off += GA_SMALL;
    else if (tp === GA_TYPE_WEAPON || tp === GA_TYPE_ARMOR) off += GA_LARGE;
    else                                             off += GA_SMALL;
  }
  return off;
}

function inventoryStart(data) {
  return gaTableEnd(data) + INV_DELTA;
}

function findBaseWeaponId(rawId, weaponItems) {
  const hi = (rawId >>> 16) & 0xFFFF;
  const lo = rawId & 0xFFFF;
  for (const w of weaponItems) {
    const dbId = parseInt(w.Id, 16);
    if (((dbId >>> 16) & 0xFFFF) !== hi) continue;
    const mod = (lo - (dbId & 0xFFFF) + 0x10000) & 0xFFFF;
    if (mod <= 1510) return dbId;
  }
  return rawId;
}

// ── build set of base IDs present in save ────────────────────────────────────
const ESTUS_BASES = [0x40000096, 0x400000BE];

function buildFoundSet(data, jsonData) {
  const invStart = inventoryStart(data);
  const found = new Set();

  for (let i = 0; i < REGULAR_SLOTS; i++) {
    const off = invStart + i * ITEM_SIZE;
    if (off + ITEM_SIZE > data.length) break;
    const sep = data[off + 3];
    if (sep === 0) continue;
    const raw = readU32LE(data, off + 4);
    if (!raw || raw === 0xFFFFFFFF) continue;
    found.add(sep === 0x80 ? findBaseWeaponId(raw, jsonData.weapon_items || []) : raw);
  }

  const kco = invStart + KEY_SECTION_OFF;
  if (kco + 4 <= data.length) {
    const kc = Math.min(readU32LE(data, kco), MAX_KEY_SLOTS);
    for (let i = 0; i < kc; i++) {
      const off = kco + 4 + i * ITEM_SIZE;
      if (off + ITEM_SIZE > data.length) break;
      if (data[off + 3] === 0) continue;
      const raw = readU32LE(data, off + 4);
      if (raw && raw !== 0xFFFFFFFF) found.add(raw);
    }
  }

  // Estus family: if any variant found, mark all +0..+22 variants present
  for (const base of ESTUS_BASES) {
    const anyFound = Array.from({length: 23}, (_,i) => i).some(i => found.has(base + i));
    if (anyFound) for (let i = 0; i <= 22; i++) found.add(base + i);
  }

  return found;
}

// ── collect all save items (for unknown-in-save report) ──────────────────────
function collectSaveItems(data, jsonData) {
  const invStart = inventoryStart(data);

  // Build a flat DB map across all sections (including keys/covenants)
  const allDbIds = new Map();
  const ALL_SECS = ['weapon_items','armor_items','ring_items','consumable_items',
                    'magic_items','ore_items','key_items','ammunition_items','covenant_items'];
  for (const sec of ALL_SECS) {
    const arr = jsonData[sec]; if (!arr) continue;
    for (const item of arr) {
      const id = parseInt(item.Id, 16);
      if (!allDbIds.has(id)) allDbIds.set(id, { ...item, _section: sec });
    }
  }

  const items = [];

  for (let i = 0; i < REGULAR_SLOTS; i++) {
    const off = invStart + i * ITEM_SIZE;
    if (off + ITEM_SIZE > data.length) break;
    const sep = data[off + 3]; if (!sep) continue;
    const raw = readU32LE(data, off + 4); if (!raw || raw === 0xFFFFFFFF) continue;
    const baseId = sep === 0x80 ? findBaseWeaponId(raw, jsonData.weapon_items || []) : raw;
    items.push({ rawId: raw, baseId, separator: sep });
  }

  const kco = invStart + KEY_SECTION_OFF;
  if (kco + 4 <= data.length) {
    const kc = Math.min(readU32LE(data, kco), MAX_KEY_SLOTS);
    for (let i = 0; i < kc; i++) {
      const off = kco + 4 + i * ITEM_SIZE;
      if (off + ITEM_SIZE > data.length) break;
      const sep = data[off + 3]; if (!sep) continue;
      const raw = readU32LE(data, off + 4); if (!raw || raw === 0xFFFFFFFF) continue;
      items.push({ rawId: raw, baseId: raw, separator: sep, isKey: true });
    }
  }

  return { items, allDbIds };
}

// ── filter logic ─────────────────────────────────────────────────────────────
function skipReason(item, sectionName) {
  if (item.Safe === false) return 'unsafe';
  const id = parseInt(item.Id, 16);
  if (id >= 0x40002300) return 'gesture';
  if (item.Category === 'bosssouls') return 'bosssoul';
  if (item.Category === 'covenantitems') return 'covenant';
  if (sectionName === 'ring_items' && id >= 0x20002700 && id <= 0x20002780) return 'covenantring';
  return null;
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  const data     = new Uint8Array(fs.readFileSync(SAVE_FILE));
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

  const invStart = inventoryStart(data);
  console.log(`Inventory starts at: 0x${invStart.toString(16).toUpperCase()}\n`);

  const found = buildFoundSet(data, jsonData);
  const { items: saveItems, allDbIds } = collectSaveItems(data, jsonData);

  // ── 1. In SAVE but NOT in JSON ─────────────────────────────────────────────
  const SEP_NAME = { 0x80: 'Weapon', 0x90: 'Armor', 0xA0: 'Ring', 0xB0: 'Consumable' };
  const unknownInSave = saveItems.filter(it => !allDbIds.has(it.baseId));

  console.log('═'.repeat(70));
  console.log(`IN SAVE BUT NOT IN JSON (${unknownInSave.length} items)`);
  console.log('═'.repeat(70));
  if (unknownInSave.length === 0) {
    console.log('  (none)');
  } else {
    for (const it of unknownInSave) {
      const cat = SEP_NAME[it.separator] || `sep=0x${it.separator.toString(16)}`;
      const flag = it.isKey ? ' [KEY SECTION]' : '';
      console.log(`  0x${it.rawId.toString(16).toUpperCase().padStart(8,'0')}  base=0x${it.baseId.toString(16).toUpperCase().padStart(8,'0')}  [${cat}]${flag}`);
    }
  }

  // ── 2. In JSON but NOT in SAVE (filtered) ─────────────────────────────────
  const SECTION_ORDER = [
    'weapon_items', 'armor_items', 'ring_items',
    'consumable_items', 'magic_items', 'ore_items', 'ammunition_items',
  ];

  const missingBySection = {};
  const covenantMissing  = [];
  const covenantPresent  = [];

  for (const sec of SECTION_ORDER) {
    const arr = jsonData[sec]; if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const reason = skipReason(item, sec);
      const id = parseInt(item.Id, 16);
      if (reason === 'covenant' || reason === 'covenantring') {
        (found.has(id) ? covenantPresent : covenantMissing).push({ ...item, _sec: sec });
        continue;
      }
      if (reason) continue;
      if (!found.has(id)) {
        if (!missingBySection[sec]) missingBySection[sec] = [];
        missingBySection[sec].push(item);
      }
    }
  }

  const totalMissing = Object.values(missingBySection).reduce((s,a) => s + a.length, 0);

  console.log('\n');
  console.log('═'.repeat(70));
  console.log(`IN JSON BUT NOT IN SAVE — real items (${totalMissing} total)`);
  console.log('Excluded: Safe=false, gestures, boss souls, Estus variants, covenants');
  console.log('═'.repeat(70));
  for (const sec of SECTION_ORDER) {
    const arr = missingBySection[sec]; if (!arr) continue;
    console.log(`\n── ${sec} (${arr.length}) ──`);
    arr.sort((a,b) => a.Name.localeCompare(b.Name)).forEach(i =>
      console.log(`  ${i.Name.padEnd(52)} ${i.Id}  cat=${i.Category}`)
    );
  }

  // ── 3. Covenant items ──────────────────────────────────────────────────────
  console.log('\n');
  console.log('═'.repeat(70));
  console.log(`COVENANT ITEMS — missing ${covenantMissing.length} / ${covenantMissing.length + covenantPresent.length}`);
  console.log('═'.repeat(70));
  if (covenantMissing.length) {
    console.log('\nMissing:');
    covenantMissing.forEach(i =>
      console.log(`  ${i.Name.padEnd(52)} ${i.Id}  [${i._sec}]`)
    );
  }
  if (covenantPresent.length) {
    console.log('\nPresent: ' + covenantPresent.map(i => i.Name).join(', '));
  } else {
    console.log('\nPresent: (none)');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('SUMMARY');
  console.log('═'.repeat(70));
  console.log(`Real items missing from save: ${totalMissing}`);
  for (const sec of SECTION_ORDER) {
    const arr = missingBySection[sec];
    if (arr && arr.length) console.log(`  ${sec.padEnd(25)} ${arr.length}`);
  }
  console.log(`Covenant items missing:       ${covenantMissing.length}`);
  console.log(`Unknown items in save:        ${unknownInSave.length}`);
}

main();
