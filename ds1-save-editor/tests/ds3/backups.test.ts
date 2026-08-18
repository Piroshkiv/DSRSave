import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { DS3Character } from '../../src/apps/ds3/lib/Character';
import { SLOT_SUMMARY_SIZE } from '../../src/apps/ds3/lib/constants';
import { STEAM_ID_PREFIX } from '../../src/apps/ds3/lib/steamId';
import {
  backupAllSlots,
  createBackup,
  deleteBackup,
  deleteBackups,
  getBackupCounts,
  getBackupPayload,
  listBackups,
  pruneSlot,
  slotSteamIdKey,
  type DS3BackupEditor,
} from '../../src/apps/ds3/lib/backups';
import { importSlotFromBinary, type DS3SlotEditor } from '../../src/apps/ds3/lib/slotTransfer';
import { SYNTHETIC_SLOT_SIZE, makeCharacter, makeSlotData } from '../helpers/ds3Slots';

const ID_A = (STEAM_ID_PREFIX << 32n) + 0xaaaaaaaan;
const ID_B = (STEAM_ID_PREFIX << 32n) + 0xbbbbbbbbn;

function summaryBlock(fill: number): Uint8Array {
  return new Uint8Array(SLOT_SUMMARY_SIZE).fill(fill);
}

/** Minimal editor surface for backupAllSlots. */
function makeBackupEditor(characters: DS3Character[], summaries: (Uint8Array | null)[] = []): DS3BackupEditor {
  return {
    getCharacters: () => characters,
    readSlotSummary: (slot: number) => summaries[slot] ?? null,
  };
}

/** Minimal editor surface for the restore path. */
function makeRestoreEditor(characters: DS3Character[], accountId: bigint | null): DS3SlotEditor & { flags: boolean[]; summaries: (Uint8Array | null)[] } {
  const flags = Array.from({ length: 10 }, () => false);
  const summaries: (Uint8Array | null)[] = Array.from({ length: 10 }, () => null);
  return {
    flags,
    summaries,
    getCharacters: () => characters,
    getSteamId: () => accountId,
    canEditSlotFlags: () => true,
    setSlotActive: (slot, active) => { flags[slot] = active; },
    replaceCharacter: (slot, data) => {
      const expected = characters[slot].getRawData().length;
      if (data.length !== expected) throw new Error(`Slot data must be ${expected} bytes`);
      const replacement = new DS3Character(new Uint8Array(data), slot);
      characters[slot] = replacement;
      return replacement;
    },
    readSlotSummary: (slot) => summaries[slot],
    writeSlotSummary: (slot, block) => { summaries[slot] = new Uint8Array(block); },
  };
}

async function wipeStore() {
  for (let slot = 0; slot < 10; slot++) {
    for (const row of await listBackups(slot)) {
      await deleteBackup(row.id);
    }
  }
}

