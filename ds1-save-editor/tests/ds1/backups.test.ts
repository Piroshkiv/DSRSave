import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { Character } from '../../src/apps/ds1/lib/Character';
import { importSlotFromBinary } from '../../src/apps/ds1/lib/slotDuplicator';
import {
  backupAllSlots,
  createBackup,
  deleteBackup,
  deleteBackups,
  getBackupCounts,
  getBackupPayload,
  listBackups,
  pruneSlot,
} from '../../src/apps/ds1/lib/backups';

const SLOT_SIZE = 0x60020;
const META_SIZE = 0x60020;

/** A character whose bytes are distinctive enough to hash differently. */
function makeCharacter(slot: number, name: string, level: number, fill = 1): Character {
  const data = new Uint8Array(SLOT_SIZE);
  // isEmpty scans 0x20..0x90, so anything non-zero there makes the slot occupied
  data.fill(fill, 0x20, 0x91);
  const char = new Character(data, slot);
  char.name = name;
  char.level = level;
  return char;
}

function makeMetadataChar(): Character {
  return new Character(new Uint8Array(META_SIZE), 10);
}

/** Minimal stand-in for the editor surface importSlotFromBinary touches. */
function makeEditor(characters: Character[]) {
  return { getCharacters: () => characters };
}

async function wipeStore() {
  for (let slot = 0; slot < 10; slot++) {
    for (const row of await listBackups(slot)) {
      await deleteBackup(row.id);
    }
  }
}

