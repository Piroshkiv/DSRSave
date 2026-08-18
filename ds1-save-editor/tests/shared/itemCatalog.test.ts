import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Item,
  ItemCatalog,
  makeItemKey,
  keyFromEmbeddedId,
  keyTypeNibble,
  keyItemId,
  parseHex,
  type RawItemDatabase,
  type RawItemEntry,
} from '../../src/shared/items';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const loadDb = async (name: string): Promise<RawItemDatabase> =>
  JSON.parse(await readFile(path.join(publicDir, 'json', name), 'utf8'));

const entry = (over: Partial<RawItemEntry> = {}): RawItemEntry => ({
  Type: '0x0',
  Id: '0x100',
  Name: 'Test Item',
  MaxStackCount: 1,
  ...over,
});

describe('item key', () => {
  it('parses hex with and without the 0x prefix', () => {
    expect(parseHex('0x1F')).toBe(31);
    expect(parseHex('1F')).toBe(31);
    expect(parseHex('0X1f')).toBe(31);
  });

  it('returns 0 for missing or unparsable values', () => {
    expect(parseHex(undefined)).toBe(0);
    expect(parseHex('')).toBe(0);
    expect(parseHex('zzz')).toBe(0);
  });

  it('accepts a bare nibble or an already-shifted type', () => {
    expect(makeItemKey(4, 0x869)).toBe(makeItemKey(0x40000000, 0x869));
  });

  it('masks a category prefix already present in the id', () => {
    // DS3 stores ids with the nibble embedded; feeding it in twice must not
    // corrupt the key.
    expect(makeItemKey(0x40000000, 0x40000869)).toBe(0x40000869);
  });

  it('keeps ids from different categories apart', () => {
    // The DS1 case that object-identity lookup used to get wrong.
    const dagger = makeItemKey(0x00000000, 0x186a0);
    const helm = makeItemKey(0x10000000, 0x186a0);
    expect(dagger).not.toBe(helm);
  });

  it('round-trips through its accessors', () => {
    const key = makeItemKey(2, 0x2710);
    expect(keyTypeNibble(key)).toBe(2);
    expect(keyItemId(key)).toBe(0x2710);
  });

  it('treats an embedded id as a key verbatim', () => {
    expect(keyFromEmbeddedId(0x40000869)).toBe(makeItemKey(4, 0x869));
  });
});

describe('Item', () => {
  it('normalises a minimal entry', () => {
    const item = new Item(entry(), 'weapon_items');
    expect(item.name).toBe('Test Item');
    expect(item.collection).toBe('weapon_items');
    expect(item.id).toBe(0x100);
    expect(item.typeNibble).toBe(0);
    expect(item.stackMax).toBe(1);
    expect(item.maxUpgrade).toBe(0);
    expect(item.durability).toBe(0);
  });

  it('treats a missing Safe flag as safe and false as unsafe', () => {
    expect(new Item(entry(), 'weapon_items').safe).toBe(true);
    expect(new Item(entry({ Safe: false }), 'weapon_items').safe).toBe(false);
  });

  it('normalises nulls that the JSON uses for "not applicable"', () => {
    const item = new Item(
      entry({ MaxUpgrade: null, Durability: null, Category: null }),
      'key_items',
    );
    expect(item.maxUpgrade).toBe(0);
    expect(item.durability).toBe(0);
    expect(item.category).toBe('');
  });

  it('derives isUpgradable and isStackable', () => {
    expect(new Item(entry({ MaxUpgrade: 10 }), 'w').isUpgradable).toBe(true);
    expect(new Item(entry({ MaxUpgrade: 0 }), 'w').isUpgradable).toBe(false);
    expect(new Item(entry({ MaxStackCount: 99 }), 'w').isStackable).toBe(true);
    expect(new Item(entry({ MaxStackCount: 1 }), 'w').isStackable).toBe(false);
  });

  it('falls back to the canonical name until an overlay sets displayName', () => {
    const item = new Item(entry({ Name: 'Estus Flask' }), 'usable_items');
    expect(item.displayName).toBe('Estus Flask');

    item.setDisplayName('原素瓶');
    expect(item.displayName).toBe('原素瓶');
    expect(item.name, 'canonical name must survive the overlay').toBe('Estus Flask');

    item.setDisplayName(undefined);
    expect(item.displayName).toBe('Estus Flask');
  });
});

