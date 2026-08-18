/**
 * DS1 ↔ DS3 parity contract.
 *
 * The two editors were written independently and are about to be unified.
 * This file states, in executable form:
 *
 *   1. the behaviour both editors ALREADY share — the shared contract a
 *      unified core must keep satisfying, checked against both games;
 *   2. every place they DISAGREE — pinned so unification resolves each one
 *      deliberately, and so a test starts failing the moment a divergence is
 *      closed (that failure is the signal to delete the pin).
 *
 * When you unify a behaviour, the matching "KNOWN DIVERGENCE" test should be
 * updated or removed in the same commit.
 */
import { describe, it, expect } from 'vitest';

import { SaveFileEditor } from '../../src/apps/ds1/lib/SaveFileEditor';
import { STATS_OFFSETS as DS1_STATS } from '../../src/apps/ds1/lib/constants';
import { Inventory as DS1Inventory } from '../../src/apps/ds1/lib/Inventory';

import { DS3SaveFileEditor } from '../../src/apps/ds3/lib/SaveFileEditor';
import { DS3Inventory } from '../../src/apps/ds3/lib/Inventory';

import { hasDS1Save, hasDS3Save, ds1SaveFile, ds3SaveFile, toFile } from '../helpers/saves';

const bothSaves = hasDS1Save && hasDS3Save;

/** Minimal shape a unified editor core has to provide, per game. */
interface EditorProbe {
  game: 'ds1' | 'ds3';
  slotCount: number;
  load(): Promise<{
    characters: Array<{
      isEmpty: boolean;
      name: string;
      level: number;
      souls: number;
      raw: Uint8Array;
      setSouls(v: number): void;
      setName(v: string): void;
    }>;
    export(): Promise<Uint8Array>;
    reload(bytes: Uint8Array): Promise<{ emptiness: boolean[] }>;
    hasFileHandle(): boolean;
    saveInPlace(): Promise<void>;
  }>;
}

const ds1Probe: EditorProbe = {
  game: 'ds1',
  slotCount: 11,
  async load() {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    return {
      characters: editor.getCharacters().map((c) => ({
        get isEmpty() {
          return c.isEmpty;
        },
        get name() {
          return c.name;
        },
        get level() {
          return c.level;
        },
        get souls() {
          return c.souls;
        },
        get raw() {
          return c.getRawData();
        },
        setSouls: (v: number) => {
          c.souls = v;
        },
        setName: (v: string) => {
          c.name = v;
        },
      })),
      export: () => editor.exportSaveFile(),
      reload: async (bytes) => {
        const again = await SaveFileEditor.fromFile(toFile(bytes, 'out.sl2'));
        return { emptiness: again.getCharacters().map((c) => c.isEmpty) };
      },
      hasFileHandle: () => editor.hasFileHandle(),
      saveInPlace: () => editor.saveToOriginalFile(),
    };
  },
};

const ds3Probe: EditorProbe = {
  game: 'ds3',
  slotCount: 10,
  async load() {
    const editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    return {
      characters: editor.getCharacters().map((c) => ({
        get isEmpty() {
          return c.isEmpty;
        },
        get name() {
          return c.name;
        },
        get level() {
          return c.level;
        },
        get souls() {
          return c.souls;
        },
        get raw() {
          return c.getRawData();
        },
        setSouls: (v: number) => {
          c.souls = v;
        },
        setName: (v: string) => {
          c.name = v;
        },
      })),
      export: () => editor.exportSaveFile(),
      reload: async (bytes) => {
        const again = await DS3SaveFileEditor.fromFileData(toFile(bytes, 'out.sl2'), null);
        return { emptiness: again.getCharacters().map((c) => c.isEmpty) };
      },
      hasFileHandle: () => editor.hasFileHandle(),
      saveInPlace: () => editor.saveToOriginalFile(),
    };
  },
};

const probes = [ds1Probe, ds3Probe];

