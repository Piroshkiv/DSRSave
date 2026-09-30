
export const BND4_HEADER_SIZE = 0x40;
export const ENTRY_HEADER_SIZE = 0x20;
export const BND4_SIGNATURE = [0x42, 0x4E, 0x44, 0x34]; // "BND4"

export const AES_KEY = new Uint8Array([
  0xFD, 0x46, 0x4D, 0x69, 0x5E, 0x69, 0xA3, 0x9A,
  0x10, 0xE3, 0x19, 0xA7, 0xAC, 0xE8, 0xB7, 0xFA
]);

export const CHARACTER_PATTERN = new Uint8Array([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
]); 


// Relative offsets from pattern position (pattern start + offset)
export const RELATIVE_OFFSETS = {
  NAME: -0xC8,

  SOULS: -0xDC,
  SOUL_MEMORY: -0xD8, // "Total Get Soul" — total souls ever collected (soul memory), 4 bytes
  LEVEL: -0xE0,

  VIGOR: -0x10C,
  ATTUNEMENT: -0x108,
  ENDURANCE: -0x104,
  VITALITY: -0xE4,
  STRENGTH: -0x100,
  DEXTERITY: -0xFC,
  INTELLIGENCE: -0xF8,
  FAITH: -0xF4,
  LUCK: -0xF0,

  HP: -0x130,
  FP: -0x124,
  STAMINA: -0x114,

  ESTUS_MAX: -0x4E,
  ASHEN_ESTUS_MAX: -0x4D,
  CLASS: -0xA2,
  WEAPON_MEMORY: -0x9D,

  // Gender and voice live here rather than in the face block. In memory they sit
  // at PlayerGameData+0xAA/+0xAB, four bytes ahead of class (+0xAE) — and CLASS is
  // already anchored at -0xA2, which puts these two exactly where they landed when
  // the sweeper located them. Gender reads 0 or 1 on all 99 characters checked;
  // voice read 0 on every one of them, so its offset is plausible but unproven.
  GENDER: -0xA6,
  VOICE: -0xA5,
} as const;

/** The nine levelled stats, in the order the game's status screen lists them. */
export const STAT_ORDER = ['VIG', 'ATN', 'END', 'VIT', 'STR', 'DEX', 'INT', 'FTH', 'LCK'];

// ===== BONFIRES / event-flag block =====
// The bonfire block moves with the (variable-length) inventory, so it can't be read at a
// fixed offset. It is located with a DS1-style windowed anchor search — see
// docs/ds3-bonfire-anchor.md. Verified byte-exact across 5 captures of 2 characters.
//
//   invStart = GA-table scan (same as findInventoryStart)
//   est      = invStart + BONFIRE_COARSE_FROM_INV            (coarse block estimate)
//   anchor   = LAST BONFIRE_PATTERN in [est-0x1500, est+0x200]
//   rec0     = anchor + BONFIRE_ANCHOR_TO_BLOCK              (block start)
export const BONFIRE_PATTERN = new Uint8Array([
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
]);
export const BONFIRE_COARSE_FROM_INV = 0x12B1F;
export const BONFIRE_ANCHOR_TO_BLOCK = 0xB5D;

// ===== GESTURES =====
// Gesture unlock table: 41 records of `[u16 value][u16 index]` in the fixed game
// order, where
//
//   value = (index + 1) * 2 + (unlocked ? 1 : 0)
//
// so bit 0 of the first byte is the unlock flag and the rest of the record is a
// self-describing id/index pair. Identical in layout to the array the game keeps
// at [[[GameDataMan]+0x10]+0x7B8]+0x10 (the "Unlock All Gestures" script in
// DS3_TGA_v3.4.0.CT) and to the DS1 table, which has 15 records instead of 41.
//
// Mapped by ds3-gesture-sweeper: each gesture was toggled alone in the game's
// memory, the game was forced to save (ESC x2), and the decrypted slots were
// diffed bit by bit. All 41 gestures landed on exactly `table + index*4` bit 0.
//
// The table has NO usable fixed anchor. Measured across 6 characters, every
// candidate drifts: CHARACTER_PATTERN (+0x114A0 / +0x114C8 / +0x11500),
// inventory start, the SteamID and the absolute offset all vary, and the offset
// even moves between two saves of the SAME character (0x21F98 -> 0x219E8).
// What does hold is the distance to the bonfire block: constant at -0x1863 over
// all 43 captures of one character, and within 0x40 of it across characters
// (-0x185B / -0x1863 / -0x189B). So the block is located the same way the
// bonfire block itself is — a coarse estimate plus a windowed search — with the
// record structure as the actual acceptance test.
/**
 * Records in the on-disk table. All 41 are present and well-formed, so all 41
 * are checked when accepting a candidate offset — that full structure is what
 * makes the search reliable.
 */
export const GESTURE_RECORD_COUNT = 41;
export const GESTURE_RECORD_SIZE = 4;
/**
 * Gestures the editor exposes: records 0-33, Point Forward through Unmannered Bow.
 *
 * Records 34-40 are broken and are never set. "Lord of Cinder" (34) is an
 * unfinished gesture — it was meant to strike the Soul of Cinder's idle pose but
 * plays a placeholder kukri-throw animation; FDP_MenuText(301140)-(301145)
 * (35-40) are empty placeholders. The records exist and the flag sticks, so
 * unlocking them just adds broken entries to the in-game gesture menu
 * (confirmed in-game). "Unlock all" clears them rather than skipping them, so it
 * also repairs a save that already has them on.
 *
 * Record 33, Unmannered Bow, is cut content too but has a finished animation and
 * is kept. It is not obtainable in normal play, so it does mark the save as
 * edited; no ban reports for it were found, but DS3 is known to soft-ban on
 * anomalous save data in general.
 */
export const GESTURE_COUNT = 34;
export const GESTURE_COARSE_FROM_BONFIRE = -0x1863;
export const GESTURE_SEARCH_RADIUS = 0x800;