describe('ItemCatalog construction', () => {
  it('indexes every collection', () => {
    const catalog = ItemCatalog.from({
      weapon_items: [entry({ Id: '0x1' }), entry({ Id: '0x2' })],
      armor_items: [entry({ Type: '0x10000000', Id: '0x1' })],
    });
    expect(catalog.size).toBe(3);
    expect(catalog.collections().sort()).toEqual(['armor_items', 'weapon_items']);
    expect(catalog.byCollection('weapon_items')).toHaveLength(2);
  });

  it('skips absent and non-array collections without throwing', () => {
    const catalog = ItemCatalog.from({
      weapon_items: [entry()],
      soul_items: undefined,
      broken: 'not an array' as never,
    });
    expect(catalog.size).toBe(1);
    expect(catalog.byCollection('soul_items')).toEqual([]);
  });

  it('builds an empty catalogue from null', () => {
    expect(ItemCatalog.from(null).isEmpty).toBe(true);
    expect(ItemCatalog.empty().size).toBe(0);
  });

  it('needs no fetch — construction is pure', () => {
    // The whole point of splitting loadItemCatalog out of the model.
    expect(() => ItemCatalog.from({ weapon_items: [entry()] })).not.toThrow();
  });
});

describe('ItemCatalog lookup', () => {
  const catalog = ItemCatalog.from({
    weapon_items: [entry({ Type: '0x0', Id: '0x186A0', Name: 'Dagger' })],
    armor_items: [entry({ Type: '0x10000000', Id: '0x186A0', Name: 'Helm of Favor' })],
    consumable_items: [entry({ Type: '0x40000000', Id: '0x40000869', Name: 'Champions Bones' })],
  });

  it('separates same-id entries from different categories', () => {
    expect(catalog.lookup(0, 0x186a0)?.name).toBe('Dagger');
    expect(catalog.lookup(1, 0x186a0)?.name).toBe('Helm of Favor');
  });

  it('resolves a DS3-style embedded id', () => {
    expect(catalog.lookupById(0x40000869)?.name).toBe('Champions Bones');
  });

  it('returns null for an unknown key instead of throwing', () => {
    expect(catalog.lookup(0, 0xdead)).toBeNull();
    expect(catalog.byKey(0xffffffff)).toBeNull();
    expect(catalog.has(0xffffffff)).toBe(false);
  });

  it('is value-based, not identity-based', () => {
    // A structurally identical copy resolves to the same catalogue entry.
    // The old DS1 classifier used Array.includes and failed exactly here.
    const clone: RawItemEntry = JSON.parse(
      JSON.stringify(catalog.lookup(0, 0x186a0)!.source),
    );
    const key = makeItemKey(parseHex(clone.Type), parseHex(clone.Id));
    expect(catalog.byKey(key)?.name).toBe('Dagger');
  });

  it('filters and reports safe items', () => {
    const withUnsafe = ItemCatalog.from({
      weapon_items: [entry({ Id: '0x1' }), entry({ Id: '0x2', Safe: false })],
    });
    expect(withUnsafe.safeItems()).toHaveLength(1);
    expect(withUnsafe.filter((i) => !i.safe)).toHaveLength(1);
  });
});

