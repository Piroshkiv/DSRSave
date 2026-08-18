import { describe, it, expect, beforeAll } from 'vitest';
import { createDecipheriv, createHash } from 'node:crypto';
import { SaveFileEditor } from '../../src/apps/ds1/lib/SaveFileEditor';
import { calculateMD5 } from '../../src/apps/ds1/lib/crypto';
import {
  SAVE_FILE_SIZE,
  SAVE_SLOT_SIZE,
  BASE_SLOT_OFFSET,
  USER_DATA_SIZE,
  USER_DATA_FILE_COUNT,
  AES_KEY,
} from '../../src/apps/ds1/lib/constants';
import { hasDS1Save, ds1SaveFile, readSaveBytes, DS1_SAVE_PATH } from '../helpers/saves';

describe.skipIf(!hasDS1Save)('DS1 SaveFileEditor (real save)', () => {
  let original: Uint8Array;

  beforeAll(async () => {
    original = await readSaveBytes(DS1_SAVE_PATH);
  });

  it('fixture is a PC-sized DSR save', () => {
    expect(original.length).toBe(SAVE_FILE_SIZE);
  });

  it('loads all 11 slots (10 characters + settings)', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    expect(editor.getCharacters()).toHaveLength(USER_DATA_FILE_COUNT);
    editor.getCharacters().forEach((c, i) => expect(c.slotNumber).toBe(i));
  });

  // Slot geometry leans on PKCS#7: the ciphertext occupies USER_DATA_SIZE
  // bytes, so the plaintext is exactly one padding block's worth shorter and
  // re-encrypting must land back on USER_DATA_SIZE. Change the padding mode
  // and the slot no longer fits.
  it('every slot decrypts to USER_DATA_SIZE minus its PKCS#7 padding', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    const plaintextSize = USER_DATA_SIZE - 12;

    for (const character of editor.getCharacters()) {
      expect(character.getRawData().length).toBe(plaintextSize);
      // Padding restores the on-disk size: plaintext + pad == ciphertext.
      expect(plaintextSize + (16 - (plaintextSize % 16))).toBe(USER_DATA_SIZE);
    }
  });

  it('rejects a file smaller than the save size', () => {
    expect(() => new SaveFileEditor(new Uint8Array(1024))).toThrow(/Invalid save file size/);
  });

  it('accepts data of exactly the save size', () => {
    expect(() => new SaveFileEditor(new Uint8Array(SAVE_FILE_SIZE))).not.toThrow();
  });

  // The load → export cycle with no edits is the backbone regression test:
  // any refactor that changes decrypt, encrypt, checksum or slot geometry
  // will break byte-identity here.
  it('export without edits reproduces the original file byte-for-byte', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    const exported = await editor.exportSaveFile();

    expect(exported.length).toBe(original.length);

    const diffs: number[] = [];
    for (let i = 0; i < original.length; i++) {
      if (exported[i] !== original[i]) {
        diffs.push(i);
        if (diffs.length > 8) break;
      }
    }
    expect(diffs.map((d) => `0x${d.toString(16)}`)).toEqual([]);
  });

  it('writes a checksum equal to MD5 of the slot ciphertext', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    const character = editor.getCharacters()[0];
    character.souls = 12345;

    const exported = await editor.exportSaveFile();
    const offset = BASE_SLOT_OFFSET + 0 * SAVE_SLOT_SIZE;
    const storedChecksum = exported.slice(offset, offset + 16);
    const ciphertext = exported.slice(offset + 16, offset + 16 + USER_DATA_SIZE);

    expect(Array.from(storedChecksum)).toEqual(Array.from(await calculateMD5(ciphertext)));
  });

  it('editing one slot leaves every other slot untouched', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    editor.getCharacters()[0].souls = 999_999;
    const exported = await editor.exportSaveFile();

    for (let slot = 1; slot < USER_DATA_FILE_COUNT; slot++) {
      const start = BASE_SLOT_OFFSET + slot * SAVE_SLOT_SIZE;
      const end = start + 16 + USER_DATA_SIZE;
      expect(
        Buffer.compare(
          Buffer.from(exported.slice(start, end)),
          Buffer.from(original.slice(start, end)),
        ),
        `slot ${slot} changed`,
      ).toBe(0);
    }
  });

  it('survives a full write → read round trip with edited values', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    const before = editor.getCharacters().map((c) => c.isEmpty);

    const target = editor.getCharacters().findIndex((c) => !c.isEmpty);
    expect(target, 'fixture has no non-empty character to edit').toBeGreaterThanOrEqual(0);

    editor.getCharacter(target)!.souls = 4_242_424;
    editor.getCharacter(target)!.humanity = 42;

    const exported = await editor.exportSaveFile();
    const reloaded = await SaveFileEditor.fromFile(
      new File([exported as unknown as BlobPart], 'out.sl2'),
    );

    expect(reloaded.getCharacter(target)!.souls).toBe(4_242_424);
    expect(reloaded.getCharacter(target)!.humanity).toBe(42);
    // Emptiness classification must be stable across the round trip.
    expect(reloaded.getCharacters().map((c) => c.isEmpty)).toEqual(before);
  });

  it('reports no file handle when constructed from raw data', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    expect(editor.hasFileHandle()).toBe(false);
    expect(editor.getFileHandle()).toBeNull();
    await expect(editor.saveToOriginalFile()).rejects.toThrow(/No file handle/);
  });

  it('getCharacter returns undefined past the last slot', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    expect(editor.getCharacter(USER_DATA_FILE_COUNT)).toBeUndefined();
  });
});

