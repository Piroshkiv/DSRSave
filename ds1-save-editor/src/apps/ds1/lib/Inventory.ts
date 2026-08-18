import { Character } from './Character';
import { ByteView } from '../../../shared/ByteView';
import {
  ItemCatalog,
  loadItemCatalog,
  type Item,
} from '../../../shared/items';

export enum ItemInfusion {
  Standard = 0,
  Crystal = 1,
  Lightning = 2,
  Raw = 3,
  Magic = 4,
  Enchanted = 5,
  Divine = 6,
  Occult = 7,
  Fire = 8,
  Chaos = 9,
}

export enum ItemCategory {
  WeaponsShields = 0x00000000,
  Armor = 0x10000000,
  Rings = 0x20000000,
  Consumables = 0x40000000,
}

export enum ItemCollectionType {
  Weapon = 'Weapon',
  Ring = 'Ring',
  Armor = 'Armor',
  Consumable = 'Consumable',
  Soul = 'Soul',
  Upgrade = 'Upgrade',
  Key = 'Key',
  Spell = 'Spell',
  Usable = 'Usable',
  Ammunition = 'Ammunition',
  Material = 'Material',
  Magic = 'Magic',
  Special = 'Special',
  Unknown = 'Unknown',
}

/**
 * Which ItemCollectionType each catalogue collection maps to.
 * Replaces the old chain of `collection.includes(entry)` identity checks.
 */
const COLLECTION_TO_TYPE: Record<string, ItemCollectionType> = {
  weapon_items: ItemCollectionType.Weapon,
  ring_items: ItemCollectionType.Ring,
  armor_items: ItemCollectionType.Armor,
  consumable_items: ItemCollectionType.Consumable,
  soul_items: ItemCollectionType.Soul,
  upgrade_items: ItemCollectionType.Upgrade,
  key_items: ItemCollectionType.Key,
  spell_items: ItemCollectionType.Spell,
  usable_items: ItemCollectionType.Usable,
  ammunition_items: ItemCollectionType.Ammunition,
  material_items: ItemCollectionType.Material,
  magic_items: ItemCollectionType.Magic,
  specials: ItemCollectionType.Special,
};

/**
 * Which catalogue collection backs each collection type — the inverse of
 * COLLECTION_TO_TYPE. Used by the item picker to list a category.
 */
export const COLLECTION_FOR_TYPE: Partial<Record<ItemCollectionType, string>> =
  Object.fromEntries(
    Object.entries(COLLECTION_TO_TYPE).map(([collection, type]) => [type, collection]),
  ) as Partial<Record<ItemCollectionType, string>>;

/** Collections that "add all" is allowed to draw from. */
const ADD_ALL_COLLECTIONS: Partial<Record<ItemCollectionType, string>> = {
  [ItemCollectionType.Weapon]: 'weapon_items',
  [ItemCollectionType.Armor]: 'armor_items',
  [ItemCollectionType.Ring]: 'ring_items',
  [ItemCollectionType.Usable]: 'usable_items',
  [ItemCollectionType.Material]: 'material_items',
  [ItemCollectionType.Key]: 'key_items',
  [ItemCollectionType.Magic]: 'magic_items',
  [ItemCollectionType.Ammunition]: 'ammunition_items',
};

export class InventoryItem {
  private data: ByteView;
  private catalog: ItemCatalog | null;
  public slotIndex: number;

  constructor(data: Uint8Array, slotIndex: number, catalog: ItemCatalog | null = null) {
    this.data = new ByteView(28);
    if (data) {
      this.data.set(data.slice(0, 28));
    }
    this.slotIndex = slotIndex;
    this.catalog = catalog;
  }

  /**
   * Byte offsets of the 28-byte slot record. Every field below is a signed
   * 32-bit little-endian integer except `itemType`, which is big-endian and
   * stored shifted left by one nibble.
   */
  private static readonly FIELD = {
    itemType: 0,
    itemId: 4,
    quantity: 8,
    order: 12,
    exists: 16,
    durability: 20,
  } as const;