// NG+ cycle ("journey" counter) — u32 LE at BONFIRE_BLOCK_TO_NG_CYCLE from the block
// start: 0 = NG, 1 = NG+1, ... It sits just before the event-flag block, behind an
// `FF*16 00*4` header, and is the only save-semantic byte an NG+ step changes (a
// captured NG+1 -> NG+2 transition touched 44 bytes of the slot; the rest were the
// play time, the save's hash fields and the runtime scratch tail).
//
// The delta is anchored to the bonfire block, not to CHARACTER_PATTERN: measured
// against the character pattern it drifts (0x115DA / 0x115EE / 0x115F2 / 0x11866 on
// four different slots), while -0x1721 from the block start holds on all 8 populated
// slots of 6 saves. The old pattern-relative RELATIVE_OFFSETS.NG_CYCLE (-0x6) pointed
// at a byte that reads 0 in every one of those slots, including a character on NG+2.
export const BONFIRE_BLOCK_TO_NG_CYCLE = -0x1721;

// "Unlock all bonfires" bitmask: [offset-from-block-start, byte value]. Each value is a
// bitmask OR-ed into the byte, so only the bonfire bits are set — every other bit in the
// same byte is preserved and no flag is ever cleared. The masks are exactly the bits the
// game itself flips 0→1 on "unlock all" (captured as the lock→unlock diff and confirmed
// identical on a second character). Records sit every 0x500 bytes; two u16 flag words per
// record (at +0x0 and +0x40E).
export const BONFIRE_UNLOCK_ALL: ReadonlyArray<readonly [number, number]> = [
  // rec 0
  [0x0000, 0xB0], [0x0001, 0x03], [0x0007, 0x80], [0x040E, 0x40], [0x040F, 0xEC],
  // rec 1
  [0x0500, 0x80], [0x0501, 0x03], [0x090F, 0xE0],
  // rec 2
  [0x0A00, 0xE0], [0x0A01, 0x03], [0x0E0F, 0xF8],
  // rec 4
  [0x1400, 0xC0], [0x1401, 0x03], [0x180F, 0xF0],
  // rec 6
  [0x1E00, 0xFE], [0x1E01, 0x02], [0x220E, 0x80], [0x220F, 0xBF],
  // rec 8
  [0x2801, 0x03], [0x2C0F, 0xC0],
  // rec 9
  [0x2D00, 0x80], [0x2D01, 0x03], [0x310F, 0xF0],
  // rec 12
  [0x3C00, 0xFE], [0x3C01, 0x03], [0x400E, 0x80], [0x400F, 0xFF],
  // rec 13
  [0x4100, 0xE8], [0x4101, 0x03], [0x450F, 0xFA],
  // rec 14
  [0x4600, 0x80], [0x4601, 0x03], [0x4A0F, 0xE0],
  // rec 15
  [0x4B00, 0xE0], [0x4B01, 0x03], [0x4F0F, 0xF8], [0x4F1B, 0x0C],
  // rec 16
  [0x5000, 0x80], [0x5001, 0x03], [0x540F, 0xE0],
  // rec 17
  [0x5500, 0xFC], [0x5501, 0x03], [0x590F, 0xFF],
  // rec 20
  [0x6400, 0xC0], [0x6401, 0x03], [0x680F, 0xF0],
  // rec 21
  [0x6900, 0xF0], [0x6901, 0x03], [0x6D0F, 0xFC],
  // rec 22
  [0x6E01, 0x03], [0x720F, 0xC0],
];

// ===== STEAM ID =====
// SteamID64 of the account the save belongs to, stored LE in two places:
//   * every populated character slot, at `u32 LE @0x58` + STEAMID_PTR_TO_ID;
//   * the system entry (entry 10), at SYSTEM_ENTRY_STEAMID_OFFSET.
// The game rejects a save whose IDs don't match the running account, which is
// what makes transferring someone else's save a two-step patch.
//
// The slot address is NOT reachable from CHARACTER_PATTERN (or from the GA
// table / inventory / bonfire anchors): the ID sits *after* the variable-length
// inventory, so every delta drifts — measured +0x66168…+0x66dc0 from the
// character pattern across 23 slots in 5 saves. Two locators that do hold on
// all 23:
//   1. the pointer at 0x58 (exact, O(1)) — same one SaveMerge uses;
//   2. STEAMID_PATTERN, the high half of the ID itself: 0x01100001 is the
//      universe/type/instance prefix every individual Steam account shares, so
//      it is account-independent, and it occurs exactly once per slot.
export const STEAMID_SLOT_PTR_OFFSET = 0x58;
export const STEAMID_PTR_TO_ID = 0x6F;

/** `01 00 10 01` = high 4 bytes of any SteamID64, LE. Sits at ID + 4. */
export const STEAMID_PATTERN = new Uint8Array([0x01, 0x00, 0x10, 0x01]);
export const STEAMID_PATTERN_TO_ID = -4;

/** SteamID64 in the system entry (entry 10), 8 bytes LE. */
export const SYSTEM_ENTRY_STEAMID_OFFSET = 0x08;

// The save-wide network setting ("Launch Setting" in the game's system menu):
// 0x01 = Play Online, 0x00 = Play Offline.
//
// Verified by diffing 13 decrypted entry-10 captures taken around a toggle in
// game: 0x23 is the *only* byte of the 393,220-byte entry that is stable within
// each group and differs across them (seven offline captures 0x00, six online
// 0x01), and checkpoints plus the live save agree. It sits in the entry's fixed
// header — a rewrite that touched 0x12F2..0x60003 left everything below 0x2000
// alone — so unlike the bonfire block this absolute offset does not drift.
export const ONLINE_FLAG_OFFSET = 0x23;

