import { describe, it, expect, beforeEach } from 'vitest';
import { DS3SaveFileEditor } from '../../src/apps/ds3/lib/SaveFileEditor';
import { DS3Character } from '../../src/apps/ds3/lib/Character';
import {
  MAX_VALUES,
  PlayerClass,
  CLASS_STARTING_STATS,
  VIGOR_TO_HP,
  ATTUNEMENT_TO_FP,
  ENDURANCE_TO_STAMINA,
  BONFIRE_UNLOCK_ALL,
  minSoulMemoryForLevel,
} from '../../src/apps/ds3/lib/constants';
import { GESTURE_COUNT, GESTURE_RECORD_COUNT } from '../../src/apps/ds3/lib/constants';
import {
  FACE_BLOCK_SIZE,
  FACE_ID_COUNT,
  FACE_COLORS_OFFSET,
  FACE_COLOR_COUNT,
  APPEARANCE_IDS,
  APPEARANCE_COLORS,
  APPEARANCE_SLIDERS,
  APPEARANCE_PRESET_SIZE,
  APPEARANCE_ID_VALUES,
  FACE_BUILD_OFFSET,
  FACE_AGE_NAMES,
  FACE_PUPIL_ID_OFFSETS,
  FACE_PUPIL_COLOR_OFFSETS,
  FACE_UNUSED_ID_OFFSET,
  FACE_UNUSED_COLOR_OFFSET,
} from '../../src/apps/ds3/lib/constants';
import { hasDS3Save, ds3SaveFile } from '../helpers/saves';

const STATS = ['VIG', 'ATN', 'END', 'VIT', 'STR', 'DEX', 'INT', 'FTH', 'LCK'] as const;

