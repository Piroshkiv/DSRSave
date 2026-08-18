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
