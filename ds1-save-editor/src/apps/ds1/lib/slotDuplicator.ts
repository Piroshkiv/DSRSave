import { Character } from './Character';
import { SaveFileEditor } from './SaveFileEditor';

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
  destEditor: SaveFileEditor,
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

  // Set flag that slot is not empty (0 = empty, 1 = not empty)
  // Only update the occupied flag, NOT the 400 byte load screen metadata
  const destMetadata = destChars[10];
  if (destMetadata) {
    destMetadata.setByte(0xC4 + destSlot, 1);
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
    const destMetadataRaw = destMetadata.getRawData();

    const patternTo = 0xC0 + 400 * destSlot;
    const patternFrom = 0xC0 + 400 * sourceSlot;

    // Copy 400 bytes of load screen data
    for (let i = 0; i < 400 && (patternTo + i) < destMetadataRaw.length; i++) {
      destMetadata.setByte(patternTo + i, sourceMetadata.getByte(patternFrom + i));
    }

    // Step 3: Set flag that slot is not empty (0 = empty, 1 = not empty)
    destMetadata.setByte(0xC4 + destSlot, 1);
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