/**
 * The suite above only ever checks the editor against itself, so it would stay
 * green even if exports stopped being readable by the game. These tests parse
 * the file the way the game does — [MD5 16][IV 16][ciphertext], MD5 taken over
 * IV ‖ ciphertext — with an independent AES implementation (node:crypto), and
 * pin the deliberate 16-byte shift documented on SaveFileEditor.
 */
describe.skipIf(!hasDS1Save)('DS1 slot container (game-side view)', () => {
  /** Decrypt a slot the way the game does. Returns the true plaintext. */
  function gameDecrypt(save: Uint8Array, slot: number): Buffer {
    const offset = BASE_SLOT_OFFSET + slot * SAVE_SLOT_SIZE;
    const iv = save.slice(offset + 16, offset + 32);
    const ciphertext = save.slice(offset + 32, offset + 16 + USER_DATA_SIZE);
    const d = createDecipheriv('aes-128-cbc', Buffer.from(AES_KEY), Buffer.from(iv));
    d.setAutoPadding(false);
    return Buffer.concat([d.update(Buffer.from(ciphertext)), d.final()]);
  }

  /** Same, minus the 12 PKCS#7 padding bytes the editor strips on load. */
  function gamePayload(save: Uint8Array, slot: number): Buffer {
    const plaintext = gameDecrypt(save, slot);
    return plaintext.subarray(0, plaintext.length - 12);
  }

  function storedChecksum(save: Uint8Array, slot: number): Buffer {
    const offset = BASE_SLOT_OFFSET + slot * SAVE_SLOT_SIZE;
    return Buffer.from(save.slice(offset, offset + 16));
  }

  /** md5(IV ‖ ciphertext), i.e. everything after the checksum field. */
  function expectedChecksum(save: Uint8Array, slot: number): Buffer {
    const offset = BASE_SLOT_OFFSET + slot * SAVE_SLOT_SIZE;
    const body = save.slice(offset + 16, offset + 16 + USER_DATA_SIZE);
    return createHash('md5').update(Buffer.from(body)).digest();
  }

  let original: Uint8Array;

  beforeAll(async () => {
    original = await readSaveBytes(DS1_SAVE_PATH);
  });

  it('every slot checksums as md5(IV ‖ ciphertext)', () => {
    for (let slot = 0; slot < USER_DATA_FILE_COUNT; slot++) {
      expect(storedChecksum(original, slot).equals(expectedChecksum(original, slot)), `slot ${slot}`)
        .toBe(true);
    }
  });

  it('every slot decrypts to PKCS#7 padding of 12 bytes', () => {
    for (let slot = 0; slot < USER_DATA_FILE_COUNT; slot++) {
      const plaintext = gameDecrypt(original, slot);
      expect(plaintext.length).toBe(USER_DATA_SIZE - 16);
      expect(Array.from(plaintext.subarray(plaintext.length - 12)), `slot ${slot}`)
        .toEqual(new Array(12).fill(0x0c));
    }
  });

  // The shift is load-bearing: every offset in constants.ts assumes it.
  it("the editor's slot data is the game's plaintext preceded by a phantom block", async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());

    for (let slot = 0; slot < USER_DATA_FILE_COUNT; slot++) {
      const editorData = Buffer.from(editor.getCharacters()[slot].getRawData());
      expect(editorData.subarray(16).equals(gamePayload(original, slot)), `slot ${slot}`).toBe(true);
    }
  });

  // The real regression risk in exportSaveFile(): re-encrypting with a freshly
  // computed checksum instead of the one the slot was decrypted with would
  // scramble the IV field and hand the game an undecryptable slot.
  it('an edited export stays valid under the game layout', async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    const target = editor.getCharacters().findIndex((c) => !c.isEmpty);
    expect(target, 'fixture has no non-empty character to edit').toBeGreaterThanOrEqual(0);

    editor.getCharacter(target)!.souls = 1_234_567;
    const exported = await editor.exportSaveFile();

    const offset = BASE_SLOT_OFFSET + target * SAVE_SLOT_SIZE;
    // The IV field is untouched by an edit — only the ciphertext behind it moves.
    expect(
      Buffer.from(exported.slice(offset + 16, offset + 32))
        .equals(Buffer.from(original.slice(offset + 16, offset + 32))),
      'IV field changed',
    ).toBe(true);

    expect(storedChecksum(exported, target).equals(expectedChecksum(exported, target))).toBe(true);

    // And the game's plaintext still matches what the editor believes it wrote.
    const editorData = Buffer.from(editor.getCharacter(target)!.getRawData());
    expect(editorData.subarray(16).equals(gamePayload(exported, target))).toBe(true);

    // Untouched slots keep valid checksums too.
    for (let slot = 0; slot < USER_DATA_FILE_COUNT; slot++) {
      expect(storedChecksum(exported, slot).equals(expectedChecksum(exported, slot)), `slot ${slot}`)
        .toBe(true);
    }
  });
});
