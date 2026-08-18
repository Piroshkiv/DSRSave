import {
  CHARACTER_PATTERN,
  STEAMID_PATTERN,
  STEAMID_PATTERN_TO_ID,
  STEAMID_SLOT_PTR_OFFSET,
  STEAMID_PTR_TO_ID,
} from './constants';

export interface OffsetPattern {
  id: string;
  label: string;
  /** Returns absolute index into getRawData() where the anchor is, or null if not found */
  findOffset(data: Uint8Array): number | null;
}

function findBytePattern(data: Uint8Array, pattern: Uint8Array): number | null {
  if (data.length < pattern.length) return null;
  const max = data.length - pattern.length;
  for (let i = 0; i <= max; i++) {
    let match = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) { match = false; break; }
    }
    if (match) return i;
  }
  return null;
}

function findInventoryStart(data: Uint8Array): number | null {
  const GA_TABLE_OFFSET = 0x70;
  const GA_ENTRY_SMALL = 8;
  const GA_ENTRY_LARGE = 60;
  const GA_MAX_ENTRIES = 6144;

  if (data.length <= GA_TABLE_OFFSET) return null;

  // Scan GA table to find its end
  let offset = GA_TABLE_OFFSET;
  let count = 0;
  while (count < GA_MAX_ENTRIES) {
    if (offset + GA_ENTRY_SMALL > data.length) break;
    const b3 = data[offset + 3];
    if (b3 === 0x80 || b3 === 0x90 || b3 === 0xA0 || b3 === 0xB0) {
      offset += GA_ENTRY_LARGE;
    } else {
      offset += GA_ENTRY_SMALL;
    }
    count++;
  }

  const inventoryStart = offset + 0x13F + 0x1DD;
  if (inventoryStart >= data.length) return null;
  return inventoryStart;
}

/**
 * Offset of the slot's SteamID64 (8 bytes LE), or null when the slot has none.
 *
 * Two independent locators, both verified on 23 populated slots across 5 saves
 * and 2 accounts — see the STEAM ID block in constants.ts:
 *
 *   1. the pointer at 0x58, which is O(1) and is what SaveMerge uses;
 *   2. STEAMID_PATTERN, unique per slot, used to confirm the pointer and as a
 *      fallback when it doesn't land on an ID (foreign or hand-edited saves).
 *
 * A pattern hit alone is enough to accept an address: `01 00 10 01` at +4 is
 * the SteamID64 prefix itself, so a match *is* an ID.
 */
export function findSteamIdOffset(data: Uint8Array): number | null {
  const looksLikeId = (at: number) =>
    at >= 0 &&
    at + 8 <= data.length &&
    STEAMID_PATTERN.every((b, i) => data[at + 4 + i] === b);

  if (data.length >= STEAMID_SLOT_PTR_OFFSET + 4) {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const ptr = view.getUint32(STEAMID_SLOT_PTR_OFFSET, true);
    // ptr === 0 means an empty slot; anything else must still pass the check.
    if (ptr !== 0 && looksLikeId(ptr + STEAMID_PTR_TO_ID)) {
      return ptr + STEAMID_PTR_TO_ID;
    }
  }

  const match = findBytePattern(data, STEAMID_PATTERN);
  if (match === null) return null;

  const offset = match + STEAMID_PATTERN_TO_ID;
  return offset >= 0 && offset + 8 <= data.length ? offset : null;
}

export const DS3_OFFSET_PATTERNS: OffsetPattern[] = [
  {
    id: 'character_stats',
    label: 'Character Stats Pattern (FF FF FF FF 00...)',
    findOffset(data) {
      return findBytePattern(data, CHARACTER_PATTERN);
    },
  },
  {
    id: 'ga_table',
    label: 'GA Table Start (0x70)',
    findOffset(data) {
      return data.length > 0x70 ? 0x70 : null;
    },
  },
  {
    id: 'inventory',
    label: 'Inventory Start',
    findOffset(data) {
      return findInventoryStart(data);
    },
  },
  {
    id: 'steam_id',
    label: 'SteamID64 (01 00 10 01 at +4)',
    findOffset(data) {
      return findSteamIdOffset(data);
    },
  },
];
