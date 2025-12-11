
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
  SOULS: -0xDC,
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

  NG_CYCLE: -0x6,
  ESTUS_MAX: -0x4E,
  ASHEN_ESTUS_MAX: -0x4D,
  CLASS: -0xA2,
} as const;

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
