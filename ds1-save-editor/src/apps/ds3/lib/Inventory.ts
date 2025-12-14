import { DS3Character } from './Character';

/**
 * DS3 Item Infusion Types
 * Based on the Final.py analysis
 */
export enum ItemInfusion {
  Standard = 0,
  Heavy = 1,
  Sharp = 2,
  Refined = 3,
  Simple = 4,
  Crystal = 5,
  Fire = 6,
  Chaos = 7,
  Lightning = 8,
  Deep = 9,
  Dark = 10,
  Poison = 11,
  Blood = 12,
  Raw = 13,
  Blessed = 14,
  Hollow = 15,
}

/**
 * Item Category based on separator byte (byte 3)
 * Based on analysis from find-inventory-end.js
 */
export enum ItemCategory {
  Weapons = 0x80,      // Weapons (separator 0x80 in structures)
  Armor = 0x90,        // Armor (separator 0x90)
  Rings = 0xA0,        // Rings (separator 0xA0)
  Consumables = 0xB0,  // Goods/Consumables (separator 0xB0)
}

export enum ItemCollectionType {
  Weapon = 'Weapon',
  Ring = 'Ring',
  Armor = 'Armor',
  Consumable = 'Consumable',
  Magic = 'Magic',
  Key = 'Key',
  Ammunition = 'Ammunition',
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
}

export interface ItemsDatabase {
  weapon_items?: Item[];
  armor_items?: Item[];
  ring_items?: Item[];
  magic_items?: Item[];
  consumable_items?: Item[];
  key_items?: Item[];
  ammunition_items?: Item[];
}

/**
 * DS3 Inventory Item
 * Structure: 16 bytes per item (based on Final.py and analysis)
 *
 * Bytes 0-2: Prefix/Unknown
 * Byte 3: Separator (0x80=Weapons, 0x90=Armor, 0xA0=Rings, 0xB0=Consumables)
 * Bytes 4-7: Item ID (4 bytes, little-endian)
 * Byte 8: Quantity (1 byte) OR
 * Bytes 8-10: Quantity (3 bytes for stackable items)
 * Bytes 11-15: Unknown/Additional data
 */
export class DS3InventoryItem {
  private data: Uint8Array;
  private itemsDatabase: ItemsDatabase | null;
  public slotIndex: number;

  constructor(data: Uint8Array, slotIndex: number, itemsDatabase: ItemsDatabase | null = null) {
    this.data = new Uint8Array(16);
    if (data) {
      this.data.set(data.slice(0, 16));
    }
    this.slotIndex = slotIndex;
    this.itemsDatabase = itemsDatabase;
  }

  /**
   * Separator byte (byte 3) - indicates item category
   */
  get separator(): number {
    return this.data[3];
  }

  set separator(value: number) {
    this.data[3] = value & 0xFF;
  }

  /**
   * Item ID (bytes 4-7, little-endian)
   */
  get itemId(): number {
    return (
      this.data[4] |
      (this.data[5] << 8) |
      (this.data[6] << 16) |
      (this.data[7] << 24)
    ) >>> 0; // Unsigned 32-bit
  }

  set itemId(value: number) {
    this.data[4] = value & 0xFF;
    this.data[5] = (value >> 8) & 0xFF;
    this.data[6] = (value >> 16) & 0xFF;
    this.data[7] = (value >> 24) & 0xFF;
  }

  /**
   * Quantity (byte 8, or bytes 8-10 for stackable items)
   * For now, using single byte
   */
  get quantity(): number {
    return this.data[8];
  }

  set quantity(value: number) {
    this.data[8] = value & 0xFF;
  }

  /**
   * Check if slot is empty
   */
  get isEmpty(): boolean {
    // Empty if all bytes are 0x00 or 0xFF
    const isAllZeros = this.data.every((b) => b === 0x00);
    const isAllFFs = this.data.every((b) => b === 0xFF);
    const isGarbagePattern =
      this.data[0] === 0x00 &&
      this.data[1] === 0x00 &&
      this.data[2] === 0x00 &&
      this.data[3] === 0x00 &&
      this.data[4] === 0xFF &&
      this.data[5] === 0xFF &&
      this.data[6] === 0xFF &&
      this.data[7] === 0xFF;

    return isAllZeros || isAllFFs || isGarbagePattern || this.quantity === 0;
  }

  /**
   * Get base item ID (without upgrade/infusion modifiers)
   */
  get baseItemId(): number {
    return this.itemId;
  }

