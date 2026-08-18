import { describe, it, expect, beforeEach } from 'vitest';
import { SaveFileEditor } from '../../src/apps/ds1/lib/SaveFileEditor';
import { Character } from '../../src/apps/ds1/lib/Character';
import { Inventory, ItemCollectionType, ItemInfusion } from '../../src/apps/ds1/lib/Inventory';
import { Item, type ItemCatalog } from '../../src/shared/items';
import { hasDS1Save, ds1SaveFile } from '../helpers/saves';

describe.skipIf(!hasDS1Save)('DS1 Inventory (real save)', () => {
  let hero: Character;
  let inventory: Inventory;
  let db: ItemCatalog;

  beforeEach(async () => {
    const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
    hero = editor.getCharacters().find((c) => !c.isEmpty)!;
    inventory = new Inventory(hero);
    await inventory.loadItemsDatabase();
    db = inventory.getCatalog();
  });

  describe('items database', () => {
    it('loads the collections that items.json actually ships', () => {
      const present = [
        'weapon_items',
        'ring_items',
        'armor_items',
        'key_items',
        'usable_items',
        'ammunition_items',
        'material_items',
        'magic_items',
        'specials',
      ];
      for (const key of present) {
        expect(db.byCollection(key).length, key).toBeGreaterThan(0);
      }
    });

    it('reports empty for collections items.json does not ship', () => {
      // The old ItemsDatabase interface declared these as required `Item[]`
      // while the data had no such keys — a type that lied. The catalogue
      // simply has no such collections, and asking for one is not an error.
      const declaredButMissing = [
        'consumable_items',
        'soul_items',
        'upgrade_items',
        'spell_items',
      ] as const;
      for (const key of declaredButMissing) {
        expect(db.byCollection(key), key).toEqual([]);
      }
    });

    it('classifies items by value, so a cloned entry still resolves', () => {
      // Regression guard. Classification used to be `collection.includes(item)`
      // — reference equality — so a structurally identical clone came back as
      // Unknown and was filed into the wrong slot range. The catalogue keys by
      // (category nibble, id) instead.
      const realWeapon = db.byCollection('weapon_items')[0];
      // A separate object built from an identical raw entry.
      const clone = new Item(JSON.parse(JSON.stringify(realWeapon.source)), realWeapon.collection);
      expect(clone).not.toBe(realWeapon);

      const realSlot = inventory.addItem(realWeapon, 1, 0, ItemInfusion.Standard)!;
      expect(inventory.readSlot(realSlot).collectionType).toBe(ItemCollectionType.Weapon);

      const cloneSlot = inventory.addItem(clone, 1, 0, ItemInfusion.Standard)!;
      expect(inventory.readSlot(cloneSlot).collectionType).toBe(ItemCollectionType.Weapon);
      expect(cloneSlot).toBeGreaterThanOrEqual(64);
    });

    it('keeps same-id entries from different categories apart', () => {
      // DS1 reuses ids across collections: Dagger and Helm of Favor are both
      // 0x186A0, told apart only by Type. Identity lookup hid this; value
      // lookup has to get the nibble right.
      const dagger = db.byCollection('weapon_items').find((w) => w.id === 0x186a0);
      const helm = db.byCollection('armor_items').find((a) => a.id === 0x186a0);
      expect(dagger, 'fixture data changed').toBeDefined();
      expect(helm, 'fixture data changed').toBeDefined();

      const weaponSlot = inventory.addItem(dagger!, 1, 0, ItemInfusion.Standard)!;
      const armorSlot = inventory.addItem(helm!, 1, 0, ItemInfusion.Standard)!;

      expect(inventory.readSlot(weaponSlot).collectionType).toBe(ItemCollectionType.Weapon);
      expect(inventory.readSlot(armorSlot).collectionType).toBe(ItemCollectionType.Armor);
    });

    it('every entry carries the fields the editor reads', () => {
      const all = db.all();
      expect(all.length).toBeGreaterThan(100);
      for (const item of all) {
        expect(typeof item.name).toBe('string');
        expect(Number.isFinite(item.id), item.name).toBe(true);
        expect(Number.isFinite(item.stackMax), item.name).toBe(true);
        expect(Number.isFinite(item.typeNibble), item.name).toBe(true);
      }
    });

    it('gives every entry a resolvable key', () => {
      for (const item of db.all()) {
        expect(db.byKey(item.key), item.name).not.toBeNull();
      }
    });
  });

  describe('reading the existing inventory', () => {
    it('finds items in a played character', () => {
      const items = inventory.getAllItems();
      expect(items.length).toBeGreaterThan(0);
    });

    it('never returns an empty slot from getAllItems', () => {
      expect(inventory.getAllItems().some((i) => i.isEmpty)).toBe(false);
    });

    it('assigns every item a collection type', () => {
      for (const item of inventory.getAllItems()) {
        expect(Object.values(ItemCollectionType)).toContain(item.collectionType);
      }
    });

    it('partitions items across collection types without loss', () => {
      const total = inventory.getAllItems().length;
      const summed = Object.values(ItemCollectionType).reduce(
        (acc, type) => acc + inventory.getItemsByType(type).length,
        0,
      );
      expect(summed).toBe(total);
    });

    it('resolves names for known items', () => {
      const named = inventory.getAllItems().filter((i) => i.itemInfo !== null);
      expect(named.length).toBeGreaterThan(0);
      for (const item of named) expect(item.itemName.length).toBeGreaterThan(0);
    });
  });

  describe('slot read/write', () => {
    it('round-trips a slot unchanged', () => {
      const before = Array.from(inventory.readSlot(64).getRawData());
      inventory.writeSlot(64, inventory.readSlot(64));
      expect(Array.from(inventory.readSlot(64).getRawData())).toEqual(before);
    });

    it('reports quantity, upgrade level and infusion as numbers', () => {
      for (const item of inventory.getAllItems().slice(0, 25)) {
        expect(Number.isFinite(item.quantity)).toBe(true);
        expect(Number.isFinite(item.upgradeLevel)).toBe(true);
        expect(Number.isFinite(item.infusion)).toBe(true);
      }
    });
  });

  describe('adding items', () => {
    const weapon = (): Item => db.byCollection('weapon_items').find((w) => w.maxUpgrade === 15)!;

    it('adds a weapon and returns its slot', () => {
      const slot = inventory.addItem(weapon(), 1, 0, ItemInfusion.Standard);
      expect(slot).not.toBeNull();
      expect(inventory.readSlot(slot!).isEmpty).toBe(false);
    });

    it('places non-key items at slot 64 or above', () => {
      const slot = inventory.addItem(weapon(), 1, 0, ItemInfusion.Standard)!;
      expect(slot).toBeGreaterThanOrEqual(64);
    });

    it('places key items below slot 64', () => {
      const key = db.byCollection('key_items')[0];
      const slot = inventory.addItem(key, 1, 0, ItemInfusion.Standard);
      if (slot !== null) expect(slot).toBeLessThan(64);
    });

    it('preserves the upgrade level it was given', () => {
      const slot = inventory.addItem(weapon(), 1, 5, ItemInfusion.Standard)!;
      expect(inventory.readSlot(slot).upgradeLevel).toBe(5);
    });

    it('preserves the infusion it was given', () => {
      const infusible = db.byCollection('weapon_items').find((w) => w.maxUpgrade === 15)!;
      const slot = inventory.addItem(infusible, 1, 0, ItemInfusion.Fire)!;
      expect(inventory.readSlot(slot).infusion).toBe(ItemInfusion.Fire);
    });

    it('stacks a stackable usable instead of taking a new slot', () => {
      const stackable = db.byCollection('usable_items').find((c) => c.stackMax > 1)!;
      const first = inventory.addItem(stackable, 1)!;
      const second = inventory.addItem(stackable, 1)!;
      expect(second).toBe(first);
    });

    it('clamps a stack to MaxStackCount', () => {
      const stackable = db.byCollection('usable_items').find((c) => c.stackMax > 1)!;
      const slot = inventory.addItem(stackable, stackable.stackMax * 10)!;
      expect(inventory.readSlot(slot).quantity).toBeLessThanOrEqual(stackable.stackMax);
    });

    it('gives each added weapon its own slot', () => {
      const w = weapon();
      const a = inventory.addItem(w, 1, 0, ItemInfusion.Standard)!;
      const b = inventory.addItem(w, 1, 0, ItemInfusion.Standard)!;
      expect(b).not.toBe(a);
    });

    it('divides crystal-infused durability by ten', () => {
      const durable = db.byCollection('weapon_items').find((w) => (w.durability ?? 0) >= 10)!;
      const plain = inventory.addItem(durable, 1, 0, ItemInfusion.Standard)!;
      const crystal = inventory.addItem(durable, 1, 0, ItemInfusion.Crystal)!;
      expect(inventory.readSlot(crystal).durability).toBe(
        Math.floor(inventory.readSlot(plain).durability / 10),
      );
    });
  });

  describe('deleting items', () => {
    it('empties the slot it deletes', () => {
      const slot = inventory.addItem(db.byCollection('weapon_items')[0], 1, 0, ItemInfusion.Standard)!;
      inventory.deleteItem(slot);
      expect(inventory.readSlot(slot).isEmpty).toBe(true);
    });

    it('drops the item from getAllItems', () => {
      const slot = inventory.addItem(db.byCollection('weapon_items')[0], 1, 0, ItemInfusion.Standard)!;
      const before = inventory.getAllItems().length;
      inventory.deleteItem(slot);
      expect(inventory.getAllItems().length).toBe(before - 1);
    });

    it('clearAllItems empties a whole collection and reports the count', () => {
      const before = inventory.getItemsByType(ItemCollectionType.Weapon).length;
      const removed = inventory.clearAllItems(ItemCollectionType.Weapon);
      expect(removed).toBe(before);
      expect(inventory.getItemsByType(ItemCollectionType.Weapon)).toHaveLength(0);
    });

    it('clearing one collection leaves the others intact', () => {
      const ringsBefore = inventory.getItemsByType(ItemCollectionType.Ring).length;
      inventory.clearAllItems(ItemCollectionType.Weapon);
      expect(inventory.getItemsByType(ItemCollectionType.Ring)).toHaveLength(ringsBefore);
    });
  });

  describe('weapon level', () => {
    it('round-trips the stored weapon level byte', () => {
      inventory.weaponLevel = 12;
      expect(inventory.weaponLevel).toBe(12);
      expect(hero.getByte(0x0179)).toBe(12);
    });

    it('calibrate(exact=false) only ever raises the level', () => {
      inventory.weaponLevel = 99;
      expect(inventory.calibrateWeaponLevel(false)).toBe(99);
    });

    it('calibrate(exact=true) may lower the level', () => {
      inventory.weaponLevel = 99;
      expect(inventory.calibrateWeaponLevel(true)).toBeLessThan(99);
    });

    it('is idempotent when run twice in exact mode', () => {
      const first = inventory.calibrateWeaponLevel(true);
      expect(inventory.calibrateWeaponLevel(true)).toBe(first);
    });

    it('reports 0 for non-weapons', () => {
      for (const item of inventory.getAllItems()) {
        if (item.collectionType !== ItemCollectionType.Weapon) {
          expect(inventory.getWeaponLevel(item)).toBe(0);
        }
      }
    });

    it('rates a +15 weapon above an unupgraded one', () => {
      const w = db.byCollection('weapon_items').find((x) => x.maxUpgrade === 15)!;
      const low = inventory.readSlot(inventory.addItem(w, 1, 0, ItemInfusion.Standard)!);
      const high = inventory.readSlot(inventory.addItem(w, 1, 15, ItemInfusion.Standard)!);
      expect(inventory.getWeaponLevel(high)).toBeGreaterThan(inventory.getWeaponLevel(low));
    });
  });

  describe('persistence', () => {
    it('an added item survives encrypt → decrypt', async () => {
      const editor = await SaveFileEditor.fromFile(await ds1SaveFile());
      const target = editor.getCharacters().findIndex((c) => !c.isEmpty);
      const inv = new Inventory(editor.getCharacter(target)!);
      await inv.loadItemsDatabase();

      const item = inv.getCatalog().byCollection('weapon_items').find((w) => w.maxUpgrade === 15)!;
      const slot = inv.addItem(item, 1, 7, ItemInfusion.Fire)!;

      const exported = await editor.exportSaveFile();
      const reloaded = await SaveFileEditor.fromFile(
        new File([exported as unknown as BlobPart], 'out.sl2'),
      );
      const reloadedInv = new Inventory(reloaded.getCharacter(target)!);
      await reloadedInv.loadItemsDatabase();

      const restored = reloadedInv.readSlot(slot);
      expect(restored.isEmpty).toBe(false);
      expect(restored.upgradeLevel).toBe(7);
      expect(restored.infusion).toBe(ItemInfusion.Fire);
    });
  });
});