  get itemType(): number {
    return Math.floor(this.data.readIntBE(InventoryItem.FIELD.itemType, 4) / 16);
  }

  set itemType(value: number) {
    this.data.writeBE(InventoryItem.FIELD.itemType, 4, value * 16);
  }

  get itemId(): number {
    return this.data.readInt(InventoryItem.FIELD.itemId, 4);
  }

  set itemId(value: number) {
    this.data.write(InventoryItem.FIELD.itemId, 4, value);
  }

  get quantity(): number {
    return this.data.readInt(InventoryItem.FIELD.quantity, 4);
  }

  set quantity(value: number) {
    this.data.write(InventoryItem.FIELD.quantity, 4, value);
  }

  get order(): number {
    return this.data.readInt(InventoryItem.FIELD.order, 4);
  }

  set order(value: number) {
    this.data.write(InventoryItem.FIELD.order, 4, value);
  }

  get exists(): number {
    return this.data.readInt(InventoryItem.FIELD.exists, 4);
  }

  set exists(value: number) {
    this.data.write(InventoryItem.FIELD.exists, 4, value);
  }

  get durability(): number {
    return this.data.readInt(InventoryItem.FIELD.durability, 4);
  }

  set durability(value: number) {
    this.data.write(InventoryItem.FIELD.durability, 4, value);
  }

  get isEmpty(): boolean {
    return this.exists === 0 || this.data.every((b) => b === 0 || b === 0xff);
  }

  /**
   * The one weapon id window that does not follow the usual
   * `base + infusion * 100 + level` layout: Greatsword of Artorias (cursed),
   * weapon 311000.
   *
   * Armour reuses these numbers — Holy Robe is 311000, Travelling Gloves
   * (Holy Set) is 312000 — so the window must be scoped to category 0.
   * Unscoped it collapsed every id in the range onto 311000, which under
   * category 1 is the Holy Robe: adding the gloves wrote a robe instead.
   */
  private get isArtoriasCursedRange(): boolean {
    return this.itemType === 0 && this.itemId >= 311000 && this.itemId <= 312705;
  }

  get baseItemId(): number {
    if (this.itemType !== 0 && this.itemType !== 1) {
      return this.itemId;
    }

    if (this.itemId >= 1330000 && this.itemId < 1332000) {
      return 1330000;
    }

    if (this.itemId >= 1332000 && this.itemId <= 1332500) {
      return 1332000;
    }

    if (this.isArtoriasCursedRange) {
      return 311000;
    }

    const withoutUpgrade = this.itemId - (this.itemId % 100);
    const infusion = withoutUpgrade % 1000;
    return withoutUpgrade - infusion;
  }

  get upgradeLevel(): number {
    if (this.itemType !== 0 && this.itemType !== 1) {
      return 0;
    }

    if (this.itemId >= 1330000 && this.itemId < 1332000) {
      return Math.floor((this.itemId - 1330000) / 100);
    }

    if (this.itemId >= 1332000 && this.itemId <= 1332500) {
      return Math.floor((this.itemId - 1332000) / 100);
    }

    return this.itemId % 100;
  }

  set upgradeLevel(value: number) {
    const baseId = this.baseItemId;

    if (baseId === 1330000) {
      this.itemId = 1330000 + value * 100;
      return;
    }

    if (baseId === 1332000) {
      this.itemId = 1332000 + value * 100;
      return;
    }

    if (this.isArtoriasCursedRange && baseId === 311000) {
      this.itemId = 311000 + value;
      return;
    }

    const infusion = this.infusion * 100;
    this.itemId = baseId + infusion + value;
  }

