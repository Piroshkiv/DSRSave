import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Real save files used as fixtures.
 *
 * These live outside the repo (they are the user's actual game saves and must
 * never be committed). Paths are overridable via env vars so the suite runs on
 * any machine; when a save is missing the dependent suites skip instead of
 * failing, so CI without fixtures still goes green.
 *
 * NOTHING in this suite ever writes to these paths — every editor operation
 * works on an in-memory copy of the bytes.
 */
const HOME = os.homedir();

export const DS1_SAVE_PATH =
  process.env.DS1_SAVE_PATH ??
  path.join(HOME, 'Documents', 'NBGI', 'DARK SOULS REMASTERED', '834633765', 'DRAKS0005.sl2');

export const DS3_SAVE_PATH =
  process.env.DS3_SAVE_PATH ??
  path.join(HOME, 'AppData', 'Roaming', 'DarkSoulsIII', '0110000131bf8025', 'DS30000.sl2');

async function exists(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isFile();
  } catch {
    return false;
  }
}

export const hasDS1Save = await exists(DS1_SAVE_PATH);
export const hasDS3Save = await exists(DS3_SAVE_PATH);

const cache = new Map<string, Uint8Array>();

/** Read a fixture save once and hand out a fresh copy to every caller. */
export async function readSaveBytes(filePath: string): Promise<Uint8Array> {
  let cached = cache.get(filePath);
  if (!cached) {
    cached = new Uint8Array(await readFile(filePath));
    cache.set(filePath, cached);
  }
  // Defensive copy: editors mutate their buffer in place.
  return new Uint8Array(cached);
}

/**
 * Wrap bytes in a `File`, which is what `SaveFileEditor.fromFileData` expects.
 * Node 18+ has a global `File`.
 */
export function toFile(bytes: Uint8Array, name: string): File {
  return new File([bytes as unknown as BlobPart], name, {
    type: 'application/octet-stream',
  });
}

export async function ds1SaveFile(): Promise<File> {
  return toFile(await readSaveBytes(DS1_SAVE_PATH), 'DRAKS0005.sl2');
}

export async function ds3SaveFile(): Promise<File> {
  return toFile(await readSaveBytes(DS3_SAVE_PATH), 'DS30000.sl2');
}

/** Hex dump helper for assertion messages. */
export function hex(bytes: Uint8Array, max = 32): string {
  return Array.from(bytes.slice(0, max))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}