  /**
   * Get item info from database
   */
  get itemInfo(): Item | null {
    if (this.isEmpty || !this.itemsDatabase) {
      return null;
    }

    const allItems = this.getAllItems();
    const itemId = this.itemId;

    return (
      allItems.find((item) => {
        const dbItemId = this.parseHex(item.Id);
        return dbItemId === itemId;
      }) || null
    );
  }

  /**
   * Get item name
   */
  get itemName(): string {
    const info = this.itemInfo;
    if (!info) {
      return `Unknown (ID:0x${this.itemId.toString(16).toUpperCase()}, Sep:0x${this.separator.toString(16).toUpperCase()})`;
    }
    return info.Name;
  }

  /**
   * Get collection type based on database
   */
  get collectionType(): ItemCollectionType {
    const info = this.itemInfo;
    if (!info) return ItemCollectionType.Unknown;

    if (this.itemsDatabase?.weapon_items?.includes(info)) return ItemCollectionType.Weapon;
    if (this.itemsDatabase?.ring_items?.includes(info)) return ItemCollectionType.Ring;
    if (this.itemsDatabase?.armor_items?.includes(info)) return ItemCollectionType.Armor;
    if (this.itemsDatabase?.consumable_items?.includes(info)) return ItemCollectionType.Consumable;
    if (this.itemsDatabase?.magic_items?.includes(info)) return ItemCollectionType.Magic;
    if (this.itemsDatabase?.key_items?.includes(info)) return ItemCollectionType.Key;
    if (this.itemsDatabase?.ammunition_items?.includes(info)) return ItemCollectionType.Ammunition;

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
      ...(this.itemsDatabase.magic_items || []),
      ...(this.itemsDatabase.key_items || []),
      ...(this.itemsDatabase.ammunition_items || []),
    ];
  }

  getRawData(): Uint8Array {
    return new Uint8Array(this.data);
  }
}

/**
 * DS3 Inventory Manager
 * Based on analysis from find-inventory-*.js scripts
 */
export class DS3Inventory {
  private character: DS3Character;
  private itemsDatabase: ItemsDatabase | null = null;

  // Based on analysis: inventory starts at Pattern1 + 0x09C
  private static readonly INVENTORY_START_RELATIVE = 0x09C;
  private static readonly ITEM_SIZE = 16; // 16 bytes per item in DS3
  private static readonly MAX_SLOTS = 300; // Based on find-inventory-end.js (scans up to 300)

  constructor(character: DS3Character) {
    this.character = character;
  }