// ===== SYSTEM ENTRY (entry 10) SLOT TABLES =====
// Two per-slot tables sit back to back near the start of the system entry:
//
//   0x1098  ten active flags, one byte per slot (0x01 = an active character,
//           0x00 = empty or deleted);
//   0x10A2  ten load-menu summary blocks of 0x22A bytes each — what the game
//           shows *before* a slot is loaded (name at +0x00 as UTF-16, soul level
//           at +0x22 as u32 LE, appearance data behind a "FACE" marker at +0x3A).
//
// Verified on a real save: all ten blocks parse at that stride, and the name and
// level of each populated block match the character in the matching slot. This
// is the DS3 counterpart of DS1's 400-byte load screen entry, with one welcome
// difference — the summary blocks sit *after* the flag array rather than inside
// slot 0's block, so writing one slot's summary cannot disturb another's flag.
export const SLOT_ACTIVE_FLAGS_OFFSET = 0x1098;
export const SLOT_SUMMARY_BASE = 0x10A2;
export const SLOT_SUMMARY_SIZE = 0x22A;
export const SLOT_COUNT = 10;

// ===== APPEARANCE PRESETS (the game's own) =====
// DS3 lets a player store finished faces in the character creator, and it keeps
// them in the system entry — six fixed-size records right at the front, before
// the slot flags and the load-menu summaries.
//
// Each record is self-describing, which is what makes it safe to find:
//
//   "FACE" | u32 version = 3 | u32 size = 0xF4 | payload 0xF8 bytes
//
// and the payload opens with exactly the same 208-byte face block a character
// slot carries, so a preset and a character speak the same format. After the
// face come 21 bytes of 0x7F, three zeros, and a u16 that reads 1 on every
// preset actually saved in-game.
//
// Measured on a save where six presets exist, and on eleven others where the
// whole 0xB0..0x6DC range is zeros — an unused slot is not an empty record but
// no record at all, so the magic is the presence test.
export const APPEARANCE_PRESET_BASE = 0xB0;
export const APPEARANCE_PRESET_RECORD_SIZE = 0x104;
export const APPEARANCE_PRESET_COUNT = 6;

export const FACE_RECORD_MAGIC = [0x46, 0x41, 0x43, 0x45]; // "FACE"
export const FACE_RECORD_VERSION = 3;
export const FACE_RECORD_DECLARED_SIZE = 0xF4;
export const FACE_RECORD_HEADER_SIZE = 12;
/** Record size minus header — the face block plus its trailer. */
export const FACE_RECORD_PAYLOAD_SIZE =
  APPEARANCE_PRESET_RECORD_SIZE - FACE_RECORD_HEADER_SIZE;
/**
 * 21 bytes of 0x7F sit right after the face block in every record seen.
 * The offset is FACE_BLOCK_SIZE, spelled out because that constant is declared
 * further down the file; the test suite pins the two together.
 */
export const FACE_RECORD_FILL_OFFSET = 0xD0;
export const FACE_RECORD_FILL_LENGTH = 21;
export const FACE_RECORD_FILL_BYTE = 0x7F;
/** u16, reads 1 on presets saved in game. */
export const FACE_RECORD_USED_OFFSET = 0xE8;

// Play time in milliseconds, u32 LE. Absolute offset in the decrypted slot header
// (not pattern-relative). The game trusts this value and continues counting from it.
export const PLAYTIME_OFFSET = 0x0C;

// Extra play time credited per gained soul level, to keep playtime plausible for
// an edited level. A random duration in [MIN, MAX] is rolled per level so the
// resulting timestamp doesn't look machine-generated.
export const PLAYTIME_MS_PER_LEVEL_MIN = 3 * 60 * 1000;
export const PLAYTIME_MS_PER_LEVEL_MAX = 5 * 60 * 1000;

// Souls required to go FROM (level-1) TO the given soul level.
// Source: DS3 wiki — levels 2-12 are fixed values (index 0 = cost of level 2);
// level 13+ uses y = 0.02x³ + 3.06x² + 105.6x − 895
// (verified against the wiki table: L13=1038, L15=1445, L20=2601).
const EARLY_LEVEL_COSTS = [673, 690, 707, 724, 741, 759, 778, 797, 816, 836, 856];

export function levelUpCost(level: number): number {
  if (level <= 1) return 0;
  if (level <= 12) return EARLY_LEVEL_COSTS[level - 2];
  return Math.floor(0.02 * level ** 3 + 3.06 * level ** 2 + 105.6 * level - 895);
}

// Cumulative souls spent to reach a soul level from level 1 (sum of per-level costs).
export function cumulativeLevelCost(level: number): number {
  let total = 0;
  for (let l = 2; l <= level; l++) total += levelUpCost(l);
  return total;
}

// Minimum plausible soul memory ("Total Get Soul") for a given soul level:
// everything spent on leveling, plus a 20% margin for souls spent elsewhere.
export function minSoulMemoryForLevel(level: number): number {
  return Math.floor(cumulativeLevelCost(level) * 1.2);
}

// Maximum values
export const MAX_VALUES = {
  SOULS: 999999999,
  LEVEL: 802, // Max level in DS3

  // Stats (99 is standard max for DS3)
  VIGOR: 99,
  ATTUNEMENT: 99,
  ENDURANCE: 99,
  VITALITY: 99,
  STRENGTH: 99,
  DEXTERITY: 99,
  INTELLIGENCE: 99,
  FAITH: 99,
  LUCK: 99,

  // Progression
  NG_CYCLE: 7, // NG+7 is max
} as const;

// DS3 Class IDs (based on alfizari's editor, offset + 1)
export enum PlayerClass {
  Knight = 0,
  Mercenary = 1,
  Warrior = 2,
  Herald = 3,
  Thief = 4,
  Assassin = 5,
  Sorcerer = 6,
  Pyromancer = 7,
  Cleric = 8,
  Deprived = 9
}