describe('DS3 backups', () => {
  beforeEach(wipeStore);

  it('stores a slot with its summary and gives both back', async () => {
    const char = makeCharacter(0, 'Solaire', 42, ID_A);
    const summary = summaryBlock(0x5a);

    const result = await createBackup(char, 'manual', { summary });
    expect(result.created).toBe(true);
    expect(result.meta?.name).toBe('Solaire');
    expect(result.meta?.level).toBe(42);
    expect(result.meta?.slot).toBe(0);

    const payload = await getBackupPayload(result.meta!.id);
    expect(payload!.slotData).toEqual(char.getRawData());
    expect(payload!.summary).toEqual(summary);
  });

  it('records the account the slot belonged to', async () => {
    const { meta } = await createBackup(makeCharacter(0, 'Owner', 10, ID_A), 'manual');
    expect(meta!.steamId).toBe(ID_A.toString(10));
  });

  it('leaves the Steam ID blank for a slot that carries none', async () => {
    const { meta } = await createBackup(makeCharacter(0, 'Nameless', 10), 'manual');
    expect(meta!.steamId).toBe('');
  });

  it('separates two accounts sharing one slot, which is what the tab filters on', async () => {
    await createBackup(makeCharacter(0, 'Mine', 10, ID_A), 'manual');
    await createBackup(makeCharacter(0, 'Theirs', 10, ID_B), 'manual');

    const rows = await listBackups(0);
    expect(rows).toHaveLength(2);
    expect(rows.filter(r => r.steamId === ID_A.toString(10))).toHaveLength(1);
    expect(rows.filter(r => r.steamId === ID_B.toString(10))).toHaveLength(1);
  });

  it('a renamed character still belongs to the same account', async () => {
    const char = makeCharacter(0, 'Before', 10, ID_A);
    await createBackup(char, 'manual');
    char.name = 'After';
    await createBackup(char, 'manual');

    const rows = await listBackups(0);
    expect(rows.map(r => r.name)).toEqual(['After', 'Before']);
    expect(new Set(rows.map(r => r.steamId))).toEqual(new Set([ID_A.toString(10)]));
  });

  it('compresses the payload well below the raw slot size', async () => {
    const { meta } = await createBackup(makeCharacter(0, 'Compressible', 1, ID_A), 'manual');

    expect(meta!.gzip).toBe(true);
    expect(meta!.rawSize).toBeGreaterThanOrEqual(SYNTHETIC_SLOT_SIZE);
    expect(meta!.storedSize).toBeLessThan(SYNTHETIC_SLOT_SIZE / 2);
  });

  it('skips a second backup when nothing changed', async () => {
    const char = makeCharacter(1, 'Siegward', 30, ID_A);

    const first = await createBackup(char, 'auto');
    const second = await createBackup(char, 'auto');

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(await listBackups(1)).toHaveLength(1);
  });

  it('records a new backup once the summary alone moves', async () => {
    const char = makeCharacter(1, 'Siegward', 30, ID_A);
    await createBackup(char, 'auto', { summary: summaryBlock(1) });
    const changed = await createBackup(char, 'auto', { summary: summaryBlock(2) });

    expect(changed.created).toBe(true);
    expect(await listBackups(1)).toHaveLength(2);
  });

  it('never backs up an empty slot', async () => {
    const empty = new DS3Character(new Uint8Array(SYNTHETIC_SLOT_SIZE), 3);
    expect(empty.isEmpty).toBe(true);

    const result = await createBackup(empty, 'manual');
    expect(result.created).toBe(false);
    expect(await listBackups(3)).toHaveLength(0);
  });

  it('drops the oldest entries once the per-slot limit is exceeded', async () => {
    const char = makeCharacter(2, 'Andre', 1, ID_A);

    for (let level = 1; level <= 6; level++) {
      char.level = level;
      await createBackup(char, 'auto', { maxPerSlot: 3 });
    }

    const rows = await listBackups(2);
    expect(rows).toHaveLength(3);
    expect(rows.map(r => r.level)).toEqual([6, 5, 4]);
  });

  it('prunes on demand when the limit is lowered', async () => {
    const char = makeCharacter(2, 'Andre', 1, ID_A);
    for (let level = 1; level <= 5; level++) {
      char.level = level;
      await createBackup(char, 'auto', { maxPerSlot: 50 });
    }

    expect(await pruneSlot(2, 2)).toBe(3);
    expect((await listBackups(2)).map(r => r.level)).toEqual([5, 4]);
  });

  it('keeps slot histories independent', async () => {
    await createBackup(makeCharacter(0, 'A', 1, ID_A), 'auto');
    await createBackup(makeCharacter(4, 'B', 2, ID_A), 'auto');
    await createBackup(makeCharacter(4, 'B', 3, ID_A), 'auto');

    expect(await getBackupCounts()).toEqual({ 0: 1, 4: 2 });
  });

  it('backs up every non-empty slot and skips unchanged ones on a second pass', async () => {
    const characters: DS3Character[] = [];
    const summaries: (Uint8Array | null)[] = [];
    for (let slot = 0; slot < 10; slot++) {
      characters.push(slot < 3
        ? makeCharacter(slot, `Hero${slot}`, 10 + slot, ID_A)
        : new DS3Character(new Uint8Array(SYNTHETIC_SLOT_SIZE), slot));
      summaries.push(slot < 3 ? summaryBlock(slot + 1) : null);
    }
    const editor = makeBackupEditor(characters, summaries);

    const first = await backupAllSlots(editor, 'auto');
    expect(first.created).toBe(3);
    expect(first.slots).toEqual([0, 1, 2]);

    // Saving twice in a row must not double the history
    const second = await backupAllSlots(editor, 'auto');
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(3);

    // Only the slot that actually changed gets a new entry
    characters[1].level = 999;
    const third = await backupAllSlots(editor, 'auto');
    expect(third.created).toBe(1);
    expect(third.slots).toEqual([1]);
  });

  it('round-trips a backup through a restore into a different, empty slot', async () => {
    const source = makeCharacter(0, 'Artorias', 77, ID_A);
    const summary = summaryBlock(0x3c);
    const { meta } = await createBackup(source, 'manual', { summary });
    const payload = await getBackupPayload(meta!.id);

    const destChars: DS3Character[] = Array.from({ length: 10 }, (_, slot) =>
      new DS3Character(new Uint8Array(SYNTHETIC_SLOT_SIZE), slot));
    const dest = makeRestoreEditor(destChars, ID_B);
    expect(dest.getCharacters()[5].isEmpty).toBe(true);

    importSlotFromBinary(dest, payload!.slotData, 5, { summary: payload!.summary });

    const restored = dest.getCharacters()[5];
    expect(restored.isEmpty).toBe(false);
    expect(restored.name).toBe('Artorias');
    expect(restored.level).toBe(77);
    expect(restored.slotIndex).toBe(5);
    expect(dest.summaries[5]).toEqual(summary);
    expect(dest.flags[5]).toBe(true);
    // Restoring into another account's save rebinds the character to it
    expect(slotSteamIdKey(restored)).toBe(ID_B.toString(10));
  });

  it('restoring a slot leaves the other slots alone', async () => {
    const { meta } = await createBackup(makeCharacter(0, 'Loner', 3, ID_A), 'manual');
    const payload = await getBackupPayload(meta!.id);

    const destChars: DS3Character[] = Array.from({ length: 10 }, (_, slot) =>
      slot === 2
        ? new DS3Character(makeSlotData('Bystander', 50, ID_B), slot)
        : new DS3Character(new Uint8Array(SYNTHETIC_SLOT_SIZE), slot));
    const dest = makeRestoreEditor(destChars, ID_B);

    importSlotFromBinary(dest, payload!.slotData, 7);

    expect(dest.getCharacters()[2].name).toBe('Bystander');
    expect(dest.flags).toEqual([false, false, false, false, false, false, false, true, false, false]);
  });

  it('deletes a backup along with its payload', async () => {
    const { meta } = await createBackup(makeCharacter(6, 'Doomed', 5, ID_A), 'manual');
    await deleteBackup(meta!.id);

    expect(await listBackups(6)).toHaveLength(0);
    expect(await getBackupPayload(meta!.id)).toBeNull();
  });

  it('bulk-deletes only the ids it is given', async () => {
    const char = makeCharacter(7, 'Keep', 1, ID_A);
    const ids: number[] = [];
    for (let level = 1; level <= 4; level++) {
      char.level = level;
      const { meta } = await createBackup(char, 'auto', { maxPerSlot: 50 });
      ids.push(meta!.id);
    }
    await createBackup(makeCharacter(8, 'Other', 1, ID_A), 'auto');

    const removed = await deleteBackups(ids.slice(0, 3));

    expect(removed).toBe(3);
    expect((await listBackups(7)).map(r => r.level)).toEqual([4]);
    expect(await listBackups(8)).toHaveLength(1);
    expect(await getBackupPayload(ids[0])).toBeNull();
  });

  it('bulk-deleting nothing is a no-op', async () => {
    await createBackup(makeCharacter(9, 'Safe', 1, ID_A), 'auto');
    expect(await deleteBackups([])).toBe(0);
    expect(await listBackups(9)).toHaveLength(1);
  });

  it('rejects slots outside the character range', async () => {
    await expect(createBackup(makeCharacter(10, 'Meta', 1, ID_A), 'manual')).rejects.toThrow();
  });
});
