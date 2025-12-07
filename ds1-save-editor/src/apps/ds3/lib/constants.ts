// Dark Souls 3 Save File Constants
// Based on BND4 format with AES-CBC encryption

// BND4 File Format Constants
export const BND4_HEADER_SIZE = 0x40;
export const ENTRY_HEADER_SIZE = 0x20;
export const BND4_SIGNATURE = [0x42, 0x4E, 0x44, 0x34]; // "BND4"

// AES Encryption Key (from DS3SaveEditor.cs)
export const AES_KEY = new Uint8Array([
  0xFD, 0x46, 0x4D, 0x69, 0x5E, 0x69, 0xA3, 0x9A,
  0x10, 0xE3, 0x19, 0xA7, 0xAC, 0xE8, 0xB7, 0xFA
]);

// Character Data Offsets
export const OFFSETS = {
  // Souls - 4 bytes, Little-Endian (decimal offset: 71100-71103, hex: 0x115DC-0x115DF)
  SOULS: 0x115BC,

  // Future offsets will be added here:
  // NAME: 0x????,
  // LEVEL: 0x????,
  // STATS: { ... }
} as const;

// Maximum values
export const MAX_VALUES = {
  SOULS: 999999999, // Maximum souls (много девяток)
} as const;