export const CLASS_NAMES: Record<PlayerClass, string> = {
  [PlayerClass.Knight]: 'Knight',
  [PlayerClass.Mercenary]: 'Mercenary',
  [PlayerClass.Warrior]: 'Warrior',
  [PlayerClass.Herald]: 'Herald',
  [PlayerClass.Thief]: 'Thief',
  [PlayerClass.Assassin]: 'Assassin',
  [PlayerClass.Sorcerer]: 'Sorcerer',
  [PlayerClass.Pyromancer]: 'Pyromancer',
  [PlayerClass.Cleric]: 'Cleric',
  [PlayerClass.Deprived]: 'Deprived'
};

// Starting stats for each class (from Fextralife wiki)
export interface ClassStats {
  level: number;
  vigor: number;
  attunement: number;
  endurance: number;
  vitality: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  faith: number;
  luck: number;
  totalStatsAtZero: number; // Sum of stats - starting level
}

export const CLASS_STARTING_STATS: Record<PlayerClass, ClassStats> = {
  [PlayerClass.Knight]: {
    level: 9,
    vigor: 12,
    attunement: 10,
    endurance: 11,
    vitality: 15,
    strength: 13,
    dexterity: 12,
    intelligence: 9,
    faith: 9,
    luck: 7,
    totalStatsAtZero: 89 // 12+10+11+15+13+12+9+9+7 = 98, 98-9 = 89
  },
  [PlayerClass.Mercenary]: {
    level: 8,
    vigor: 11,
    attunement: 12,
    endurance: 11,
    vitality: 10,
    strength: 10,
    dexterity: 16,
    intelligence: 10,
    faith: 8,
    luck: 9,
    totalStatsAtZero: 89 // 11+12+11+10+10+16+10+8+9 = 97, 97-8 = 89
  },
  [PlayerClass.Warrior]: {
    level: 7,
    vigor: 14,
    attunement: 6,
    endurance: 12,
    vitality: 11,
    strength: 16,
    dexterity: 9,
    intelligence: 8,
    faith: 9,
    luck: 11,
    totalStatsAtZero: 89 // 14+6+12+11+16+9+8+9+11 = 96, 96-7 = 89
  },
  [PlayerClass.Herald]: {
    level: 9,
    vigor: 12,
    attunement: 10,
    endurance: 9,
    vitality: 12,
    strength: 12,
    dexterity: 11,
    intelligence: 8,
    faith: 13,
    luck: 11,
    totalStatsAtZero: 89 // 12+10+9+12+12+11+8+13+11 = 98, 98-9 = 89
  },
  [PlayerClass.Thief]: {
    level: 5,
    vigor: 10,
    attunement: 11,
    endurance: 10,
    vitality: 9,
    strength: 9,
    dexterity: 13,
    intelligence: 10,
    faith: 8,
    luck: 14,
    totalStatsAtZero: 89 // 10+11+10+9+9+13+10+8+14 = 94, 94-5 = 89
  },
  [PlayerClass.Assassin]: {
    level: 10,
    vigor: 10,
    attunement: 14,
    endurance: 11,
    vitality: 10,
    strength: 10,
    dexterity: 14,
    intelligence: 11,
    faith: 9,
    luck: 10,
    totalStatsAtZero: 89 // 10+14+11+10+10+14+11+9+10 = 99, 99-10 = 89
  },
  [PlayerClass.Sorcerer]: {
    level: 6,
    vigor: 9,
    attunement: 16,
    endurance: 9,
    vitality: 7,
    strength: 7,
    dexterity: 12,
    intelligence: 16,
    faith: 7,
    luck: 12,
    totalStatsAtZero: 89 // 9+16+9+7+7+12+16+7+12 = 95, 95-6 = 89
  },
  [PlayerClass.Pyromancer]: {
    level: 8,
    vigor: 11,
    attunement: 12,
    endurance: 10,
    vitality: 8,
    strength: 12,
    dexterity: 9,
    intelligence: 14,
    faith: 14,
    luck: 7,
    totalStatsAtZero: 89 // 11+12+10+8+12+9+14+14+7 = 97, 97-8 = 89
  },
  [PlayerClass.Cleric]: {
    level: 7,
    vigor: 10,
    attunement: 14,
    endurance: 9,
    vitality: 7,
    strength: 12,
    dexterity: 8,
    intelligence: 7,
    faith: 16,
    luck: 13,
    totalStatsAtZero: 89 // 10+14+9+7+12+8+7+16+13 = 96, 96-7 = 89
  },
  [PlayerClass.Deprived]: {
    level: 1,
    vigor: 10,
    attunement: 10,
    endurance: 10,
    vitality: 10,
    strength: 10,
    dexterity: 10,
    intelligence: 10,
    faith: 10,
    luck: 10,
    totalStatsAtZero: 89 // 10*9 = 90, 90-1 = 89
  }
};

// HP calculation table from Vigor (collected via Cheat Engine)
export const VIGOR_TO_HP: Record<number, number> = {
  1: 300, 2: 301, 3: 305, 4: 311, 5: 320,
  6: 331, 7: 345, 8: 362, 9: 381, 10: 403,
  11: 427, 12: 454, 13: 483, 14: 515, 15: 550,
  16: 594, 17: 638, 18: 681, 19: 723, 20: 764,
  21: 804, 22: 842, 23: 879, 24: 914, 25: 947,
  26: 977, 27: 1000, 28: 1019, 29: 1038, 30: 1056,
  31: 1074, 32: 1092, 33: 1109, 34: 1125, 35: 1141,
  36: 1157, 37: 1172, 38: 1186, 39: 1200, 40: 1213,
  41: 1226, 42: 1238, 43: 1249, 44: 1260, 45: 1269,
  46: 1278, 47: 1285, 48: 1292, 49: 1297, 50: 1300,
  51: 1302, 52: 1304, 53: 1307, 54: 1309, 55: 1312,
  56: 1314, 57: 1316, 58: 1319, 59: 1321, 60: 1323,
  61: 1326, 62: 1328, 63: 1330, 64: 1333, 65: 1335,
  66: 1337, 67: 1340, 68: 1342, 69: 1344, 70: 1346,
  71: 1348, 72: 1351, 73: 1353, 74: 1355, 75: 1357,
  76: 1359, 77: 1361, 78: 1363, 79: 1365, 80: 1367,
  81: 1369, 82: 1371, 83: 1373, 84: 1375, 85: 1377,
  86: 1379, 87: 1381, 88: 1383, 89: 1385, 90: 1386,
  91: 1388, 92: 1390, 93: 1391, 94: 1393, 95: 1395,
  96: 1396, 97: 1397, 98: 1399, 99: 1400
};

