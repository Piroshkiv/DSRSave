import { Character } from './Character';
import { SaveFileEditor } from './SaveFileEditor';

/**
 * The slice of an editor a slot import needs.
 * Structural so the Nintendo and PS4 editors qualify without inheriting.
 */
export interface SlotEditor {
  getCharacters(): Character[];
}

/** Load screen entry (name, level, class shown on the load menu) per slot. */
const LOAD_SCREEN_BASE = 0xC0;
const LOAD_SCREEN_SIZE = 400;

/**
 * Occupied flags, one byte per slot (0 = empty, 1 = occupied).
 *
 * These ten bytes sit *inside* slot 0's load screen block (0xC0..0x24F), so any
 * write of that block carries the flag array of all ten slots with it. Verified
 * on a real save: slots 0-5 populated reads `01 01 01 01 01 01 00 00 00 00`.
 */
const OCCUPIED_FLAG_BASE = 0xC4;
const SLOT_COUNT = 10;

/** Snapshot the occupied flags so a load screen write cannot take them along. */
function readOccupiedFlags(metadata: Character): number[] {
  return Array.from({ length: SLOT_COUNT }, (_, i) => metadata.getByte(OCCUPIED_FLAG_BASE + i));
}

function writeOccupiedFlags(metadata: Character, flags: number[]): void {
  flags.forEach((value, i) => metadata.setByte(OCCUPIED_FLAG_BASE + i, value));
}

/**
 * Copy one slot's 400-byte load screen entry, leaving every slot's occupied
 * flag as it was in the destination.
 */
function writeLoadScreenBlock(metadata: Character, destSlot: number, block: Uint8Array): void {
  const flags = readOccupiedFlags(metadata);
  const patternTo = LOAD_SCREEN_BASE + LOAD_SCREEN_SIZE * destSlot;
  const raw = metadata.getRawData();

  for (let i = 0; i < LOAD_SCREEN_SIZE && (patternTo + i) < raw.length; i++) {
    metadata.setByte(patternTo + i, block[i]);
  }

  writeOccupiedFlags(metadata, flags);
}

/**
 * Export a character slot to a binary file
 *
 * @param character Character to export
 * @returns Blob with character data
 */
export function exportSlotToBinary(character: Character): Blob {
  const slotData = character.getRawData();
  return new Blob([new Uint8Array(slotData)], { type: 'application/octet-stream' });
}

/**
 * Download a character slot as a .bin.dsrslot file
 *
 * @param character Character to download
 */
export function downloadSlot(character: Character): void {
  const blob = exportSlotToBinary(character);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const charName = character.name || 'unnamed';
  link.download = `${charName}.bin.dsrslot`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import a character slot from binary data
 * Only sets the slot occupied flag, does NOT copy load screen metadata
 *
 * @param destEditor Destination save file editor
 * @param slotData Binary slot data
 * @param destSlot Destination slot number (0-9)
 */
export function importSlotFromBinary(
  destEditor: SlotEditor,
  slotData: Uint8Array,
  destSlot: number
): void {
  if (destSlot < 0 || destSlot >= 10) {
    throw new Error('Destination slot must be between 0 and 9');
  }

  const destChars = destEditor.getCharacters();

  // Create new Character with imported data
  const newChar = new Character(slotData, destSlot);

  // Replace destination character
  const destCharIndex = destChars.findIndex(c => c.slotNumber === destSlot);
  if (destCharIndex !== -1) {
    destChars[destCharIndex] = newChar;
  }

  const destMetadata = destChars[10];
  if (destMetadata) {
    // Only the occupied flag: the load screen entry is cosmetic and the game
    // rewrites it. (0 = empty, 1 = occupied)
    destMetadata.setByte(OCCUPIED_FLAG_BASE + destSlot, 1);
  }
}

/**
 * Copy a character from one slot to another slot
 * Based on DSRSaveSlotDuplicator logic
 *
 * @param sourceEditor Source save file editor
 * @param destEditor Destination save file editor
 * @param sourceSlot Source slot number (0-9)
 * @param destSlot Destination slot number (0-9)
 */
export function copyCharacterSlot(
  sourceEditor: SaveFileEditor,
  destEditor: SaveFileEditor,
  sourceSlot: number,
  destSlot: number
): void {
  if (sourceSlot < 0 || sourceSlot >= 10) {
    throw new Error('Source slot must be between 0 and 9');
  }

  if (destSlot < 0 || destSlot >= 10) {
    throw new Error('Destination slot must be between 0 and 9');
  }

  const sourceChars = sourceEditor.getCharacters();
  const destChars = destEditor.getCharacters();

  const sourceChar = sourceChars[sourceSlot];

  if (!sourceChar) {
    throw new Error('Source character not found');
  }

  if (sourceChar.isEmpty) {
    throw new Error('Source slot is empty');
  }

  // Step 1: Copy the character data to destination slot
  // Create new Character with source data but destination slot number
  const sourceRawData = sourceChar.getRawData();
  const newCharData = new Uint8Array(sourceRawData);
  const newChar = new Character(newCharData, destSlot);

  // Replace destination character
  const destCharIndex = destChars.findIndex(c => c.slotNumber === destSlot);
  if (destCharIndex !== -1) {
    destChars[destCharIndex] = newChar;
  }

  // Step 2: Copy load screen data (slot 10 contains metadata)
  // This is what you see when you click load game (name, level...)
  const sourceMetadata = sourceChars[10]; // Slot 10 is metadata slot
  const destMetadata = destChars[10];

  if (sourceMetadata && destMetadata) {
    const patternFrom = LOAD_SCREEN_BASE + LOAD_SCREEN_SIZE * sourceSlot;
    const block = sourceMetadata.getRawData().slice(patternFrom, patternFrom + LOAD_SCREEN_SIZE);

    // Copy 400 bytes of load screen data, keeping the destination's own flags
    writeLoadScreenBlock(destMetadata, destSlot, block);

    // Step 3: Set flag that slot is not empty (0 = empty, 1 = not empty)
    destMetadata.setByte(OCCUPIED_FLAG_BASE + destSlot, 1);
  }
}

/**
 * Duplicate a character within the same save file
 *
 * @param editor Save file editor
 * @param sourceSlot Source slot number (0-9)
 * @param destSlot Destination slot number (0-9)
 */
export function duplicateCharacterSlot(
  editor: SaveFileEditor,
  sourceSlot: number,
  destSlot: number
): void {
  copyCharacterSlot(editor, editor, sourceSlot, destSlot);
}
