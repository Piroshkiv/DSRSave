import { DS3Character } from './Character';
import { SLOT_COUNT, SLOT_SUMMARY_SIZE } from './constants';
import { toArrayBuffer } from '../../../shared/binary';

/**
 * Moving a character between DS3 saves.
 *
 * Three things travel together, and a transfer that skips any of them leaves
 * the destination save subtly wrong:
 *
 *   1. the slot's decrypted bytes — the character itself;
 *   2. its load-menu summary block in the system entry — what the menu shows
 *      before the slot is opened (DS1 calls this the load screen block);
 *   3. the account binding: every populated slot stores the owner's SteamID64,
 *      and the game refuses a character whose ID isn't the running account's.
 *
 * (3) is what makes DS3 different from DS1, where a save carries no account
 * identity at all: an imported slot is always rebound to the destination save's
 * Steam ID, otherwise the character simply won't load for its new owner.
 */

/** The slice of an editor a slot transfer needs. Structural, so tests can fake it. */
export interface DS3SlotEditor {
  getCharacters(): DS3Character[];
  replaceCharacter(slotIndex: number, plainData: Uint8Array): DS3Character;
  getSteamId(): bigint | null;
  canEditSlotFlags(): boolean;
  setSlotActive(slotIndex: number, active: boolean): void;
  readSlotSummary(slotIndex: number): Uint8Array | null;
  writeSlotSummary(slotIndex: number, block: Uint8Array): void;
}

export interface ImportSlotResult {
  /** SteamID64 the imported slot now carries, null when it could not be rebound. */
  steamId: bigint | null;
  /** True when the slot's stored ID was actually rewritten. */
  reboundSteamId: boolean;
  /** True when the load-menu summary came along, so the menu reads correctly at once. */
  summaryCopied: boolean;
}

export interface ImportSlotOptions {
  /**
   * Account to bind the imported character to. Defaults to the destination
   * save's own ID; pass null to leave whatever the slot data carries.
   */
  steamId?: bigint | null;
  /** Load-menu summary block that belongs with these slot bytes. */
  summary?: Uint8Array | null;
  /** Set the slot's active flag (default true — an imported slot should show up). */
  markActive?: boolean;
}

// ===== .bin.ds3slot CONTAINER =====
// A slot file is the raw decrypted slot bytes, optionally followed by the
// load-menu summary block and a trailer that says it is there. Files without
// the trailer are still valid — that is exactly a raw slot dump, which is what
// other DS3 tools produce — so this only ever adds information.
const TRAILER_MAGIC = 'DS3SLOT\0';
const TRAILER_SIZE = 16; // magic (8) + summary size (u32 LE) + format version (u32 LE)
const TRAILER_VERSION = 1;

export interface SlotFile {
  slotData: Uint8Array;
  /** Present only when the file was written with a summary block. */
  summary: Uint8Array | null;
}

export function packSlotFile(slotData: Uint8Array, summary: Uint8Array | null): Uint8Array {
  if (!summary) return new Uint8Array(slotData);

  const out = new Uint8Array(slotData.length + summary.length + TRAILER_SIZE);
  out.set(slotData, 0);
  out.set(summary, slotData.length);

  const trailerAt = slotData.length + summary.length;
  for (let i = 0; i < TRAILER_MAGIC.length; i++) {
    out[trailerAt + i] = TRAILER_MAGIC.charCodeAt(i);
  }
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(trailerAt + 8, summary.length, true);
  view.setUint32(trailerAt + 12, TRAILER_VERSION, true);
  return out;
}

