import { describe, it, expect, beforeEach } from 'vitest';
import { SaveFileEditor } from '../../src/apps/ds1/lib/SaveFileEditor';
import { Character } from '../../src/apps/ds1/lib/Character';
import { BONFIRE_BIT_INDICES } from '../../src/apps/ds1/lib/Character';
import {
  STATS_OFFSETS,
  VIT_TO_HP,
  END_TO_STAMINA,
  PlayerClass,
} from '../../src/apps/ds1/lib/constants';
import { hasDS1Save, ds1SaveFile } from '../helpers/saves';

/** A standalone character buffer, for behaviour that needs no real save. */
function blankCharacter(size = 0x60014): Character {
  return new Character(new Uint8Array(size), 0);
}

describe.skipIf(!hasDS1Save)('DS1 Character (real save)', () => {
  let editor: SaveFileEditor;
  let hero: Character;

  beforeEach(async () => {
    // Fresh copy per test: Character mutates its buffer in place.
    editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    hero = editor.getCharacters().find((c) => !c.isEmpty)!;
  });

  describe('slot classification', () => {
    it('separates populated slots from empty ones', () => {
      const characters = editor.getCharacters();
      const populated = characters.filter((c) => !c.isEmpty);
      const empty = characters.filter((c) => c.isEmpty);

      expect(populated.length).toBeGreaterThan(0);
      expect(populated.length + empty.length).toBe(characters.length);
    });

    it('treats an all-zero buffer as empty', () => {
      expect(blankCharacter().isEmpty).toBe(true);
    });

    it('treats a too-short buffer as empty', () => {
      expect(new Character(new Uint8Array(0x10), 0).isEmpty).toBe(true);
    });

    it('a single non-zero byte in the probe window marks a slot populated', () => {
      const c = blankCharacter();
      c.setByte(0x20, 0x01);
      expect(c.isEmpty).toBe(false);
    });
  });

  describe('name', () => {
    it('reads a non-empty name for a populated slot', () => {
      expect(hero.name.length).toBeGreaterThan(0);
    });

    it('round-trips an ASCII name', () => {
      hero.name = 'Solaire';
      expect(hero.name).toBe('Solaire');
    });

    it('round-trips a non-ASCII name', () => {
      hero.name = '灰の勇者';
      expect(hero.name).toBe('灰の勇者');
    });

    it('mirrors the name into the second copy at 0x18C', () => {
      // DS1 stores the name twice; a refactor that drops the mirror write
      // leaves a stale name visible in-game.
      hero.name = 'Artorias';
      const primary = Array.from({ length: 16 }, (_, i) => hero.getByte(0x108 + i));
      const mirror = Array.from({ length: 16 }, (_, i) => hero.getByte(0x18c + i));
      expect(mirror).toEqual(primary);
    });

    it('truncates at 16 characters', () => {
      hero.name = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      expect(hero.name).toBe('ABCDEFGHIJKLMNOP');
    });

    it('clears the field for an empty name', () => {
      hero.name = '';
      expect(hero.name).toBe('');
      expect(hero.getByte(0x108)).toBe(0);
    });

    it('leaves no stale tail when overwriting a longer name', () => {
      hero.name = 'LongCharacterX';
      hero.name = 'Ash';
      expect(hero.name).toBe('Ash');
    });
  });

  describe('numeric fields', () => {
    it('round-trips level as 16-bit little-endian', () => {
      hero.level = 713;
      expect(hero.level).toBe(713);
      expect(hero.getByte(0x00f0)).toBe(713 & 0xff);
      expect(hero.getByte(0x00f1)).toBe(713 >> 8);
    });

    it('round-trips souls as 32-bit little-endian', () => {
      hero.souls = 0x12345678;
      expect(hero.souls).toBe(0x12345678);
      expect(hero.getByte(0x00f4)).toBe(0x78);
      expect(hero.getByte(0x00f7)).toBe(0x12);
    });

    it('round-trips the in-game maximum soul count', () => {
      hero.souls = 999_999_999; // DS1 caps souls here; well under 2^31
      expect(hero.souls).toBe(999_999_999);
    });

    it('KNOWN BUG: souls above 2^31-1 read back negative', () => {
      // The DS1 getter composes the value with a signed `<< 24` and never
      // applies `>>> 0`, so the top bit turns the result negative. DS3's
      // getter does apply `>>> 0` and clamps the setter to MAX_VALUES.SOULS.
      // Pinned so unification picks the DS3 behaviour on purpose.
      hero.souls = 0xffffffff;
      expect(hero.souls).toBe(-1);
    });

    it('KNOWN DIVERGENCE: the DS1 setter does not clamp out-of-range souls', () => {
      // DS3 clamps in the setter; DS1 silently wraps to the low 32 bits.
      hero.souls = 0x1_0000_0005;
      expect(hero.souls).toBe(5);
    });

    it('round-trips humanity', () => {
      hero.humanity = 99;
      expect(hero.humanity).toBe(99);
    });

    it('round-trips gender, physique and class', () => {
      hero.gender = 1;
      hero.physique = 4;
      hero.playerClass = PlayerClass.Pyromancer;
      expect(hero.gender).toBe(1);
      expect(hero.physique).toBe(4);
      expect(hero.playerClass).toBe(PlayerClass.Pyromancer);
    });

    it('round-trips hairstyle as 32-bit little-endian', () => {
      hero.hairstyle = 0x0a0b0c0d;
      expect(hero.hairstyle).toBe(0x0a0b0c0d);
    });

    it('masks byte fields to 8 bits', () => {
      hero.humanity = 0x1ff;
      expect(hero.humanity).toBe(0xff);
    });
  });

  describe('stats', () => {
    it('exposes every documented stat', () => {
      for (const stat of Object.keys(STATS_OFFSETS)) {
        expect(typeof hero.getStat(stat)).toBe('number');
      }
    });

    it('round-trips each stat independently', () => {
      const names = Object.keys(STATS_OFFSETS);
      names.forEach((stat, i) => hero.setStat(stat, 10 + i));
      names.forEach((stat, i) => expect(hero.getStat(stat), stat).toBe(10 + i));
    });

    it('throws on an unknown stat', () => {
      expect(() => hero.getStat('LCK')).toThrow(/Unknown stat/);
      expect(() => hero.setStat('LCK', 1)).toThrow(/Unknown stat/);
    });

    it('leaves HP alone when auto-update is off', () => {
      const before = hero.hp;
      hero.setStat('VIT', 40);
      expect(hero.hp).toBe(before);
    });

    it('derives HP from the VIT table when auto-update is on', () => {
      hero.setStat('VIT', 40, true);
      expect(hero.hp).toBe(VIT_TO_HP[40]);
    });

    it('derives stamina from the END table when auto-update is on', () => {
      hero.setStat('END', 30, true);
      expect(hero.stamina).toBe(END_TO_STAMINA[30]);
    });

    it('leaves derived values untouched for out-of-table stat values', () => {
      const before = hero.hp;
      hero.setStat('VIT', 0, true); // table starts at 1
      expect(hero.hp).toBe(before);
    });

    it('writes both current and max HP', () => {
      hero.hp = 1234;
      expect(hero.hp).toBe(1234);
      // max HP mirror
      expect(hero.getByte(0x007c) | (hero.getByte(0x007d) << 8)).toBe(1234);
    });
  });

  describe('appearance', () => {
    it('round-trips hair colour as floats', () => {
      hero.setHairColor(0.25, 0.5, 0.75);
      const [r, g, b] = hero.getHairColor();
      expect(r).toBeCloseTo(0.25, 6);
      expect(g).toBeCloseTo(0.5, 6);
      expect(b).toBeCloseTo(0.75, 6);
    });

    it('round-trips eye colour as floats', () => {
      hero.setEyeColor(0.1, 0.2, 0.3);
      const [r, g, b] = hero.getEyeColor();
      expect(r).toBeCloseTo(0.1, 6);
      expect(g).toBeCloseTo(0.2, 6);
      expect(b).toBeCloseTo(0.3, 6);
    });

    it('defaults the hair alpha channel to opaque when it was zero', () => {
      // A zero alpha renders the hair invisible in-game, so the setter
      // repairs it. This guard must survive unification.
      hero.setByte(0xe420, 0);
      hero.setByte(0xe421, 0);
      hero.setByte(0xe422, 0);
      hero.setByte(0xe423, 0);
      hero.setHairColor(1, 1, 1);
      expect(hero.getByte(0xe423)).not.toBe(0);
    });

    it('round-trips face data', () => {
      const face = new Uint8Array(50).map((_, i) => (i * 5) & 0xff);
      hero.setFaceData(face);
      expect(Array.from(hero.getFaceData().slice(0, 50))).toEqual(Array.from(face));
    });

    it('round-trips skin colour', () => {
      const skin = new Uint8Array(50).map((_, i) => (i * 3) & 0xff);
      hero.setSkinColor(skin);
      expect(Array.from(hero.getSkinColor().slice(0, 50))).toEqual(Array.from(skin));
    });

    it('face data and skin colour occupy separate regions', () => {
      hero.setFaceData(new Uint8Array(50).fill(0x11));
      hero.setSkinColor(new Uint8Array(50).fill(0x22));
      expect(Array.from(hero.getFaceData().slice(0, 50))).toEqual(new Array(50).fill(0x11));
      expect(Array.from(hero.getSkinColor().slice(0, 50))).toEqual(new Array(50).fill(0x22));
    });

    it('writes at most 50 bytes of face data', () => {
      const before = hero.getByte(0xe434 + 50);
      hero.setFaceData(new Uint8Array(64).fill(0xee));
      expect(hero.getByte(0xe434 + 50)).toBe(before);
    });
  });

  describe('pattern anchor', () => {
    it('finds Pattern1 inside the documented window', () => {
      const offset = hero.findPattern1();
      expect(offset).toBeGreaterThanOrEqual(0x1f000);
      expect(offset).toBeLessThanOrEqual(0x1ffff);
    });

    it('is deterministic across repeated calls', () => {
      expect(hero.findPattern1()).toBe(hero.findPattern1());
    });

    it('returns -1 when the buffer holds no pattern', () => {
      expect(blankCharacter().findPattern1()).toBe(-1);
    });

    it('anchors NG+ relative to the pattern', () => {
      const ng = hero.ngPlus;
      expect(ng).toBeGreaterThanOrEqual(0);
      hero.ngPlus = 3;
      expect(hero.ngPlus).toBe(3);
    });

    it('refuses to set NG+ without a pattern', () => {
      expect(() => {
        blankCharacter().ngPlus = 1;
      }).toThrow(/Pattern1 not found/);
    });
  });

  describe('bonfires', () => {
    it('exposes 24 warp flags', () => {
      expect(hero.getBonfireWarpFlags()).toHaveLength(24);
    });

    it('round-trips an individual flag at every bit index', () => {
      for (let bit = 0; bit < 24; bit++) {
        hero.setBonfireWarpFlag(bit, true);
        expect(hero.getBonfireWarpFlags()[bit], `bit ${bit} set`).toBe(true);
        hero.setBonfireWarpFlag(bit, false);
        expect(hero.getBonfireWarpFlags()[bit], `bit ${bit} cleared`).toBe(false);
      }
    });

    it('setting one flag does not disturb its neighbours', () => {
      for (let bit = 0; bit < 24; bit++) hero.setBonfireWarpFlag(bit, false);
      hero.setBonfireWarpFlag(9, true);
      const flags = hero.getBonfireWarpFlags();
      expect(flags.filter(Boolean)).toHaveLength(1);
      expect(flags[9]).toBe(true);
    });

    it('unlockAllBonfires writes the documented byte pattern', () => {
      hero.unlockAllBonfires();
      const status = hero.getBonfireStatus()!;
      expect(status.values).toEqual([0xf8, 0xff, 0xff, 0x22]);
    });

    it('unlockAllBonfires leaves bits 0-2 clear and every other bit set', () => {
      hero.unlockAllBonfires();
      const flags = hero.getBonfireWarpFlags();
      expect(flags.slice(0, 3)).toEqual([false, false, false]);
      expect(flags.slice(3).every(Boolean)).toBe(true);
    });

    it('areBonfiresUnlocked agrees with unlockAllBonfires', () => {
      hero.unlockAllBonfires();
      expect(hero.areBonfiresUnlocked()).toBe(true);
    });

    it('the live UI path reports every bonfire unlocked after unlockAllBonfires', () => {
      // This is what BonfiresTab actually does.
      hero.unlockAllBonfires();
      const flags = hero.getBonfireWarpFlags();
      expect(flags.slice(3).every(Boolean)).toBe(true);
      expect(hero.getWarpFlag()).toBe(true);
    });

    it('reports locked when any single bonfire is missing', () => {
      hero.unlockAllBonfires();
      for (const bit of BONFIRE_BIT_INDICES) {
        hero.setBonfireWarpFlag(bit, false);
        expect(hero.areBonfiresUnlocked(), `bit ${bit} cleared`).toBe(false);
        hero.setBonfireWarpFlag(bit, true);
      }
      expect(hero.areBonfiresUnlocked()).toBe(true);
    });

    it('ignores the warp bits 0-2, which are not bonfires', () => {
      hero.unlockAllBonfires();
      for (const bit of [0, 1, 2]) hero.setBonfireWarpFlag(bit, true);
      expect(hero.areBonfiresUnlocked()).toBe(true);
      for (const bit of [0, 1, 2]) hero.setBonfireWarpFlag(bit, false);
      expect(hero.areBonfiresUnlocked()).toBe(true);
    });

    it('recognises a save unlocked by an older build (0xF0 in the first byte)', () => {
      // Pre-fix builds wrote 0xF0, leaving The Catacombs (bit 3) locked, so
      // such a save is genuinely not fully unlocked and must report false.
      hero.unlockAllBonfires();
      hero.setBonfireWarpFlag(3, false);
      expect(hero.areBonfiresUnlocked()).toBe(false);
    });

    it('round-trips the warp flag', () => {
      hero.setWarpFlag(true);
      expect(hero.getWarpFlag()).toBe(true);
      hero.setWarpFlag(false);
      expect(hero.getWarpFlag()).toBe(false);
    });

    it('degrades gracefully without a pattern', () => {
      const blank = blankCharacter();
      expect(blank.getBonfireWarpFlags()).toEqual(new Array(24).fill(false));
      expect(blank.getBonfireStatus()).toBeNull();
      expect(blank.areBonfiresUnlocked()).toBe(false);
      expect(blank.getWarpFlag()).toBe(false);
      expect(() => blank.unlockAllBonfires()).toThrow();
    });
  });

  describe('world event flags', () => {
    it('reads a flag relative to the pattern', () => {
      expect(typeof hero.getWorldEventFlag('D23D', 3, false)).toBe('boolean');
    });

    it('honours the reverse modifier', () => {
      const direct = hero.getWorldEventFlag('D23D', 3, false);
      expect(hero.getWorldEventFlag('D23D', 3, true)).toBe(!direct);
    });

    it('returns false for an out-of-range offset', () => {
      expect(hero.getWorldEventFlag('FFFFFF', 0, false)).toBe(false);
    });
  });

  describe('raw byte access', () => {
    it('round-trips a byte', () => {
      hero.setByte(0x500, 0x5a);
      expect(hero.getByte(0x500)).toBe(0x5a);
    });

    it('masks writes to 8 bits', () => {
      hero.setByte(0x500, 0x1ff);
      expect(hero.getByte(0x500)).toBe(0xff);
    });

    it('rejects out-of-range offsets', () => {
      expect(() => hero.getByte(-1)).toThrow(/out of range/);
      expect(() => hero.getByte(0x7fffffff)).toThrow(/out of range/);
      expect(() => hero.setByte(-1, 0)).toThrow(/out of range/);
    });
  });
});
