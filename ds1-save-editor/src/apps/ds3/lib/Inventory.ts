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
  Ore = 'Ore',
  Key = 'Key',
  Ammunition = 'Ammunition',
  Covenant = 'Covenant',
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
  ore_items?: Item[];
  key_items?: Item[];
  ammunition_items?: Item[];
  covenant_items?: Item[];
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

  // Cache for baseItemId to avoid repeated searches
  private _cachedBaseItemId: number | null = null;

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
   * Bytes 0-2: First 3 bytes of item ID (for signature)
   * These should match bytes 4-6
   */
  updateItemIdPrefix(): void {
    this.data[0] = this.data[4];
    this.data[1] = this.data[5];
    this.data[2] = this.data[6];
  }

  /**
   * Signature bytes 12-13 (counters)
   * Based on Final.py logic
   */
  get counterByte12(): number {
    return this.data[12];
  }

  set counterByte12(value: number) {
    this.data[12] = value & 0xFF;
  }

  get counterByte13(): number {
    return this.data[13];
  }

  set counterByte13(value: number) {
    this.data[13] = value & 0xFF;
  }

  /**
   * Set signature bytes (9-15) based on previous item or defaults
   * Bytes 9-11: 00 00 00
   * Byte 12: counter (incremented from previous)
   * Byte 13: counter with masking
   * Bytes 14-15: copied from previous or default
   */
  setSignatureBytes(previousItem: DS3InventoryItem | null): void {
    // Bytes 9-11: always 00 00 00
    this.data[9] = 0x00;
    this.data[10] = 0x00;
    this.data[11] = 0x00;

    if (previousItem && !previousItem.isEmpty) {
      // Copy and increment counter from previous item
      const prevCounter12 = previousItem.counterByte12;
      const prevCounter13 = previousItem.counterByte13;

      // Increment byte 12
      const newCounter12 = (prevCounter12 + 1) & 0xFF;
      this.data[12] = newCounter12;

      // Byte 13: increment lower nibble (0-9 decimal value)
      const lowerNibble = prevCounter13 & 0x0F;
      const upperNibble = prevCounter13 & 0xF0;
      const newLowerNibble = ((lowerNibble + 1) % 10) & 0x0F;
      this.data[13] = upperNibble | newLowerNibble;

      // Copy bytes 14-15 from previous item
      this.data[14] = previousItem.data[14];
      this.data[15] = previousItem.data[15];
    } else {
      // Default values (from Final.py default_pattern)
      this.data[12] = 0x90;
      this.data[13] = 0xA0;
      this.data[14] = 0xEE;
      this.data[15] = 0x02;
    }
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
   * Get upgrade level for weapons (0-15)
   * Formula: byte0 = base_byte0 + (infusion * 100) + upgrade
   * So: upgrade = (byte0 - base_byte0) % 100
   */
  get upgradeLevel(): number {
    // Only weapons have upgrade levels (separator 0x80)
    if (this.separator !== 0x80 || !this.itemsDatabase) {
      return 0;
    }

    const baseId = this.baseItemId;
    if (baseId === this.itemId) {
      return 0; // No upgrade/infusion
    }

    const byte0 = this.itemId & 0xFF;
    const base_byte0 = baseId & 0xFF;
    const modifier = (byte0 - base_byte0 + 256) & 0xFF;

    return modifier % 100;
  }

  /**
   * Get infusion type for weapons
   * Formula: byte0 = base_byte0 + (infusion * 100) + upgrade
   * So: infusion = floor((byte0 - base_byte0) / 100)
   */
  get infusion(): ItemInfusion {
    // Only weapons have infusions (separator 0x80)
    if (this.separator !== 0x80 || !this.itemsDatabase) {
      return ItemInfusion.Standard;
    }

    const baseId = this.baseItemId;
    if (baseId === this.itemId) {
      return ItemInfusion.Standard; // No upgrade/infusion
    }

    const byte0 = this.itemId & 0xFF;
    const base_byte0 = baseId & 0xFF;
    const modifier = (byte0 - base_byte0 + 256) & 0xFF;

    return Math.floor(modifier / 100) as ItemInfusion;
  }

  /**
   * Get base item ID (without upgrade modifiers)
   * Formula: byte0 = base_byte0 + (infusion * 100) + upgrade
   *
   * For weapons, bytes 1-3 stay the same, only byte0 changes with upgrades/infusions.
   * So we search for a weapon with matching bytes 1-3 in the database.
   */
  get baseItemId(): number {
    // Only weapons need ID cleaning (separator 0x80)
    if (this.separator !== 0x80 || !this.itemsDatabase) {
      return this.itemId;
    }

    // Use cached value if available
    if (this._cachedBaseItemId !== null) {
      return this._cachedBaseItemId;
    }

    const allWeapons = this.itemsDatabase.weapon_items || [];
    const byte1 = (this.itemId >> 8) & 0xFF;
    const byte2 = (this.itemId >> 16) & 0xFF;
    const byte3 = (this.itemId >> 24) & 0xFF;

    // Search for weapon where bytes 1-3 match (byte0 may differ due to upgrades)
    const found = allWeapons.find(w => {
      const dbId = this.parseHex(w.Id);
      const dbByte1 = (dbId >> 8) & 0xFF;
      const dbByte2 = (dbId >> 16) & 0xFF;
      const dbByte3 = (dbId >> 24) & 0xFF;
      return dbByte1 === byte1 && dbByte2 === byte2 && dbByte3 === byte3;
    });

    const result = found ? this.parseHex(found.Id) : this.itemId;
    this._cachedBaseItemId = result;
    return result;
  }

  /**
   * Get item info from database
   */
  get itemInfo(): Item | null {
    if (this.isEmpty || !this.itemsDatabase) {
      return null;
    }

    const allItems = this.getAllItems();

    // First, try exact match with baseItemId (works for weapons)
    const baseId = this.baseItemId;
    let found = allItems.find((item) => {
      const dbItemId = this.parseHex(item.Id);
      return dbItemId === baseId;
    });

    // If not found and it's a weapon, try exact itemId match
    // (some special weapons might not need masking)
    if (!found && this.separator === 0x80) {
      found = allItems.find((item) => {
        const dbItemId = this.parseHex(item.Id);
        return dbItemId === this.itemId;
      });
    }

    // For non-weapons, try exact itemId match
    if (!found && this.separator !== 0x80) {
      found = allItems.find((item) => {
        const dbItemId = this.parseHex(item.Id);
        return dbItemId === this.itemId;
      });
    }

    return found || null;
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
   * Uses the Category field from item info for reliable type detection
   */
  get collectionType(): ItemCollectionType {
    const info = this.itemInfo;
    if (!info) return ItemCollectionType.Unknown;

    // Use Category field for more reliable type detection
    const category = info.Category?.toLowerCase();

    // Map category to collection type
    if (category === 'keys') return ItemCollectionType.Key;
    if (category === 'covenants') return ItemCollectionType.Covenant;
    if (category === 'ores') return ItemCollectionType.Ore;
    if (category === 'ammunition') return ItemCollectionType.Ammunition;
    if (category === 'rings') return ItemCollectionType.Ring;
    if (category === 'sorceries' || category === 'miracles' || category === 'pyromancies') {
      return ItemCollectionType.Magic;
    }
    // Armor categories
    if (category === 'helms' || category === 'chests' || category === 'gauntlets' || category === 'leggings') {
      return ItemCollectionType.Armor;
    }

    // Fallback to array membership check for items without specific category
    if (this.itemsDatabase?.weapon_items?.includes(info)) return ItemCollectionType.Weapon;
    if (this.itemsDatabase?.ring_items?.includes(info)) return ItemCollectionType.Ring;
    if (this.itemsDatabase?.armor_items?.includes(info)) return ItemCollectionType.Armor;
    if (this.itemsDatabase?.magic_items?.includes(info)) return ItemCollectionType.Magic;
    if (this.itemsDatabase?.consumable_items?.includes(info)) return ItemCollectionType.Consumable;
    if (this.itemsDatabase?.ore_items?.includes(info)) return ItemCollectionType.Ore;
    if (this.itemsDatabase?.key_items?.includes(info)) return ItemCollectionType.Key;
    if (this.itemsDatabase?.ammunition_items?.includes(info)) return ItemCollectionType.Ammunition;
    if (this.itemsDatabase?.covenant_items?.includes(info)) return ItemCollectionType.Covenant;

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
      ...(this.itemsDatabase.ore_items || []),
      ...(this.itemsDatabase.key_items || []),
      ...(this.itemsDatabase.ammunition_items || []),
      ...(this.itemsDatabase.covenant_items || []),
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
  private static readonly MAX_SLOTS = 2000; // Scan up to 3000 slots for complete inventory

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
   * Calculate CRC16 for item ID (used in bytes 14-15)
   * This appears to be CRC16-CCITT (polynomial 0x1021)
   */
  // @ts-expect-error - Reserved for future use
  private _calculateItemCRC16(itemId: number): number {
    const bytes = [
      itemId & 0xFF,
      (itemId >> 8) & 0xFF,
      (itemId >> 16) & 0xFF,
      (itemId >> 24) & 0xFF,
    ];

    let crc = 0xFFFF;
    const polynomial = 0x1021;

    for (const byte of bytes) {
      crc ^= (byte << 8);
      for (let i = 0; i < 8; i++) {
        if (crc & 0x8000) {
          crc = ((crc << 1) ^ polynomial) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }

    return crc & 0xFFFF;
  }

  /**
   * Read Counter 1 (Pattern + 472)
   * Counter 1 is the global item counter used in bytes 0-1 of each item
   */
  // @ts-expect-error - Reserved for future use
  private _readCounter1(): number {
    const data = this.character.getRawData();
    const patternOffset = this.findPattern(data);

    if (patternOffset === -1) {
      throw new Error('[DS3 Inventory] Character pattern not found');
    }

    const counter1Offset = patternOffset + 472;

    if (counter1Offset + 1 >= data.length) {
      throw new Error('[DS3 Inventory] Counter 1 offset out of bounds');
    }

    // Read counter (2 bytes, little-endian)
    return data[counter1Offset] | (data[counter1Offset + 1] << 8);
  }

  /**
   * Increment Counter 1 (Pattern + 472)
   * Counter 1 tracks inventory item additions (including deleted items)
   * Based on Final.py logic: both counters increment together
   */
  private incrementCounter1(): void {
    const data = this.character.getRawData();
    const patternOffset = this.findPattern(data);

    if (patternOffset === -1) {
      throw new Error('[DS3 Inventory] Character pattern not found');
    }

    // Counter 1 is at Pattern + 472 (Final.py pattern is 1 byte before ours, so 473 - 1 = 472)
    const counter1Offset = patternOffset + 472;

    if (counter1Offset + 1 >= data.length) {
      throw new Error('[DS3 Inventory] Counter 1 offset out of bounds');
    }

    // Read counter (2 bytes, little-endian)
    const counter1Value = data[counter1Offset] | (data[counter1Offset + 1] << 8);

    // Increment with wrap-around at 0xFFFF
    const newCounter1Value = (counter1Value + 1) & 0xFFFF;

    // Write back (little-endian)
    data[counter1Offset] = newCounter1Value & 0xFF;
    data[counter1Offset + 1] = (newCounter1Value >> 8) & 0xFF;
  }

  /**
   * Read Counter 2 (Pattern + 35300)
   * Counter 2 is used in bytes 14-15 of each item
   */
  // @ts-expect-error - Reserved for future use
  private _readCounter2(): number {
    const data = this.character.getRawData();
    const patternOffset = this.findPattern(data);

    if (patternOffset === -1) {
      throw new Error('[DS3 Inventory] Character pattern not found');
    }

    const counter2Offset = patternOffset + 35300;

    if (counter2Offset + 1 >= data.length) {
      throw new Error('[DS3 Inventory] Counter 2 offset out of bounds');
    }

    // Read counter (2 bytes, little-endian)
    return data[counter2Offset] | (data[counter2Offset + 1] << 8);
  }

  /**
   * Increment Counter 2 (Pattern + 35300)
   * Counter 2 tracks item additions (including deleted items)
   * Based on Final.py logic: both counters increment together when adding items
   */
  private incrementCounter2(): void {
    const data = this.character.getRawData();
    const patternOffset = this.findPattern(data);

    if (patternOffset === -1) {
      throw new Error('[DS3 Inventory] Character pattern not found');
    }

    // Counter 2 is at Pattern + 35300 (Final.py pattern is 1 byte before ours, so 35301 - 1 = 35300)
    const counter2Offset = patternOffset + 35300;

    if (counter2Offset + 1 >= data.length) {
      throw new Error('[DS3 Inventory] Counter 2 offset out of bounds');
    }

    // Read counter (2 bytes, little-endian)
    const counter2Value = data[counter2Offset] | (data[counter2Offset + 1] << 8);

    // Increment with wrap-around at 0xFFFF
    const newCounter2Value = (counter2Value + 1) & 0xFFFF;

    // Write back (little-endian)
    data[counter2Offset] = newCounter2Value & 0xFF;
    data[counter2Offset + 1] = (newCounter2Value >> 8) & 0xFF;
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
   * Find next available slot (2 consecutive empty slots)
   */
  findNextAvailableSlot(): number {
    for (let i = 0; i < DS3Inventory.MAX_SLOTS - 1; i++) {
      const slot = this.readSlot(i);
      const nextSlot = this.readSlot(i + 1);

      if (slot.isEmpty && nextSlot.isEmpty) {
        return i;
      }
    }
    return 0; // Fallback to slot 0
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
   * For weapons: applies formula byte0 = base_byte0 + (infusion * 100) + upgrade
   * Items are added to the first empty slot found or to the specified targetSlot
   * @param targetSlot - Optional slot index to add the item to. If not specified, finds first empty slot.
   */
  addItem(itemInfo: Item, quantity: number = 1, upgradeLevel: number = 0, infusion: number = 0, targetSlot?: number): number | null {
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

    // Determine insert index
    let insertIndex = -1;
    // @ts-expect-error - Reserved for future use
    let _previousNonEmptyItem: DS3InventoryItem | null = null;

    if (targetSlot !== undefined) {
      // Use specified target slot
      insertIndex = targetSlot;

      // Check if target slot is valid
      if (insertIndex < 0 || insertIndex >= DS3Inventory.MAX_SLOTS) {
        console.warn(`[DS3 Inventory] Invalid target slot ${targetSlot}`);
        return null;
      }

      // Find last non-empty item before this slot for counter bytes
      for (let j = insertIndex - 1; j >= 0; j--) {
        const prevSlot = this.readSlot(j);
        if (!prevSlot.isEmpty) {
          _previousNonEmptyItem = prevSlot;
          break;
        }
      }
    } else {
      // Find 2 consecutive empty slots and insert in the first one
      for (let i = 0; i < DS3Inventory.MAX_SLOTS - 1; i++) {
        const slot = this.readSlot(i);
        const nextSlot = this.readSlot(i + 1);

        // Check if current and next slots are both empty
        if (slot.isEmpty && nextSlot.isEmpty) {
          insertIndex = i;
          // Find last non-empty item before this slot for counter bytes
          for (let j = i - 1; j >= 0; j--) {
            const prevSlot = this.readSlot(j);
            if (!prevSlot.isEmpty) {
              _previousNonEmptyItem = prevSlot;
              break;
            }
          }
          break;
        }
      }

      if (insertIndex === -1) {
        console.warn('[DS3 Inventory] Could not find 2 consecutive empty slots');
        return null; // No 2 consecutive empty slots found
      }
    }

    // @ts-expect-error - Reserved for future use
    const _slot = this.readSlot(insertIndex);
    let finalItemId = this.parseHex(itemInfo.Id);

    // For weapons, apply upgrade and infusion to byte 0
    // Formula: byte0 = base_byte0 + (infusion * 100) + upgrade
    if (collectionType === ItemCollectionType.Weapon && (upgradeLevel > 0 || infusion > 0)) {
      const byte0 = finalItemId & 0xFF;
      const byte1 = (finalItemId >> 8) & 0xFF;
      const byte2 = (finalItemId >> 16) & 0xFF;
      const byte3 = (finalItemId >> 24) & 0xFF;

      const byte0_modifier = (infusion * 100) + upgradeLevel;
      const newByte0 = (byte0 + byte0_modifier) & 0xFF;

      finalItemId = newByte0 | (byte1 << 8) | (byte2 << 16) | (byte3 << 24);
    }

    // Determine separator based on category
    let separator = 0xB0; // Default: Consumables
    if (collectionType === ItemCollectionType.Weapon) separator = 0x80;
    else if (collectionType === ItemCollectionType.Armor) separator = 0x90;
    else if (collectionType === ItemCollectionType.Ring) separator = 0xA0;

    // Create new item data from scratch
    const newItemData = new Uint8Array(16);

    // Bytes 4-7: Item ID (little-endian) - write this first
    newItemData[4] = finalItemId & 0xFF;
    newItemData[5] = (finalItemId >> 8) & 0xFF;
    newItemData[6] = (finalItemId >> 16) & 0xFF;
    newItemData[7] = (finalItemId >> 24) & 0xFF;

    // Bytes 0-2: Copy first 3 bytes of Item ID (bytes 4-6)
    newItemData[0] = newItemData[4];
    newItemData[1] = newItemData[5];
    newItemData[2] = newItemData[6];

    // Byte 3: Separator
    newItemData[3] = separator;

    // Byte 8: Quantity
    newItemData[8] = Math.min(quantity, itemInfo.MaxStackCount);

    // Bytes 9-11: Always 00 00 00
    newItemData[9] = 0x00;
    newItemData[10] = 0x00;
    newItemData[11] = 0x00;

    // Bytes 12-15: Signature bytes
    // Byte 12: Count of non-empty items from start of inventory (0x80 + count)
    // Need to count how many non-empty items exist before this slot
    let nonEmptyCount = 0;
    for (let i = 0; i < insertIndex; i++) {
      const slot = this.readSlot(i);
      if (!slot.isEmpty) {
        nonEmptyCount++;
      }
    }
    newItemData[12] = (0x80 + nonEmptyCount) & 0xFF;

    // Byte 13: Hash/random value - set to 0x00, game will fill proper value on load
    newItemData[13] = 0x00;

    // Bytes 14-15: Item ID checksum - set to 0x0000, game will fill proper value on load
    // (CRC16 algorithm doesn't match, game must calculate it differently)
    newItemData[14] = 0x00;
    newItemData[15] = 0x00;

    console.log(`[DS3 Add Item] Adding ${itemInfo.Name} to slot ${insertIndex}`);
    console.log(`  Item ID: 0x${finalItemId.toString(16).toUpperCase()}`);
    console.log(`  Full bytes: ${Array.from(newItemData).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

    // Write the new item
    const newItem = new DS3InventoryItem(newItemData, insertIndex, this.itemsDatabase);
    this.writeSlot(insertIndex, newItem);

    // Increment both counters to track item addition
    this.incrementCounter1();
    this.incrementCounter2();

    return insertIndex;
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
    if (this.itemsDatabase.ore_items?.includes(item)) return ItemCollectionType.Ore;
    if (this.itemsDatabase.key_items?.includes(item)) return ItemCollectionType.Key;
    if (this.itemsDatabase.ammunition_items?.includes(item)) return ItemCollectionType.Ammunition;
    if (this.itemsDatabase.covenant_items?.includes(item)) return ItemCollectionType.Covenant;

    return ItemCollectionType.Unknown;
  }
}