// FP calculation table from Attunement (collected via Cheat Engine)
export const ATTUNEMENT_TO_FP: Record<number, number> = {
  1: 50, 2: 53, 3: 58, 4: 62, 5: 67,
  6: 72, 7: 77, 8: 82, 9: 87, 10: 93,
  11: 98, 12: 103, 13: 109, 14: 114, 15: 120,
  16: 124, 17: 130, 18: 136, 19: 143, 20: 150,
  21: 157, 22: 165, 23: 173, 24: 181, 25: 189,
  26: 198, 27: 206, 28: 215, 29: 224, 30: 233,
  31: 242, 32: 251, 33: 260, 34: 270, 35: 280,
  36: 283, 37: 286, 38: 289, 39: 293, 40: 296,
  41: 299, 42: 302, 43: 305, 44: 309, 45: 312,
  46: 315, 47: 318, 48: 320, 49: 323, 50: 326,
  51: 329, 52: 332, 53: 334, 54: 337, 55: 339,
  56: 342, 57: 344, 58: 346, 59: 348, 60: 350,
  61: 352, 62: 355, 63: 358, 64: 361, 65: 364,
  66: 366, 67: 369, 68: 372, 69: 375, 70: 377,
  71: 380, 72: 383, 73: 385, 74: 388, 75: 391,
  76: 394, 77: 396, 78: 399, 79: 402, 80: 404,
  81: 407, 82: 409, 83: 412, 84: 415, 85: 417,
  86: 420, 87: 422, 88: 425, 89: 427, 90: 430,
  91: 432, 92: 434, 93: 437, 94: 439, 95: 441,
  96: 444, 97: 446, 98: 448, 99: 450
};

// Stamina calculation table from Endurance (collected via Cheat Engine)
export const ENDURANCE_TO_STAMINA: Record<number, number> = {
  1: 83, 2: 84, 3: 85, 4: 86, 5: 87,
  6: 88, 7: 89, 8: 91, 9: 92, 10: 94,
  11: 95, 12: 97, 13: 98, 14: 100, 15: 102,
  16: 104, 17: 106, 18: 108, 19: 110, 20: 112,
  21: 114, 22: 116, 23: 118, 24: 120, 25: 122,
  26: 125, 27: 127, 28: 129, 29: 132, 30: 134,
  31: 136, 32: 139, 33: 141, 34: 144, 35: 146,
  36: 149, 37: 152, 38: 154, 39: 157, 40: 160,
  41: 160, 42: 160, 43: 160, 44: 160, 45: 160,
  46: 161, 47: 161, 48: 161, 49: 161, 50: 161,
  51: 161, 52: 162, 53: 162, 54: 162, 55: 162,
  56: 162, 57: 162, 58: 163, 59: 163, 60: 163,
  61: 163, 62: 163, 63: 163, 64: 164, 65: 164,
  66: 164, 67: 164, 68: 164, 69: 164, 70: 165,
  71: 165, 72: 165, 73: 165, 74: 165, 75: 165,
  76: 166, 77: 166, 78: 166, 79: 166, 80: 166,
  81: 166, 82: 167, 83: 167, 84: 167, 85: 167,
  86: 167, 87: 167, 88: 168, 89: 168, 90: 168,
  91: 168, 92: 168, 93: 168, 94: 169, 95: 169,
  96: 169, 97: 169, 98: 169, 99: 170
};

// Covenant badge inventory bytes — collected from game saves via Cheat Engine.
// byte13_upper: upper nibble of inventory byte 13 (item-specific, game validates it)
// byte14, byte15: inventory bytes 14-15 (item-specific, game validates it)
export const COVENANT_BADGE_INVENTORY: Record<number, { byte13_upper: number; byte14: number; byte15: number }> = {
  0x20002710: { byte13_upper: 0x0, byte14: 0x8A, byte15: 0x02 }, // Blade of the Darkmoon
  0x20002724: { byte13_upper: 0xC, byte14: 0x9C, byte15: 0x02 }, // Watchdogs of Farron
  0x2000272E: { byte13_upper: 0x0, byte14: 0xA3, byte15: 0x02 }, // Aldrich Faithful
  0x20002738: { byte13_upper: 0x4, byte14: 0x77, byte15: 0x02 }, // Warrior of Sunlight
  0x20002742: { byte13_upper: 0x8, byte14: 0x96, byte15: 0x02 }, // Mound-Makers
  0x2000274C: { byte13_upper: 0x8, byte14: 0x7D, byte15: 0x02 }, // Way of Blue
  0x20002756: { byte13_upper: 0xC, byte14: 0x83, byte15: 0x02 }, // Blue Sentinel
  0x20002760: { byte13_upper: 0x4, byte14: 0x90, byte15: 0x02 }, // Rosaria's Fingers
  0x2000276A: { byte13_upper: 0x4, byte14: 0xA9, byte15: 0x02 }, // Spears of the Church
};

