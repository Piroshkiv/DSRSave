import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

type Entry = {
  Type: string;
  Id: string;
  Name: string;
  MaxStackCount: number;
  Category?: string;
  MaxUpgrade?: number | null;
  Safe?: boolean;
};

async function loadJson(name: string): Promise<Record<string, Entry[]>> {
  return JSON.parse(await readFile(path.join(publicDir, 'json', name), 'utf8'));
}

const parseId = (e: Entry) => parseInt(e.Id, 16) >>> 0;
/**
 * The top nibble of an id encodes the category (0x0 weapon, 0x1 armour,
 * 0x2 ring, 0x4 goods); the numeric item id lives in the low 28 bits.
 */
const numericId = (e: Entry) => parseId(e) & 0x0fffffff;
const flatten = (db: Record<string, Entry[]>) =>
  Object.entries(db).flatMap(([collection, items]) =>
    (items ?? []).map((item) => ({ collection, item })),
  );

describe('DS3 items database (public/json/ds3_items.json)', () => {
  it('is valid JSON with the expected collections', async () => {
    const db = await loadJson('ds3_items.json');
    for (const key of [
      'weapon_items',
      'armor_items',
      'ring_items',
      'magic_items',
      'consumable_items',
      'ore_items',
      'key_items',
      'ammunition_items',
      'covenant_items',
    ]) {
      expect(Array.isArray(db[key]), key).toBe(true);
    }
  });

  it('every entry has the fields the editor reads', async () => {
    const db = await loadJson('ds3_items.json');
    for (const { collection, item } of flatten(db)) {
      expect(typeof item.Id, `${collection}/${item.Name}`).toBe('string');
      expect(typeof item.Type, `${collection}/${item.Name}`).toBe('string');
      expect(typeof item.Name, collection).toBe('string');
      expect(item.Name.length, `${collection} entry with empty name`).toBeGreaterThan(0);
      expect(Number.isFinite(item.MaxStackCount), `${collection}/${item.Name}`).toBe(true);
    }
  });

  it('every id parses as hex', async () => {
    const db = await loadJson('ds3_items.json');
    for (const { collection, item } of flatten(db)) {
      expect(Number.isNaN(parseId(item)), `${collection}/${item.Name} (${item.Id})`).toBe(false);
    }
  });

  // ---- the invariant that motivated removing "Greatsword of Artorias" ----

  it('no weapon id is an upgrade variant of another weapon', async () => {
    // DS3 weapon ids are laid out as base + infusion*100 + upgradeLevel, and
    // every real base is a multiple of 100. An entry whose id is not a
    // multiple of 100 is really some other weapon at +N wearing a fake name;
    // adding it writes an upgrade-level id as a base item.
    const db = await loadJson('ds3_items.json');
    const offenders = db.weapon_items
      .filter((w) => numericId(w) % 100 !== 0)
      .map((w) => `${w.Name} (${w.Id})`);

    expect(offenders).toEqual([]);
  });

  it('the fake "Greatsword of Artorias" entry stays deleted', async () => {
    const db = await loadJson('ds3_items.json');
    const artorias = flatten(db).filter(({ item }) => /artorias/i.test(item.Name));
    expect(artorias.map(({ item }) => item.Name)).toEqual([]);
  });

  it('id 0x0060216A is absent (it is Wolf Knight\'s Greatsword +10)', async () => {
    const db = await loadJson('ds3_items.json');
    expect(db.weapon_items.some((w) => parseId(w) === 0x0060216a)).toBe(false);
    // The genuine base weapon must still be there.
    expect(db.weapon_items.some((w) => parseId(w) === 0x00602160)).toBe(true);
  });

  it('armour and magic ids are all proper bases', async () => {
    const db = await loadJson('ds3_items.json');
    for (const key of ['armor_items', 'magic_items']) {
      const offenders = db[key].filter((e) => numericId(e) % 100 !== 0).map((e) => e.Name);
      expect(offenders, key).toEqual([]);
    }
  });

  // ---- Safe flag hygiene ----

  it('Safe is only ever the literal false', async () => {
    // The editor tests `Safe === false`; any other falsy value would be
    // silently treated as safe.
    const db = await loadJson('ds3_items.json');
    for (const { collection, item } of flatten(db)) {
      if ('Safe' in item) {
        expect(item.Safe, `${collection}/${item.Name}`).toBe(false);
      }
    }
  });

  it('still marks the known cut/debug content unsafe', async () => {
    const db = await loadJson('ds3_items.json');
    const unsafeNames = new Set(
      flatten(db)
        .filter(({ item }) => item.Safe === false)
        .map(({ item }) => item.Name),
    );

    // Representatives of each cut-content family found during the audit.
    for (const name of [
      'Fists',
      'transparent dagger',
      'Debug Life Ring',
      'Empty Helm Slot',
      'Ruin Sentinel Helm',
      'Dark Orb',
      'Combustion',
      'Dragon Scale',
      'Praise the Sun',
    ]) {
      expect(unsafeNames.has(name), `${name} should be unsafe`).toBe(true);
    }
  });

  it('keeps the three verified real items selectable', async () => {
    // Farron Hail (Orbeck, Sage's Scroll), Champion's Bones (Ashes of
    // Ariandel) and Young Grass Dew (Ringed City) are genuine DS3 items that
    // had been mis-flagged. Regressing this hides them in Safe Mode again.
    const db = await loadJson('ds3_items.json');
    const byName = new Map(flatten(db).map(({ item }) => [item.Name, item]));

    for (const name of ['Farron Hail', 'Champions Bones', 'Young Grass Dew']) {
      const item = byName.get(name);
      expect(item, `${name} missing from the database`).toBeDefined();
      expect(item!.Safe, `${name} is flagged unsafe again`).toBeUndefined();
    }
  });

  it('every unsafe weapon is non-upgradable', async () => {
    const db = await loadJson('ds3_items.json');
    for (const w of db.weapon_items.filter((x) => x.Safe === false)) {
      expect(w.MaxUpgrade ?? 0, w.Name).toBe(0);
    }
  });

  it('no non-weapon collection carries an upgrade level', async () => {
    const db = await loadJson('ds3_items.json');
    for (const [collection, items] of Object.entries(db)) {
      if (collection === 'weapon_items') continue;
      for (const item of items) {
        expect(item.MaxUpgrade ?? 0, `${collection}/${item.Name}`).toBe(0);
      }
    }
  });

  // ---- id collisions ----

  it('the only cross-collection id overlap is rings vs covenant badges', async () => {
    const db = await loadJson('ds3_items.json');
    const seen = new Map<number, string>();
    const collisions: string[] = [];

    for (const { collection, item } of flatten(db)) {
      const id = parseId(item);
      const prior = seen.get(id);
      if (prior) {
        const pair = [prior, collection].sort().join(' + ');
        if (pair !== 'covenant_items + ring_items') {
          collisions.push(`0x${id.toString(16)}: ${pair} (${item.Name})`);
        }
      } else {
        seen.set(id, collection);
      }
    }

    expect(collisions).toEqual([]);
  });

  it('no collection contains a duplicate id', async () => {
    const db = await loadJson('ds3_items.json');
    for (const [collection, items] of Object.entries(db)) {
      const ids = items.map(parseId);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dupes.map((d) => `0x${d.toString(16)}`), collection).toEqual([]);
    }
  });
});

