import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InventoryItem, ItemInfusion } from '../../src/apps/ds1/lib/Inventory';
import { ItemCatalog, type RawItemDatabase } from '../../src/shared/items';

/**
 * Id arithmetic of a single 28-byte inventory slot.
 *
 * No save file is involved: a slot is just bytes, so these run everywhere.
 */

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');

const raw: RawItemDatabase = JSON.parse(
  await readFile(path.join(publicDir, 'json', 'items.json'), 'utf8'),
);
const catalog = ItemCatalog.from(raw);

const WEAPON = 0;
const ARMOR = 1;

/** A fresh, existing slot holding the given category and id. */
function slot(type: number, id: number): InventoryItem {
  const item = new InventoryItem(new Uint8Array(28), 0, catalog);
  item.itemType = type;
  item.itemId = id;
  item.exists = 1;
  item.quantity = 1;
  return item;
}

describe('DS1 slot id arithmetic', () => {
  describe('Holy Set (regression: gloves turned into the robe)', () => {
    // Armour ids in this set: Priest's Hat 310000, Holy Robe 311000,
    // Travelling Gloves 312000, Holy Trousers 313000. Upgrades add the level.
    //
    // 311000..312705 is a weapon-only window (Greatsword of Artorias (cursed)).
    // It used to be applied to armour too, so every Holy Set glove id collapsed
    // onto base 311000 — which as armour is the Holy Robe. Creating the gloves
    // wrote a robe into the save, at any upgrade level.
    it('keeps Travelling Gloves (Holy Set) at their own base id', () => {
      expect(slot(ARMOR, 312000).baseItemId).toBe(312000);
    });

    it('resolves the gloves by name, not as the robe', () => {
      expect(slot(ARMOR, 312000).itemName).toBe('Travelling Gloves (Holy Set)');
      expect(slot(ARMOR, 311000).itemName).toBe('Holy Robe');
    });

    it('writes an upgrade level onto the gloves, not onto the robe', () => {
      for (let level = 0; level <= 10; level++) {
        const gloves = slot(ARMOR, 312000);
        gloves.upgradeLevel = level;
        expect(gloves.itemId, `+${level}`).toBe(312000 + level);
        expect(gloves.upgradeLevel, `+${level}`).toBe(level);
        expect(gloves.itemName, `+${level}`).toBe('Travelling Gloves (Holy Set)');
      }
    });

    it('leaves the rest of the set alone', () => {
      for (const [id, name] of [
        [310000, "Priest's Hat"],
        [311000, 'Holy Robe'],
        [313000, 'Holy Trousers'],
      ] as const) {
        const piece = slot(ARMOR, id);
        piece.upgradeLevel = 10;
        expect(piece.itemId, name).toBe(id + 10);
        expect(piece.itemName, name).toBe(name);
      }
    });

    it('does not infuse armour when setting Standard', () => {
      const gloves = slot(ARMOR, 312005);
      gloves.infusion = ItemInfusion.Standard;
      expect(gloves.itemId).toBe(312005);
      expect(gloves.infusion).toBe(ItemInfusion.Standard);
    });
  });

  describe('Greatsword of Artorias (cursed), weapon 311000', () => {
    it('still reads as its own base', () => {
      expect(slot(WEAPON, 311000).baseItemId).toBe(311000);
    });

    it('upgrades by +1 per level and takes no infusion', () => {
      const sword = slot(WEAPON, 311000);
      sword.upgradeLevel = 5;
      expect(sword.itemId).toBe(311005);
      expect(sword.upgradeLevel).toBe(5);

      sword.infusion = ItemInfusion.Fire;
      expect(sword.itemId).toBe(311005);
      expect(sword.infusion).toBe(ItemInfusion.Standard);
    });
  });

  describe('the ordinary layout, base + infusion * 100 + level', () => {
    it('round-trips a weapon upgrade', () => {
      const longsword = slot(WEAPON, 200000);
      longsword.upgradeLevel = 15;
      expect(longsword.itemId).toBe(200015);
      expect(longsword.baseItemId).toBe(200000);
    });

    it('round-trips a weapon infusion', () => {
      const longsword = slot(WEAPON, 200000);
      longsword.upgradeLevel = 5;
      longsword.infusion = ItemInfusion.Fire;
      expect(longsword.itemId).toBe(200000 + ItemInfusion.Fire * 100 + 5);
      expect(longsword.infusion).toBe(ItemInfusion.Fire);
      expect(longsword.upgradeLevel).toBe(5);
      expect(longsword.baseItemId).toBe(200000);
    });

    it('keeps Pyromancy Flame on its own hundred-step scale', () => {
      const flame = slot(WEAPON, 1330000);
      flame.upgradeLevel = 15;
      expect(flame.itemId).toBe(1331500);
      expect(flame.upgradeLevel).toBe(15);
      expect(flame.baseItemId).toBe(1330000);
    });
  });

  describe('every armour entry survives a round-trip through the slot', () => {
    // The bug was a single id window swallowing entries from another category;
    // this pins that no armour id is misread as another armour item.
    it('reads back the base id and name it was written with', () => {
      for (const item of catalog.byCollection('armor_items')) {
        const piece = slot(ARMOR, item.id);
        expect(piece.baseItemId, item.name).toBe(item.id);
        expect(piece.itemName, item.name).toBe(item.name);

        const maxUpgrade = item.maxUpgrade || 0;
        piece.upgradeLevel = maxUpgrade;
        expect(piece.itemId, item.name).toBe(item.id + maxUpgrade);
        expect(piece.itemName, item.name).toBe(item.name);
      }
    });
  });
});
