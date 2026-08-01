/**
 * add-all-missing.js
 *
 * Reads a raw DS3 character .bin, adds every item from ds3_items.json that is
 * not already in the inventory, then writes a new .bin file.
 *
 * Filters (same as addAllItems in Inventory.ts):
 *   - Safe === false  → skip
 *   - Estus Flask / Ashen Estus Flask variants → skip
 *   - Keys (key_items section) → skip
 *   - Covenant items / covenant rings → skip
 *   - Gestures (ID >= 0x40002300) → skip
 *   - Weapons / Armor → skip (need GA table; handled by app's Add All instead)
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const SAVE_FILE   = 'C:\\Users\\Iho\\Downloads\\character_slot2_raw (14).bin';
const OUTPUT_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot2_all_items.bin';
const JSON_FILE   = path.join(__dirname, '../public/json/ds3_items.json');

// ── GA table / inventory constants ───────────────────────────────────────────
const GA_START       = 0x70;
const GA_SLOTS       = 6144;
const GA_SMALL       = 8;
const GA_LARGE       = 60;
const GA_TYPE_WEAPON = 0x80000000 >>> 0;
const GA_TYPE_ARMOR  = 0x90000000 >>> 0;
const INV_DELTA      = 0x13F + 0x1DD;
const ITEM_SIZE      = 16;
const REGULAR_SLOTS  = 1920;
const KEY_SECTION_OFF = 0x7800;
const MAX_KEY_SLOTS   = 256;

const FIND_PATTERN = [
  0xFF,0xFF,0xFF,0xFF,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0xFF,0xFF,0xFF,0xFF,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
];

// ── primitives ────────────────────────────────────────────────────────────────
function u32(b, o) { return ((b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0); }

function gaEnd(data) {
  let off = GA_START;
  for (let i = 0; i < GA_SLOTS; i++) {
    if (off + GA_SMALL > data.length) break;
    const gh = u32(data, off), tp = (gh & 0xF0000000) >>> 0;
    if (gh === 0)                                         off += GA_SMALL;
    else if (tp === GA_TYPE_WEAPON || tp === GA_TYPE_ARMOR) off += GA_LARGE;
    else                                                  off += GA_SMALL;
  }
  return off;
}

function invStart(data) { return gaEnd(data) + INV_DELTA; }

function findPattern(data) {
  outer: for (let i = 0; i <= data.length - FIND_PATTERN.length; i++) {
    for (let j = 0; j < FIND_PATTERN.length; j++) {
      if (data[i+j] !== FIND_PATTERN[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function findBaseWeapon(rawId, weapons) {
  const hi = (rawId >>> 16) & 0xFFFF, lo = rawId & 0xFFFF;
  for (const w of weapons) {
    const db = parseInt(w.Id, 16);
    if (((db >>> 16) & 0xFFFF) !== hi) continue;
    if (((lo - (db & 0xFFFF) + 0x10000) & 0xFFFF) <= 1510) return db;
  }
  return rawId;
}

// ── build set of IDs already in save ─────────────────────────────────────────
const ESTUS_BASES = [0x40000096, 0x400000BE];

function buildFound(data, jsonData) {
  const inv = invStart(data);
  const found = new Set();

  for (let i = 0; i < REGULAR_SLOTS; i++) {
    const off = inv + i * ITEM_SIZE;
    if (off + ITEM_SIZE > data.length) break;
    const sep = data[off + 3]; if (!sep) continue;
    const raw = u32(data, off + 4); if (!raw || raw === 0xFFFFFFFF) continue;
    found.add(sep === 0x80 ? findBaseWeapon(raw, jsonData.weapon_items || []) : raw);
  }

  const kco = inv + KEY_SECTION_OFF;
  if (kco + 4 <= data.length) {
    const kc = Math.min(u32(data, kco), MAX_KEY_SLOTS);
    for (let i = 0; i < kc; i++) {
      const off = kco + 4 + i * ITEM_SIZE;
      if (off + ITEM_SIZE > data.length) break;
      if (!data[off + 3]) continue;
      const raw = u32(data, off + 4);
      if (raw && raw !== 0xFFFFFFFF) found.add(raw);
    }
  }

  // Mark all Estus variants as found if any variant present
  for (const base of ESTUS_BASES) {
    if (Array.from({length: 23}, (_, i) => i).some(i => found.has(base + i)))
      for (let i = 0; i <= 22; i++) found.add(base + i);
  }

  return found;
}

// ── inventory helpers ─────────────────────────────────────────────────────────
function getHighestIndex(data, inv) {
  let max = 0;
  for (let i = 0; i < REGULAR_SLOTS; i++) {
    const off = inv + i * ITEM_SIZE;
    if (off + ITEM_SIZE > data.length) break;
    if (!data[off + 3]) continue;
    const v = data[off + 12] | ((data[off + 13] & 0x0F) << 8);
    if (v > max) max = v;
  }
  return max;
}

function findNextSlot(data, inv, from) {
  for (let i = from; i < REGULAR_SLOTS - 1; i++) {
    const o1 = inv + i * ITEM_SIZE, o2 = o1 + ITEM_SIZE;
    if (o2 + ITEM_SIZE <= data.length && data[o1 + 3] === 0 && data[o2 + 3] === 0) return i;
  }
  return -1;
}

function addItem(data, inv, itemId, sep, qty, maxStack, idxCounter, fromSlot) {
  const slot = findNextSlot(data, inv, fromSlot);
  if (slot < 0) return { slot: -1, idx: idxCounter };

  const off = inv + slot * ITEM_SIZE;
  const q   = Math.min(qty, maxStack);
  const idx = idxCounter + 1;

  data[off+0] = itemId & 0xFF;
  data[off+1] = (itemId >> 8) & 0xFF;
  data[off+2] = (itemId >> 16) & 0xFF;
  data[off+3] = sep;
  data[off+4] = itemId & 0xFF;
  data[off+5] = (itemId >> 8) & 0xFF;
  data[off+6] = (itemId >> 16) & 0xFF;
  data[off+7] = (itemId >> 24) & 0xFF;
  data[off+8]  = q & 0xFF;
  data[off+9]  = (q >> 8) & 0xFF;
  data[off+10] = (q >> 16) & 0xFF;
  data[off+11] = (q >> 24) & 0xFF;
  data[off+12] = idx & 0xFF;
  data[off+13] = ((Math.random() * 256 | 0) & 0xF0) | ((idx >> 8) & 0x0F);
  data[off+14] = 0xCF;
  data[off+15] = 0x1F;

  return { slot, idx };
}

function updateCounter2(data, newIdx) {
  const pat = findPattern(data);
  if (pat < 0) return;
  const off = pat + 35300;
  if (off + 2 > data.length) return;
  const cur = data[off] | (data[off+1] << 8);
  if (newIdx > cur) { data[off] = newIdx & 0xFF; data[off+1] = (newIdx >> 8) & 0xFF; }
}

// ── filter ────────────────────────────────────────────────────────────────────
function shouldSkip(item, sec) {
  if (item.Safe === false) return true;
  const id = parseInt(item.Id, 16);
  if (id >= 0x40000096 && id <= 0x400000AB) return true; // Estus Flask
  if (id >= 0x400000BE && id <= 0x400000D3) return true; // Ashen Estus Flask
  if (id >= 0x40002300) return true;                     // gestures
  if (item.Category === 'covenantitems') return true;
  if (sec === 'ring_items' && id >= 0x20002700 && id <= 0x20002780) return true;
  return false;
}

const SEP = {
  ring_items: 0xA0,
};

// ── main ──────────────────────────────────────────────────────────────────────
function main() {
  const data     = new Uint8Array(fs.readFileSync(SAVE_FILE));
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'));

  const inv   = invStart(data);
  const found = buildFound(data, jsonData);
  let idxCtr  = getHighestIndex(data, inv);
  let nextSlot = 0;

  console.log(`Inventory start: 0x${inv.toString(16).toUpperCase()}`);
  console.log(`Highest item index: ${idxCtr}`);

  // Sections to process (weapons/armor handled by app's Add All — need GA table)
  const SECTIONS = [
    'ring_items', 'consumable_items', 'magic_items', 'ore_items', 'ammunition_items',
  ];

  const added = [], skipped = { unsafe: 0, estus: 0, gesture: 0, covenant: 0, present: 0 };

  for (const sec of SECTIONS) {
    const arr = jsonData[sec]; if (!Array.isArray(arr)) continue;

    for (const item of arr) {
      if (item.Safe === false)                                       { skipped.unsafe++;   continue; }
      const id = parseInt(item.Id, 16);
      if ((id >= 0x40000096 && id <= 0x400000AB) ||
          (id >= 0x400000BE && id <= 0x400000D3))                   { skipped.estus++;    continue; }
      if (id >= 0x40002300)                                          { skipped.gesture++;  continue; }
      if (item.Category === 'covenantitems')                         { skipped.covenant++; continue; }
      if (item.Category === 'ashes')                                 { skipped.ashes = (skipped.ashes||0)+1; continue; }
      if (sec === 'ring_items' && id >= 0x20002700 && id <= 0x20002780) { skipped.covenant++; continue; }
      if (found.has(id))                                             { skipped.present++;  continue; }

      const sep = SEP[sec] ?? 0xB0;
      const { slot, idx } = addItem(data, inv, id, sep, item.MaxStackCount, item.MaxStackCount, idxCtr, nextSlot);

      if (slot >= 0) {
        idxCtr   = idx;
        nextSlot = slot + 1;
        found.add(id);
        added.push({ name: item.Name, sec, id: item.Id });
      } else {
        console.warn(`  No slot for: ${item.Name}`);
      }
    }
  }

  updateCounter2(data, idxCtr);

  console.log(`\nAdded ${added.length} items:`);
  for (const { name, sec, id } of added)
    console.log(`  + ${name.padEnd(52)} ${id}  [${sec}]`);

  console.log(`\nSkipped: unsafe=${skipped.unsafe}  estus=${skipped.estus}  gestures=${skipped.gesture}  covenant=${skipped.covenant}  already present=${skipped.present}`);

  fs.writeFileSync(OUTPUT_FILE, Buffer.from(data));
  console.log(`\nSaved → ${OUTPUT_FILE}`);
}

main();