export function unpackSlotFile(bytes: Uint8Array): SlotFile {
  if (bytes.length <= TRAILER_SIZE) return { slotData: bytes, summary: null };

  const trailerAt = bytes.length - TRAILER_SIZE;
  for (let i = 0; i < TRAILER_MAGIC.length; i++) {
    if (bytes[trailerAt + i] !== TRAILER_MAGIC.charCodeAt(i)) {
      return { slotData: bytes, summary: null };
    }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const summarySize = view.getUint32(trailerAt + 8, true);
  if (summarySize === 0 || summarySize > trailerAt) {
    return { slotData: bytes, summary: null };
  }

  return {
    slotData: bytes.slice(0, trailerAt - summarySize),
    summary: bytes.slice(trailerAt - summarySize, trailerAt),
  };
}

/** Export a character slot, with its load-menu summary when the editor has one. */
export function exportSlotToBinary(editor: DS3SlotEditor, slotIndex: number): Blob {
  const character = editor.getCharacters().find(c => c.slotIndex === slotIndex);
  if (!character) throw new Error(`Slot ${slotIndex} is not loaded`);
  if (character.isEmpty) throw new Error(`Slot ${slotIndex + 1} is empty`);

  const packed = packSlotFile(character.getRawData(), editor.readSlotSummary(slotIndex));
  return new Blob([toArrayBuffer(packed)], { type: 'application/octet-stream' });
}

/** Download a character slot as a .bin.ds3slot file. */
export function downloadSlot(editor: DS3SlotEditor, slotIndex: number): void {
  const character = editor.getCharacters().find(c => c.slotIndex === slotIndex);
  const blob = exportSlotToBinary(editor, slotIndex);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${character?.name || 'unnamed'}.bin.ds3slot`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Write slot bytes into a save, rebinding them to that save's account.
 *
 * Nothing reaches the disk here — the caller still has to export the save.
 */
export function importSlotFromBinary(
  editor: DS3SlotEditor,
  slotData: Uint8Array,
  destSlot: number,
  options: ImportSlotOptions = {}
): ImportSlotResult {
  if (destSlot < 0 || destSlot >= SLOT_COUNT) {
    throw new Error('Destination slot must be between 0 and 9');
  }

  const imported = editor.replaceCharacter(destSlot, slotData);

  const steamId = options.steamId !== undefined ? options.steamId : editor.getSteamId();
  const reboundSteamId = steamId !== null && steamId !== undefined
    ? imported.setSteamId(steamId)
    : false;

  if (options.markActive !== false && editor.canEditSlotFlags()) {
    editor.setSlotActive(destSlot, true);
  }

  let summaryCopied = false;
  const summary = options.summary;
  if (summary && summary.length === SLOT_SUMMARY_SIZE) {
    try {
      editor.writeSlotSummary(destSlot, summary);
      summaryCopied = true;
    } catch (error) {
      // A save whose system entry wouldn't decrypt still imports fine; the load
      // menu just stays stale until the character is opened once.
      console.warn('[DS3] Could not copy the load-menu summary:', error);
    }
  }

  return { steamId: steamId ?? null, reboundSteamId, summaryCopied };
}

/**
 * Copy a character from one save into another (or into another slot of the
 * same save, which is how a slot is duplicated).
 */
export function copyCharacterSlot(
  sourceEditor: DS3SlotEditor,
  destEditor: DS3SlotEditor,
  sourceSlot: number,
  destSlot: number,
  options: ImportSlotOptions = {}
): ImportSlotResult {
  if (sourceSlot < 0 || sourceSlot >= SLOT_COUNT) {
    throw new Error('Source slot must be between 0 and 9');
  }

  const sourceChar = sourceEditor.getCharacters().find(c => c.slotIndex === sourceSlot);
  if (!sourceChar) {
    throw new Error('Source character not found');
  }
  if (sourceChar.isEmpty) {
    throw new Error('Source slot is empty');
  }

  return importSlotFromBinary(destEditor, sourceChar.getRawData(), destSlot, {
    summary: sourceEditor.readSlotSummary(sourceSlot),
    ...options,
  });
}

/** Duplicate a character within the same save. */
export function duplicateCharacterSlot(
  editor: DS3SlotEditor,
  sourceSlot: number,
  destSlot: number
): ImportSlotResult {
  return copyCharacterSlot(editor, editor, sourceSlot, destSlot);
}