// ===========================================================================
// APPEARANCE
// ===========================================================================
// Offsets come from DS3_TGA_v3.4.0.CT (group "Appearance" and the
// "Save / Restore Current FaceData" script; the table is maintained by
// The Grand Archives), then verified against
// real saves with ds3-appearance-sweeper: a marker run wrote a distinct value
// into every slider and all 111 of them came back out of the .sl2, and a
// memory-vs-save comparison matched 122 of 122 fields.
//
// In memory the data lives at PlayerGameData ([[GameDataMan]+0x10]) + 0x6B8.
// The CT script saves 192 bytes of it, but the block is longer: the last 16
// bytes (Lipstick, Laugh Lines, Skin Tone, Skin Color Layers...) also travel
// into the save, proven when a crashed run left marker values there and the
// next save wrote exactly those. So the block is 0x6B8..0x787 = 208 bytes.
//
// gender/voice are NOT part of it — they sit in the stat block, next to CLASS.
export const FACE_BLOCK_SIZE = 0xD0;

/**
 * The face block has no fixed offset — it moves between characters and even
 * between two saves of the same character (one save had the gesture table at
 * the address the face block occupied three minutes earlier). It is located the
 * way the bonfire block and the gesture table are: a coarse estimate off the
 * bonfire block, a windowed signature search, and a full scan as the fallback.
 *
 * Measured on 99 characters across 15 files (4 profiles plus editor backups):
 * the delta from the bonfire block stays within -0xA153..-0xA337, and the
 * midpoint below put exactly one candidate in the window every single time.
 */
export const FACE_COARSE_FROM_BONFIRE = -0xA245;
export const FACE_SEARCH_RADIUS = 0x800;

/**
 * Structural signature of the block, used to recognise it without knowing the
 * character's appearance: nine u32 model IDs whose values are small (so the top
 * three bytes of each are zero), followed by nine RGBA colors whose alpha byte
 * is always 0xFF. 27 zero bytes and 9 0xFF bytes in fixed positions.
 *
 * A full scan finds more matches — clusters spaced 0x1B8 apart, up to 40 in a
 * levelled character's slot, which look like a cache of other players' faces.
 * The window is what keeps the right one, so never take "first match in slot".
 */
export const FACE_ID_COUNT = 9;
export const FACE_COLOR_COUNT = 9;
export const FACE_COLORS_OFFSET = 0x24;

/**
 * Model IDs (u32 each). These are NOT free-form numbers: the value indexes a
 * model table, and an out-of-range one makes the game load a nonexistent asset
 * and crash — that is exactly how the first sweep run ended. The editor must
 * only ever offer values seen in real saves.
 *
 * Observed across 81 characters: Hair 3/6/9/106/108/111 (111 is the last entry
 * in the in-game list), Eyebrows 1/12, Eyelashes 2/3, Pupils 0/5, Tattoo 0/20,
 * Beard 0. Age reads 0 or 1 (and 100 in four edited saves) although the CT
 * dropdown claims 0..3, so its dropdown is not trustworthy either.
 */
/**
 * Face block byte 0 is not a model ID at all — it packs three separate character
 * creation settings into decimal digits:
 *
 *     value = 100 * muscular + 10 * chestHair + age      (age 0..2)
 *
 * The Cheat Engine table calls the whole byte "Age" with a 0..3 dropdown, which
 * is why real saves looked like they held nonsense (0, 1, 100, 110, 111, 112).
 * Each digit was confirmed on its own in the character creator: toggling the
 * muscular build flipped 112 <-> 12, chest hair flipped 112 <-> 102, and the age
 * option cycled the last digit through 0, 1, 2 — every time leaving the other
 * digits untouched. That makes 12 valid values, and the editor shows the three
 * settings separately rather than the number.
 */
export const FACE_BUILD_OFFSET = 0x00;
export const FACE_AGE_NAMES = ['Young', 'Mature', 'Aged'] as const;

/**
 * The eyes have three controls in the character creator, not two: "Pupils"
 * alongside "Left Pupil" and "Right Pupil". The pair one is not a field of its
 * own — watching memory while it is used shows it writing both eyes at once,
 * shape and color together, always to the same value. So the editor offers the
 * same pair control on top of the two real fields.
 */
export const FACE_PUPIL_ID_OFFSETS = [0x08, 0x0C] as const;
export const FACE_PUPIL_COLOR_OFFSETS = [0x2C, 0x30] as const;

/**
 * The ids and the colors are two parallel lists in the same order, so each
 * index is one "part plus its color": build/skin, hair, left eye, right eye,
 * brows, beard, ???, tattoo, eyelashes.
 *
 * Index 6 is the odd one out and the editor leaves it alone. Across 82
 * characters from four profiles its id is always 0 and its color always
 * 00 00 00 FF, with no exception — while the tattoo next to it does vary, and
 * even keeps a color while its id is 0, which is what a used-but-disabled slot
 * looks like. Nothing in the character creator touched it in any capture run
 * either. It reads as a slot the structure reserves and the game never fills,
 * and since neither its meaning nor its valid ids are known, offering it would
 * be the same crash risk as any other unverified model id.
 */
export const FACE_UNUSED_ID_OFFSET = 0x18;
export const FACE_UNUSED_COLOR_OFFSET = 0x3C;

export const APPEARANCE_IDS: ReadonlyArray<{ offset: number; label: string }> = [
  { offset: 0x04, label: 'Hair' },
  { offset: 0x08, label: 'Left Pupil' },
  { offset: 0x0C, label: 'Right Pupil' },
  { offset: 0x10, label: 'Eyebrows' },
  { offset: 0x14, label: 'Beard' },
  { offset: 0x1C, label: 'Tattoo / Mark' },
  { offset: 0x20, label: 'Eyelashes' },
];

const idRange = (from: number, to: number, missing: number[] = []): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i).filter((v) => !missing.includes(v));

