import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import { DS3SaveFileEditor } from '../../src/apps/ds3/lib/SaveFileEditor';
import { findSteamIdOffset } from '../../src/apps/ds3/lib/offsetPatterns';
import {
  STEAMID_PATTERN,
  STEAMID_SLOT_PTR_OFFSET,
  STEAMID_PTR_TO_ID,
  SYSTEM_ENTRY_STEAMID_OFFSET,
} from '../../src/apps/ds3/lib/constants';
import {
  parseSteamId,
  formatSteamId,
  formatSteamIdHex,
  isValidSteamId,
  steamIdFromPath,
} from '../../src/apps/ds3/lib/steamId';
import { hasDS3Save, ds3SaveFile, DS3_SAVE_PATH, toFile } from '../helpers/saves';

/**
 * The save folder is named after the SteamID64 in hex, so the fixture carries
 * its own expected value — no ID is hardcoded here, and pointing the suite at
 * another account's save still works.
 */
const expectedId = BigInt('0x' + path.basename(path.dirname(DS3_SAVE_PATH)));

/** Every offset where `01 00 10 01` shows up, i.e. every SteamID64 candidate. */
function scanForIds(data: Uint8Array): number[] {
  const hits: number[] = [];
  for (let i = 0; i + STEAMID_PATTERN.length <= data.length; i++) {
    let match = true;
    for (let j = 0; j < STEAMID_PATTERN.length; j++) {
      if (data[i + j] !== STEAMID_PATTERN[j]) { match = false; break; }
    }
    if (match) hits.push(i - 4);
  }
  return hits;
}

describe('SteamID parsing', () => {
  const id = 0x0110000131bf8025n; // 76561198794899493

  it('accepts the decimal form Steam shows', () => {
    expect(parseSteamId('76561198794899493')).toBe(id);
    expect(parseSteamId('  76561198794899493  ')).toBe(id);
  });

  it('accepts the hex form the save folder is named after', () => {
    expect(parseSteamId('0110000131bf8025')).toBe(id);
    expect(parseSteamId('0x0110000131BF8025')).toBe(id);
  });

  // An all-digit folder name is shorter than any real decimal ID, so it can
  // only be hex — the ambiguity resolves by range, not by guessing.
  it('reads an all-numeric folder name as hex', () => {
    expect(parseSteamId('0110000112345678')).toBe(0x0110000112345678n);
  });

  it('rejects anything that is not a plausible account ID', () => {
    expect(parseSteamId('')).toBeNull();
    expect(parseSteamId('   ')).toBeNull();
    expect(parseSteamId('not an id')).toBeNull();
    expect(parseSteamId('12345')).toBeNull();               // far below the range
    expect(parseSteamId('99999999999999999999')).toBeNull(); // far above it
    expect(parseSteamId('0x0210000131bf8025')).toBeNull();   // wrong universe prefix
  });

  it('reads the ID off a save path', () => {
    expect(steamIdFromPath('C:\\Users\\x\\AppData\\Roaming\\DarkSoulsIII\\0110000131bf8025\\DS30000.sl2'))
      .toBe(id);
    expect(steamIdFromPath('/home/x/.steam/DarkSoulsIII/0110000131bf8025/DS30000.sl2')).toBe(id);
    // A backup one level deeper still resolves — segments are read deepest-first.
    expect(steamIdFromPath('D:\\saves\\0110000131bf8025\\New folder\\DS30000.sl2')).toBe(id);
    // webkitRelativePath form (directory pick in the browser)
    expect(steamIdFromPath('0110000131bf8025/DS30000.sl2')).toBe(id);
  });

  it('returns null when the path carries no account folder', () => {
    expect(steamIdFromPath('')).toBeNull();
    expect(steamIdFromPath(null)).toBeNull();
    expect(steamIdFromPath(undefined)).toBeNull();
    expect(steamIdFromPath('DS30000.sl2')).toBeNull();
    expect(steamIdFromPath('C:\\saves\\backup\\DS30000.sl2')).toBeNull();
    // DS1-style decimal account folder is not a SteamID64 in hex
    expect(steamIdFromPath('C:\\NBGI\\DARK SOULS REMASTERED\\834633765\\DRAKS0005.sl2')).toBeNull();
  });

  it('formats back into both notations', () => {
    expect(formatSteamId(id)).toBe('76561198794899493');
    expect(formatSteamIdHex(id)).toBe('0110000131bf8025');
    expect(isValidSteamId(id)).toBe(true);
    expect(isValidSteamId(0n)).toBe(false);
  });
});

