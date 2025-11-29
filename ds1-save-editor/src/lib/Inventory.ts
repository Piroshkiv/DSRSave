import { Character } from './Character';

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

export interface Item {
  Type: string;
  Id: string;
  MaxStackCount: number;
  Category: string;
  Name: string;
  MaxUpgrade?: number;
  CanInfuse?: boolean;
  Durability?: number;
  MugenMonkeyName?: string;
  SoulsplannerName?: string;
}

export interface ItemsDatabase {
  weapon_items: Item[];
  ring_items: Item[];
  armor_items: Item[];
  consumable_items: Item[];
  soul_items: Item[];
  upgrade_items: Item[];
  key_items: Item[];
  spell_items: Item[];
  usable_items: Item[];
  ammunition_items: Item[];
  material_items: Item[];
  magic_items: Item[];
  specials: Item[];
}

export class InventoryItem {
  private data: Uint8Array;
  private itemsDatabase: ItemsDatabase | null;
  public slotIndex: number;

  constructor(data: Uint8Array, slotIndex: number, itemsDatabase: ItemsDatabase | null = null) {
    this.data = new Uint8Array(28);
    if (data) {
      this.data.set(data.slice(0, 28));
    }
    this.slotIndex = slotIndex;
    this.itemsDatabase = itemsDatabase;
  }

  get itemType(): number {
    const value =
      (this.data[0] << 24) |
      (this.data[1] << 16) |
      (this.data[2] << 8) |
      this.data[3];
    return Math.floor(value / 16);
  }

  set itemType(value: number) {
    const stored = value * 16;
    this.data[0] = (stored >> 24) & 0xff;
    this.data[1] = (stored >> 16) & 0xff;
    this.data[2] = (stored >> 8) & 0xff;
    this.data[3] = stored & 0xff;
  }

  get itemId(): number {
    return (
      this.data[4] |
      (this.data[5] << 8) |
      (this.data[6] << 16) |
      (this.data[7] << 24)
    );
  }

  set itemId(value: number) {
    this.data[4] = value & 0xff;
    this.data[5] = (value >> 8) & 0xff;
    this.data[6] = (value >> 16) & 0xff;
    this.data[7] = (value >> 24) & 0xff;
  }

  get quantity(): number {
    return (
      this.data[8] |
      (this.data[9] << 8) |
      (this.data[10] << 16) |
      (this.data[11] << 24)
    );
  }

  set quantity(value: number) {
    this.data[8] = value & 0xff;
    this.data[9] = (value >> 8) & 0xff;
    this.data[10] = (value >> 16) & 0xff;
    this.data[11] = (value >> 24) & 0xff;
  }

  get order(): number {
    return (
      this.data[12] |
      (this.data[13] << 8) |
      (this.data[14] << 16) |
      (this.data[15] << 24)
    );
  }

  set order(value: number) {
    this.data[12] = value & 0xff;
    this.data[13] = (value >> 8) & 0xff;
    this.data[14] = (value >> 16) & 0xff;
    this.data[15] = (value >> 24) & 0xff;
  }

  get exists(): number {
    return (
      this.data[16] |
      (this.data[17] << 8) |
      (this.data[18] << 16) |
      (this.data[19] << 24)
    );
  }

  set exists(value: number) {
    this.data[16] = value & 0xff;
    this.data[17] = (value >> 8) & 0xff;
    this.data[18] = (value >> 16) & 0xff;
    this.data[19] = (value >> 24) & 0xff;
  }

  get durability(): number {
    return (
      this.data[20] |
      (this.data[21] << 8) |
      (this.data[22] << 16) |
      (this.data[23] << 24)
    );
  }

  set durability(value: number) {
    this.data[20] = value & 0xff;
    this.data[21] = (value >> 8) & 0xff;
    this.data[22] = (value >> 16) & 0xff;
    this.data[23] = (value >> 24) & 0xff;
  }