  /**
   * Load items database from JSON
   */
  async loadItemsDatabase(): Promise<void> {
    const isElectron = typeof window !== 'undefined' && window.location.protocol === 'file:';

    const paths = isElectron
      ? ['./json/ds3_items.json', '/json/ds3_items.json']
      : ['/json/ds3_items.json', './json/ds3_items.json'];

    let lastError: Error | null = null;

    for (const jsonPath of paths) {
      try {
        const response = await fetch(jsonPath);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        this.itemsDatabase = await response.json();
        console.log('[DS3 Inventory] Items database loaded successfully');
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Failed to load DS3 items database from ${jsonPath}:`, lastError);
      }
    }

    console.error('Could not load DS3 items database from any path:', lastError);
    throw new Error('Could not load DS3 items database. Please ensure ds3_items.json is available.');
  }

  getItemsDatabase(): ItemsDatabase | null {
    return this.itemsDatabase;
  }

  /**
   * Get inventory start offset (Pattern + 0x09C)
   */
  private getInventoryStartOffset(): number {
    const characterData = this.character.getRawData();
    const patternOffset = this.findPattern(characterData);

    if (patternOffset === -1) {
      throw new Error('[DS3 Inventory] Character pattern not found');
    }

    return patternOffset + DS3Inventory.INVENTORY_START_RELATIVE;
  }

  /**
   * Find character pattern in data
   */
  private findPattern(data: Uint8Array): number {
    const pattern = [
      0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ];

    if (data.length < pattern.length) {
      return -1;
    }

    const maxStart = data.length - pattern.length;

    for (let i = 0; i <= maxStart; i++) {
      let found = true;
      for (let j = 0; j < pattern.length; j++) {
        if (data[i + j] !== pattern[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Get all non-empty items from inventory
   */
  getAllItems(): DS3InventoryItem[] {
    const items: DS3InventoryItem[] = [];
    const data = this.character.getRawData();
    const inventoryStart = this.getInventoryStartOffset();

    for (let i = 0; i < DS3Inventory.MAX_SLOTS; i++) {
      const offset = inventoryStart + i * DS3Inventory.ITEM_SIZE;
      if (offset + DS3Inventory.ITEM_SIZE > data.length) break;

      const itemData = data.slice(offset, offset + DS3Inventory.ITEM_SIZE);
      const item = new DS3InventoryItem(itemData, i, this.itemsDatabase);

      if (!item.isEmpty) {
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Get items by collection type
   */
  getItemsByType(collectionType: ItemCollectionType): DS3InventoryItem[] {
    return this.getAllItems().filter((item) => item.collectionType === collectionType);
  }

  /**
   * Read item from specific slot
   */
  readSlot(slotIndex: number): DS3InventoryItem {
    const data = this.character.getRawData();
    const inventoryStart = this.getInventoryStartOffset();
    const offset = inventoryStart + slotIndex * DS3Inventory.ITEM_SIZE;

    if (offset + DS3Inventory.ITEM_SIZE > data.length) {
      throw new Error('Slot index out of range');
    }

    const itemData = data.slice(offset, offset + DS3Inventory.ITEM_SIZE);
    return new DS3InventoryItem(itemData, slotIndex, this.itemsDatabase);
  }

  /**
   * Write item to specific slot
   */
  writeSlot(slotIndex: number, item: DS3InventoryItem): void {
    const data = this.character.getRawData();
    const inventoryStart = this.getInventoryStartOffset();
    const offset = inventoryStart + slotIndex * DS3Inventory.ITEM_SIZE;

    if (offset + DS3Inventory.ITEM_SIZE > data.length) {
      throw new Error('Slot index out of range');
    }

    const itemData = item.getRawData();
    data.set(itemData, offset);
  }

  /**
   * Find existing item in inventory
   */
  findExistingItem(itemInfo: Item): DS3InventoryItem | null {
    const baseId = this.parseHex(itemInfo.Id);

    for (let i = 0; i < DS3Inventory.MAX_SLOTS; i++) {
      const item = this.readSlot(i);
      if (item.isEmpty) continue;

      if (item.baseItemId === baseId) {
        return item;
      }
    }

    return null;
  }

  /**
   * Add item to inventory
   */
  addItem(itemInfo: Item, quantity: number = 1): number | null {
    const collectionType = this.getCollectionTypeFromItem(itemInfo);

    // For stackable items, check if item already exists
    if (
      collectionType !== ItemCollectionType.Weapon &&
      collectionType !== ItemCollectionType.Armor &&
      collectionType !== ItemCollectionType.Ring &&
      itemInfo.MaxStackCount > 1
    ) {
      const existing = this.findExistingItem(itemInfo);
      if (existing) {
        const newQuantity = Math.min(existing.quantity + quantity, itemInfo.MaxStackCount);
        existing.quantity = newQuantity;
        this.writeSlot(existing.slotIndex, existing);
        return existing.slotIndex;
      }
    }

    // Find empty slot
    for (let i = 0; i < DS3Inventory.MAX_SLOTS; i++) {
      const slot = this.readSlot(i);
      if (slot.isEmpty) {
        const idNumeric = this.parseHex(itemInfo.Id);

        // Determine separator based on category
        let separator = 0xB0; // Default: Consumables
        if (collectionType === ItemCollectionType.Weapon) separator = 0x80;
        else if (collectionType === ItemCollectionType.Armor) separator = 0x90;
        else if (collectionType === ItemCollectionType.Ring) separator = 0xA0;

        slot.separator = separator;
        slot.itemId = idNumeric;
        slot.quantity = Math.min(quantity, itemInfo.MaxStackCount);

        this.writeSlot(i, slot);
        return i;
      }
    }

    return null;
  }

  /**
   * Delete item from slot
   */
  deleteItem(slotIndex: number): void {
    const emptyItem = new DS3InventoryItem(new Uint8Array(16).fill(0x00), slotIndex, this.itemsDatabase);
    this.writeSlot(slotIndex, emptyItem);
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
    if (this.itemsDatabase.magic_items?.includes(item)) return ItemCollectionType.Magic;
    if (this.itemsDatabase.key_items?.includes(item)) return ItemCollectionType.Key;
    if (this.itemsDatabase.ammunition_items?.includes(item)) return ItemCollectionType.Ammunition;

    return ItemCollectionType.Unknown;
  }
}