  get infusion(): ItemInfusion {
    if (this.itemType !== 0) {
      return ItemInfusion.Standard;
    }

    if ((this.itemId >= 1330000 && this.itemId <= 1332500) || this.isArtoriasCursedRange) {
      return ItemInfusion.Standard;
    }

    const withoutUpgrade = this.itemId - (this.itemId % 100);
    const infusionValue = Math.floor((withoutUpgrade % 1000) / 100);

    return infusionValue as ItemInfusion;
  }

  set infusion(value: ItemInfusion) {
    if ((this.itemId >= 1330000 && this.itemId <= 1332500) || this.isArtoriasCursedRange) {
      return;
    }

    const baseId = this.baseItemId;
    const upgradeLevel = this.upgradeLevel;
    this.itemId = baseId + value * 100 + upgradeLevel;
  }

  /**
   * The catalogue entry for this slot, resolved by (category nibble, item id).
   *
   * Was a linear scan over the whole flattened catalogue on every read; now a
   * single map hit. Still returns the raw JSON entry so existing callers and
   * a single map hit.
   */
  /**
   * The catalogue entry for this slot, resolved by (category nibble, item id).
   * Was a linear scan over the whole flattened catalogue on every read.
   */
  get itemInfo(): Item | null {
    if (this.isEmpty || !this.catalog) return null;
    return this.catalog.lookup(this.itemType, this.baseItemId);
  }

  get itemName(): string {
    const info = this.itemInfo;
    if (!info) return `Unknown (Type:0x${this.itemType.toString(16)}, ID:0x${this.itemId.toString(16)})`;
    return info.displayName;
  }

  get collectionType(): ItemCollectionType {
    const item = this.itemInfo;
    if (!item) return ItemCollectionType.Unknown;
    return COLLECTION_TO_TYPE[item.collection] ?? ItemCollectionType.Unknown;
  }

  getRawData(): Uint8Array {
    return new Uint8Array(this.data);
  }
}

export class Inventory {
  private character: Character;
  private catalog: ItemCatalog | null = null;

  private static readonly INVENTORY_START = 0x370;
  private static readonly ITEM_SIZE = 28;
  private static readonly MAX_SLOTS = 2048;

  // Hand slots: base offset stores the inventory slot index of the equipped weapon,
  // data offset stores a cached copy of that weapon's item ID (bytes 4-7).
  private static readonly EQUIPMENT_SLOTS = [
    { base: 0x02A8, data: 0x314 }, // LeftHand1
    { base: 0x02AC, data: 0x318 }, // RightHand1
    { base: 0x02B0, data: 0x31C }, // LeftHand2
    { base: 0x02B4, data: 0x320 }, // RightHand2
  ];
  constructor(character: Character) {
    this.character = character;
  }

  async loadItemsDatabase(): Promise<void> {
    try {
      const { catalog } = await loadItemCatalog('items.json');
      this.catalog = catalog;
    } catch (error) {
      console.error('Could not load items database:', error);
      throw new Error('Could not load items database. Please ensure items.json is available.');
    }
  }

  /** Indexed catalogue used for all id lookups. */
  getCatalog(): ItemCatalog {
    return this.catalog ?? ItemCatalog.empty();
  }

  get weaponLevel(): number {
    return this.character.getByte(0x0179);
  }

  set weaponLevel(value: number) {
    this.character.setByte(0x0179, value & 0xFF);
  }

  calibrateWeaponLevel(exact = false): number {
    const allItems = this.getAllItems();
    let maxWL = 0;

    for (const item of allItems) {
      if (item.collectionType === ItemCollectionType.Weapon) {
        const weaponLevel = this.getWeaponLevel(item);
        if (weaponLevel > maxWL) {
          maxWL = weaponLevel;
        }
      }
    }

    // exact=true (user clicked button): set to actual max, can decrease.
    // exact=false (automatic): only increase — anti-cheat detects weapon > WL, not WL > weapon.
    if (exact || maxWL > this.weaponLevel) {
      this.weaponLevel = maxWL;
    }

    return this.weaponLevel;
  }

