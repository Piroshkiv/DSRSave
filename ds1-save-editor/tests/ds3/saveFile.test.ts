import { describe, it, expect, beforeAll } from 'vitest';
import { DS3SaveFileEditor } from '../../src/apps/ds3/lib/SaveFileEditor';
import { calculateMD5 } from '../../src/apps/ds3/lib/crypto';
import {
  BND4_HEADER_SIZE,
  ENTRY_HEADER_SIZE,
  BND4_SIGNATURE,
  ONLINE_FLAG_OFFSET,
  APPEARANCE_SLIDERS,
  APPEARANCE_COLORS,
  APPEARANCE_IDS,
  APPEARANCE_ID_VALUES,
  FACE_BLOCK_SIZE,
  APPEARANCE_PRESET_COUNT,
  APPEARANCE_PRESET_BASE,
  APPEARANCE_PRESET_RECORD_SIZE,
  FACE_RECORD_MAGIC,
  FACE_RECORD_VERSION,
  FACE_RECORD_DECLARED_SIZE,
  FACE_RECORD_HEADER_SIZE,
  FACE_RECORD_FILL_OFFSET,
  FACE_RECORD_FILL_LENGTH,
  FACE_RECORD_FILL_BYTE,
  FACE_RECORD_USED_OFFSET,
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
  // The editor is only useful if an edited look survives the trip through the
  // container: re-encrypted, re-hashed, written out and parsed back. Loading
  // throws on a checksum mismatch, so a clean reload also proves the hashes.
  describe('appearance survives export', () => {
    const reload = async (editor: DS3SaveFileEditor) =>
      DS3SaveFileEditor.fromFileData(
        toFile(await editor.exportSaveFile(), 'DS30000.sl2'),
        null,
      );

    it('writes every kind of appearance edit into the file', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const hero = editor.getCharacters().find((c) => !c.isEmpty)!;
      const slot = hero.slotIndex;

      const slider = APPEARANCE_SLIDERS[10];
      const color = APPEARANCE_COLORS[1];          // hair
      const id = APPEARANCE_IDS[0];                // hair style
      const idValue = APPEARANCE_ID_VALUES[id.offset].at(-1)!;

      hero.setFaceByte(slider.offset, 0x2A);
      hero.setFaceColor(color.offset, 200, 100, 50);
      hero.setFaceId(id.offset, idValue);
      hero.faceAge = 2;
      hero.muscular = true;
      hero.chestHair = false;
      hero.gender = 1;
      hero.voice = 2;
      const expected = hero.getFaceBlock();

      const back = (await reload(editor)).getCharacters()[slot];
      expect(back.findFaceBlock()).toBeGreaterThan(0);
      expect(back.getFaceByte(slider.offset), slider.label).toBe(0x2A);
      expect(back.getFaceColor(color.offset), color.label).toEqual([200, 100, 50]);
      expect(back.getFaceId(id.offset), id.label).toBe(idValue);
      expect(back.faceAge).toBe(2);
      expect(back.muscular).toBe(true);
      expect(back.chestHair).toBe(false);
      expect(back.gender).toBe(1);
      expect(back.voice).toBe(2);
      expect(back.getFaceBlock()).toEqual(expected);
    });

    it('touches nothing else in the block', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const hero = editor.getCharacters().find((c) => !c.isEmpty)!;
      const before = hero.getFaceBlock();

      const { offset } = APPEARANCE_SLIDERS[3];
      hero.setFaceByte(offset, (before[offset] + 1) & 0xFF);

      const after = (await reload(editor)).getCharacters()[hero.slotIndex].getFaceBlock();
      expect(after).toHaveLength(FACE_BLOCK_SIZE);
      for (let i = 0; i < FACE_BLOCK_SIZE; i++) {
        if (i === offset) continue;
        expect(after[i], `byte 0x${i.toString(16)} moved`).toBe(before[i]);
      }
      expect(after[offset]).toBe((before[offset] + 1) & 0xFF);
    });

    it('leaves every other character untouched', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const populated = editor.getCharacters().filter((c) => !c.isEmpty);
      if (populated.length < 2) return;

      const [hero, ...others] = populated;
      const untouched = others.map((c) => ({ slot: c.slotIndex, face: c.getFaceBlock() }));
      hero.setFaceByte(APPEARANCE_SLIDERS[5].offset, 0x77);

      const reloaded = await reload(editor);
      for (const { slot, face } of untouched) {
        expect(reloaded.getCharacters()[slot].getFaceBlock(), `slot ${slot}`).toEqual(face);
      }
    });

    it('carries a preset from one character to another through the file', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const populated = editor.getCharacters().filter((c) => !c.isEmpty);
      if (populated.length < 2) return;

      const [source, target] = populated;
      source.setFaceId(APPEARANCE_IDS[0].offset, APPEARANCE_ID_VALUES[0x04].at(-1)!);
      source.setFaceColor(APPEARANCE_COLORS[0].offset, 33, 66, 99);
      const preset = source.exportAppearancePreset();
      target.importAppearancePreset(preset);

      const reloaded = await reload(editor);
      const back = reloaded.getCharacters()[target.slotIndex];
      expect(back.getFaceBlock()).toEqual(source.getFaceBlock());
      expect(back.getFaceColor(APPEARANCE_COLORS[0].offset)).toEqual([33, 66, 99]);
      expect(back.exportAppearancePreset()).toEqual(preset);
    });
  });
  // The game's own appearance presets — six records at the front of the system
  // entry. These tests never assume a preset exists: the fixture save gains and
  // loses them as the game is played.
  describe('appearance presets', () => {
    it('the fill offset really is the end of the face block', () => {
      expect(FACE_RECORD_FILL_OFFSET).toBe(FACE_BLOCK_SIZE);
      expect(FACE_RECORD_HEADER_SIZE + FACE_RECORD_USED_OFFSET + 2)
        .toBeLessThanOrEqual(APPEARANCE_PRESET_RECORD_SIZE);
    });

    it('reports six slots, each empty or a full face block', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const slots = editor.listAppearancePresets();
      expect(slots).toHaveLength(APPEARANCE_PRESET_COUNT);
      for (const { index, face } of slots) {
        expect(editor.hasAppearancePreset(index)).toBe(face !== null);
        if (face) expect(face, `slot ${index}`).toHaveLength(FACE_BLOCK_SIZE);
      }
    });

    it('rejects a slot index outside the six', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      expect(() => editor.readAppearancePreset(-1)).toThrow(/out of range/);
      expect(() => editor.readAppearancePreset(APPEARANCE_PRESET_COUNT)).toThrow(/out of range/);
    });

    it('writing a face into an occupied slot keeps the rest of the record', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const hero = editor.getCharacters().find((c) => !c.isEmpty)!;
      const slot = editor.listAppearancePresets().find((p) => p.face !== null)?.index;
      if (slot === undefined) return;   // this save has no presets saved in game

      const at = APPEARANCE_PRESET_BASE + slot * APPEARANCE_PRESET_RECORD_SIZE;
      const before = editor.readSystemEntryBytes(at, APPEARANCE_PRESET_RECORD_SIZE);
      editor.writeAppearancePreset(slot, hero.getFaceBlock());

      const after = editor.readSystemEntryBytes(at, APPEARANCE_PRESET_RECORD_SIZE);
      expect(editor.readAppearancePreset(slot)).toEqual(hero.getFaceBlock());
      // header and trailer untouched
      expect(after.slice(0, FACE_RECORD_HEADER_SIZE))
        .toEqual(before.slice(0, FACE_RECORD_HEADER_SIZE));
      const tail = FACE_RECORD_HEADER_SIZE + FACE_BLOCK_SIZE;
      expect(after.slice(tail)).toEqual(before.slice(tail));
    });

    it('builds a valid record when the slot was empty', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const hero = editor.getCharacters().find((c) => !c.isEmpty)!;
      const slot = APPEARANCE_PRESET_COUNT - 1;

      editor.clearAppearancePreset(slot);
      expect(editor.hasAppearancePreset(slot)).toBe(false);
      expect(editor.readAppearancePreset(slot)).toBeNull();

      editor.writeAppearancePreset(slot, hero.getFaceBlock());
      const at = APPEARANCE_PRESET_BASE + slot * APPEARANCE_PRESET_RECORD_SIZE;
      const rec = editor.readSystemEntryBytes(at, APPEARANCE_PRESET_RECORD_SIZE);
      const view = new DataView(rec.buffer, rec.byteOffset, rec.byteLength);

      expect(Array.from(rec.slice(0, 4))).toEqual(FACE_RECORD_MAGIC);
      expect(view.getUint32(4, true)).toBe(FACE_RECORD_VERSION);
      expect(view.getUint32(8, true)).toBe(FACE_RECORD_DECLARED_SIZE);
      expect(editor.readAppearancePreset(slot)).toEqual(hero.getFaceBlock());

      const fillAt = FACE_RECORD_HEADER_SIZE + FACE_RECORD_FILL_OFFSET;
      for (let i = 0; i < FACE_RECORD_FILL_LENGTH; i++) {
        expect(rec[fillAt + i], `fill byte ${i}`).toBe(FACE_RECORD_FILL_BYTE);
      }
      expect(view.getUint16(FACE_RECORD_HEADER_SIZE + FACE_RECORD_USED_OFFSET, true)).toBe(1);
    });

    it('a written preset survives export and reload', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const hero = editor.getCharacters().find((c) => !c.isEmpty)!;
      hero.setFaceColor(APPEARANCE_COLORS[1].offset, 7, 8, 9);
      const face = hero.getFaceBlock();

      const slot = 2;
      editor.writeAppearancePreset(slot, face);
      const reloaded = await DS3SaveFileEditor.fromFileData(
        toFile(await editor.exportSaveFile(), 'DS30000.sl2'),
        null,
      );
      expect(reloaded.readAppearancePreset(slot)).toEqual(face);
    });

    it('clearing a preset survives export and reload', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      editor.clearAppearancePreset(0);
      const reloaded = await DS3SaveFileEditor.fromFileData(
        toFile(await editor.exportSaveFile(), 'DS30000.sl2'),
        null,
      );
      expect(reloaded.hasAppearancePreset(0)).toBe(false);
      const at = APPEARANCE_PRESET_BASE;
      expect(Array.from(reloaded.readSystemEntryBytes(at, APPEARANCE_PRESET_RECORD_SIZE)))
        .toEqual(new Array(APPEARANCE_PRESET_RECORD_SIZE).fill(0));
    });

    it('a preset applies onto a character byte for byte', async () => {
      const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
      const populated = editor.getCharacters().filter((c) => !c.isEmpty);
      if (populated.length < 2) return;

      const [source, target] = populated;
      editor.writeAppearancePreset(3, source.getFaceBlock());
      target.setFaceBlock(editor.readAppearancePreset(3)!);
      expect(target.getFaceBlock()).toEqual(source.getFaceBlock());
    });
  });
});