  get isEmpty(): boolean {
    return this.exists === 0 || this.data.every((b) => b === 0 || b === 0xff);
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

    if (this.itemId >= 311000 && this.itemId <= 312705) {
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

    if (this.itemId >= 311000 && this.itemId <= 312705) {
      return this.itemId % 100;
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

    if (baseId === 311000) {
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

    if (
      (this.itemId >= 1330000 && this.itemId <= 1332500) ||
      (this.itemId >= 311000 && this.itemId <= 312705)
    ) {
      return ItemInfusion.Standard;
    }

    const withoutUpgrade = this.itemId - (this.itemId % 100);
    const infusionValue = Math.floor((withoutUpgrade % 1000) / 100);

    return infusionValue as ItemInfusion;
  }

  set infusion(value: ItemInfusion) {
    if (
      (this.itemId >= 1330000 && this.itemId <= 1332500) ||
      (this.itemId >= 311000 && this.itemId <= 312705)
    ) {
      return;
    }

    const baseId = this.baseItemId;
    const upgradeLevel = this.upgradeLevel;
    this.itemId = baseId + value * 100 + upgradeLevel;
  }

  get itemInfo(): Item | null {
    if (this.isEmpty || !this.itemsDatabase) {
      return null;
    }

    const allItems = this.getAllItems();
    return (
      allItems.find(
        (item) =>
          this.parseHex(item.Id) === this.baseItemId &&
          Math.floor(this.parseHex(item.Type) / 0x10000000) === this.itemType
      ) || null
    );
  }

  get itemName(): string {
    const info = this.itemInfo;
    return info ? info.Name : `Unknown (Type:0x${this.itemType.toString(16)}, ID:0x${this.itemId.toString(16)})`;
  }

  get collectionType(): ItemCollectionType {
    const info = this.itemInfo;
    if (!info) return ItemCollectionType.Unknown;

    if (this.itemsDatabase?.weapon_items?.includes(info)) return ItemCollectionType.Weapon;
    if (this.itemsDatabase?.ring_items?.includes(info)) return ItemCollectionType.Ring;
    if (this.itemsDatabase?.armor_items?.includes(info)) return ItemCollectionType.Armor;
    if (this.itemsDatabase?.consumable_items?.includes(info)) return ItemCollectionType.Consumable;
    if (this.itemsDatabase?.soul_items?.includes(info)) return ItemCollectionType.Soul;
    if (this.itemsDatabase?.upgrade_items?.includes(info)) return ItemCollectionType.Upgrade;
    if (this.itemsDatabase?.key_items?.includes(info)) return ItemCollectionType.Key;
    if (this.itemsDatabase?.spell_items?.includes(info)) return ItemCollectionType.Spell;
    if (this.itemsDatabase?.usable_items?.includes(info)) return ItemCollectionType.Usable;
    if (this.itemsDatabase?.ammunition_items?.includes(info)) return ItemCollectionType.Ammunition;
    if (this.itemsDatabase?.material_items?.includes(info)) return ItemCollectionType.Material;
    if (this.itemsDatabase?.magic_items?.includes(info)) return ItemCollectionType.Magic;
    if (this.itemsDatabase?.specials?.includes(info)) return ItemCollectionType.Special;

    return ItemCollectionType.Unknown;
  }

  private parseHex(hex: string): number {
    return parseInt(hex.replace('0x', '').replace('0X', ''), 16);
  }

  private getAllItems(): Item[] {
    if (!this.itemsDatabase) return [];

    return [
      ...(this.itemsDatabase.weapon_items || []),
      ...(this.itemsDatabase.ring_items || []),
      ...(this.itemsDatabase.armor_items || []),
      ...(this.itemsDatabase.consumable_items || []),
      ...(this.itemsDatabase.soul_items || []),
      ...(this.itemsDatabase.upgrade_items || []),
      ...(this.itemsDatabase.key_items || []),
      ...(this.itemsDatabase.spell_items || []),
      ...(this.itemsDatabase.usable_items || []),
      ...(this.itemsDatabase.ammunition_items || []),
      ...(this.itemsDatabase.material_items || []),
      ...(this.itemsDatabase.magic_items || []),
      ...(this.itemsDatabase.specials || []),
    ];
  }

  getRawData(): Uint8Array {
    return new Uint8Array(this.data);
  }
}

export class Inventory {
  private character: Character;
  private itemsDatabase: ItemsDatabase | null = null;

  private static readonly INVENTORY_START = 0x370;
  private static readonly ITEM_SIZE = 28;
  private static readonly MAX_SLOTS = 2048;

  constructor(character: Character) {
    this.character = character;
  }

  async loadItemsDatabase(): Promise<void> {
    // Check if running in Electron (file:// protocol) or web (http/https)
    const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';
    
    // In Electron, use relative path; in web, use absolute path
    const paths = isElectron 
      ? ['./json/items.json', '/json/items.json']
      : ['/json/items.json', './json/items.json'];
    
    let lastError: Error | null = null;
    
    for (const jsonPath of paths) {
      try {
        const response = await fetch(jsonPath);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        this.itemsDatabase = await response.json();
        return; // Success, exit early
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Failed to load items database from ${jsonPath}:`, lastError);
        // Continue to try next path
      }
    }
    
    // All paths failed
    console.error('Could not load items database from any path:', lastError);
    throw new Error('Could not load items database. Please ensure items.json is available.');
  }

  getItemsDatabase(): ItemsDatabase | null {
    return this.itemsDatabase;
  }

  get weaponLevel(): number {
    return this.character.getByte(0x0179);
  }

  set weaponLevel(value: number) {
    this.character.setByte(0x0179, value & 0xFF);
  }

  calibrateWeaponLevel(): number {
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

    this.weaponLevel = maxWL;
    return maxWL;
  }

  public getWeaponLevel(item: InventoryItem): number {
    const itemInfo = item.itemInfo;
    if (!itemInfo || !itemInfo.MaxUpgrade || item.collectionType !== ItemCollectionType.Weapon) {
      return 0;
    }

    // Special case for Pyromancy Flame (Ascended)
    if (item.baseItemId === 0x145320) {
      return 15;
    }

    if (itemInfo.MaxUpgrade === 5) {
      return 5 + item.upgradeLevel * 2;
    }

    const baseMaxUpgrade = itemInfo.MaxUpgrade;
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
      const item = new InventoryItem(itemData, i, this.itemsDatabase);

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
    return new InventoryItem(itemData, slotIndex, this.itemsDatabase);
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

  findExistingItem(itemInfo: Item, upgradeLevel: number, infusion: ItemInfusion): InventoryItem | null {
    const baseId = this.parseHex(itemInfo.Id);
    const collectionType = this.getCollectionTypeFromItem(itemInfo);

    // For Key Items, search in slots 0-63, for others search in slots 64+
    const startSlot = collectionType === ItemCollectionType.Key ? 0 : 64;
    const endSlot = collectionType === ItemCollectionType.Key ? 64 : Inventory.MAX_SLOTS;

    for (let i = startSlot; i < endSlot; i++) {
      const item = this.readSlot(i);
      if (item.isEmpty) continue;

      if (
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
      itemInfo.MaxStackCount > 1
    ) {
      const existing = this.findExistingItem(itemInfo, upgradeLevel, infusion);
      if (existing) {
        const newQuantity = Math.min(existing.quantity + quantity, itemInfo.MaxStackCount);
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
        const typeNumeric = Math.floor(this.parseHex(itemInfo.Type) / 0x10000000);
        const idNumeric = this.parseHex(itemInfo.Id);

        slot.itemType = typeNumeric;
        slot.itemId = idNumeric;
        slot.quantity = Math.min(quantity, itemInfo.MaxStackCount);
        slot.order = i;
        slot.exists = 1;

        let baseDurability = itemInfo.Durability || 0;
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
    const emptyItem = new InventoryItem(new Uint8Array(28).fill(0xff), slotIndex, this.itemsDatabase);
    emptyItem.exists = 0;
    this.writeSlot(slotIndex, emptyItem);
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

  private parseHex(hex: string): number {
    return parseInt(hex.replace('0x', '').replace('0X', ''), 16);
  }

  private getCollectionTypeFromItem(item: Item): ItemCollectionType {
    if (!this.itemsDatabase) return ItemCollectionType.Unknown;

    if (this.itemsDatabase.weapon_items?.includes(item)) return ItemCollectionType.Weapon;
    if (this.itemsDatabase.ring_items?.includes(item)) return ItemCollectionType.Ring;
    if (this.itemsDatabase.armor_items?.includes(item)) return ItemCollectionType.Armor;
    if (this.itemsDatabase.consumable_items?.includes(item)) return ItemCollectionType.Consumable;
    if (this.itemsDatabase.soul_items?.includes(item)) return ItemCollectionType.Soul;
    if (this.itemsDatabase.upgrade_items?.includes(item)) return ItemCollectionType.Upgrade;
    if (this.itemsDatabase.key_items?.includes(item)) return ItemCollectionType.Key;
    if (this.itemsDatabase.spell_items?.includes(item)) return ItemCollectionType.Spell;
    if (this.itemsDatabase.usable_items?.includes(item)) return ItemCollectionType.Usable;
    if (this.itemsDatabase.ammunition_items?.includes(item)) return ItemCollectionType.Ammunition;
    if (this.itemsDatabase.material_items?.includes(item)) return ItemCollectionType.Material;
    if (this.itemsDatabase.magic_items?.includes(item)) return ItemCollectionType.Magic;
    if (this.itemsDatabase.specials?.includes(item)) return ItemCollectionType.Special;

    return ItemCollectionType.Unknown;
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