  public getWeaponLevel(item: InventoryItem): number {
    const itemInfo = item.itemInfo;
    if (!itemInfo || item.collectionType !== ItemCollectionType.Weapon) {
      return 0;
    }

    // Pyromancy Flame (Ascended) — always WL 15 (requires +15 regular flame to craft)
    if (item.baseItemId === 0x145320) {
      return 15;
    }

    // Pyromancy Flame (regular) — WL equals upgrade level (upgrades 0–15, ID-encoded as 1330000 + level*100)
    if (item.baseItemId === 0x144B50) {
      return item.upgradeLevel;
    }

    if (!itemInfo.maxUpgrade) {
      return 0;
    }

    if (itemInfo.maxUpgrade === 5) {
      return 5 + item.upgradeLevel * 2;
    }

    const baseMaxUpgrade = itemInfo.maxUpgrade;
    const maxUpgradeForInfusion = Inventory.getMaxUpgradeForInfusion(baseMaxUpgrade, item.infusion);
    const currentUpgrade = item.upgradeLevel;

    switch (maxUpgradeForInfusion) {
      case 15:
        return currentUpgrade;
      case 5:
        return 10 + currentUpgrade;
      case 10:
        return 5 + currentUpgrade;
      default:
        return currentUpgrade;
    }
  }

  getAllItems(): InventoryItem[] {
    const items: InventoryItem[] = [];
    const data = this.character.getRawData();

    for (let i = 0; i < Inventory.MAX_SLOTS; i++) {
      const offset = Inventory.INVENTORY_START + i * Inventory.ITEM_SIZE;
      if (offset + Inventory.ITEM_SIZE > data.length) break;

      const itemData = data.slice(offset, offset + Inventory.ITEM_SIZE);
      const item = new InventoryItem(itemData, i, this.catalog);

      if (!item.isEmpty) {
        items.push(item);
      }
    }

    return items;
  }

  getItemsByType(collectionType: ItemCollectionType): InventoryItem[] {
    return this.getAllItems().filter((item) => item.collectionType === collectionType);
  }

  readSlot(slotIndex: number): InventoryItem {
    const data = this.character.getRawData();
    const offset = Inventory.INVENTORY_START + slotIndex * Inventory.ITEM_SIZE;

    if (offset + Inventory.ITEM_SIZE > data.length) {
      throw new Error('Slot index out of range');
    }

    const itemData = data.slice(offset, offset + Inventory.ITEM_SIZE);
    return new InventoryItem(itemData, slotIndex, this.catalog);
  }

  writeSlot(slotIndex: number, item: InventoryItem): void {
    const data = this.character.getRawData();
    const offset = Inventory.INVENTORY_START + slotIndex * Inventory.ITEM_SIZE;

    if (offset + Inventory.ITEM_SIZE > data.length) {
      throw new Error('Slot index out of range');
    }

    const itemData = item.getRawData();
    data.set(itemData, offset);
  }

  // Call after editing a weapon that's already equipped in a hand slot.
  // Updates the cached item ID copy that the game validates at runtime.
  syncEquipmentSlots(tsSlotIndex: number): void {
    const data = this.character.getRawData();
    const invItemOffset = Inventory.INVENTORY_START + tsSlotIndex * Inventory.ITEM_SIZE;

    for (const slot of Inventory.EQUIPMENT_SLOTS) {
      const stored =
        (data[slot.base] |
        (data[slot.base + 1] << 8) |
        (data[slot.base + 2] << 16) |
        (data[slot.base + 3] << 24)) >>> 0;

      if (stored === 0xFFFFFFFF) continue;

      if (stored === tsSlotIndex) {
        data[slot.data]     = data[invItemOffset + 4];
        data[slot.data + 1] = data[invItemOffset + 5];
        data[slot.data + 2] = data[invItemOffset + 6];
        data[slot.data + 3] = data[invItemOffset + 7];
      }
    }
  }

