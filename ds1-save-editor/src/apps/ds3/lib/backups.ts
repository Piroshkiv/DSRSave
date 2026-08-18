import { DS3Character } from './Character';
import { SLOT_COUNT } from './constants';
import { packSlotFile, unpackSlotFile, type SlotFile } from './slotTransfer';
import { formatSteamId } from './steamId';
import {
  BackupRecord,
  BackupSource,
  BackupStore,
  MAX_PER_SLOT_LIMIT,
  PutBackupResult,
  formatBytes,
} from '../../../shared/backupStore';

/**
 * Per-slot backup history for DS3, kept in IndexedDB by the shared store.
 *
 * A backup is one character slot's decrypted bytes plus its load-menu summary
 * block, packed in the same container the .bin.ds3slot export uses — restoring
 * therefore puts the load menu back exactly as it was, not just the character.
 *
 * Unlike DS1, a DS3 slot names its owner: every populated slot carries the
 * account's SteamID64. That is what the tab filters on, so a save opened from
 * another account's folder never offers to restore a stranger's character over
 * yours — and it survives renaming a character, which a name filter would not.
 *
 * Slots are ~2.6 MB decrypted (roughly seven times a DS1 slot), so the default
 * history is kept shorter than DS1's.
 */

export interface DS3BackupMeta extends BackupRecord {
  /** SteamID64 the slot was bound to, in decimal; '' when the slot carries none. */
  steamId: string;
}

/** The slice of an editor a backup pass needs. */
export interface DS3BackupEditor {
  getCharacters(): DS3Character[];
  readSlotSummary(slotIndex: number): Uint8Array | null;
}

export const DS3_DEFAULT_MAX_PER_SLOT = 10;

export type { BackupSource };
export { MAX_PER_SLOT_LIMIT, formatBytes };

const store = new BackupStore<DS3BackupMeta>({
  dbName: 'ds3-backups',
  slotCount: SLOT_COUNT,
  defaultMaxPerSlot: DS3_DEFAULT_MAX_PER_SLOT,
});

export function listBackups(slot: number): Promise<DS3BackupMeta[]> {
  return store.list(slot);
}

/** Backup count per slot, for the slot list badges. */
export function getBackupCounts(): Promise<Record<number, number>> {
  return store.counts();
}

export function getTotalSize(): Promise<number> {
  return store.totalSize();
}

export function deleteBackup(id: number): Promise<void> {
  return store.delete(id);
}

/** Delete several backups in one transaction. Returns how many were removed. */
export function deleteBackups(ids: number[]): Promise<number> {
  return store.deleteMany(ids);
}

/** The stored slot bytes and summary block, decompressed and unpacked. */
export async function getBackupPayload(id: number): Promise<SlotFile | null> {
  const packed = await store.payload(id);
  return packed ? unpackSlotFile(packed) : null;
}

/**
 * Drop the oldest records of a slot until at most `max` remain.
 * Returns how many were removed.
 */
export function pruneSlot(slot: number, max: number): Promise<number> {
  return store.prune(slot, max);
}

export type CreateBackupResult = PutBackupResult<DS3BackupMeta>;

export interface CreateBackupOptions {
  /** Load-menu summary block to store alongside the slot. */
  summary?: Uint8Array | null;
  maxPerSlot?: number;
}

/** SteamID64 a slot is bound to, as the decimal string the records store. */
export function slotSteamIdKey(character: DS3Character): string {
  try {
    const id = character.getSteamId();
    return id === null ? '' : formatSteamId(id);
  } catch {
    return '';
  }
}

/**
 * Name and level for the history list. A slot whose layout the pattern search
 * can't make sense of still gets backed up — the bytes are what matter, and a
 * row with a blank name is far better than a lost snapshot.
 */
function describe(character: DS3Character): { name: string; level: number } {
  try {
    return { name: character.name || '', level: character.level };
  } catch {
    return { name: '', level: 0 };
  }
}

/**
 * Store one slot, unless its bytes match the slot's newest backup.
 *
 * The duplicate check covers the summary block too, so a save that only moved
 * the load menu forward still records a new entry.
 */
export async function createBackup(
  character: DS3Character,
  source: BackupSource,
  options: CreateBackupOptions = {}
): Promise<CreateBackupResult> {
  const slot = character.slotIndex;
  if (!store.acceptsSlot(slot)) {
    throw new Error(`Cannot back up slot ${slot}`);
  }
  if (character.isEmpty) {
    return { created: false };
  }

  const { name, level } = describe(character);

  return store.put(
    {
      slot,
      name,
      level,
      steamId: slotSteamIdKey(character),
      source,
    },
    packSlotFile(character.getRawData(), options.summary ?? null),
    options.maxPerSlot ?? DS3_DEFAULT_MAX_PER_SLOT
  );
}

export interface BackupAllResult {
  created: number;
  skipped: number;
  slots: number[];
}

/** Back up every non-empty slot, skipping the ones whose content is unchanged. */
export async function backupAllSlots(
  editor: DS3BackupEditor,
  source: BackupSource,
  maxPerSlot: number = DS3_DEFAULT_MAX_PER_SLOT
): Promise<BackupAllResult> {
  const result: BackupAllResult = { created: 0, skipped: 0, slots: [] };

  for (const character of editor.getCharacters().slice(0, SLOT_COUNT)) {
    if (character.isEmpty) continue;
    try {
      const outcome = await createBackup(character, source, {
        summary: editor.readSlotSummary(character.slotIndex),
        maxPerSlot,
      });
      if (outcome.created) {
        result.created++;
        result.slots.push(character.slotIndex);
      } else {
        result.skipped++;
      }
    } catch (error) {
      console.error(`[ds3-backups] Failed to back up slot ${character.slotIndex}:`, error);
    }
  }

  return result;
}
