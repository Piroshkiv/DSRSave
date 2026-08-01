/**
 * Finds the correct INVENTORY_START_RELATIVE for DS3.
 *
 * Scans every 16-byte aligned position in the slot for regions with many
 * NON-EMPTY inventory items (byte[3] ∈ {0x80, 0x90, 0xA0, 0xB0}).
 */

const fs     = require('fs');
const crypto = require('crypto');

const SAVE_PATH = 'C:/Users/Iho/AppData/Roaming/DarkSoulsIII/0110000131bf8025/DS30000.sl2';

const AES_KEY = Buffer.from([
  0xFD, 0x46, 0x4D, 0x69, 0x5E, 0x69, 0xA3, 0x9A,
  0x10, 0xE3, 0x19, 0xA7, 0xAC, 0xE8, 0xB7, 0xFA,
]);

const PATTERN = Buffer.from([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const ITEM_SEP  = new Set([0x80, 0x90, 0xA0, 0xB0]);
const VALID_SEP = new Set([0x00, 0x80, 0x90, 0xA0, 0xB0]);

// ── helpers ──────────────────────────────────────────────────────────────────

function decryptSlot(buf, slotIndex) {
  const hdr = 0x40 + slotIndex * 0x20;
  const entrySize  = Number(buf.readBigUInt64LE(hdr + 0x08));
  const dataOffset = buf.readUInt32LE(hdr + 0x10);
  const iv  = buf.slice(dataOffset + 16, dataOffset + 32);
  const enc = buf.slice(dataOffset + 32, dataOffset + 32 + entrySize - 32);
  const dec = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
  dec.setAutoPadding(false);
  return Buffer.concat([dec.update(enc), dec.final()]);
}

function findPattern(data) {
  for (let i = 0; i <= data.length - PATTERN.length; i++) {
    let ok = true;
    for (let j = 0; j < PATTERN.length; j++) {
      if (data[i + j] !== PATTERN[j]) { ok = false; break; }
    }
    if (ok) return i;
  }
  return -1;
}

function gaTableEnd(data) {
  let offset = 0x70;
  for (let i = 0; i < 6144; i++) {
    if (offset + 8 > data.length) break;
    const gh = data.readUInt32LE(offset) >>> 0;
    const tp = gh & 0xF0000000;
    offset += (gh !== 0 && (tp === 0x80000000 || tp === 0x90000000)) ? 60 : 8;
  }
  return offset;
}

function dumpSlots(data, start, n = 6) {
  const lines = [];
  for (let i = 0; i < n; i++) {
    const off = start + i * 16;
    if (off + 16 > data.length) break;
    const bytes  = Array.from(data.slice(off, off + 16))
      .map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const sep    = data[off + 3];
    const itemId = data.readUInt32LE(off + 4);
    const qty    = data.readUInt32LE(off + 8);
    const mark   = ITEM_SEP.has(sep) ? ' ★' : '';
    lines.push(
      `  [${i}] ${bytes}  sep=0x${sep.toString(16).toUpperCase().padStart(2,'0')}` +
      `  id=0x${itemId.toString(16).toUpperCase().padStart(8,'0')}  qty=${qty}${mark}`
    );
  }
  return lines.join('\n');
}

/**
 * Slide a 128-slot (2048-byte) window, count non-empty inventory items.
 * Return the window start with the most non-empty items.
 * Also require that the window has at least some valid-only sep bytes (no garbage).
 */
function findInventoryRegion(data) {
  const WINDOW = 128; // slots in window
  let bestOff = -1, bestCount = 0;

  for (let off = 0; off + WINDOW * 16 <= data.length; off += 16) {
    let nonEmpty = 0;
    let valid    = true;
    for (let i = 0; i < WINDOW; i++) {
      const sep = data[off + i * 16 + 3];
      if (!VALID_SEP.has(sep)) { valid = false; break; }
      if (ITEM_SEP.has(sep)) nonEmpty++;
    }
    if (valid && nonEmpty > bestCount) {
      bestCount = nonEmpty;
      bestOff   = off;
    }
  }
  return { offset: bestOff, nonEmpty: bestCount };
}

/**
 * Walk backwards from bestOff to find where the inventory ACTUALLY starts
 * (first group of valid 16-byte entries starting with non-empty items).
 */
function findInventoryStart(data, approxOff) {
  // Walk back while entries are valid
  let start = approxOff;
  while (start - 16 >= 0 && VALID_SEP.has(data[start - 16 + 3])) {
    start -= 16;
  }
  return start;
}

// ── main ─────────────────────────────────────────────────────────────────────

function main() {
  const save = fs.readFileSync(SAVE_PATH);
  const entryCount = Math.min(save.readUInt32LE(0x0C), 10);
  console.log(`Found ${entryCount} slots\n`);

  for (let slot = 0; slot < entryCount; slot++) {
    let data;
    try { data = decryptSlot(save, slot); } catch { continue; }

    // skip empty slots
    let hasContent = false;
    for (let i = 0x10; i < 0x40; i++) { if (data[i] !== 0) { hasContent = true; break; } }
    if (!hasContent) continue;

    const patternOffset = findPattern(data);
    const gaEnd         = gaTableEnd(data);
    const gaFormula     = gaEnd + 0x13F + 0x1DD;

    const { offset: approxOff, nonEmpty } = findInventoryRegion(data);
    const invStart = approxOff !== -1 ? findInventoryStart(data, approxOff) : -1;

    // Count total non-empty items in found region
    let totalItems = 0, totalValid = 0;
    if (invStart !== -1) {
      for (let off = invStart; off + 16 <= data.length; off += 16) {
        const sep = data[off + 3];
        if (!VALID_SEP.has(sep)) break;
        totalValid++;
        if (ITEM_SEP.has(sep)) totalItems++;
      }
    }

    console.log(`════ Slot ${slot} ════`);
    console.log(`  Data length    : ${data.length} (0x${data.length.toString(16)})`);
    if (patternOffset !== -1)
      console.log(`  Pattern offset : 0x${patternOffset.toString(16).toUpperCase()}`);
    console.log(`  GA table end   : 0x${gaEnd.toString(16).toUpperCase()}`);
    console.log(`  GA formula     : 0x${gaFormula.toString(16).toUpperCase()}`);

    if (invStart !== -1) {
      console.log(`  Found inv start: 0x${invStart.toString(16).toUpperCase()} (${totalItems} items, ${totalValid} valid slots)`);
      console.log(`\n  First 8 slots at found inventory start:`);
      console.log(dumpSlots(data, invStart, 8));

      // Also show a few slots around peak (to confirm non-empty items)
      console.log(`\n  8 slots at peak region (0x${approxOff.toString(16).toUpperCase()}, ${nonEmpty} non-empty in window):`);
      console.log(dumpSlots(data, approxOff, 8));

      if (patternOffset !== -1) {
        const rel = invStart - patternOffset;
        console.log(`\n  INVENTORY_START_RELATIVE = invStart - pattern`);
        console.log(`    = 0x${invStart.toString(16)} - 0x${patternOffset.toString(16)} = ${rel} (0x${(rel >>> 0).toString(16)})`);
        const diffFromOld = invStart - (patternOffset + 0x09C);
        console.log(`    Diff from old Pattern+0x09C: ${diffFromOld}  (${diffFromOld % 8 === 0 ? diffFromOld/8 + ' × 8 bytes' : 'not ×8'})`);
        const diffFromGA  = invStart - gaFormula;
        console.log(`    Diff from GA formula: ${diffFromGA}  (${diffFromGA % 8 === 0 ? diffFromGA/8 + ' × 8 bytes' : 'not ×8'})`);
      }
    } else {
      console.log(`  Could not find inventory region!`);
    }
    console.log();
  }
}

main();