  // Call after deleting a weapon that may be equipped in a hand slot.
  // Resets any matching hand slot to fist (0xFFFFFFFF).
  clearEquipmentSlots(tsSlotIndex: number): void {
    const data = this.character.getRawData();

    for (const slot of Inventory.EQUIPMENT_SLOTS) {
      const stored =
        (data[slot.base] |
        (data[slot.base + 1] << 8) |
        (data[slot.base + 2] << 16) |
        (data[slot.base + 3] << 24)) >>> 0;

      if (stored === tsSlotIndex) {
        data[slot.base] = 0xFF; data[slot.base + 1] = 0xFF;
        data[slot.base + 2] = 0xFF; data[slot.base + 3] = 0xFF;
        data[slot.data] = 0xFF; data[slot.data + 1] = 0xFF;
        data[slot.data + 2] = 0xFF; data[slot.data + 3] = 0xFF;
      }
    }
  }

  // Returns a map of tsSlotIndex → hand label(s) e.g. 64 → "LH1", 129 → "RH1/RH2"
  getEquippedWeaponSlots(): Map<number, string> {
    const data = this.character.getRawData();
    const labels = ['LH1', 'RH1', 'LH2', 'RH2'];
    const result = new Map<number, string>();
    Inventory.EQUIPMENT_SLOTS.forEach((slot, i) => {
      const stored = (
        data[slot.base] |
        (data[slot.base + 1] << 8) |
        (data[slot.base + 2] << 16) |
        (data[slot.base + 3] << 24)
      ) >>> 0;
      if (stored !== 0xFFFFFFFF) {
        const existing = result.get(stored);
        result.set(stored, existing ? existing + '/' + labels[i] : labels[i]);
      }
    });
    return result;
  }

  findExistingItem(itemInfo: Item, upgradeLevel: number, infusion: ItemInfusion): InventoryItem | null {
    const baseId = itemInfo.id;
    const typeNumeric = itemInfo.typeNibble;
    const collectionType = this.getCollectionTypeFromItem(itemInfo);

    // For Key Items, search in slots 0-63, for others search in slots 64+
    const startSlot = collectionType === ItemCollectionType.Key ? 0 : 64;
    const endSlot = collectionType === ItemCollectionType.Key ? 64 : Inventory.MAX_SLOTS;

    for (let i = startSlot; i < endSlot; i++) {
      const item = this.readSlot(i);
      if (item.isEmpty) continue;

      if (
        item.itemType === typeNumeric &&
        item.baseItemId === baseId &&
        item.upgradeLevel === upgradeLevel &&
        item.infusion === infusion
      ) {
        return item;
      }
    }

    return null;
  }

  addItem(
    itemInfo: Item,
    quantity: number = 1,
    upgradeLevel: number = 0,
    infusion: ItemInfusion = ItemInfusion.Standard
  ): number | null {
    const collectionType = this.getCollectionTypeFromItem(itemInfo);

    // For stackable items (not weapons, armor, or rings), check if item already exists
    if (
      collectionType !== ItemCollectionType.Weapon &&
      collectionType !== ItemCollectionType.Armor &&
      collectionType !== ItemCollectionType.Ring &&
      itemInfo.stackMax > 1
    ) {
      const existing = this.findExistingItem(itemInfo, upgradeLevel, infusion);
      if (existing) {
        const newQuantity = Math.min(existing.quantity + quantity, itemInfo.stackMax);
        existing.quantity = newQuantity;
        this.writeSlot(existing.slotIndex, existing);
        this.updateItemsNumber(existing.slotIndex);
        return existing.slotIndex;
      }
    }

    // Find empty slot
    // For Key Items, search in slots 0-63, for others search in slots 64+
    const startSlot = collectionType === ItemCollectionType.Key ? 0 : 64;
    const endSlot = collectionType === ItemCollectionType.Key ? 64 : Inventory.MAX_SLOTS;

    for (let i = startSlot; i < endSlot; i++) {
      const slot = this.readSlot(i);
      if (slot.isEmpty) {
        const typeNumeric = itemInfo.typeNibble;
        const idNumeric = itemInfo.id;

        slot.itemType = typeNumeric;
        slot.itemId = idNumeric;
        slot.quantity = Math.min(quantity, itemInfo.stackMax);
        slot.order = i;
        slot.exists = 1;

        let baseDurability = itemInfo.durability;
        if (infusion === ItemInfusion.Crystal) {
          baseDurability = Math.floor(baseDurability / 10);
        }
        slot.durability = baseDurability;

        slot.upgradeLevel = upgradeLevel;
        slot.infusion = infusion;

        this.writeSlot(i, slot);
        this.updateItemsNumber(i);

        return i;
      }
    }

    return null;
  }