describe('DS1 items database (public/json/items.json)', () => {
  it('ships the collections the editor reads', async () => {
    const db = await loadJson('items.json');
    for (const key of [
      'weapon_items',
      'ring_items',
      'armor_items',
      'key_items',
      'usable_items',
      'ammunition_items',
      'material_items',
      'magic_items',
      'specials',
    ]) {
      expect(Array.isArray(db[key]), key).toBe(true);
      expect(db[key].length, key).toBeGreaterThan(0);
    }
  });

  it('does not ship four collections the old type used to declare', async () => {
    // The removed ItemsDatabase interface typed these as required `Item[]`
    // while the data had no such keys. Pinned so nobody adds the keys back
    // by accident — the catalogue simply reports an empty collection instead.
    const db = await loadJson('items.json');
    for (const key of ['consumable_items', 'soul_items', 'upgrade_items', 'spell_items']) {
      expect(db[key], key).toBeUndefined();
    }
  });

  it('every entry has the fields the editor reads', async () => {
    const db = await loadJson('items.json');
    for (const { collection, item } of flatten(db)) {
      expect(typeof item.Id, `${collection}/${item.Name}`).toBe('string');
      expect(typeof item.Type, `${collection}/${item.Name}`).toBe('string');
      expect(item.Name.length, collection).toBeGreaterThan(0);
      expect(Number.isFinite(item.MaxStackCount), `${collection}/${item.Name}`).toBe(true);
    }
  });

  it('every id parses as hex', async () => {
    const db = await loadJson('items.json');
    for (const { collection, item } of flatten(db)) {
      expect(Number.isNaN(parseId(item)), `${collection}/${item.Name} (${item.Id})`).toBe(false);
    }
  });

  it('no collection contains a duplicate id', async () => {
    const db = await loadJson('items.json');
    for (const [collection, items] of Object.entries(db)) {
      const ids = items.map(parseId);
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
      expect(dupes.map((d) => `0x${d.toString(16)}`), collection).toEqual([]);
    }
  });
});