describe.skipIf(!hasDS3Save)('DS3 SteamID', () => {
  let editor: DS3SaveFileEditor;
  let populated: number[];

  beforeAll(async () => {
    editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    populated = editor
      .getCharacters()
      .filter((c) => !c.isEmpty)
      .map((c) => c.slotIndex);
    expect(populated.length, 'fixture has no populated slot').toBeGreaterThan(0);
  });

  it('reads the account ID from the system entry', () => {
    expect(editor.getSteamId()).toBe(expectedId);
  });

  it('reads the same ID out of every populated slot', () => {
    for (const slot of populated) {
      expect(editor.getCharacter(slot)!.getSteamId(), `slot ${slot}`).toBe(expectedId);
    }
  });

  // The pattern is what makes the locator work on saves where the pointer is
  // unusable; if it ever stops being unique, the fallback silently aims wrong.
  it('the ID pattern occurs exactly once per populated slot', () => {
    for (const slot of populated) {
      const data = editor.getCharacter(slot)!.getRawData();
      expect(scanForIds(data), `slot ${slot}`).toHaveLength(1);
    }
  });

  it('pointer and pattern locators agree', () => {
    for (const slot of populated) {
      const data = editor.getCharacter(slot)!.getRawData();
      const viaPointer =
        new DataView(data.buffer, data.byteOffset, data.byteLength)
          .getUint32(STEAMID_SLOT_PTR_OFFSET, true) + STEAMID_PTR_TO_ID;

      expect(findSteamIdOffset(data), `slot ${slot}`).toBe(viaPointer);
      expect(scanForIds(data)[0], `slot ${slot}`).toBe(viaPointer);
    }
  });

  it('finds the ID by pattern alone when the pointer is unusable', () => {
    const data = Uint8Array.from(editor.getCharacter(populated[0])!.getRawData());
    const real = findSteamIdOffset(data)!;

    // Wipe the pointer the way an empty/garbled slot would have it.
    new DataView(data.buffer).setUint32(STEAMID_SLOT_PTR_OFFSET, 0, true);
    expect(findSteamIdOffset(data)).toBe(real);
  });

  it('reports no ID for an empty buffer', () => {
    expect(findSteamIdOffset(new Uint8Array(0x200))).toBeNull();
  });

  it('summarises a single-account save as consistent', () => {
    const summary = editor.getSteamIdSummary();

    expect(summary.system).toBe(expectedId);
    expect(summary.slots.map((s) => s.slotIndex)).toEqual(populated);
    expect(summary.slots.every((s) => s.steamId === expectedId)).toBe(true);
    expect(summary.mismatched).toBe(false);
  });

  // The state a save assembled from downloaded characters is actually in, and
  // the reason "apply to all" exists as its own button.
  it('flags a save whose slots disagree, and clears once rebound', async () => {
    const fresh = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    const other = 0x0110000187654321n;

    expect(fresh.getCharacter(populated[0])!.setSteamId(other)).toBe(true);

    // The system entry still holds the original ID, so the save now disagrees
    // with itself no matter how many slots are populated.
    const mixed = fresh.getSteamIdSummary();
    expect(mixed.mismatched).toBe(true);
    expect(mixed.slots.find((s) => s.slotIndex === populated[0])!.steamId).toBe(other);

    fresh.setSteamId(expectedId);
    expect(fresh.getSteamIdSummary().mismatched).toBe(false);
  });

  // The transfer case: rebinding must hit the system entry *and* every slot,
  // and survive the encrypt → decrypt round trip.
  it('rebinding rewrites both places and survives an export', async () => {
    const fresh = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    const newId = 0x0110000112345678n;

    const patched = fresh.setSteamId(newId);
    expect(patched).toBe(populated.length);

    const exported = await fresh.exportSaveFile();
    const reloaded = await DS3SaveFileEditor.fromFileData(toFile(exported, 'DS30000.sl2'), null);

    expect(reloaded.getSteamId()).toBe(newId);
    for (const slot of populated) {
      expect(reloaded.getCharacter(slot)!.getSteamId(), `slot ${slot}`).toBe(newId);
    }

    // The system entry's ID field is the only thing that moved there.
    const before = editor.readSystemEntryBytes(0, 0x40);
    const after = reloaded.readSystemEntryBytes(0, 0x40);
    for (let i = 0; i < before.length; i++) {
      const inIdField =
        i >= SYSTEM_ENTRY_STEAMID_OFFSET && i < SYSTEM_ENTRY_STEAMID_OFFSET + 8;
      if (!inIdField) expect(after[i], `system entry byte 0x${i.toString(16)}`).toBe(before[i]);
    }
  });
});