/**
 * The model IDs the game actually has, per face-block offset.
 *
 * These were read off the game itself: ds3-appearance-sweeper's `--watch-ids`
 * polls the field while the list is scrolled in the appearance menu, so every
 * value here is one the game selected on its own. Nothing is interpolated —
 * the IDs are sparse and a value with no model behind it crashes the game on
 * load, so the lists say exactly what was seen and nothing more.
 *
 * Two things the ranges alone would get wrong:
 *
 * - Hair is not one run. It is 0..11 and 101..112, 24 styles in two families,
 *   which matches the 24 entries the in-game list offers.
 * - Tattoo / Mark runs 0..55 but genuinely skips 11, 12, 16, 19, 31 and 46 —
 *   two independent passes over the whole list produced the same 50 values and
 *   the same six holes, so those IDs do not exist.
 *
 * Byte 0 is absent on purpose: it is not an ID but three packed settings, see
 * FACE_BUILD_OFFSET.
 */
export const APPEARANCE_ID_VALUES: Readonly<Record<number, number[]>> = {
  0x04: [...idRange(0, 11), ...idRange(101, 112)],  // Hair, 24 styles
  0x08: idRange(0, 8),                              // Left Pupil
  0x0C: idRange(0, 8),                              // Right Pupil
  0x10: idRange(0, 16),                             // Eyebrows
  0x14: idRange(0, 11),                             // Beard
  0x1C: idRange(0, 55, [11, 12, 16, 19, 31, 46]),   // Tattoo / Mark, 50 marks
  0x20: idRange(0, 3),                              // Eyelashes
};

/** Colors are RGBA; only RGB is editable, alpha is always 0xFF. */
export const APPEARANCE_COLORS: ReadonlyArray<{ offset: number; label: string }> = [
  { offset: 0x24, label: 'Skin' },
  { offset: 0x28, label: 'Hair' },
  { offset: 0x2C, label: 'Left Pupil' },
  { offset: 0x30, label: 'Right Pupil' },
  { offset: 0x34, label: 'Eyebrows' },
  { offset: 0x38, label: 'Beard' },
  { offset: 0x40, label: 'Tattoo / Mark' },
  { offset: 0x44, label: 'Eyelashes' },
];

/**
 * Appearance preset file — our own format, the way DS1 has .dsrchr.
 *
 *   0x00   4   magic "D3CH"
 *   0x04   1   version
 *   0x05   1   gender
 *   0x06   1   voice
 *   0x07   1   reserved
 *   0x08 208   the face block verbatim
 *
 * Everything that defines a look lives in the face block, so a preset is lossless.
 * The Cheat Engine table's own preset format is deliberately not used: it stores
 * 192 bytes of face data and drops the last 16 (Lipstick 1/2, Laugh Lines, Nasal
 * Size, Nose Bridge Color, Skin Tone, Skin Color Layers 1-4), and its <body> tag
 * holds the runtime float scales that never reach the save at all.
 *
 * The magic exists because a headerless file would be indistinguishable from a
 * DS1 .dsrchr, and loading one into DS3 would quietly write garbage into a face.
 */
export const APPEARANCE_PRESET_MAGIC = 'D3CH';
export const APPEARANCE_PRESET_VERSION = 1;
export const APPEARANCE_PRESET_HEADER_SIZE = 8;
export const APPEARANCE_PRESET_SIZE = APPEARANCE_PRESET_HEADER_SIZE + FACE_BLOCK_SIZE;
export const APPEARANCE_PRESET_EXTENSION = '.ds3chr';

