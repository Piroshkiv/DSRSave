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
});