  deleteItem(slotIndex: number): void {
    this.clearEquipmentSlots(slotIndex);
    const emptyItem = new InventoryItem(new Uint8Array(28).fill(0xff), slotIndex, this.catalog);
    emptyItem.exists = 0;
    this.writeSlot(slotIndex, emptyItem);
  }

  clearAllItems(collectionType: ItemCollectionType): number {
    const items = this.getItemsByType(collectionType);
    for (const item of items) {
      this.deleteItem(item.slotIndex);
    }
    return items.length;
  }

  private updateItemsNumber(slotIndex: number): void {
    const data = this.character.getRawData();
    const currentMax =
      data[0xe370] |
      (data[0xe371] << 8) |
      (data[0xe372] << 16) |
      (data[0xe373] << 24);

    if (slotIndex > currentMax) {
      data[0xe370] = slotIndex & 0xff;
      data[0xe371] = (slotIndex >> 8) & 0xff;
      data[0xe372] = (slotIndex >> 16) & 0xff;
      data[0xe373] = (slotIndex >> 24) & 0xff;
    }
  }

  /** Which section of the inventory an entry belongs to. */
  private getCollectionTypeFromItem(item: Item): ItemCollectionType {
    return COLLECTION_TO_TYPE[item.collection] ?? ItemCollectionType.Unknown;
  }

  /**
   * Compute the upgrade level for a weapon so its Weapon Level does not exceed targetWL.
   * Returns null if the weapon cannot be at or below targetWL even at upgrade 0.
   */
  private computeUpgradeLevelForWL(item: Item, targetWL: number): number | null {
    const itemId = item.id;

    // Pyromancy Flame (regular) — upgrades 0–15 via ID encoding, WL = upgradeLevel
    if (itemId === 0x144B50) {
      return Math.min(targetWL, 15);
    }

    // Pyromancy Flame (Ascended) — always counts as WL 15, upgrades 0–5 via ID encoding
    // Only give if WL >= 15 (crafted from regular flame at +15)
    if (itemId === 0x145320) {
      return targetWL >= 15 ? 5 : null;
    }

    const maxUpgrade = item.maxUpgrade;

    // No upgrade possible → WL = 0, always valid
    if (!maxUpgrade || maxUpgrade === 0) {
      return 0;
    }

    if (maxUpgrade === 5) {
      // Boss/special weapons: WL = 5 + upgradeLevel * 2, minimum WL is 5
      if (targetWL < 5) return null;
      return Math.min(Math.floor((targetWL - 5) / 2), 5);
    }

    if (maxUpgrade === 15) {
      // Standard weapons (standard infusion): WL = upgradeLevel
      return Math.min(targetWL, 15);
    }

    // Fallback for unusual MaxUpgrade values
    return Math.min(targetWL, maxUpgrade);
  }