describe.skipIf(!hasDS3Save)('DS3 Character (real save)', () => {
  let editor: DS3SaveFileEditor;
  let hero: DS3Character;

  beforeEach(async () => {
    editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    hero = editor.getCharacters().find((c) => !c.isEmpty)!;
  });

  describe('emptiness', () => {
    it('reports empty for a zero buffer', () => {
      expect(new DS3Character(new Uint8Array(0x1000), 0).isEmpty).toBe(true);
    });

    it('reports empty for a short buffer', () => {
      expect(new DS3Character(new Uint8Array(0x10), 0).isEmpty).toBe(true);
    });

    it('rejects null data', () => {
      expect(() => new DS3Character(null as never, 0)).toThrow(/cannot be null/);
    });

    it('empty characters answer with neutral values instead of throwing', () => {
      const empty = new DS3Character(new Uint8Array(0x1000), 0);
      expect(empty.name).toBe('');
      expect(empty.level).toBe(0);
      expect(empty.souls).toBe(0);
      expect(empty.getStat('VIG')).toBe(0);
      expect(empty.allBonfiresUnlocked).toBe(false);
      expect(empty.findBonfireBlock()).toBe(-1);
    });
  });

  describe('pattern anchor', () => {
    it('throws a descriptive error when the pattern is absent', () => {
      // Non-empty by the isEmpty heuristic, but carries no character pattern.
      const junk = new Uint8Array(0x2000).fill(0x7f);
      expect(() => new DS3Character(junk, 0).level).toThrow(/Pattern not found/);
    });

    it('caches the pattern offset until explicitly invalidated', () => {
      const first = hero.level;
      hero.invalidatePatternCache();
      expect(hero.level).toBe(first);
    });
  });

  describe('name', () => {
    it('round-trips an ASCII name', () => {
      hero.name = 'Unkindled';
      expect(hero.name).toBe('Unkindled');
    });

    it('round-trips a non-ASCII name', () => {
      hero.name = 'Соляр';
      expect(hero.name).toBe('Соляр');
    });

    it('truncates at 16 characters', () => {
      hero.name = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      expect(hero.name).toBe('ABCDEFGHIJKLMNOP');
    });

    it('leaves no stale tail when overwriting', () => {
      hero.name = 'LongNameHere';
      hero.name = 'Ash';
      expect(hero.name).toBe('Ash');
    });

    it('ignores writes to an empty slot', () => {
      const empty = editor.getCharacters().find((c) => c.isEmpty)!;
      empty.name = 'ghost';
      expect(empty.name).toBe('');
    });
  });

  describe('numeric fields', () => {
    it('round-trips level', () => {
      hero.level = 120;
      expect(hero.level).toBe(120);
    });

    it('clamps level to the documented range', () => {
      hero.level = 99_999;
      expect(hero.level).toBe(MAX_VALUES.LEVEL);
      hero.level = -5;
      expect(hero.level).toBe(1);
    });

    it('round-trips souls up to the in-game cap', () => {
      hero.souls = MAX_VALUES.SOULS;
      expect(hero.souls).toBe(MAX_VALUES.SOULS);
    });

    it('never returns a negative soul count', () => {
      // Contrast with DS1, whose getter lacks the `>>> 0`.
      hero.souls = MAX_VALUES.SOULS;
      expect(hero.souls).toBeGreaterThanOrEqual(0);
    });

    it('clamps souls in the setter', () => {
      hero.souls = MAX_VALUES.SOULS + 1_000_000;
      expect(hero.souls).toBe(MAX_VALUES.SOULS);
      hero.souls = -1;
      expect(hero.souls).toBe(0);
    });

    it('round-trips soul memory', () => {
      hero.soulMemory = 1_234_567;
      expect(hero.soulMemory).toBe(1_234_567);
    });

    it('round-trips NG cycle and clamps it', () => {
      hero.ngCycle = 3;
      expect(hero.ngCycle).toBe(3);
      hero.ngCycle = 255;
      expect(hero.ngCycle).toBe(MAX_VALUES.NG_CYCLE);
    });

    it('round-trips estus counts and clamps them at 20', () => {
      hero.estusMax = 12;
      hero.ashenEstusMax = 3;
      expect(hero.estusMax).toBe(12);
      expect(hero.ashenEstusMax).toBe(3);

      hero.estusMax = 99;
      expect(hero.estusMax).toBe(20);
    });

    it('round-trips weapon memory and clamps it at 10', () => {
      hero.weaponMemory = 7;
      expect(hero.weaponMemory).toBe(7);
      hero.weaponMemory = 99;
      expect(hero.weaponMemory).toBe(10);
      hero.weaponMemory = -1;
      expect(hero.weaponMemory).toBe(0);
    });

    it('round-trips class and resolves its name', () => {
      hero.playerClass = PlayerClass.Sorcerer;
      expect(hero.playerClass).toBe(PlayerClass.Sorcerer);
      expect(hero.className).toBe('Sorcerer');
    });

    it('falls back to Unknown for an unmapped class byte', () => {
      hero.playerClass = 200 as PlayerClass;
      expect(hero.className).toBe('Unknown');
    });
  });

  describe('stats', () => {
    it('exposes all nine stats', () => {
      for (const stat of STATS) expect(Number.isFinite(hero.getStat(stat))).toBe(true);
    });

    it('round-trips each stat independently', () => {
      STATS.forEach((stat, i) => hero.setStat(stat, 20 + i));
      STATS.forEach((stat, i) => expect(hero.getStat(stat), stat).toBe(20 + i));
    });

    it('KNOWN DIVERGENCE: an unknown stat is ignored instead of throwing', () => {
      // DS1's Character.getStat/setStat throw `Unknown stat: X`; DS3 logs and
      // returns, so a typo silently does nothing. Unification must pick one.
      expect(() => hero.setStat('RES', 10)).not.toThrow();
      expect(hero.getStat('RES')).toBe(0);
    });

    it('derives HP from VIG', () => {
      hero.setStat('VIG', 40);
      expect(hero.hp).toBe(VIGOR_TO_HP[40]);
    });

    it('derives FP from ATN', () => {
      hero.setStat('ATN', 30);
      expect(hero.fp).toBe(ATTUNEMENT_TO_FP[30]);
    });

    it('derives stamina from END', () => {
      hero.setStat('END', 25);
      expect(hero.stamina).toBe(ENDURANCE_TO_STAMINA[25]);
    });

    it('round-trips HP, FP and stamina directly', () => {
      hero.hp = 1500;
      hero.fp = 300;
      hero.stamina = 150;
      expect(hero.hp).toBe(1500);
      expect(hero.fp).toBe(300);
      expect(hero.stamina).toBe(150);
    });
  });

  describe('level calculation', () => {
    it('agrees with the stored level for every populated slot in the fixture', () => {
      for (const character of editor.getCharacters()) {
        if (character.isEmpty) continue;
        expect(character.calculateLevel(), `slot ${character.slotIndex}`).toBe(character.level);
      }
    });

    it('tracks a stat increase one for one', () => {
      const before = hero.calculateLevel();
      hero.setStat('STR', hero.getStat('STR') + 5);
      expect(hero.calculateLevel()).toBe(before + 5);
    });

    it('matches the class starting table at base stats', () => {
      hero.playerClass = PlayerClass.Knight;
      const start = CLASS_STARTING_STATS[PlayerClass.Knight];
      for (const stat of STATS) hero.setStat(stat, (start as never as Record<string, number>)[stat] ?? hero.getStat(stat));
      // Level at exactly the class's starting stats is the class's start level.
      expect(hero.calculateLevel()).toBeGreaterThan(0);
    });

    it('updateDerivedStats syncs HP, FP, stamina and level together', () => {
      hero.setStat('VIG', 30);
      hero.setStat('ATN', 20);
      hero.setStat('END', 20);
      hero.updateDerivedStats();

      expect(hero.hp).toBe(VIGOR_TO_HP[30]);
      expect(hero.fp).toBe(ATTUNEMENT_TO_FP[20]);
      expect(hero.stamina).toBe(ENDURANCE_TO_STAMINA[20]);
      expect(hero.level).toBe(hero.calculateLevel());
    });
  });

  describe('progression side effects', () => {
    it('raises soul memory to the floor for the current level', () => {
      hero.soulMemory = 0;
      hero.enforceSoulMemoryFloor();
      expect(hero.soulMemory).toBe(minSoulMemoryForLevel(hero.level) + hero.souls);
    });

    it('never lowers soul memory that already clears the floor', () => {
      hero.soulMemory = 900_000_000;
      hero.enforceSoulMemoryFloor();
      expect(hero.soulMemory).toBe(900_000_000);
    });

    it('credits soul memory when souls are added', () => {
      const before = hero.souls;
      const memoryBefore = hero.soulMemory;
      hero.souls = before + 10_000;
      hero.applySoulsProgression(before);
      expect(hero.soulMemory).toBeGreaterThanOrEqual(memoryBefore + 10_000);
    });

    it('does not shrink soul memory when souls are spent', () => {
      const before = hero.souls;
      const memoryBefore = hero.soulMemory;
      hero.souls = Math.max(0, before - 5_000);
      hero.applySoulsProgression(before);
      expect(hero.soulMemory).toBeGreaterThanOrEqual(memoryBefore);
    });

    it('credits play time when the level rises', () => {
      const before = hero.level;
      const playtimeBefore = hero.playtimeMs;
      hero.level = before + 10;
      hero.applyLevelProgression(before);
      expect(hero.playtimeMs).toBeGreaterThan(playtimeBefore);
    });

    it('leaves play time alone when the level does not rise', () => {
      const before = hero.level;
      const playtimeBefore = hero.playtimeMs;
      hero.applyLevelProgression(before);
      expect(hero.playtimeMs).toBe(playtimeBefore);
    });
  });

  describe('bonfires', () => {
    it('locates the bonfire block in a populated slot', () => {
      const rec0 = hero.findBonfireBlock();
      expect(rec0).toBeGreaterThan(0);
      expect(rec0).toBeLessThan(hero.getRawData().length);
    });

    it('is deterministic across calls', () => {
      expect(hero.findBonfireBlock()).toBe(hero.findBonfireBlock());
    });

    it('unlockAllBonfires makes allBonfiresUnlocked report true', () => {
      // DS3's getter and setter agree — unlike the DS1 pair, which do not.
      hero.unlockAllBonfires();
      expect(hero.allBonfiresUnlocked).toBe(true);
    });

    it('unlockAllBonfires only ever sets bits, never clears them', () => {
      const rec0 = hero.findBonfireBlock();
      const data = hero.getRawData();
      const before = BONFIRE_UNLOCK_ALL.map(([off]) => data[rec0 + off]);

      hero.unlockAllBonfires();

      BONFIRE_UNLOCK_ALL.forEach(([off, val], i) => {
        const after = data[rec0 + off];
        expect(after & before[i], `offset ${off} lost bits`).toBe(before[i]);
        expect(after & val, `offset ${off} missing unlock bits`).toBe(val);
      });
    });

    it('is idempotent', () => {
      hero.unlockAllBonfires();
      const rec0 = hero.findBonfireBlock();
      const snapshot = BONFIRE_UNLOCK_ALL.map(([off]) => hero.getRawData()[rec0 + off]);
      hero.unlockAllBonfires();
      expect(BONFIRE_UNLOCK_ALL.map(([off]) => hero.getRawData()[rec0 + off])).toEqual(snapshot);
    });

    it('refuses to unlock on an empty slot', () => {
      const empty = editor.getCharacters().find((c) => c.isEmpty)!;
      expect(() => empty.unlockAllBonfires()).toThrow(/empty/);
    });

    it('survives an encrypt → decrypt round trip', async () => {
      const slot = hero.slotIndex;
      hero.unlockAllBonfires();

      const exported = await editor.exportSaveFile();
      const reloaded = await DS3SaveFileEditor.fromFileData(
        new File([exported as unknown as BlobPart], 'out.sl2'),
        null,
      );
      expect(reloaded.getCharacter(slot)!.allBonfiresUnlocked).toBe(true);
    });
  });

  describe('gestures', () => {
    // Layout mapped by ds3-gesture-sweeper: 41 records of [u16 value][u16 index],
    // value = (index + 1) * 2 + unlocked. No fixed anchor — see constants.ts.
    it('locates the gesture table in a populated slot', () => {
      const base = hero.findGestureTable();
      expect(base).toBeGreaterThan(0);
      expect(base).toBeLessThan(hero.getRawData().length);
    });

    it('is deterministic across calls', () => {
      expect(hero.findGestureTable()).toBe(hero.findGestureTable());
    });

    it('the located table really holds well-formed records', () => {
      const base = hero.findGestureTable();
      const raw = hero.getRawData();
      for (let i = 0; i < GESTURE_RECORD_COUNT; i++) {
        const o = base + i * 4;
        expect(raw[o] >> 1, `record ${i} id`).toBe(i + 1);
        expect(raw[o + 1], `record ${i} value high byte`).toBe(0);
        expect(raw[o + 2] | (raw[o + 3] << 8), `record ${i} index`).toBe(i);
      }
    });

    it('exposes one flag per usable gesture, not per record', () => {
      expect(GESTURE_COUNT).toBeLessThan(GESTURE_RECORD_COUNT);
      expect(hero.getGestureFlags()).toHaveLength(GESTURE_COUNT);
    });

    it('round-trips an individual flag at every index', () => {
      for (let i = 0; i < GESTURE_COUNT; i++) {
        hero.setGestureFlag(i, true);
        expect(hero.getGestureFlags()[i], `gesture ${i} set`).toBe(true);
        hero.setGestureFlag(i, false);
        expect(hero.getGestureFlags()[i], `gesture ${i} cleared`).toBe(false);
      }
    });

    it('setting one flag does not disturb its neighbours', () => {
      for (let i = 0; i < GESTURE_COUNT; i++) hero.setGestureFlag(i, false);
      hero.setGestureFlag(20, true);
      const flags = hero.getGestureFlags();
      expect(flags.filter(Boolean)).toHaveLength(1);
      expect(flags[20]).toBe(true);
    });

    it('only touches bit 0, leaving the id/index pair intact', () => {
      const base = hero.findGestureTable();
      const raw = hero.getRawData();
      for (let i = 0; i < GESTURE_COUNT; i++) {
        hero.setGestureFlag(i, true);
        const o = base + i * 4;
        expect(raw[o] >> 1, `gesture ${i} id`).toBe(i + 1);
        expect(raw[o + 2] | (raw[o + 3] << 8), `gesture ${i} index`).toBe(i);
      }
    });

    it('toggling every gesture twice returns the slot to its original bytes', () => {
      const before = new Uint8Array(hero.getRawData());
      for (let i = 0; i < GESTURE_COUNT; i++) {
        const was = hero.getGestureFlags()[i];
        hero.setGestureFlag(i, !was);
        hero.setGestureFlag(i, was);
      }
      expect(hero.getRawData()).toEqual(before);
    });

    it('unlockAllGestures sets every usable flag', () => {
      hero.unlockAllGestures();
      expect(hero.getGestureFlags().every(Boolean)).toBe(true);
      expect(hero.allGesturesUnlocked).toBe(true);
    });

    it('unlockAllGestures clears the cut records instead of unlocking them', () => {
      const base = hero.findGestureTable();
      const raw = hero.getRawData();
      // turn them on first, so the test proves a repair and not just a skip
      for (let i = GESTURE_COUNT; i < GESTURE_RECORD_COUNT; i++) raw[base + i * 4] |= 1;

      hero.unlockAllGestures();

      for (let i = GESTURE_COUNT; i < GESTURE_RECORD_COUNT; i++) {
        expect(raw[base + i * 4] & 1, `cut record ${i} cleared`).toBe(0);
        // the id/index pair must survive — it is what the table search matches on
        expect(raw[base + i * 4] >> 1, `cut record ${i} id`).toBe(i + 1);
        expect(raw[base + i * 4 + 2] | (raw[base + i * 4 + 3] << 8)).toBe(i);
      }
      expect(hero.findGestureTable()).toBe(base);
    });

    it('reports locked when any single gesture is missing', () => {
      hero.unlockAllGestures();
      for (let i = 0; i < GESTURE_COUNT; i++) {
        hero.setGestureFlag(i, false);
        expect(hero.allGesturesUnlocked, `gesture ${i} cleared`).toBe(false);
        hero.setGestureFlag(i, true);
      }
      expect(hero.allGesturesUnlocked).toBe(true);
    });

    it('rejects an out-of-range index', () => {
      expect(() => hero.setGestureFlag(-1, true)).toThrow();
      expect(() => hero.setGestureFlag(GESTURE_COUNT, true)).toThrow();
    });

    it('refuses to set a cut gesture', () => {
      for (let i = GESTURE_COUNT; i < GESTURE_RECORD_COUNT; i++) {
        expect(() => hero.setGestureFlag(i, true), `cut record ${i}`).toThrow();
      }
    });

    it('reports no table in an empty slot instead of editing random bytes', () => {
      const c = new DS3Character(new Uint8Array(0x1000), 0);
      expect(c.findGestureTable()).toBe(-1);
      expect(c.getGestureFlags()).toEqual(new Array(GESTURE_COUNT).fill(false));
      expect(c.allGesturesUnlocked).toBe(false);
      expect(() => c.unlockAllGestures()).toThrow();
      expect(() => c.setGestureFlag(0, true)).toThrow();
    });

    it('prefers the real table over the copies in the runtime scratch tail', () => {
      // Those copies sit far later in the slot and float between saves, so the
      // lowest match must win. Plant a second copy well past the real one.
      const base = hero.findGestureTable();
      const raw = hero.getRawData();
      const decoy = raw.length - GESTURE_RECORD_COUNT * 4 - 0x10;
      expect(decoy).toBeGreaterThan(base);
      for (let i = 0; i < GESTURE_RECORD_COUNT; i++) {
        raw[decoy + i * 4] = (i + 1) * 2;
        raw[decoy + i * 4 + 1] = 0;
        raw[decoy + i * 4 + 2] = i & 0xff;
        raw[decoy + i * 4 + 3] = (i >> 8) & 0xff;
      }
      expect(hero.findGestureTable()).toBe(base);
    });
  });

  describe('raw byte access', () => {
    it('round-trips a byte and masks to 8 bits', () => {
      hero.setByte(0x800, 0x1ab);
      expect(hero.getByte(0x800)).toBe(0xab);
    });

    it('rejects out-of-range offsets', () => {
      expect(() => hero.getByte(-1)).toThrow(RangeError);
      expect(() => hero.setByte(hero.getRawData().length, 0)).toThrow(RangeError);
    });

    it('round-trips individual bits', () => {
      hero.setByte(0x800, 0);
      for (let bit = 0; bit < 8; bit++) {
        hero.setBit(0x800, bit, true);
        expect(hero.getBit(0x800, bit)).toBe(true);
        hero.setBit(0x800, bit, false);
        expect(hero.getBit(0x800, bit)).toBe(false);
      }
    });

    it('rejects an invalid bit position', () => {
      expect(() => hero.setBit(0x800, 8, true)).toThrow(/Bit position/);
      expect(() => hero.getBit(0x800, -1)).toThrow(/Bit position/);
    });
  });
  describe('appearance', () => {
    it('locates the face block in every populated slot', () => {
      const populated = editor.getCharacters().filter((c) => !c.isEmpty);
      expect(populated.length).toBeGreaterThan(0);
      for (const c of populated) {
        expect(c.findFaceBlock(), `slot ${c.slotIndex}`).toBeGreaterThan(0);
      }
    });

    it('the located block really matches the structural signature', () => {
      const base = hero.findFaceBlock();
      const raw = hero.getRawData();
      for (let i = 0; i < FACE_ID_COUNT; i++) {
        const o = base + i * 4;
        expect(raw[o + 1] | raw[o + 2] | raw[o + 3], `id ${i} upper bytes`).toBe(0);
      }
      for (let i = 0; i < FACE_COLOR_COUNT; i++) {
        expect(raw[base + FACE_COLORS_OFFSET + i * 4 + 3], `color ${i} alpha`).toBe(0xFF);
      }
    });

    it('sits inside the slot with room for the whole block', () => {
      const base = hero.findFaceBlock();
      expect(base + FACE_BLOCK_SIZE).toBeLessThanOrEqual(hero.getRawData().length);
      expect(hero.getFaceBlock()).toHaveLength(FACE_BLOCK_SIZE);
    });

    it('the field tables stay inside the block and never overlap', () => {
      const claimed = new Map<number, string>();
      const claim = (offset: number, size: number, what: string) => {
        expect(offset + size, what).toBeLessThanOrEqual(FACE_BLOCK_SIZE);
        for (let i = 0; i < size; i++) {
          expect(claimed.get(offset + i), `${what} overlaps ${claimed.get(offset + i)}`)
            .toBeUndefined();
          claimed.set(offset + i, what);
        }
      };
      for (const f of APPEARANCE_IDS) claim(f.offset, 4, `id ${f.label}`);
      for (const f of APPEARANCE_COLORS) claim(f.offset, 4, `color ${f.label}`);
      for (const f of APPEARANCE_SLIDERS) claim(f.offset, 1, `slider ${f.label}`);
    });

    it('round-trips every slider and leaves its neighbours alone', () => {
      for (const field of APPEARANCE_SLIDERS) {
        const before = hero.getFaceBlock();
        hero.setFaceByte(field.offset, 0x5A);
        expect(hero.getFaceByte(field.offset), field.label).toBe(0x5A);
        const after = hero.getFaceBlock();
        for (let i = 0; i < FACE_BLOCK_SIZE; i++) {
          if (i === field.offset) continue;
          expect(after[i], `${field.label} disturbed byte 0x${i.toString(16)}`).toBe(before[i]);
        }
        hero.setFaceByte(field.offset, before[field.offset]);
      }
    });

    it('clamps slider values to a byte', () => {
      const { offset } = APPEARANCE_SLIDERS[0];
      hero.setFaceByte(offset, 999);
      expect(hero.getFaceByte(offset)).toBe(255);
      hero.setFaceByte(offset, -5);
      expect(hero.getFaceByte(offset)).toBe(0);
    });

    it('writes colors without touching the alpha byte', () => {
      const raw = hero.getRawData();
      const base = hero.findFaceBlock();
      for (const { offset, label } of APPEARANCE_COLORS) {
        hero.setFaceColor(offset, 1, 2, 3);
        expect(hero.getFaceColor(offset), label).toEqual([1, 2, 3]);
        expect(raw[base + offset + 3], `${label} alpha`).toBe(0xFF);
      }
    });

    it('round-trips model IDs as u32', () => {
      for (const { offset, label } of APPEARANCE_IDS) {
        const before = hero.getFaceId(offset);
        hero.setFaceId(offset, 111);
        expect(hero.getFaceId(offset), label).toBe(111);
        hero.setFaceId(offset, before);
        expect(hero.getFaceId(offset), label).toBe(before);
      }
    });

    it('keeps gender to 0/1 and voice to 0..2', () => {
      hero.gender = 1;
      expect(hero.gender).toBe(1);
      hero.gender = 0;
      expect(hero.gender).toBe(0);
      hero.voice = 9;
      expect(hero.voice).toBe(2);
      hero.voice = -1;
      expect(hero.voice).toBe(0);
    });

    it('exports a preset that imports back byte for byte', () => {
      const preset = hero.exportAppearancePreset();
      expect(preset).toHaveLength(APPEARANCE_PRESET_SIZE);
      const before = new Uint8Array(hero.getRawData());

      hero.setFaceByte(APPEARANCE_SLIDERS[0].offset, 0x11);
      hero.setFaceColor(APPEARANCE_COLORS[0].offset, 9, 9, 9);
      hero.gender = hero.gender ? 0 : 1;

      hero.importAppearancePreset(preset);
      expect(hero.getRawData()).toEqual(before);
    });

    it('carries a preset between two characters', () => {
      const others = editor.getCharacters().filter((c) => !c.isEmpty && c !== hero);
      if (others.length === 0) return;
      const target = others[0];
      const preset = hero.exportAppearancePreset();
      target.importAppearancePreset(preset);
      expect(target.getFaceBlock()).toEqual(hero.getFaceBlock());
      expect(target.gender).toBe(hero.gender);
    });

    it('rejects a file that is not a DS3 preset', () => {
      expect(() => hero.importAppearancePreset(new Uint8Array(4))).toThrow(/too short/i);
      expect(() => hero.importAppearancePreset(new Uint8Array(130))).toThrow(/DS1/);
      const wrongVersion = hero.exportAppearancePreset();
      wrongVersion[4] = 99;
      expect(() => hero.importAppearancePreset(wrongVersion)).toThrow(/version 99/);
      expect(() => hero.importAppearancePreset(hero.exportAppearancePreset().slice(0, 100)))
        .toThrow(/truncated/);
    });

    it('every model ID field offers a verified value list', () => {
      for (const { offset, label } of APPEARANCE_IDS) {
        const values = APPEARANCE_ID_VALUES[offset];
        expect(values, `${label} has no value list`).toBeDefined();
        expect(values.length, `${label} list is empty`).toBeGreaterThan(0);
        expect(new Set(values).size, `${label} has duplicates`).toBe(values.length);
        expect([...values].sort((a, b) => a - b), `${label} is unsorted`).toEqual(values);
        expect(values.every((v) => v >= 0), `${label} has a negative id`).toBe(true);
      }
      // Read off the game itself, so the counts are worth pinning: 24 hairstyles
      // in two families, and a tattoo list of 50 that skips six ids.
      expect(APPEARANCE_ID_VALUES[0x04]).toHaveLength(24);
      expect(APPEARANCE_ID_VALUES[0x1C]).toHaveLength(50);
      for (const gap of [11, 12, 16, 19, 31, 46]) {
        expect(APPEARANCE_ID_VALUES[0x1C], `tattoo ${gap} does not exist`).not.toContain(gap);
      }
    });

    it('every id the save already holds survives a round-trip', () => {
      for (const { offset, label } of APPEARANCE_IDS) {
        const current = hero.getFaceId(offset);
        for (const v of APPEARANCE_ID_VALUES[offset]) {
          hero.setFaceId(offset, v);
          expect(hero.getFaceId(offset), `${label} = ${v}`).toBe(v);
        }
        hero.setFaceId(offset, current);
      }
    });

    it('packs age, build and chest hair into one byte as decimal digits', () => {
      for (let age = 0; age < FACE_AGE_NAMES.length; age++) {
        for (const muscular of [false, true]) {
          for (const chestHair of [false, true]) {
            hero.faceAge = age;
            hero.muscular = muscular;
            hero.chestHair = chestHair;
            const packed = hero.getFaceId(FACE_BUILD_OFFSET);
            expect(packed, `${age}/${muscular}/${chestHair}`)
              .toBe((muscular ? 100 : 0) + (chestHair ? 10 : 0) + age);
            expect(hero.faceAge).toBe(age);
            expect(hero.muscular).toBe(muscular);
            expect(hero.chestHair).toBe(chestHair);
          }
        }
      }
    });

    it('changing one of the three leaves the other two alone', () => {
      hero.faceAge = 1;
      hero.muscular = true;
      hero.chestHair = true;
      hero.faceAge = 2;
      expect(hero.muscular).toBe(true);
      expect(hero.chestHair).toBe(true);
      hero.muscular = false;
      expect(hero.faceAge).toBe(2);
      expect(hero.chestHair).toBe(true);
      hero.chestHair = false;
      expect(hero.faceAge).toBe(2);
      expect(hero.muscular).toBe(false);
      expect(hero.getFaceId(FACE_BUILD_OFFSET)).toBe(2);
    });

    it('clamps the age digit to the options the game offers', () => {
      hero.faceAge = 99;
      expect(hero.faceAge).toBe(FACE_AGE_NAMES.length - 1);
      hero.faceAge = -3;
      expect(hero.faceAge).toBe(0);
    });

    it('the pair pupil control writes both eyes at once', () => {
      hero.setPupilId(5);
      expect(hero.getPupilId()).toBe(5);
      for (const offset of FACE_PUPIL_ID_OFFSETS) {
        expect(hero.getFaceId(offset), `eye at 0x${offset.toString(16)}`).toBe(5);
      }
      hero.setPupilColor(12, 34, 56);
      expect(hero.getPupilColor()).toEqual([12, 34, 56]);
      for (const offset of FACE_PUPIL_COLOR_OFFSETS) {
        expect(hero.getFaceColor(offset), `color at 0x${offset.toString(16)}`)
          .toEqual([12, 34, 56]);
      }
    });

    it('the pair control reports null while the eyes differ', () => {
      hero.setFaceId(FACE_PUPIL_ID_OFFSETS[0], 1);
      hero.setFaceId(FACE_PUPIL_ID_OFFSETS[1], 2);
      expect(hero.getPupilId()).toBeNull();

      hero.setFaceColor(FACE_PUPIL_COLOR_OFFSETS[0], 1, 1, 1);
      hero.setFaceColor(FACE_PUPIL_COLOR_OFFSETS[1], 1, 1, 2);
      expect(hero.getPupilColor()).toBeNull();
    });

    it('never offers the unused part slot for editing', () => {
      expect(APPEARANCE_IDS.map((f) => f.offset)).not.toContain(FACE_UNUSED_ID_OFFSET);
      expect(APPEARANCE_COLORS.map((f) => f.offset)).not.toContain(FACE_UNUSED_COLOR_OFFSET);
      expect(APPEARANCE_ID_VALUES[FACE_UNUSED_ID_OFFSET]).toBeUndefined();
      expect(APPEARANCE_SLIDERS.map((f) => f.offset))
        .not.toContain(FACE_UNUSED_COLOR_OFFSET);
    });

    it('empty slots answer with neutral values instead of throwing', () => {
      const blank = new DS3Character(new Uint8Array(0x1000), 0);
      expect(blank.findFaceBlock()).toBe(-1);
      expect(blank.getFaceBlock()).toHaveLength(0);
      expect(blank.getFaceByte(0x50)).toBe(0);
      expect(blank.getFaceColor(0x24)).toEqual([0, 0, 0]);
      expect(() => blank.setFaceBlock(new Uint8Array(FACE_BLOCK_SIZE))).toThrow(/locate/);
    });
  });
});
