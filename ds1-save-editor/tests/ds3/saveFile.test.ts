import { describe, it, expect, beforeAll } from 'vitest';
import { DS3SaveFileEditor } from '../../src/apps/ds3/lib/SaveFileEditor';
import { calculateMD5 } from '../../src/apps/ds3/lib/crypto';
import {
  BND4_HEADER_SIZE,
  ENTRY_HEADER_SIZE,
  BND4_SIGNATURE,
  ONLINE_FLAG_OFFSET,
} from '../../src/apps/ds3/lib/constants';
import { hasDS3Save, ds3SaveFile, readSaveBytes, DS3_SAVE_PATH, toFile } from '../helpers/saves';

describe.skipIf(!hasDS3Save)('DS3 SaveFileEditor (real save)', () => {
  let original: Uint8Array;

  beforeAll(async () => {
    original = await readSaveBytes(DS3_SAVE_PATH);
  });

  describe('container format', () => {
    it('fixture carries the BND4 signature', () => {
      expect(Array.from(original.slice(0, BND4_SIGNATURE.length))).toEqual(
        Array.from(BND4_SIGNATURE),
      );
    });

    it('rejects a file without the BND4 signature', async () => {
      const bogus = new Uint8Array(original.length);
      bogus.set(original.slice(0, BND4_HEADER_SIZE));
      bogus[0] ^= 0xff;
      await expect(
        DS3SaveFileEditor.fromFileData(toFile(bogus, 'bad.sl2'), null),
      ).rejects.toThrow(/BND4/);
    });

    it('rejects a file too small to hold a header', async () => {
      await expect(
        DS3SaveFileEditor.fromFileData(toFile(new Uint8Array(16), 'tiny.sl2'), null),
      ).rejects.toThrow(/too small/);
    });

    it('reports the container entry count', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      // 10 character slots plus the system entries DS3 appends.
      expect(editor.getEntryCount()).toBeGreaterThanOrEqual(11);
    });
  });

  describe('character slots', () => {
    it('exposes exactly 10 character slots', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      expect(editor.getCharacters()).toHaveLength(10);
    });

    it('indexes slots 0..9 in order', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      editor.getCharacters().forEach((c, i) => expect(c.slotIndex).toBe(i));
    });

    it('decrypts every slot to the same payload size', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const sizes = new Set(editor.getCharacters().map((c) => c.getRawData().length));
      expect(sizes.size).toBe(1);
    });

    it('finds at least one populated slot', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      expect(editor.getCharacters().filter((c) => !c.isEmpty).length).toBeGreaterThan(0);
    });

    it('getCharacter matches by slot index and misses out of range', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      expect(editor.getCharacter(0)?.slotIndex).toBe(0);
      expect(editor.getCharacter(99)).toBeUndefined();
    });

    it('reports an active flag for each slot', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      for (let i = 0; i < 10; i++) expect(typeof editor.isSlotActive(i)).toBe('boolean');
    });

    it('never marks an empty slot active', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      for (const c of editor.getCharacters()) {
        if (c.isEmpty) expect(editor.isSlotActive(c.slotIndex)).toBe(false);
      }
    });
  });

  describe('system entries', () => {
    it('decrypts entries beyond the character slots', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const entry10 = await editor.getRawEntry(10);
      expect(entry10.getRawData().length).toBeGreaterThan(0);
    });

    it('rejects an out-of-range entry index', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      await expect(editor.getRawEntry(editor.getEntryCount())).rejects.toThrow(/out of range/);
      await expect(editor.getRawEntry(-1)).rejects.toThrow(/out of range/);
    });
  });

  describe('online flag', () => {
    it('reads the launch setting as a boolean', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      expect(typeof editor.isOnline()).toBe('boolean');
    });

    it('agrees with the raw byte at ONLINE_FLAG_OFFSET', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const raw = editor.readSystemEntryBytes(ONLINE_FLAG_OFFSET, 1)[0];
      expect(editor.isOnline()).toBe(raw === 0x01);
    });

    it('toggles in memory both ways', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      editor.setOnline(false);
      expect(editor.isOnline()).toBe(false);
      editor.setOnline(true);
      expect(editor.isOnline()).toBe(true);
    });

    // The flag lives in the system entry, which is only re-encrypted when it is
    // marked dirty — the round trip is what proves the write actually lands.
    it('survives export and reload', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      editor.setOnline(false);

      const reloaded = await DS3SaveFileEditor.fromFileData(
        toFile(await editor.exportSaveFile(), 'DS30000.sl2'),
        null,
      );
      expect(reloaded.isOnline()).toBe(false);

      reloaded.setOnline(true);
      const back = await DS3SaveFileEditor.fromFileData(
        toFile(await reloaded.exportSaveFile(), 'DS30000.sl2'),
        null,
      );
      expect(back.isOnline()).toBe(true);
    });

    it('changes only the flag byte inside the system entry', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const before = Uint8Array.from(editor.getSystemEntryData()!);
      editor.setOnline(!editor.isOnline());

      const after = editor.getSystemEntryData()!;
      const differing: number[] = [];
      for (let i = 0; i < before.length; i++) {
        if (before[i] !== after[i]) differing.push(i);
      }
      expect(differing).toEqual([ONLINE_FLAG_OFFSET]);
    });
  });

  describe('checksums', () => {
    // Loading throws on mismatch, so a clean load already proves every stored
    // checksum is correct. This pins the exact hashed range: IV + ciphertext.
    it('the stored checksum covers IV and ciphertext together', async () => {
      const view = new DataView(original.buffer, original.byteOffset, original.byteLength);
      const entryHeaderOffset = BND4_HEADER_SIZE + 0 * ENTRY_HEADER_SIZE;
      const entrySize = Number(view.getBigUint64(entryHeaderOffset + 0x08, true));
      const entryDataOffset = view.getUint32(entryHeaderOffset + 0x10, true);

      const stored = original.slice(entryDataOffset, entryDataOffset + 16);
      const hashed = original.slice(entryDataOffset + 16, entryDataOffset + entrySize);

      expect(Array.from(stored)).toEqual(Array.from(await calculateMD5(hashed)));
    });

    it('a corrupted slot fails to load', async () => {
      const view = new DataView(original.buffer, original.byteOffset, original.byteLength);
      const entryDataOffset = view.getUint32(BND4_HEADER_SIZE + 0x10, true);

      const tampered = new Uint8Array(original);
      tampered[entryDataOffset + 64] ^= 0xff; // flip a ciphertext byte

      const editor = await DS3SaveFileEditor.fromFileData(toFile(tampered, 'bad.sl2'), null);
      // The loader swallows the error and substitutes an empty slot.
      expect(editor.getCharacters()[0].isEmpty).toBe(true);
    });
  });

  describe('export', () => {
    it('preserves the file length', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      expect((await editor.exportSaveFile()).length).toBe(original.length);
    });

    it('re-exported data loads cleanly (all checksums valid)', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const exported = await editor.exportSaveFile();

      // Would throw / blank the slots if any checksum were wrong.
      const reloaded = await DS3SaveFileEditor.fromFileData(toFile(exported, 'out.sl2'), null);
      expect(reloaded.getCharacters().map((c) => c.isEmpty)).toEqual(
        editor.getCharacters().map((c) => c.isEmpty),
      );
    });

    it('writes a checksum matching MD5(IV + ciphertext) for every slot', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const exported = await editor.exportSaveFile();
      const view = new DataView(exported.buffer, exported.byteOffset, exported.byteLength);

      for (let slot = 0; slot < 10; slot++) {
        const header = BND4_HEADER_SIZE + slot * ENTRY_HEADER_SIZE;
        const entrySize = Number(view.getBigUint64(header + 0x08, true));
        const dataOffset = view.getUint32(header + 0x10, true);

        const stored = exported.slice(dataOffset, dataOffset + 16);
        const hashed = exported.slice(dataOffset + 16, dataOffset + entrySize);
        expect(Array.from(stored), `slot ${slot}`).toEqual(Array.from(await calculateMD5(hashed)));
      }
    });

    it('reuses the per-slot IV rather than generating a new one', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const exported = await editor.exportSaveFile();
      const view = new DataView(original.buffer, original.byteOffset, original.byteLength);

      for (let slot = 0; slot < 10; slot++) {
        const dataOffset = view.getUint32(
          BND4_HEADER_SIZE + slot * ENTRY_HEADER_SIZE + 0x10,
          true,
        );
        expect(
          Array.from(exported.slice(dataOffset + 16, dataOffset + 32)),
          `slot ${slot} IV`,
        ).toEqual(Array.from(original.slice(dataOffset + 16, dataOffset + 32)));
      }
    });

    it('round-trips an edited value', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const target = editor.getCharacters().find((c) => !c.isEmpty)!;
      const slot = target.slotIndex;
      target.souls = 555_555;

      const exported = await editor.exportSaveFile();
      const reloaded = await DS3SaveFileEditor.fromFileData(toFile(exported, 'out.sl2'), null);

      expect(reloaded.getCharacter(slot)!.souls).toBe(555_555);
    });

    it('leaves empty slots byte-identical', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      editor.getCharacters().find((c) => !c.isEmpty)!.souls = 4242;

      const exported = await editor.exportSaveFile();
      const view = new DataView(original.buffer, original.byteOffset, original.byteLength);

      for (const character of editor.getCharacters()) {
        if (!character.isEmpty) continue;
        const header = BND4_HEADER_SIZE + character.slotIndex * ENTRY_HEADER_SIZE;
        const entrySize = Number(view.getBigUint64(header + 0x08, true));
        const dataOffset = view.getUint32(header + 0x10, true);

        expect(
          Buffer.compare(
            Buffer.from(exported.slice(dataOffset, dataOffset + entrySize)),
            Buffer.from(original.slice(dataOffset, dataOffset + entrySize)),
          ),
          `empty slot ${character.slotIndex} changed`,
        ).toBe(0);
      }
    });

    it('KNOWN DIVERGENCE: export rewrites every populated slot, not just edited ones', async () => {
      // exportSaveFile() recalculates the level and calls
      // applyLevelProgression() -> enforceSoulMemoryFloor() for EVERY
      // non-empty character. Any slot whose stored soul memory sits below
      // minSoulMemoryForLevel(level) + souls is silently raised, even when the
      // user never touched it. DS1's export is pure by comparison. Unification
      // has to decide which semantics win.
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const untouched = editor
        .getCharacters()
        .filter((c) => !c.isEmpty)
        .find((c) => c.soulMemory === 0);

      expect(untouched, 'fixture needs a populated slot with zero soul memory').toBeDefined();

      const before = untouched!.soulMemory;
      await editor.exportSaveFile();
      expect(untouched!.soulMemory).toBeGreaterThan(before);
    });

    it('export reaches a fixed point: exporting the result again changes nothing', async () => {
      // Once the soul-memory floor is satisfied, further exports must be
      // stable. A non-idempotent export would drift the save on every save.
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const once = await editor.exportSaveFile();

      const second = await DS3SaveFileEditor.fromFileData(toFile(once, 'a.sl2'), null);
      const twice = await second.exportSaveFile();

      expect(Buffer.compare(Buffer.from(once), Buffer.from(twice))).toBe(0);
    });
  });

  describe('file handle', () => {
    it('refuses to save in place without a handle', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      expect(editor.hasFileHandle()).toBe(false);
      expect(editor.getFileHandle()).toBeNull();
      await expect(editor.saveToOriginalFile()).rejects.toThrow(/No file handle/);
    });
  });
});