  /**
   * Add all items of the given collection type to the inventory.
   * For weapons, targetWL limits which weapons are added and at what upgrade level.
   * Returns the count of items added or updated.
   */
  addAllItems(
    collectionType: ItemCollectionType,
    targetWL?: number
  ): number {
    const catalog = this.getCatalog();
    if (catalog.isEmpty) return 0;

    // Items to always skip
    const SKIP_NAMES = new Set([
      // Estus Flask (all variants)
      'Estus Flask', 'Estus Flask (empty)',
      'Estus Flask + 1', 'Estus Flask + 1 (empty)',
      'Estus Flask + 2', 'Estus Flask + 2 (empty)',
      'Estus Flask + 3', 'Estus Flask + 3 (empty)',
      'Estus Flask + 4', 'Estus Flask + 4 (empty)',
      'Estus Flask + 5', 'Estus Flask + 5 (empty)',
      'Estus Flask + 6', 'Estus Flask + 6 (empty)',
      'Estus Flask + 7', 'Estus Flask + 7 (empty)',
      // Bare fists (not a real weapon)
      'Fists',
      // Empty/invisible armor slots
      'No helm', 'No armor', 'No gauntlets', 'No legs',
      // Egg-curse sorcerer head
      'Bloated Sorcerer Head',
      // Dragon transformation stones (DragonHead / DragonBody)
      'Dragon Head Stone', 'Dragon Torso Stone',
      // Internal/dummy items (SpiderEgg / NoMagic equivalents)
      'Egg', 'Big Egg',
    ]);

    const collection = ADD_ALL_COLLECTIONS[collectionType];
    if (!collection) return 0;
    const items = catalog.byCollection(collection);

    let count = 0;
    // Deduplicate by name within a single Add All run
    // (some items appear multiple times in the DB with different IDs)
    const seenNames = new Set<string>();

    for (const item of items) {
      if (SKIP_NAMES.has(item.name)) continue;
      if (seenNames.has(item.name)) continue;
      seenNames.add(item.name);

      if (collectionType === ItemCollectionType.Weapon) {
        const wl = targetWL ?? this.weaponLevel;
        const upgradeLevel = this.computeUpgradeLevelForWL(item, wl);
        if (upgradeLevel === null) continue;
        const slotIndex = this.addItem(item, 1, upgradeLevel, ItemInfusion.Standard);
        if (slotIndex !== null) count++;

      } else if (collectionType === ItemCollectionType.Ring) {
        // Duplicates allowed for rings
        const slotIndex = this.addItem(item, 1, 0, ItemInfusion.Standard);
        if (slotIndex !== null) count++;

      } else if (collectionType === ItemCollectionType.Armor) {
        // Duplicates allowed, add at max upgrade level
        const maxUpgrade = item.maxUpgrade || 0;
        const slotIndex = this.addItem(item, 1, maxUpgrade, ItemInfusion.Standard);
        if (slotIndex !== null) count++;

      } else {
        // No duplicates for all other categories
        const maxQty = Math.max(1, item.stackMax || 1);
        if ((item.stackMax || 1) <= 1) {
          // Non-stackable: skip if already exists
          const existing = this.findExistingItem(item, 0, ItemInfusion.Standard);
          if (existing) continue;
        }
        // For stackable items, addItem will update quantity of existing to max.
        // Passing maxQty ensures: min(existing + maxQty, maxQty) = maxQty.
        const slotIndex = this.addItem(item, maxQty, 0, ItemInfusion.Standard);
        if (slotIndex !== null) count++;
      }
    }

    return count;
  }

  static getMaxUpgradeForInfusion(baseMaxUpgrade: number, infusion: ItemInfusion): number {
    switch (infusion) {
      case ItemInfusion.Standard:
        return baseMaxUpgrade;
      case ItemInfusion.Crystal:
      case ItemInfusion.Lightning:
      case ItemInfusion.Raw:
      case ItemInfusion.Enchanted:
      case ItemInfusion.Occult:
      case ItemInfusion.Chaos:
        return Math.min(5, baseMaxUpgrade);
      case ItemInfusion.Magic:
      case ItemInfusion.Divine:
      case ItemInfusion.Fire:
        return Math.min(10, baseMaxUpgrade);
      default:
        return baseMaxUpgrade;
    }
  }
}
