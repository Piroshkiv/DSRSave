import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { calculateMD5 } from './md5';
import { toArrayBuffer } from './binary';

/**
 * Per-slot backup history in IndexedDB, shared by the DS1 and DS3 editors.
 *
 * A backup is one character slot's decrypted bytes. Metadata lives in its own
 * object store so listing a slot never reads a payload, and payloads are
 * gzipped when the browser has CompressionStream.
 *
 * Neither save format carries an identity that survives a rewrite (DS1 has no
 * account data at all; both games rewrite the per-slot IV on every save), so
 * records are keyed by slot number. What separates two histories that happen to
 * share a slot is a game-specific field the caller adds to the record: the
 * character name in DS1, the account's Steam ID in DS3.
 */

export type BackupSource = 'auto' | 'manual' | 'pre-restore';

/** Fields every backup carries, whichever game wrote it. */
export interface BackupRecord {
  id: number;
  slot: number;
  name: string;
  level: number;
  /** Epoch ms of when the backup was taken. */
  createdAt: number;
  /** MD5 (hex) of the uncompressed payload — drives duplicate detection. */
  hash: string;
  rawSize: number;
  storedSize: number;
  gzip: boolean;
  source: BackupSource;
}

/** What a caller describes; the store fills in the rest. */
export type BackupDescriptor<TMeta extends BackupRecord> =
  Omit<TMeta, 'id' | 'createdAt' | 'hash' | 'rawSize' | 'storedSize' | 'gzip'>;

export interface PutBackupResult<TMeta extends BackupRecord> {
  created: boolean;
  /** Set when `created` is false: the payload is byte-identical to the newest backup. */
  duplicate?: boolean;
  meta?: TMeta;
  pruned?: number;
}

interface BackupBlob {
  id: number;
  /** Payload bytes, gzipped when the browser has CompressionStream. */
  data: ArrayBuffer;
}

interface BackupDB<TMeta extends BackupRecord> extends DBSchema {
  backups: {
    key: number;
    value: TMeta;
    indexes: { 'by-slot': number; 'by-slot-time': [number, number] };
  };
  blobs: {
    key: number;
    value: BackupBlob;
  };
}

export const DEFAULT_MAX_PER_SLOT = 20;
export const MAX_PER_SLOT_LIMIT = 200;

const DB_VERSION = 1;

const hasCompression = typeof CompressionStream !== 'undefined'
  && typeof DecompressionStream !== 'undefined';

