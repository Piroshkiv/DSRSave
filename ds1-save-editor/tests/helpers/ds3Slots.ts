import { DS3Character } from '../../src/apps/ds3/lib/Character';
import { CHARACTER_PATTERN } from '../../src/apps/ds3/lib/constants';

/**
 * Synthetic DS3 slot bytes: enough structure for the real getters to work
 * without needing a 12 MB save on disk.
 *
 * `isEmpty` scans 0x10..0x40, the stat/name getters are all relative to
 * CHARACTER_PATTERN, and `findSteamIdOffset` accepts any 8 bytes whose high
 * half is the SteamID64 prefix — so a valid ID written anywhere is found.
 */
export const SYNTHETIC_SLOT_SIZE = 0x8000;
const PATTERN_AT = 0x2000;
const STEAM_ID_AT = 0x1000;

export function makeSlotData(name: string, level: number, steamId?: bigint): Uint8Array {
  const data = new Uint8Array(SYNTHETIC_SLOT_SIZE);
  data.fill(0x11, 0x10, 0x40); // anything non-zero here means "occupied"
  data.set(CHARACTER_PATTERN, PATTERN_AT);

  if (steamId !== undefined) {
    new DataView(data.buffer).setBigUint64(STEAM_ID_AT, steamId, true);
  }

  const character = new DS3Character(data, 0);
  character.name = name;
  character.level = level;
  return data;
}

export function makeCharacter(
  slot: number,
  name: string,
  level: number,
  steamId?: bigint
): DS3Character {
  return new DS3Character(makeSlotData(name, level, steamId), slot);
}

/** `getSteamId()` without the null-check noise at every call site. */
export function steamIdOf(character: DS3Character): bigint | null {
  return character.getSteamId();
}