describe('DS1 backups', () => {
  beforeEach(wipeStore);

  it('stores a slot and gives the exact bytes back', async () => {
    const char = makeCharacter(0, 'Solaire', 42);
    char.setByte(0x5000, 0xAB);

    const result = await createBackup(char, 'manual');
    expect(result.created).toBe(true);
    expect(result.meta?.name).toBe('Solaire');
    expect(result.meta?.level).toBe(42);
    expect(result.meta?.slot).toBe(0);

    const payload = await getBackupPayload(result.meta!.id);
    expect(payload).not.toBeNull();
    expect(payload!.length).toBe(SLOT_SIZE);
    expect(payload).toEqual(char.getRawData());
  });

  it('compresses the payload well below the raw slot size', async () => {
    const char = makeCharacter(0, 'Compressible', 1);
    const { meta } = await createBackup(char, 'manual');

    expect(meta!.gzip).toBe(true);
    expect(meta!.rawSize).toBe(SLOT_SIZE);
    expect(meta!.storedSize).toBeLessThan(SLOT_SIZE / 2);
  });

  it('skips a second backup when nothing changed', async () => {
    const char = makeCharacter(1, 'Siegmeyer', 30);

    const first = await createBackup(char, 'auto');
    const second = await createBackup(char, 'auto');

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await listBackups(1)).toHaveLength(1);
  });

  it('records a new backup once a single byte differs', async () => {
    const char = makeCharacter(1, 'Siegmeyer', 30);
    await createBackup(char, 'auto');

    char.level = 31;
    const changed = await createBackup(char, 'auto');

    expect(changed.created).toBe(true);
    const rows = await listBackups(1);
    expect(rows).toHaveLength(2);
    // Newest first
    expect(rows[0].level).toBe(31);
    expect(rows[1].level).toBe(30);
  });

  it('never backs up an empty slot', async () => {
    const empty = new Character(new Uint8Array(SLOT_SIZE), 3);
    expect(empty.isEmpty).toBe(true);

    const result = await createBackup(empty, 'manual');
    expect(result.created).toBe(false);
    expect(await listBackups(3)).toHaveLength(0);
  });

  it('drops the oldest entries once the per-slot limit is exceeded', async () => {
    const char = makeCharacter(2, 'Andre', 1);

    for (let level = 1; level <= 6; level++) {
      char.level = level;
      await createBackup(char, 'auto', 3);
    }

    const rows = await listBackups(2);
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.level)).toEqual([6, 5, 4]);
  });

  it('prunes on demand when the limit is lowered', async () => {
    const char = makeCharacter(2, 'Andre', 1);
    for (let level = 1; level <= 5; level++) {
      char.level = level;
      await createBackup(char, 'auto', 50);
    }

    const removed = await pruneSlot(2, 2);
    expect(removed).toBe(3);
    expect((await listBackups(2)).map(r => r.level)).toEqual([5, 4]);
  });

  it('keeps slot histories independent', async () => {
    await createBackup(makeCharacter(0, 'A', 1), 'auto');
    await createBackup(makeCharacter(4, 'B', 2), 'auto');
    await createBackup(makeCharacter(4, 'B', 3), 'auto');

    expect(await getBackupCounts()).toEqual({ 0: 1, 4: 2 });
  });

  it('backs up every non-empty slot and skips unchanged ones on a second pass', async () => {
    const characters: Character[] = [];
    for (let slot = 0; slot < 10; slot++) {
      characters.push(slot < 3
        ? makeCharacter(slot, `Hero${slot}`, 10 + slot, slot + 1)
        : new Character(new Uint8Array(SLOT_SIZE), slot));
    }
    characters.push(makeMetadataChar());

    const first = await backupAllSlots(characters, 'auto');
    expect(first.created).toBe(3);
    expect(first.slots).toEqual([0, 1, 2]);

    // Saving twice in a row must not double the history
    const second = await backupAllSlots(characters, 'auto');
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(3);

    // Only the slot that actually changed gets a new entry
    characters[1].level = 999;
    const third = await backupAllSlots(characters, 'auto');
    expect(third.created).toBe(1);
    expect(third.slots).toEqual([1]);
  });

  it('round-trips a backup through a restore into a different, empty slot', async () => {
    const source = makeCharacter(0, 'Artorias', 77);
    source.setByte(0x1234, 0x5A);

    const { meta } = await createBackup(source, 'manual');
    const payload = await getBackupPayload(meta!.id);

    // Restore into slot 5, which starts out empty
    const destChars: Character[] = [];
    for (let slot = 0; slot < 10; slot++) {
      destChars.push(new Character(new Uint8Array(SLOT_SIZE), slot));
    }
    const destMetadata = makeMetadataChar();
    destChars.push(destMetadata);

    expect(destChars[5].isEmpty).toBe(true);

    importSlotFromBinary(makeEditor(destChars), payload!, 5);

    const restored = destChars[5];
    expect(restored.isEmpty).toBe(false);
    expect(restored.name).toBe('Artorias');
    expect(restored.level).toBe(77);
    expect(restored.getByte(0x1234)).toBe(0x5A);
    expect(restored.slotNumber).toBe(5);

    // Slot flips from empty to occupied in the slot 10 flag array
    expect(destMetadata.getByte(0xC4 + 5)).toBe(1);
  });

  it('flips only the restored slot flag, leaving the other nine untouched', async () => {
    const destChars: Character[] = [];
    for (let slot = 0; slot < 10; slot++) {
      destChars.push(new Character(new Uint8Array(SLOT_SIZE), slot));
    }
    const destMetadata = makeMetadataChar();
    // Slots 0-2 occupied, the rest empty
    [1, 1, 1, 0, 0, 0, 0, 0, 0, 0].forEach((v, i) => destMetadata.setByte(0xC4 + i, v));
    // A marker inside slot 0's load screen block, which must not be rewritten
    destMetadata.setByte(0xC0 + 400 * 0 + 200, 0x42);
    destChars.push(destMetadata);

    importSlotFromBinary(makeEditor(destChars), makeCharacter(0, 'X', 1).getRawData(), 7);

    const flags = Array.from({ length: 10 }, (_, i) => destMetadata.getByte(0xC4 + i));
    expect(flags).toEqual([1, 1, 1, 0, 0, 0, 0, 1, 0, 0]);
    expect(destMetadata.getByte(0xC0 + 400 * 0 + 200)).toBe(0x42);
  });

  it('restoring into slot 0 keeps every other slot flag intact', async () => {
    const destChars: Character[] = [];
    for (let slot = 0; slot < 10; slot++) {
      destChars.push(new Character(new Uint8Array(SLOT_SIZE), slot));
    }
    const destMetadata = makeMetadataChar();
    // The flag array lives inside slot 0's load screen block, so slot 0 is the
    // case where a careless write would wipe the other nine
    [0, 1, 0, 1, 1, 0, 0, 0, 0, 1].forEach((v, i) => destMetadata.setByte(0xC4 + i, v));
    destChars.push(destMetadata);

    importSlotFromBinary(makeEditor(destChars), makeCharacter(3, 'Y', 9).getRawData(), 0);

    const flags = Array.from({ length: 10 }, (_, i) => destMetadata.getByte(0xC4 + i));
    expect(flags).toEqual([1, 1, 0, 1, 1, 0, 0, 0, 0, 1]);
  });

  it('deletes a backup along with its payload', async () => {
    const { meta } = await createBackup(makeCharacter(6, 'Doomed', 5), 'manual');
    await deleteBackup(meta!.id);

    expect(await listBackups(6)).toHaveLength(0);
    expect(await getBackupPayload(meta!.id)).toBeNull();
  });

  it('bulk-deletes only the ids it is given', async () => {
    const char = makeCharacter(7, 'Keep', 1);
    const ids: number[] = [];
    for (let level = 1; level <= 4; level++) {
      char.level = level;
      const { meta } = await createBackup(char, 'auto', 50);
      ids.push(meta!.id);
    }
    await createBackup(makeCharacter(8, 'Other', 1), 'auto');

    // Drop the first three, as "delete all" does for a filtered list
    const removed = await deleteBackups(ids.slice(0, 3));

    expect(removed).toBe(3);
    expect((await listBackups(7)).map(r => r.level)).toEqual([4]);
    expect(await listBackups(8)).toHaveLength(1);
    expect(await getBackupPayload(ids[0])).toBeNull();
  });

  it('bulk-deleting nothing is a no-op', async () => {
    await createBackup(makeCharacter(9, 'Safe', 1), 'auto');
    expect(await deleteBackups([])).toBe(0);
    expect(await listBackups(9)).toHaveLength(1);
  });

  it('rejects slots outside the character range', async () => {
    await expect(createBackup(makeCharacter(10, 'Meta', 1), 'manual')).rejects.toThrow();
  });
});
