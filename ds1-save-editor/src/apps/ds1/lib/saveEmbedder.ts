import { SaveFileEditor } from './SaveFileEditor';
import { copyCharacterSlot } from './slotDuplicator';

export type EmbedMode = 'character';

/**
 * Fix save slot by copying default slot 0 structure and restoring user data
 *
 * Process:
 * 1. Save a copy of the selected user slot
 * 2. Copy slot 0 from default save into the selected user slot (complete replacement)
 * 3. Restore user data from the saved copy back into the slot
 *
 * @param defaultSaveEditor - The default save editor (DRAKS0005.sl2) - source of slot 0
 * @param userSaveEditor - The user's save editor - will be modified
 * @param userSlotIndex - The slot index in user's save to fix (0-9)
 * @param mode - What to restore: 'character'
 * @returns Modified user save editor with fixed slot
 */
export async function embedSaveData(
  defaultSaveEditor: SaveFileEditor,
  userSaveEditor: SaveFileEditor,
  userSlotIndex: number,
  mode: EmbedMode
): Promise<SaveFileEditor> {
  // Get characters
  const defaultChars = defaultSaveEditor.getCharacters();
  const userChars = userSaveEditor.getCharacters();

  const userSlot = userChars[userSlotIndex];
  const defaultSlot0 = defaultChars[0];

  if (!userSlot) {
    throw new Error(`User save slot ${userSlotIndex} not found`);
  }

  if (userSlot.isEmpty) {
    throw new Error(`User save slot ${userSlotIndex} is empty`);
  }

  if (!defaultSlot0) {
    throw new Error('Default save slot 0 not found');
  }

  console.log('=== Starting Save Slot Fix ===');
  console.log(`Mode: ${mode}`);
  console.log(`Fixing user save slot ${userSlotIndex}`);

  try {
    // Step 1: Save a copy of the user's slot data
    console.log('Step 1: Saving copy of user slot data...');
    const userSlotCopy = new Uint8Array(userSlot.getRawData());

    // Save slot 10 (technical slot) data before copyCharacterSlot modifies it
    const userSlot10 = userChars[10];
    const userSlot10Copy = userSlot10 ? new Uint8Array(userSlot10.getRawData()) : null;

    // Step 2: Copy slot 0 from default save into the user's selected slot (complete replacement)
    console.log('Step 2: Copying default slot 0 into user slot (complete replacement)...');
    copyCharacterSlot(defaultSaveEditor, userSaveEditor, 0, userSlotIndex);

    // Restore slot 10 data (we don't want to modify the technical slot)
    if (userSlot10 && userSlot10Copy) {
      for (let i = 0; i < userSlot10Copy.length; i++) {
        userSlot10.setByte(i, userSlot10Copy[i]);
      }
    }

    // Step 3: Restore user data from the saved copy based on mode
    console.log('Step 3: Restoring user data from saved copy...');
    const fixedSlot = userChars[userSlotIndex];

    if (mode === 'character') {
      console.log('Restoring character data (0x00-0x1E470)...');
      const CHARACTER_DATA_SIZE = 0x1e470;
      const bytesToCopy = Math.min(CHARACTER_DATA_SIZE, userSlotCopy.length);

      for (let i = 0; i < bytesToCopy; i++) {
        fixedSlot.setByte(i, userSlotCopy[i]);
      }
      console.log(`Restored ${bytesToCopy} bytes of character data`);
    }

    console.log('=== Save Slot Fix Complete ===');

    // Return the modified user save editor (it will recalculate signature when exporting)
    return userSaveEditor;
  } catch (error) {
    console.error('Error during save fix:', error);
    throw error;
  }
}