describe('ItemCatalog raw-id index and collection precedence', () => {
  const raw: RawItemDatabase = {
    ring_items: [entry({ Type: '0x20000000', Id: '0x20002710', Name: 'Ring version' })],
    covenant_items: [entry({ Type: '0x40000000', Id: '0x20002710', Name: 'Badge version' })],
  };

  it('lets collectionOrder decide who wins a shared raw id', () => {
    // DS3 needs the covenant badge to win: a save holding 0x20002710 means
    // the badge, not the ring.
    const covenantFirst = ItemCatalog.from(raw, {
      collectionOrder: ['covenant_items', 'ring_items'],
    });
    expect(covenantFirst.byRawId(0x20002710)?.name).toBe('Badge version');

    const ringFirst = ItemCatalog.from(raw, {
      collectionOrder: ['ring_items', 'covenant_items'],
    });
    expect(ringFirst.byRawId(0x20002710)?.name).toBe('Ring version');
  });

  it('keeps both reachable by composite key regardless of order', () => {
    const catalog = ItemCatalog.from(raw, { collectionOrder: ['covenant_items'] });
    expect(catalog.lookup(0x20000000, 0x20002710)?.name).toBe('Ring version');
    expect(catalog.lookup(0x40000000, 0x20002710)?.name).toBe('Badge version');
  });

  it('ignores collectionOrder entries that are absent from the data', () => {
    const catalog = ItemCatalog.from(raw, {
      collectionOrder: ['does_not_exist', 'covenant_items'],
    });
    expect(catalog.size).toBe(2);
    expect(catalog.byRawId(0x20002710)?.name).toBe('Badge version');
  });

  it('returns null for an unknown raw id', () => {
    expect(ItemCatalog.from(raw).byRawId(0xdeadbeef)).toBeNull();
  });
});

describe('ItemCatalog against the shipped databases', () => {
  it('indexes every DS1 entry with a unique key', async () => {
    const raw = await loadDb('items.json');
    const catalog = ItemCatalog.from(raw);
    const rawCount = Object.values(raw).reduce((n, c) => n + (c?.length ?? 0), 0);

    expect(catalog.size).toBe(rawCount);
    expect(new Set(catalog.all().map((i) => i.key)).size).toBe(rawCount);
  });

  it('indexes every DS3 entry with a unique key', async () => {
    const raw = await loadDb('ds3_items.json');
    const catalog = ItemCatalog.from(raw);
    const rawCount = Object.values(raw).reduce((n, c) => n + (c?.length ?? 0), 0);

    expect(catalog.size).toBe(rawCount);
    expect(new Set(catalog.all().map((i) => i.key)).size).toBe(rawCount);
  });

  it('keeps the DS3 ring and covenant twins distinct', async () => {
    // Same id 0x20002710, different Type — the one real overlap in the data.
    const catalog = ItemCatalog.from(await loadDb('ds3_items.json'));
    const ring = catalog.lookup(0x20000000, 0x20002710);
    const covenant = catalog.lookup(0x40000000, 0x20002710);

    expect(ring?.collection).toBe('ring_items');
    expect(covenant?.collection).toBe('covenant_items');
    expect(ring!.key).not.toBe(covenant!.key);
  });

  it('resolves the DS1 id collisions that identity lookup got wrong', async () => {
    const catalog = ItemCatalog.from(await loadDb('items.json'));
    expect(catalog.lookup(0, 0x186a0)?.name).toBe('Dagger');
    expect(catalog.lookup(1, 0x186a0)?.name).toBe('Helm of Favor');
  });

  it('carries the DS3 Safe flag through', async () => {
    const catalog = ItemCatalog.from(await loadDb('ds3_items.json'));
    expect(catalog.all().length - catalog.safeItems().length).toBe(150);
    expect(catalog.filter((i) => i.name === 'Farron Hail')[0]?.safe).toBe(true);
    expect(catalog.filter((i) => i.name === 'Fists')[0]?.safe).toBe(false);
  });

  it('treats every DS1 entry as safe', async () => {
    const catalog = ItemCatalog.from(await loadDb('items.json'));
    expect(catalog.safeItems().length).toBe(catalog.size);
  });
});
