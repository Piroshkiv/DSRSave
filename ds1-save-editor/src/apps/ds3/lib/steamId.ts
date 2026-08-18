/**
 * SteamID64 parsing/formatting for the DS3 editor.
 *
 * Users meet the ID in two shapes and both are accepted:
 *   * decimal — what Steam profiles and lookup sites show (76561198794899493);
 *   * hex — what the save folder is named (`DarkSoulsIII/0110000131bf8025`).
 */

/** Every SteamID64 a save carries: the system entry's, plus one per populated slot. */
export interface SteamIdSummary {
  system: bigint | null;
  slots: { slotIndex: number; steamId: bigint | null }[];
  /**
   * true when two *different* account IDs are present — a save stitched from
   * several accounts, which is what actually needs rebinding.
   *
   * A slot carrying no ID at all does not count here: see `unbound`.
   */
  mismatched: boolean;
  /**
   * Slots whose data holds no account ID anywhere — characters imported from a
   * save that was never bound to an account. The game still loads them and
   * there is no field to write into, so they are reported, not patched.
   */
  unbound: number[];
}

/** High 32 bits of every individual Steam account ID (universe 1, type 1, instance 1). */
export const STEAM_ID_PREFIX = 0x01100001n;

const MIN_ID = STEAM_ID_PREFIX << 32n;
const MAX_ID = MIN_ID + 0xFFFFFFFFn;

/** True for IDs the game (and our pattern locator) can actually carry. */
export function isValidSteamId(id: bigint): boolean {
  return id >= MIN_ID && id <= MAX_ID;
}

/** Decimal form — the one Steam itself shows. */
export function formatSteamId(id: bigint): string {
  return id.toString(10);
}

/** Hex form, 16 digits — identical to the save folder's name. */
export function formatSteamIdHex(id: bigint): string {
  return id.toString(16).padStart(16, '0');
}

/**
 * Pull the account ID out of a save's location: DS3 stores saves in
 * `DarkSoulsIII/<SteamID64 in hex>/DS30000.sl2`, so the folder name *is* the ID.
 *
 * Segments are checked deepest-first, so a backup tucked one level deeper
 * (`…/0110000131bf8025/New folder/DS30000.sl2`) still resolves.
 *
 * Where the path comes from: Tauri hands back a real filesystem path with the
 * file handle. In the browser there is none unless the user picked a whole
 * directory, in which case `File.webkitRelativePath` carries the folder name —
 * everything else returns null and the field stays manual.
 */
export function steamIdFromPath(path: string | null | undefined): bigint | null {
  if (!path) return null;

  const segments = path.split(/[\\/]/).filter((s) => s.length > 0);

  for (let i = segments.length - 1; i >= 0; i--) {
    if (!/^[0-9a-f]{16}$/i.test(segments[i])) continue;
    const id = BigInt('0x' + segments[i].toLowerCase());
    if (isValidSteamId(id)) return id;
  }
  return null;
}

/**
 * Parse user input in either notation. Returns null when the text isn't a
 * plausible SteamID64, so callers can just refuse instead of writing garbage
 * into the save.
 *
 * Digit-only input is read as decimal first and as hex only if that lands
 * outside the valid range — which is what makes the all-numeric folder names
 * (e.g. `0110000112345678`) work as well as decimal IDs.
 */
export function parseSteamId(text: string): bigint | null {
  const cleaned = text.trim().replace(/[\s_]/g, '');
  if (cleaned === '') return null;

  const asBigInt = (literal: string): bigint | null => {
    try {
      return BigInt(literal);
    } catch {
      return null;
    }
  };

  if (/^0x[0-9a-f]{1,16}$/i.test(cleaned)) {
    const id = asBigInt(cleaned.toLowerCase());
    return id !== null && isValidSteamId(id) ? id : null;
  }

  if (/^[0-9]+$/.test(cleaned)) {
    const decimal = asBigInt(cleaned);
    if (decimal !== null && isValidSteamId(decimal)) return decimal;
  }

  if (/^[0-9a-f]{1,16}$/i.test(cleaned)) {
    const hex = asBigInt('0x' + cleaned.toLowerCase());
    if (hex !== null && isValidSteamId(hex)) return hex;
  }

  return null;
}