async function gzip(data: Uint8Array): Promise<{ buffer: ArrayBuffer; gzip: boolean }> {
  if (!hasCompression) {
    return { buffer: toArrayBuffer(data), gzip: false };
  }
  const stream = new Blob([toArrayBuffer(data)]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return { buffer, gzip: true };
}

async function gunzip(buffer: ArrayBuffer, compressed: boolean): Promise<Uint8Array> {
  if (!compressed) return new Uint8Array(buffer);
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function md5Hex(data: Uint8Array): Promise<string> {
  const digest = await calculateMD5(data);
  return Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
}

export interface BackupStoreOptions {
  /** IndexedDB database name — one per game, so histories never mix. */
  dbName: string;
  /** Slots the store accepts, numbered 0..slotCount-1. */
  slotCount?: number;
  defaultMaxPerSlot?: number;
}

export class BackupStore<TMeta extends BackupRecord> {
  private readonly dbName: string;
  private readonly slotCount: number;
  readonly defaultMaxPerSlot: number;
  private dbPromise: Promise<IDBPDatabase<BackupDB<TMeta>>> | null = null;

  constructor({ dbName, slotCount = 10, defaultMaxPerSlot = DEFAULT_MAX_PER_SLOT }: BackupStoreOptions) {
    this.dbName = dbName;
    this.slotCount = slotCount;
    this.defaultMaxPerSlot = defaultMaxPerSlot;
  }

  private db(): Promise<IDBPDatabase<BackupDB<TMeta>>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<BackupDB<TMeta>>(this.dbName, DB_VERSION, {
        upgrade(db) {
          const backups = db.createObjectStore('backups', { keyPath: 'id', autoIncrement: true });
          backups.createIndex('by-slot', 'slot');
          backups.createIndex('by-slot-time', ['slot', 'createdAt']);
          db.createObjectStore('blobs', { keyPath: 'id' });
        },
      });
    }
    return this.dbPromise;
  }

  /** True for slots this store will accept a backup for. */
  acceptsSlot(slot: number): boolean {
    return Number.isInteger(slot) && slot >= 0 && slot < this.slotCount;
  }

  clampMaxPerSlot(max: number): number {
    if (!Number.isFinite(max)) return this.defaultMaxPerSlot;
    return Math.max(1, Math.min(MAX_PER_SLOT_LIMIT, Math.floor(max) || this.defaultMaxPerSlot));
  }

  /** One slot's history, newest first. */
  async list(slot: number): Promise<TMeta[]> {
    const db = await this.db();
    const rows = await db.getAllFromIndex('backups', 'by-slot', slot);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Backup count per slot, for the slot list badges. */
  async counts(): Promise<Record<number, number>> {
    const db = await this.db();
    const counts: Record<number, number> = {};
    for (const row of await db.getAll('backups')) {
      counts[row.slot] = (counts[row.slot] ?? 0) + 1;
    }
    return counts;
  }

  async totalSize(): Promise<number> {
    const db = await this.db();
    return (await db.getAll('backups')).reduce((sum, row) => sum + row.storedSize, 0);
  }

  async delete(id: number): Promise<void> {
    const db = await this.db();
    const tx = db.transaction(['backups', 'blobs'], 'readwrite');
    await Promise.all([
      tx.objectStore('backups').delete(id),
      tx.objectStore('blobs').delete(id),
      tx.done,
    ]);
  }

  /** Delete several backups in one transaction. Returns how many were removed. */
  async deleteMany(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const db = await this.db();
    const tx = db.transaction(['backups', 'blobs'], 'readwrite');
    const backups = tx.objectStore('backups');
    const blobs = tx.objectStore('blobs');
    await Promise.all([
      ...ids.map(id => backups.delete(id)),
      ...ids.map(id => blobs.delete(id)),
      tx.done,
    ]);
    return ids.length;
  }

  /** The stored payload, decompressed. */
  async payload(id: number): Promise<Uint8Array | null> {
    const db = await this.db();
    const [meta, blob] = await Promise.all([db.get('backups', id), db.get('blobs', id)]);
    if (!meta || !blob) return null;
    return gunzip(blob.data, meta.gzip);
  }

  /**
   * Drop the oldest records of a slot until at most `max` remain.
   * Returns how many were removed.
   */
  async prune(slot: number, max: number): Promise<number> {
    const limit = this.clampMaxPerSlot(max);
    const rows = await this.list(slot);
    const doomed = rows.slice(limit);
    for (const row of doomed) {
      await this.delete(row.id);
    }
    return doomed.length;
  }

  /**
   * Store one payload, unless its bytes match the slot's newest backup.
   *
   * The duplicate check is what keeps a double Ctrl+S (or a reload that found
   * nothing changed) from filling the history with identical entries.
   */
  async put(
    descriptor: BackupDescriptor<TMeta>,
    data: Uint8Array,
    maxPerSlot: number = this.defaultMaxPerSlot
  ): Promise<PutBackupResult<TMeta>> {
    const { slot } = descriptor;
    if (!this.acceptsSlot(slot)) {
      throw new Error(`Cannot back up slot ${slot}`);
    }

    const hash = await md5Hex(data);

    const existing = await this.list(slot);
    if (existing.length > 0 && existing[0].hash === hash) {
      return { created: false, duplicate: true, meta: existing[0] };
    }

    const { buffer, gzip: compressed } = await gzip(data);

    const meta = {
      ...descriptor,
      createdAt: Date.now(),
      hash,
      rawSize: data.length,
      storedSize: buffer.byteLength,
      gzip: compressed,
    } as Omit<TMeta, 'id'>;

    const db = await this.db();
    const tx = db.transaction(['backups', 'blobs'], 'readwrite');
    const id = await tx.objectStore('backups').add(meta as TMeta);
    await tx.objectStore('blobs').put({ id: id as number, data: buffer });
    await tx.done;

    const pruned = await this.prune(slot, maxPerSlot);
    return { created: true, meta: { ...meta, id: id as number } as TMeta, pruned };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
