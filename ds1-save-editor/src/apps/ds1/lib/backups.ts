import { Character } from './Character';
import {
  BackupRecord,
  BackupSource,
  BackupStore,
  DEFAULT_MAX_PER_SLOT,
  MAX_PER_SLOT_LIMIT,
  PutBackupResult,
  formatBytes,
} from '../../../shared/backupStore';

/**
 * Per-slot backup history for DS1, kept in IndexedDB by the shared store.
 *
 * A backup is one character slot: the 0x60020 bytes of decrypted user data.
 * The load screen block in slot 10 is deliberately not kept — it only feeds the
 * load menu and the game rewrites it, while writing it back would drag the
 * occupied-flag array (which lives inside slot 0's block) along with it.
 *
 * Save files carry no account identity of any kind (no Steam ID anywhere, and
 * the per-slot IV is an MD5 of the ciphertext that changes on every write), so
 * records are keyed by slot number only. The tab filters by character name to
 * separate histories that happen to share a slot. DS3, whose slots do carry an
 * account ID, filters by that instead — see `apps/ds3/lib/backups.ts`.
 */

export type BackupMeta = BackupRecord;
export type { BackupSource };
export { DEFAULT_MAX_PER_SLOT, MAX_PER_SLOT_LIMIT, formatBytes };

const store = new BackupStore<BackupMeta>({ dbName: 'ds1-backups' });

export function listBackups(slot: number): Promise<BackupMeta[]> {
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

/** The stored slot bytes, decompressed. */
export function getBackupPayload(id: number): Promise<Uint8Array | null> {
  return store.payload(id);
}

/**
 * Drop the oldest records of a slot until at most `max` remain.
 * Returns how many were removed.
 */
export function pruneSlot(slot: number, max: number): Promise<number> {
  return store.prune(slot, max);
}

export type CreateBackupResult = PutBackupResult<BackupMeta>;

/**
 * Store one slot, unless its bytes match the slot's newest backup.
 */
export async function createBackup(
  character: Character,
  source: BackupSource,
  maxPerSlot: number = DEFAULT_MAX_PER_SLOT
): Promise<CreateBackupResult> {
  const slot = character.slotNumber;
  if (!store.acceptsSlot(slot)) {
    throw new Error(`Cannot back up slot ${slot}`);
  }
  if (character.isEmpty) {
    return { created: false };
  }

  return store.put(
    {
      slot,
      name: character.name || '',
      level: character.level,
      source,
    },
    character.getRawData(),
    maxPerSlot
  );
}

export interface BackupAllResult {
  created: number;
  skipped: number;
  slots: number[];
}

/**
 * Back up every non-empty slot, skipping the ones whose content is unchanged.
 *
 * `characters` is the editor's full list; index 10 is the metadata slot and is
 * never backed up.
 */
export async function backupAllSlots(
  characters: Character[],
  source: BackupSource,
  maxPerSlot: number = DEFAULT_MAX_PER_SLOT
): Promise<BackupAllResult> {
  const result: BackupAllResult = { created: 0, skipped: 0, slots: [] };

  for (const character of characters.slice(0, 10)) {
    if (character.isEmpty) continue;
    try {
      const outcome = await createBackup(character, source, maxPerSlot);
      if (outcome.created) {
        result.created++;
        result.slots.push(character.slotNumber);
      } else {
        result.skipped++;
      }
    } catch (error) {
      console.error(`[backups] Failed to back up slot ${character.slotNumber}:`, error);
    }
  }

  return result;
}