/** Plain 0..255 sliders — anything here is safe to set to any byte value. */
export const APPEARANCE_SLIDERS: ReadonlyArray<{ offset: number; label: string; group: string }> = [
  { offset: 0x48, label: 'Position, Horizontal', group: 'Tattoo / Mark' },
  { offset: 0x49, label: 'Position, Vertical', group: 'Tattoo / Mark' },
  { offset: 0x4A, label: 'Rotation', group: 'Tattoo / Mark' },
  { offset: 0x4B, label: 'Size', group: 'Tattoo / Mark' },
  { offset: 0x4C, label: 'Head', group: 'Body Proportions' },
  { offset: 0x4D, label: 'Chest', group: 'Body Proportions' },
  { offset: 0x4E, label: 'Abdomen', group: 'Body Proportions' },
  { offset: 0x4F, label: 'Upper Arms', group: 'Body Proportions' },
  { offset: 0x50, label: 'Thighs', group: 'Body Proportions' },
  { offset: 0x51, label: 'Forearms', group: 'Body Proportions' },
  { offset: 0x52, label: 'Calves', group: 'Body Proportions' },
  { offset: 0x66, label: 'Apparent Age', group: 'Features' },
  { offset: 0x67, label: 'Facial Aesthetic', group: 'Features' },
  { offset: 0x68, label: 'Form Emphasis', group: 'Features' },
  { offset: 0x6A, label: 'Brow Ridge Height', group: 'Brow Ridge' },
  { offset: 0x6B, label: 'Inner Brow Ridge', group: 'Brow Ridge' },
  { offset: 0x6C, label: 'Outer Brow Ridge', group: 'Brow Ridge' },
  { offset: 0x6D, label: 'Cheekbone Height', group: 'Cheeks' },
  { offset: 0x6E, label: 'Cheekbone Depth', group: 'Cheeks' },
  { offset: 0x6F, label: 'Cheekbone Width', group: 'Cheeks' },
  { offset: 0x70, label: 'Cheekbone Prominence', group: 'Cheeks' },
  { offset: 0x71, label: 'Cheek Fullness', group: 'Cheeks' },
  { offset: 0x72, label: 'Chin Tip Position', group: 'Chin' },
  { offset: 0x73, label: 'Chin Length', group: 'Chin' },
  { offset: 0x74, label: 'Chin Protrusion', group: 'Chin' },
  { offset: 0x75, label: 'Chin Depth', group: 'Chin' },
  { offset: 0x76, label: 'Chin Size', group: 'Chin' },
  { offset: 0x77, label: 'Chin Height', group: 'Chin' },
  { offset: 0x78, label: 'Chin Width', group: 'Chin' },
  { offset: 0x79, label: 'Eye Position', group: 'Eyes' },
  { offset: 0x7A, label: 'Eye Size', group: 'Eyes' },
  { offset: 0x7B, label: 'Eye Slant', group: 'Eyes' },
  { offset: 0x7C, label: 'Eye Spacing', group: 'Eyes' },
  { offset: 0x7D, label: 'Nose Size', group: 'Facial Balance' },
  { offset: 0x7E, label: 'Nose/Forehead Ratio', group: 'Facial Balance' },
  { offset: 0x80, label: 'Face Protrusion', group: 'Facial Balance' },
  { offset: 0x81, label: 'Vertical Facial Spacing', group: 'Facial Balance' },
  { offset: 0x82, label: 'Facial Feature Slant', group: 'Facial Balance' },
  { offset: 0x83, label: 'Horizontal Facial Spacing', group: 'Facial Balance' },
  { offset: 0x85, label: 'Forehead Depth', group: 'Forehead & Glabella' },
  { offset: 0x86, label: 'Forehead Protrusion', group: 'Forehead & Glabella' },
  { offset: 0x88, label: 'Jaw Position', group: 'Jaw' },
  { offset: 0x89, label: 'Jaw Width', group: 'Jaw' },
  { offset: 0x8A, label: 'Lower Jaw', group: 'Jaw' },
  { offset: 0x8B, label: 'Jaw Contour', group: 'Jaw' },
  { offset: 0x8C, label: 'Lip Shape', group: 'Lips' },
  { offset: 0x8D, label: 'Mouth Expression', group: 'Lips' },
  { offset: 0x8E, label: 'Lip Fullness', group: 'Lips' },
  { offset: 0x8F, label: 'Lip Size', group: 'Lips' },
  { offset: 0x90, label: 'Lip Protrusion', group: 'Lips' },
  { offset: 0x92, label: 'Mouth Protrusion', group: 'Mouth' },
  { offset: 0x93, label: 'Mouth Slant', group: 'Mouth' },
  { offset: 0x94, label: 'Occlusion', group: 'Mouth' },
  { offset: 0x95, label: 'Mouth Position', group: 'Mouth' },
  { offset: 0x96, label: 'Mouth Width', group: 'Mouth' },
  { offset: 0x97, label: 'Mouth-Chin Distance', group: 'Mouth' },
  { offset: 0x98, label: 'Nose Ridge Depth', group: 'Nose Ridge' },
  { offset: 0x99, label: 'Nose Ridge Length', group: 'Nose Ridge' },
  { offset: 0x9A, label: 'Nose Position', group: 'Nose Ridge' },
  { offset: 0x9B, label: 'Nose Tip Height', group: 'Nose Ridge' },
  { offset: 0x9C, label: 'Nostril Slant', group: 'Nostrils' },
  { offset: 0x9D, label: 'Nostril Size', group: 'Nostrils' },
  { offset: 0x9E, label: 'Nostril Width', group: 'Nostrils' },
  { offset: 0x9F, label: 'Nose Protrusion', group: 'Nose Ridge' },
  { offset: 0xA0, label: 'Nose Bridge Height', group: 'Forehead & Glabella' },
  { offset: 0xA1, label: 'Bridge Protrusion 1', group: 'Forehead & Glabella' },
  { offset: 0xA2, label: 'Bridge Protrusion 2', group: 'Forehead & Glabella' },
  { offset: 0xA3, label: 'Nose Bridge Width', group: 'Forehead & Glabella' },
  { offset: 0xA4, label: 'Nose Height', group: 'Nose Ridge' },
  { offset: 0xA5, label: 'Nose Slant', group: 'Nose Ridge' },
  { offset: 0xAD, label: 'Cheek Color', group: 'Skin' },
  { offset: 0xAE, label: 'Tone Around Eyes', group: 'Cosmetics' },
  { offset: 0xAF, label: 'Eye Socket', group: 'Cosmetics' },
  { offset: 0xB9, label: 'Eyelid Brightness', group: 'Cosmetics' },
  { offset: 0xBA, label: 'Eyelid Color', group: 'Cosmetics' },
  { offset: 0xBB, label: 'Eyeliner', group: 'Cosmetics' },
  { offset: 0xBC, label: 'Eye Shadow', group: 'Cosmetics' },
  { offset: 0xC1, label: 'Lipstick 1', group: 'Cosmetics' },
  { offset: 0xC2, label: 'Lipstick 2', group: 'Cosmetics' },
  { offset: 0xC3, label: 'Laugh Lines', group: 'Skin' },
  { offset: 0xC4, label: 'Nasal Size', group: 'Nostrils' },
  { offset: 0xC5, label: 'Nose Bridge Color', group: 'Skin' },
  { offset: 0xC6, label: 'Skin Color Layer 4', group: 'Skin' },
  { offset: 0xC7, label: 'Skin Tone', group: 'Skin' },
  { offset: 0xC8, label: 'Skin Color Layer 1', group: 'Skin' },
  { offset: 0xC9, label: 'Skin Color Layer 2', group: 'Skin' },
  { offset: 0xCA, label: 'Skin Color Layer 3', group: 'Skin' },

  // Three bytes the reference table has no entry for, but the game does drive:
  // switching between the built-in face presets rewrote 81 bytes of the block
  // and these were among them. 0x91 sits between Lip Protrusion and Mouth
  // Protrusion, 0xAB/0xAC just ahead of Cheek Color. What each does is unknown,
  // hence the offsets for names — but they are part of the look, so leaving them
  // out would mean the editor cannot reproduce a face the game can.
  //
  // The other 46 undescribed bytes of the block stayed put through the same
  // preset sweep, so they are not exposed.
  { offset: 0x91, label: 'Unnamed 0x91', group: 'Unlabelled' },
  { offset: 0xAB, label: 'Unnamed 0xAB', group: 'Unlabelled' },
  { offset: 0xAC, label: 'Unnamed 0xAC', group: 'Unlabelled' },
];  // 90