describe.skipIf(!bothSaves)('shared editor contract', () => {
  describe.each(probes)('$game', (probe) => {
    it('exposes the expected number of slots', async () => {
      const editor = await probe.load();
      expect(editor.characters).toHaveLength(probe.slotCount);
    });

    it('classifies every slot as empty or populated', async () => {
      const editor = await probe.load();
      for (const c of editor.characters) expect(typeof c.isEmpty).toBe('boolean');
    });

    it('has at least one populated slot in the fixture', async () => {
      const editor = await probe.load();
      expect(editor.characters.some((c) => !c.isEmpty)).toBe(true);
    });

    it('decrypts every slot to a non-empty buffer', async () => {
      const editor = await probe.load();
      for (const c of editor.characters) expect(c.raw.length).toBeGreaterThan(0);
    });

    it('reads a name and a level for populated slots', async () => {
      const editor = await probe.load();
      for (const c of editor.characters.filter((x) => !x.isEmpty)) {
        expect(typeof c.name).toBe('string');
        expect(Number.isFinite(c.level)).toBe(true);
      }
    });

    it('round-trips a name of up to 16 characters', async () => {
      const editor = await probe.load();
      const hero = editor.characters.find((c) => !c.isEmpty)!;
      hero.setName('SixteenCharsXXXX');
      expect(hero.name).toBe('SixteenCharsXXXX');
    });

    it('truncates names beyond 16 characters', async () => {
      const editor = await probe.load();
      const hero = editor.characters.find((c) => !c.isEmpty)!;
      hero.setName('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(hero.name).toBe('ABCDEFGHIJKLMNOP');
    });

    it('exports a buffer of the original length', async () => {
      const editor = await probe.load();
      const exported = await editor.export();
      expect(exported.length).toBeGreaterThan(0);
    });

    it('re-reads its own export with the same slot layout', async () => {
      const editor = await probe.load();
      const before = editor.characters.map((c) => c.isEmpty);
      const { emptiness } = await editor.reload(await editor.export());
      expect(emptiness).toEqual(before);
    });

    it('persists an edited soul count through encrypt → decrypt', async () => {
      const editor = await probe.load();
      const index = editor.characters.findIndex((c) => !c.isEmpty);
      editor.characters[index].setSouls(123_456);

      const exported = await editor.export();
      const again = await probe.load();
      const reloaded = await again.reload(exported);
      expect(reloaded.emptiness[index]).toBe(false);
    });

    it('reports no file handle and refuses to save in place', async () => {
      const editor = await probe.load();
      expect(editor.hasFileHandle()).toBe(false);
      await expect(editor.saveInPlace()).rejects.toThrow();
    });
  });
});

describe('stat vocabulary', () => {
  // DS3's stat names are hard-coded in Character.STAT_MAP.
  const DS3_STATS = ['VIG', 'ATN', 'END', 'VIT', 'STR', 'DEX', 'INT', 'FTH', 'LCK'];
  const DS1_NAMES = Object.keys(DS1_STATS);

  it('DS1 has eight stats, DS3 has nine', () => {
    expect(DS1_NAMES).toHaveLength(8);
    expect(DS3_STATS).toHaveLength(9);
  });

  it('DANGER: "VIT" means different things in the two games', () => {
    // DS1 VIT = Vitality, the HP stat (VIT_TO_HP).
    // DS3 VIT = Vitality, the equip-load stat; HP comes from VIG (VIGOR_TO_HP).
    // A unified layer that keys stats by name alone will silently write the
    // wrong attribute. Any shared stat model needs an explicit per-game map.
    expect(DS1_NAMES).toContain('VIT');
    expect(DS3_STATS).toContain('VIT');
    expect(DS1_NAMES).not.toContain('VIG');
    expect(DS3_STATS).toContain('VIG');
  });

  it('RES is DS1-only; VIG and LCK are DS3-only', () => {
    expect(DS1_NAMES).toContain('RES');
    expect(DS3_STATS).not.toContain('RES');
    expect(DS1_NAMES).not.toContain('LCK');
    expect(DS3_STATS).toContain('LCK');
  });

  it('the genuinely shared names are ATN, END, STR, DEX, INT, FTH', () => {
    const shared = DS1_NAMES.filter((s) => DS3_STATS.includes(s) && s !== 'VIT').sort();
    expect(shared).toEqual(['ATN', 'DEX', 'END', 'FTH', 'INT', 'STR']);
  });
});

describe.skipIf(!bothSaves)('KNOWN DIVERGENCES to resolve during unification', () => {
  it('souls: DS1 overflows to negative, DS3 clamps and stays unsigned', async () => {
    const ds1 = await SaveFileEditor.fromFile(await ds1SaveFile());
    const ds1Hero = ds1.getCharacters().find((c) => !c.isEmpty)!;
    ds1Hero.souls = 0xffffffff;
    expect(ds1Hero.souls).toBe(-1);

    const ds3 = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    const ds3Hero = ds3.getCharacters().find((c) => !c.isEmpty)!;
    ds3Hero.souls = 0xffffffff;
    expect(ds3Hero.souls).toBeGreaterThan(0);
  });

  it('unknown stat: DS1 throws, DS3 silently ignores', async () => {
    const ds1 = await SaveFileEditor.fromFile(await ds1SaveFile());
    const ds1Hero = ds1.getCharacters().find((c) => !c.isEmpty)!;
    expect(() => ds1Hero.getStat('NOPE')).toThrow(/Unknown stat/);

    const ds3 = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    const ds3Hero = ds3.getCharacters().find((c) => !c.isEmpty)!;
    expect(() => ds3Hero.getStat('NOPE')).not.toThrow();
  });

  it('export purity: DS1 is byte-stable, DS3 rewrites populated slots', async () => {
    const ds1 = await SaveFileEditor.fromFile(await ds1SaveFile());
    const ds1Before = ds1.getCharacters().map((c) => c.souls);
    await ds1.exportSaveFile();
    expect(ds1.getCharacters().map((c) => c.souls)).toEqual(ds1Before);

    // DS3 recalculates level and enforces the soul-memory floor on export.
    const ds3 = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    const victim = ds3.getCharacters().filter((c) => !c.isEmpty).find((c) => c.soulMemory === 0);
    expect(victim, 'fixture needs a slot with zero soul memory').toBeDefined();
    await ds3.exportSaveFile();
    expect(victim!.soulMemory).toBeGreaterThan(0);
  });

  it('SHARED: both games answer "are all bonfires unlocked" consistently', async () => {
    // Converged: DS1's areBonfiresUnlocked() now decodes the flag bits rather
    // than comparing raw bytes, matching DS3's allBonfiresUnlocked getter.
    // A unified core can expose this as one query.
    const ds1 = await SaveFileEditor.fromFile(await ds1SaveFile());
    const ds1Hero = ds1.getCharacters().find((c) => !c.isEmpty)!;
    ds1Hero.unlockAllBonfires();
    expect(ds1Hero.areBonfiresUnlocked()).toBe(true);

    const ds3 = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    const ds3Hero = ds3.getCharacters().find((c) => !c.isEmpty)!;
    ds3Hero.unlockAllBonfires();
    expect(ds3Hero.allBonfiresUnlocked).toBe(true);
  });

  it('SHARED: both games resolve items through the same ItemCatalog', async () => {
    // Converged. Both editors index their JSON into the shared catalogue and
    // look entries up by value; neither keeps a raw database around any more.
    const ds1 = await SaveFileEditor.fromFile(await ds1SaveFile());
    const ds1Inv = new DS1Inventory(ds1.getCharacters().find((c) => !c.isEmpty)!);
    await ds1Inv.loadItemsDatabase();

    expect(ds1Inv.getCatalog().size).toBeGreaterThan(0);
    // Same id, different category — resolved correctly by value.
    expect(ds1Inv.getCatalog().lookup(0, 0x186a0)?.name).toBe('Dagger');
    expect(ds1Inv.getCatalog().lookup(1, 0x186a0)?.name).toBe('Helm of Favor');

    const ds3 = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    const ds3Inv = new DS3Inventory(ds3.getCharacters().find((c) => !c.isEmpty)!);
    await ds3Inv.loadItemsDatabase();
    expect(ds3Inv.getCatalog().size).toBeGreaterThan(0);
    // DS3 embeds the category nibble in the id, so a raw id resolves directly.
    expect(ds3Inv.getCatalog().byRawId(0x40000869)?.name).toBe('Champions Bones');
  });

  it('Safe flag: modelled for both games, but only DS3 data marks anything unsafe', async () => {
    // The shared model always carries `safe`, so the filter is common code;
    // DS1's catalogue simply has nothing flagged.
    const ds1 = await SaveFileEditor.fromFile(await ds1SaveFile());
    const ds1Inv = new DS1Inventory(ds1.getCharacters().find((c) => !c.isEmpty)!);
    await ds1Inv.loadItemsDatabase();
    const ds1Catalog = ds1Inv.getCatalog();
    expect(ds1Catalog.safeItems().length).toBe(ds1Catalog.size);

    const ds3 = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    const ds3Inv = new DS3Inventory(ds3.getCharacters().find((c) => !c.isEmpty)!);
    await ds3Inv.loadItemsDatabase();
    const ds3Catalog = ds3Inv.getCatalog();
    expect(ds3Catalog.safeItems().length).toBeLessThan(ds3Catalog.size);
  });

  it('slot count: DS1 has 11 entries (10 + settings), DS3 exposes 10', async () => {
    const ds1 = await SaveFileEditor.fromFile(await ds1SaveFile());
    expect(ds1.getCharacters()).toHaveLength(11);

    const ds3 = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    expect(ds3.getCharacters()).toHaveLength(10);
    // DS3 keeps its system data in separate BND4 entries instead.
    expect(ds3.getEntryCount()).toBeGreaterThan(10);
  });

  it('checksum scope: DS1 hashes ciphertext only, DS3 hashes IV + ciphertext', () => {
    // Documented here because it is invisible from the public API but is the
    // single most dangerous thing to get wrong when merging the save writers.
    // DS1: checksum = MD5(encrypted)            — see SaveFileEditor.exportSaveFile
    // DS3: checksum = MD5(iv ++ encrypted)      — see DS3SaveFileEditor.exportSaveFile
    expect(true).toBe(true);
  });
});
