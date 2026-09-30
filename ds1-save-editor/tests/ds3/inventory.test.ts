import { describe, it, expect, beforeEach } from 'vitest';
import { DS3SaveFileEditor } from '../../src/apps/ds3/lib/SaveFileEditor';
import { DS3Character } from '../../src/apps/ds3/lib/Character';
import { DS3Inventory, ItemCollectionType, ItemInfusion } from '../../src/apps/ds3/lib/Inventory';
import type { ItemCatalog } from '../../src/shared/items';
import { ByteView } from '../../src/shared/ByteView';
import { hasDS3Save, ds3SaveFile, toFile } from '../helpers/saves';

describe.skipIf(!hasDS3Save)('DS3 Inventory (real save)', () => {
  let editor: DS3SaveFileEditor;
  let hero: DS3Character;
  let inventory: DS3Inventory;
  let db: ItemCatalog;

  beforeEach(async () => {
    editor = await DS3SaveFileEditor.fromFileData(await ds3SaveFile(), null);
    hero = editor.getCharacters().find((c) => !c.isEmpty)!;
    inventory = new DS3Inventory(hero);
    await inventory.loadItemsDatabase();
    db = inventory.getCatalog();
  });

  const weapons = () => db.byCollection('weapon_items').filter((w) => w.safe);
  const regularWeapon = () => weapons().find((w) => w.maxUpgrade === 10)!;
  const uniqueWeapon = () => weapons().find((w) => w.maxUpgrade === 5)!;

  describe('items database', () => {
    it('loads through the production fetch path', () => {
      expect(db).toBeTruthy();
      expect(db.byCollection('weapon_items').length).toBeGreaterThan(100);
    });

    it('exposes every collection the editor offers', () => {
      const keys = [
        'weapon_items',
        'armor_items',
        'ring_items',
        'magic_items',
        'consumable_items',
        'ore_items',
        'key_items',
        'ammunition_items',
        'covenant_items',
      ];
      for (const key of keys) {
        expect(db.byCollection(key).length, key).toBeGreaterThan(0);
      }
    });

    it('surfaces a clear error when the database is unavailable', async () => {
      const original = globalThis.fetch;
      globalThis.fetch = (async () => new Response('nope', { status: 404 })) as typeof fetch;
      try {
        const inv = new DS3Inventory(hero);
        await expect(inv.loadItemsDatabase()).rejects.toThrow(/Could not load DS3 items database/);
      } finally {
        globalThis.fetch = original;
      }
    });
  });

  describe('reading the existing inventory', () => {
    it('parses items from a played character', () => {
      expect(inventory.getAllItems().length).toBeGreaterThan(0);
    });

    it('returns no empty slots', () => {
      expect(inventory.getAllItems().some((i) => i.isEmpty)).toBe(false);
    });

    it('assigns every item a known collection type', () => {
      for (const item of inventory.getAllItems()) {
        expect(Object.values(ItemCollectionType)).toContain(item.collectionType);
      }
    });

    it('resolves display names for recognised items', () => {
      const known = inventory.getAllItems().filter((i) => i.itemInfo !== null);
      expect(known.length).toBeGreaterThan(0);
      for (const item of known) expect(item.itemName.length).toBeGreaterThan(0);
    });

    it('finds a free slot beyond the occupied ones', () => {
      expect(inventory.findNextAvailableSlot()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('adding items', () => {
    it('adds a weapon and reports its slot', () => {
      const slot = inventory.addItem(regularWeapon(), 1, 0, ItemInfusion.Standard);
      expect(slot).not.toBeNull();
    });

    it('makes the added weapon discoverable', () => {
      const item = regularWeapon();
      const before = inventory.getItemsByType(ItemCollectionType.Weapon).length;
      inventory.addItem(item, 1, 0, ItemInfusion.Standard);
      expect(inventory.getItemsByType(ItemCollectionType.Weapon).length).toBe(before + 1);
    });

    it('preserves the requested upgrade level', () => {
      const item = regularWeapon();
      inventory.addItem(item, 1, 7, ItemInfusion.Standard);
      const added = inventory
        .getItemsByType(ItemCollectionType.Weapon)
        .filter((i) => i.baseItemId === item.rawId);
      expect(added.some((i) => i.upgradeLevel === 7)).toBe(true);
    });

    it('preserves the requested infusion', () => {
      const item = regularWeapon();
      inventory.addItem(item, 1, 0, ItemInfusion.Fire);
      const added = inventory
        .getItemsByType(ItemCollectionType.Weapon)
        .filter((i) => i.baseItemId === item.rawId);
      expect(added.some((i) => i.infusion === ItemInfusion.Fire)).toBe(true);
    });

    it('finds an item it just added', () => {
      const item = regularWeapon();
      inventory.addItem(item, 1, 0, ItemInfusion.Standard);
      expect(inventory.findExistingItem(item)).not.toBeNull();
    });

    it('keeps the character pattern resolvable after a GA-shifting add', () => {
      // Adding a weapon inserts a GA entry, which shifts every later offset.
      // If the pattern cache were not invalidated, reads would silently go wrong.
      const nameBefore = hero.name;
      inventory.addItem(regularWeapon(), 1, 0, ItemInfusion.Standard);
      expect(hero.name).toBe(nameBefore);
      expect(hero.level).toBeGreaterThan(0);
    });

    it('keeps the inventory readable after several adds', () => {
      for (let i = 0; i < 5; i++) {
        inventory.addItem(regularWeapon(), 1, i, ItemInfusion.Standard);
      }
      expect(inventory.getAllItems().length).toBeGreaterThan(0);
      expect(inventory.getAllItems().some((i) => i.isEmpty)).toBe(false);
    });
  });

  describe('GA entry defaults', () => {
    // Both guard against the same trap: the catalogue reports a missing
    // numeric field as 0, so a `?? default` fallback silently stops firing.
    // Caught by comparing against the pre-catalogue implementation.
    it('writes the default weapon durability, not zero', () => {
      const item = regularWeapon();
      inventory.addItem(item, 1, 0, ItemInfusion.Standard);

      // The GA entry carries the item id at bytes 4-7 and durability at 8-11.
      const data = ByteView.wrap(hero.getRawData());
      let found = -1;
      for (let off = 0x70; off + 12 < data.length && found < 0; off += 4) {
        if (data.readUInt(off + 4, 4) === item.rawId && data.readUInt(off, 4) !== 0) {
          found = off;
        }
      }
      expect(found, 'GA entry for the added weapon not found').toBeGreaterThan(0);
      expect(data.readUInt(found + 8, 4), 'durability').toBe(75);
    });

    it('leaves a non-upgradable weapon at +0 during a bulk add', () => {
      // Dark Hand is the one safe DS3 weapon with MaxUpgrade 0. A `|| default`
      // fallback would read that 0 as "unknown" and upgrade it anyway.
      const darkHand = db.byCollection('weapon_items').find((w) => w.name === 'Dark Hand');
      expect(darkHand, 'fixture data changed').toBeDefined();
      expect(darkHand!.maxUpgrade).toBe(0);

      inventory.addAllItems(ItemCollectionType.Weapon, 6);

      const held = inventory
        .getItemsByType(ItemCollectionType.Weapon)
        .filter((i) => i.baseItemId === darkHand!.rawId);
      expect(held.length).toBeGreaterThan(0);
      for (const item of held) expect(item.upgradeLevel).toBe(0);
    });
  });

  describe('editing and deleting', () => {
    it('editItem updates quantity, upgrade and infusion', () => {
      const slot = inventory.addItem(regularWeapon(), 1, 0, ItemInfusion.Standard)!;
      inventory.editItem(slot, 1, 4, ItemInfusion.Lightning);
      const item = inventory.readSlot(slot);
      expect(item.upgradeLevel).toBe(4);
      expect(item.infusion).toBe(ItemInfusion.Lightning);
    });

    it('deleteItem empties the slot', () => {
      const slot = inventory.addItem(regularWeapon(), 1, 0, ItemInfusion.Standard)!;
      inventory.deleteItem(slot);
      expect(inventory.readSlot(slot).isEmpty).toBe(true);
    });
  });

  describe('storage box', () => {
    it('round-trips a storage quantity for a stackable good', () => {
      const stackable = db.byCollection('consumable_items').find(
        (c) => c.safe && c.stackMax > 1,
      )!;
      inventory.addItem(stackable, 1);
      inventory.setStorageQuantity(stackable, 50);
      expect(inventory.getStorageQuantity(stackable.rawId)).toBe(50);
    });

    it('lists storage items without empties', () => {
      expect(inventory.getAllStorageItems().some((i) => i.isEmpty)).toBe(false);
    });
  });

  describe('weapon memory', () => {
    it('round-trips the stored value', () => {
      inventory.weaponMemory = 5;
      expect(inventory.weaponMemory).toBe(5);
      expect(hero.weaponMemory).toBe(5);
    });

    it('counts a unique weapon (MaxUpgrade 5) at double its upgrade level', () => {
      const item = uniqueWeapon();
      const slot = inventory.addItem(item, 1, 3, ItemInfusion.Standard)!;
      expect(inventory.getWeaponLevel(inventory.readSlot(slot))).toBe(6);
    });

    it('counts a regular weapon (MaxUpgrade 10) at its upgrade level', () => {
      const item = regularWeapon();
      const slot = inventory.addItem(item, 1, 8, ItemInfusion.Standard)!;
      expect(inventory.getWeaponLevel(inventory.readSlot(slot))).toBe(8);
    });

    it('calibrate(exact=false) only raises', () => {
      inventory.weaponMemory = 10;
      expect(inventory.calibrateWeaponMemory(false)).toBe(10);
    });

    it('calibrate(exact=true) tracks the strongest weapon held', () => {
      inventory.addItem(regularWeapon(), 1, 9, ItemInfusion.Standard);
      expect(inventory.calibrateWeaponMemory(true)).toBeGreaterThanOrEqual(9);
    });

    it('is idempotent in exact mode', () => {
      const first = inventory.calibrateWeaponMemory(true);
      expect(inventory.calibrateWeaponMemory(true)).toBe(first);
    });
  });

  describe('bulk add respects the Safe flag', () => {
    /**
     * Count items of a collection per base id. The fixture already holds
     * Estus, equipped gear and "Empty … Slot" placeholders, so bulk-add
     * assertions must compare against a baseline rather than the raw contents.
     */
    const countById = (type: ItemCollectionType) => {
      const counts = new Map<number, number>();
      for (const item of inventory.getItemsByType(type)) {
        counts.set(item.baseItemId, (counts.get(item.baseItemId) ?? 0) + 1);
      }
      return counts;
    };

    const assertNoNewIds = (
      type: ItemCollectionType,
      forbidden: Set<number>,
      label: string,
    ) => {
      const before = countById(type);
      inventory.addAllItems(type, 0);
      const after = countById(type);

      const introduced = [...after.entries()].filter(
        ([id, n]) => forbidden.has(id) && n > (before.get(id) ?? 0),
      );
      expect(introduced.map(([id]) => `0x${id.toString(16)}`), label).toEqual([]);
    };

    it('never adds a weapon marked Safe: false', () => {
      assertNoNewIds(
        ItemCollectionType.Weapon,
        new Set(db.byCollection('weapon_items').filter((w) => w.safe === false).map((w) => w.rawId)),
        'unsafe weapons introduced',
      );
    });

    it('never adds an armour piece marked Safe: false', () => {
      assertNoNewIds(
        ItemCollectionType.Armor,
        new Set(db.byCollection('armor_items').filter((a) => a.safe === false).map((a) => a.rawId)),
        'unsafe armour introduced',
      );
    });

    it('never adds a ring marked Safe: false', () => {
      assertNoNewIds(
        ItemCollectionType.Ring,
        new Set(db.byCollection('ring_items').filter((r) => r.safe === false).map((r) => r.rawId)),
        'unsafe rings introduced',
      );
    });

    it('does not hand out extra Estus or Ashen Estus', () => {
      const isEstus = (id: number) =>
        (id >= 0x40000096 && id <= 0x400000ab) || (id >= 0x400000be && id <= 0x400000d3);

      const before = countById(ItemCollectionType.Consumable);
      inventory.addAllItems(ItemCollectionType.Consumable, 0);
      const after = countById(ItemCollectionType.Consumable);

      const grown = [...after.entries()].filter(
        ([id, n]) => isEstus(id) && n > (before.get(id) ?? 0),
      );
      expect(grown.map(([id]) => `0x${id.toString(16)}`)).toEqual([]);
    });

    it('does not add covenant badges when bulk-adding rings', () => {
      assertNoNewIds(
        ItemCollectionType.Ring,
        new Set(db.byCollection('covenant_items').map((c) => c.rawId)),
        'covenant badges introduced as rings',
      );
    });

    it('adds a meaningful number of safe weapons', () => {
      const before = inventory.getItemsByType(ItemCollectionType.Weapon).length;
      inventory.addAllItems(ItemCollectionType.Weapon, 0);
      expect(inventory.getItemsByType(ItemCollectionType.Weapon).length).toBeGreaterThan(
        before + 50,
      );
    });

    it('gives regular weapons exactly the target upgrade level', () => {
      const targetWL = 4;
      inventory.addAllItems(ItemCollectionType.Weapon, targetWL);

      const held = inventory.getItemsByType(ItemCollectionType.Weapon);
      const sample = weapons()
        .filter((w) => w.maxUpgrade === 10)
        .slice(0, 20);

      for (const item of sample) {
        const id = item.rawId;
        expect(
          held.some((h) => h.baseItemId === id && h.upgradeLevel === targetWL),
          `${item.name} missing at +${targetWL}`,
        ).toBe(true);
      }
    });

    it('halves the upgrade level for unique weapons, which count double', () => {
      const targetWL = 6;
      inventory.addAllItems(ItemCollectionType.Weapon, targetWL);

      const held = inventory.getItemsByType(ItemCollectionType.Weapon);
      const sample = weapons()
        .filter((w) => w.maxUpgrade === 5)
        .slice(0, 20);

      for (const item of sample) {
        const id = item.rawId;
        expect(
          held.some((h) => h.baseItemId === id && h.upgradeLevel === targetWL / 2),
          `${item.name} missing at +${targetWL / 2}`,
        ).toBe(true);
      }
    });
  });

  describe('bulk clear protects unsafe items', () => {
    it('leaves an unsafe item in place', () => {
      const unsafe = db.byCollection('weapon_items').find((w) => w.safe === false)!;
      const slot = inventory.addItem(unsafe, 1, 0, ItemInfusion.Standard);
      expect(slot).not.toBeNull();

      inventory.clearAllItems(ItemCollectionType.Weapon);

      const survivors = inventory
        .getItemsByType(ItemCollectionType.Weapon)
        .filter((i) => i.baseItemId === unsafe.rawId);
      expect(survivors.length).toBeGreaterThan(0);
    });

    it('removes the safe items around it', () => {
      inventory.addItem(regularWeapon(), 1, 0, ItemInfusion.Standard);
      inventory.clearAllItems(ItemCollectionType.Weapon);

      const remaining = inventory.getItemsByType(ItemCollectionType.Weapon);
      for (const item of remaining) {
        // Anything left must be either unrecognised or explicitly unsafe.
        expect(item.itemInfo === null || item.itemInfo.safe === false).toBe(true);
      }
    });
  });

  describe('duplicates', () => {
    const countOf = (type: ItemCollectionType) =>
      inventory.getAllItems().filter((i) => i.collectionType === type).length;

    const safeFrom = (collection: string) =>
      db.byCollection(collection).filter((i) => i.safe);

    it('adds a ring once, however many times it is asked for', () => {
      const ring = safeFrom('ring_items')[5];
      const before = countOf(ItemCollectionType.Ring);

      const first = inventory.addItem(ring, 1, 0, ItemInfusion.Standard);
      const second = inventory.addItem(ring, 1, 0, ItemInfusion.Standard);

      expect(second).toBe(first);
      expect(countOf(ItemCollectionType.Ring)).toBe(before + 1);
    });

    it('adds a spell once, however many times it is asked for', () => {
      const spell = safeFrom('magic_items')[3];
      const before = countOf(ItemCollectionType.Magic);

      const first = inventory.addItem(spell, 1, 0, ItemInfusion.Standard);
      const second = inventory.addItem(spell, 1, 0, ItemInfusion.Standard);

      expect(second).toBe(first);
      expect(countOf(ItemCollectionType.Magic)).toBe(before + 1);
    });

    const idempotent: [string, ItemCollectionType][] = [
      ['rings', ItemCollectionType.Ring],
      ['consumables', ItemCollectionType.Consumable],
      ['spells', ItemCollectionType.Magic],
      ['ores', ItemCollectionType.Ore],
      ['ammunition', ItemCollectionType.Ammunition],
      ['keys', ItemCollectionType.Key],
      ['covenants', ItemCollectionType.Covenant],
    ];

    for (const [label, type] of idempotent) {
      it(`bulk-adding ${label} twice leaves the same number of slots`, () => {
        inventory.addAllItems(type, 0);
        const afterFirst = countOf(type);
        inventory.addAllItems(type, 0);

        expect(afterFirst).toBeGreaterThan(0);
        expect(countOf(type)).toBe(afterFirst);
      });
    }

    it('still stacks a second helping of a stackable good', () => {
      const good = safeFrom('consumable_items').find(
        (i) => i.stackMax > 1 && inventory.findExistingItem(i) === null
      )!;
      const slot = inventory.addItem(good, 1)!;
      inventory.addItem(good, 2);
      expect(inventory.readSlot(slot).quantity).toBe(3);
    });

    it('keeps duplicating weapons and armour, which are held in multiples', () => {
      for (const type of [ItemCollectionType.Weapon, ItemCollectionType.Armor]) {
        inventory.addAllItems(type, 0);
        const afterFirst = countOf(type);
        inventory.addAllItems(type, 0);
        expect(countOf(type)).toBeGreaterThan(afterFirst);
      }
    });
  });

  describe('bottomless box', () => {
    const boxStart = () => (inventory as any).getStorageBoxStart(hero.getRawData()) as number;

    const liveEntries = () => {
      const data = hero.getRawData();
      const start = boxStart();
      let n = 0;
      for (let i = 0; i < 1920; i++) if (data[start + i * 16 + 3] !== 0x00) n++;
      return n;
    };

    const firstGap = () => {
      const data = hero.getRawData();
      const start = boxStart();
      for (let i = 0; i < 1920; i++) if (data[start + i * 16 + 3] === 0x00) return i;
      return 1920;
    };

    const stackable = () => db.byCollection('consumable_items').filter((i) => i.safe && i.stackMax > 1);

    it('finds the box', () => {
      expect(boxStart()).toBeGreaterThan(0);
    });

    it('counts the entries it writes', () => {
      // The count ahead of the array is what the game reads; entries written
      // past it never show up in the box in game.
      const good = stackable()[0];
      inventory.setStorageQuantity(good, 600);

      expect(inventory.getStorageItemCount()).toBe(liveEntries());
      expect(inventory.getStorageQuantity(good.rawId)).toBe(600);
    });

    it('keeps the count in step across a bulk add', () => {
      inventory.addAllItems(ItemCollectionType.Consumable, 0);

      expect(liveEntries()).toBeGreaterThan(10);
      expect(inventory.getStorageItemCount()).toBe(liveEntries());
    });

    it('leaves no gap in the run of entries', () => {
      inventory.addAllItems(ItemCollectionType.Consumable, 0);

      expect(firstGap()).toBe(liveEntries());
    });

    it('closes the gap and drops the count when an item is taken out', () => {
      const goods = stackable().slice(0, 3);
      for (const g of goods) inventory.setStorageQuantity(g, 600);
      const before = inventory.getStorageItemCount();

      inventory.setStorageQuantity(goods[0], 0);

      expect(inventory.getStorageItemCount()).toBe(before - 1);
      expect(liveEntries()).toBe(before - 1);
      expect(firstGap()).toBe(before - 1);
      expect(inventory.getStorageQuantity(goods[0].rawId)).toBe(0);
      expect(inventory.getStorageQuantity(goods[1].rawId)).toBe(600);
    });

    it('blanks a freed slot the way the game does', () => {
      const good = stackable()[0];
      inventory.setStorageQuantity(good, 600);
      inventory.setStorageQuantity(good, 0);

      const data = hero.getRawData();
      const freed = boxStart() + liveEntries() * 16;
      // An unused slot is 0x00 except for bytes 4-7, which the game leaves at 0xFF.
      expect(Array.from(data.slice(freed, freed + 16))).toEqual([
        0, 0, 0, 0, 0xFF, 0xFF, 0xFF, 0xFF, 0, 0, 0, 0, 0, 0, 0, 0,
      ]);
    });

    it('survives encrypt → decrypt with the count intact', async () => {
      const slotIndex = hero.slotIndex;
      const good = stackable()[0];
      inventory.setStorageQuantity(good, 600);
      const expected = inventory.getStorageItemCount();

      const exported = await editor.exportSaveFile();
      const reloaded = await DS3SaveFileEditor.fromFileData(toFile(exported, 'out.sl2'), null);
      const inv = new DS3Inventory(reloaded.getCharacter(slotIndex)!);
      await inv.loadItemsDatabase();

      expect(inv.getStorageItemCount()).toBe(expected);
      expect(inv.getStorageQuantity(good.rawId)).toBe(600);
    });
  });

  describe('persistence', () => {
    it('an added weapon survives encrypt → decrypt', async () => {
      const slotIndex = hero.slotIndex;
      const item = regularWeapon();
      inventory.addItem(item, 1, 6, ItemInfusion.Standard);

      const exported = await editor.exportSaveFile();
      const reloaded = await DS3SaveFileEditor.fromFileData(toFile(exported, 'out.sl2'), null);

      const inv = new DS3Inventory(reloaded.getCharacter(slotIndex)!);
      await inv.loadItemsDatabase();

      const match = inv
        .getItemsByType(ItemCollectionType.Weapon)
        .filter((i) => i.baseItemId === item.rawId && i.upgradeLevel === 6);
      expect(match.length).toBeGreaterThan(0);
    });
  });
});
