import { DS3Character } from './Character';
import { ByteView } from '../../../shared/ByteView';
import {
  ItemCatalog,
  fetchItemDatabase,
  type Item,
} from '../../../shared/items';
import { COVENANT_BADGE_INVENTORY } from './constants';

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

/**
 * Collection precedence for raw-id lookups.
 *
 * The nine covenant badges repeat their ring counterparts' ids, and a save
 * holding one of those ids means the badge — so covenant_items must be
 * indexed first. Previously this ordering lived in a hand-rolled WeakMap
 * index; it now configures the shared ItemCatalog.
 */
const DS3_COLLECTION_ORDER = [
  'covenant_items',
  'weapon_items',
  'ring_items',
  'armor_items',
  'consumable_items',
  'magic_items',
  'ore_items',
  'key_items',
  'ammunition_items',
] as const;

/** Sub-category strings that map straight onto a collection type. */
const CATEGORY_TO_TYPE: Record<string, ItemCollectionType> = {
  keys: ItemCollectionType.Key,
  covenants: ItemCollectionType.Covenant,
  ores: ItemCollectionType.Ore,
  ammunition: ItemCollectionType.Ammunition,
  rings: ItemCollectionType.Ring,
  sorceries: ItemCollectionType.Magic,
  miracles: ItemCollectionType.Magic,
  pyromancies: ItemCollectionType.Magic,
  helms: ItemCollectionType.Armor,
  chests: ItemCollectionType.Armor,
  gauntlets: ItemCollectionType.Armor,
  leggings: ItemCollectionType.Armor,
};

/** Which catalogue collection backs each collection type. */
export const COLLECTION_FOR_TYPE: Partial<Record<ItemCollectionType, string>> = {
  [ItemCollectionType.Weapon]: 'weapon_items',
  [ItemCollectionType.Armor]: 'armor_items',
  [ItemCollectionType.Ring]: 'ring_items',
  [ItemCollectionType.Consumable]: 'consumable_items',
  [ItemCollectionType.Magic]: 'magic_items',
  [ItemCollectionType.Ore]: 'ore_items',
  [ItemCollectionType.Key]: 'key_items',
  [ItemCollectionType.Ammunition]: 'ammunition_items',
  [ItemCollectionType.Covenant]: 'covenant_items',
};

/** Collections used when the sub-category does not identify the type on its own. */
const DS3_COLLECTION_TO_TYPE: Record<string, ItemCollectionType> = {
  weapon_items: ItemCollectionType.Weapon,
  consumable_items: ItemCollectionType.Consumable,
  magic_items: ItemCollectionType.Magic,
  ammunition_items: ItemCollectionType.Ammunition,
};

/**
 * Classify a catalogue entry: sub-category first, then the collection it came
 * from. The collection step replaces the old `collection.includes(entry)`
 * identity checks and covers the same four cases they did.
 */
function ds3CollectionType(item: Item): ItemCollectionType {
  return (
    CATEGORY_TO_TYPE[item.category.toLowerCase()] ??
    DS3_COLLECTION_TO_TYPE[item.collection] ??
    ItemCollectionType.Unknown
  );
}

export class DS3InventoryItem {
  private data: ByteView;
  private catalog: ItemCatalog | null;
  public slotIndex: number;

  private _cachedBaseItemId: number | null = null;

  constructor(data: Uint8Array, slotIndex: number, catalog: ItemCatalog | null = null) {
    this.data = new ByteView(16);
    if (data) {
      this.data.set(data.slice(0, 16));
    }
    this.slotIndex = slotIndex;
    this.catalog = catalog;
  }

  /**
   * Byte offsets of the 16-byte slot record.
   * Bytes 0-2 mirror the low bytes of the item id (see updateItemIdPrefix);
   * bytes 12-15 hold the signature counters.
   */
  private static readonly FIELD = {
    separator: 3,
    itemId: 4,
    quantity: 8,
    counter12: 12,
    counter13: 13,
  } as const;

  /** Separator byte — item category (0x80 weapons, 0x90 armour, 0xA0 rings, 0xB0 goods). */
  get separator(): number {
    return this.data[DS3InventoryItem.FIELD.separator];
  }

  set separator(value: number) {
    this.data[DS3InventoryItem.FIELD.separator] = value & 0xff;
  }

  get itemId(): number {
    return this.data.readUInt(DS3InventoryItem.FIELD.itemId, 4);
  }

  set itemId(value: number) {
    this.data.write(DS3InventoryItem.FIELD.itemId, 4, value);
  }

  get quantity(): number {
    return this.data.readUInt(DS3InventoryItem.FIELD.quantity, 4);
  }

  set quantity(value: number) {
    this.data.write(DS3InventoryItem.FIELD.quantity, 4, value);
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
    return this.data[DS3InventoryItem.FIELD.counter12];
  }

  set counterByte12(value: number) {
    this.data[DS3InventoryItem.FIELD.counter12] = value & 0xff;
  }

  get counterByte13(): number {
    return this.data[DS3InventoryItem.FIELD.counter13];
  }

  set counterByte13(value: number) {
    this.data[DS3InventoryItem.FIELD.counter13] = value & 0xff;
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
   * Check if slot is empty.
   * An empty slot has byte[3] == 0x00 (upper nibble of gaitem_handle = ITEM_TYPE_EMPTY).
   */
  get isEmpty(): boolean {
    return this.data[3] === 0x00;
  }

  /**
   * Get upgrade level for weapons (0-15)
   * Formula: id = base_id + (infusion * 100) + upgrade
   * So: upgrade = (id - base_id) % 100
   *
   * The subtraction is on the whole id, not on its lower half: for eight weapons
   * (Caestus, Avelyn, Large Club, …) the modifier carries into the upper half,
   * and masking it away used to read those back as a different item.
   */
  get upgradeLevel(): number {
    // Only weapons have upgrade levels (separator 0x80)
    if (this.separator !== 0x80 || !this.catalog) {
      return 0;
    }

    const baseId = this.baseItemId;
    if (baseId === this.itemId) {
      return 0; // No upgrade/infusion
    }

    return (this.itemId - baseId) % 100;
  }

  /**
   * Get infusion type for weapons
   * Formula: low16 = base_low16 + (infusion * 100) + upgrade
   * So: infusion = floor((low16 - base_low16) / 100)
   */
  get infusion(): ItemInfusion {
    // Only weapons have infusions (separator 0x80)
    if (this.separator !== 0x80 || !this.catalog) {
      return ItemInfusion.Standard;
    }

    const baseId = this.baseItemId;
    if (baseId === this.itemId) {
      return ItemInfusion.Standard; // No upgrade/infusion
    }

    return Math.floor((this.itemId - baseId) / 100) as ItemInfusion;
  }

  /**
   * Get base item ID (without upgrade modifiers)
   * Formula: id = base_id + (infusion * 100) + upgrade, so the stored id sits at
   * most 15*100 + 10 = 1510 above the base weapon's id.
   *
   * The comparison runs on the whole id. Matching on the lower half alone missed
   * the eight weapons whose modifier carries into the upper half (Caestus at
   * 0xA7FFD0 becomes 0xA805AC when Hollow), which then read back as "Unknown".
   * Real weapons are 10000 apart, so the 1510 window still picks out exactly one
   * base; where several candidates fit (the cut "transparent" set is spaced 100
   * apart) the nearest one below wins.
   */
  get baseItemId(): number {
    // Only weapons need ID cleaning (separator 0x80)
    if (this.separator !== 0x80 || !this.catalog) {
      return this.itemId;
    }

    // Use cached value if available
    if (this._cachedBaseItemId !== null) {
      return this._cachedBaseItemId;
    }

    const allWeapons = this.catalog.byCollection('weapon_items');
    const id = this.itemId;

    let best = -1;
    for (const w of allWeapons) {
      const modifier = id - w.rawId;
      if (modifier < 0 || modifier > 1510) continue;
      if (w.rawId > best) best = w.rawId;
    }

    const result = best >= 0 ? best : id;
    this._cachedBaseItemId = result;
    return result;
  }

  /**
   * Get item info from database — O(1) via module-level WeakMap lookup
   */
  /**
   * The catalogue entry for this slot.
   *
   * A save stores the id without any `Type`, so resolution goes through the
   * raw-id index, where DS3_COLLECTION_ORDER makes covenant badges win over
   * the ring entries that share their ids.
   */
  get itemInfo(): Item | null {
    if (this.isEmpty || !this.catalog) return null;
    return this.catalog.byRawId(this.baseItemId) ?? this.catalog.byRawId(this.itemId);
  }

  /**
   * Get item name
   */
  get itemName(): string {
    const info = this.itemInfo;
    if (!info) {
      return `Unknown (ID:0x${this.itemId.toString(16).toUpperCase()}, Sep:0x${this.separator.toString(16).toUpperCase()})`;
    }
    return info.displayName;
  }

  /**
   * Get collection type — O(1) via category string on the looked-up item
   */
  get collectionType(): ItemCollectionType {
    const item = this.itemInfo;
    if (!item) return ItemCollectionType.Unknown;
    return ds3CollectionType(item);
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
  private catalog: ItemCatalog | null = null;

  private static readonly ITEM_SIZE = 16;
  // Key items live in a separate section immediately after the regular inventory
  private static readonly REGULAR_SLOTS = 1920;          // max regular inventory slots
  private static readonly KEY_SECTION_OFFSET = 0x7800;  // byte offset from invStart to key-count field
  private static readonly MAX_KEY_SLOTS = 256;
  private static readonly KEY_SLOT_BASE = 3000;          // virtual slot index for key section

  constructor(character: DS3Character) {
    this.character = character;
  }

  /**
   * Load items database from JSON
   */
  async loadItemsDatabase(): Promise<void> {
    try {
      const raw = await fetchItemDatabase('ds3_items.json');
      this.catalog = ItemCatalog.from(raw, { collectionOrder: DS3_COLLECTION_ORDER });
      console.log('[DS3 Inventory] Items database loaded successfully');
    } catch (error) {
      console.error('Could not load DS3 items database:', error);
      throw new Error('Could not load DS3 items database. Please ensure ds3_items.json is available.');
    }
  }

  /** Indexed catalogue used for all id lookups. */
  getCatalog(): ItemCatalog {
    return this.catalog ?? ItemCatalog.empty();
  }

  /**
   * Get inventory start offset.
   *
   * Same algorithm as the Python reference (main_ds3.py):
   *   gaEnd = walk GA table from 0x70 (6144 entries; weapon/armor = 60 bytes, rest = 8 bytes)
   *   inventoryStart = gaEnd + 0x13F + 0x1DD
   *
   * IMPORTANT: type-bit comparisons must use unsigned (>>> 0) because JS
   * bitwise ops produce signed 32-bit integers; without >>> 0 the comparison
   * 0x80000000 === tp silently fails for every weapon/armor entry.
   */
  private static readonly GA_START        = 0x70;
  private static readonly GA_SLOTS        = 6144;
  private static readonly GA_ENTRY_SMALL  = 8;
  private static readonly GA_ENTRY_LARGE  = 60;   // weapon / armor
  private static readonly GA_TYPE_WEAPON  = 0x80000000 >>> 0;
  private static readonly GA_TYPE_ARMOR   = 0x90000000 >>> 0;
  private static readonly INV_OFFSET_FROM_GA_END = 0x13F + 0x1DD; // 0x31C

  private scanGATable(data: Uint8Array, slots: number = DS3Inventory.GA_SLOTS): {
    items: Array<{ handle: number; itemId: number; offset: number }>;
    empty: Array<{ handle: number; itemId: number; offset: number }>;
    endOffset: number;
  } {
    const items: Array<{ handle: number; itemId: number; offset: number }> = [];
    const empty: Array<{ handle: number; itemId: number; offset: number }> = [];
    let off = DS3Inventory.GA_START;

    for (let i = 0; i < slots; i++) {
      if (off + DS3Inventory.GA_ENTRY_SMALL > data.length) break;
      const gh = ((data[off] | (data[off + 1] << 8) | (data[off + 2] << 16) | (data[off + 3] << 24)) >>> 0);
      const iid = ((data[off + 4] | (data[off + 5] << 8) | (data[off + 6] << 16) | (data[off + 7] << 24)) >>> 0);
      const tp = (gh & 0xF0000000) >>> 0;
      const entry = { handle: gh, itemId: iid, offset: off };
      items.push(entry);
      if (gh === 0) {
        empty.push(entry);
        off += DS3Inventory.GA_ENTRY_SMALL;
      } else if (tp === DS3Inventory.GA_TYPE_WEAPON || tp === DS3Inventory.GA_TYPE_ARMOR) {
        off += DS3Inventory.GA_ENTRY_LARGE;
      } else {
        off += DS3Inventory.GA_ENTRY_SMALL;
      }
    }
    return { items, empty, endOffset: off };
  }

  private gaTableEnd(data: Uint8Array): number {
    return this.scanGATable(data).endOffset;
  }

  /**
   * Writes a 60-byte GA table entry for a weapon or armor item.
   * Ports the Python add_weapon_armor GA logic:
   *   1. Insert 60-byte entry at first empty slot (+60 bytes)
   *   2. Delete the next earliest empty 8-byte slot (-8 bytes, net +52)
   *   3. Delete 52 bytes from near the end to maintain file size (net 0)
   * Returns ga_highest index (used in inventory slot bytes 0-1), or 0 on failure.
   */
  private addGAEntry(
    finalItemId: number,
    collectionType: ItemCollectionType,
    durability: number
  ): number {
    const data = this.character.getRawData();
    const { items, empty } = this.scanGATable(data);

    if (empty.length < 5) {
      console.warn('[DS3 GA] Not enough empty GA slots');
      return 0;
    }

    // ga_highest = max(handle & 0x0000FFFF across all non-empty items) + 1
    let maxIdx = 0;
    for (const it of items) {
      if (it.handle !== 0) {
        const idx = it.handle & 0x0000FFFF;
        if (idx > maxIdx) maxIdx = idx;
      }
    }
    const gaHighest = (maxIdx + 1) & 0xFFFF;

    // First empty slot (minimum offset)
    const gaEmptyOff = empty.reduce((m, e) => (e.offset < m ? e.offset : m), empty[0].offset);

    // Build 60-byte GA entry (based on Python templates)
    const gaSlot = new Uint8Array(60);
    gaSlot[0] = gaHighest & 0xFF;
    gaSlot[1] = (gaHighest >> 8) & 0xFF;
    if (collectionType === ItemCollectionType.Weapon || collectionType === ItemCollectionType.Ammunition) {
      gaSlot[2] = 0x80; gaSlot[3] = 0x80;
    } else {
      gaSlot[2] = 0x81; gaSlot[3] = 0x90;
    }
    gaSlot[4] = finalItemId & 0xFF;
    gaSlot[5] = (finalItemId >> 8) & 0xFF;
    gaSlot[6] = (finalItemId >> 16) & 0xFF;
    gaSlot[7] = (finalItemId >> 24) & 0xFF;
    // bytes 8-11: durability (uint32 LE)
    gaSlot[8]  = durability & 0xFF;
    gaSlot[9]  = (durability >> 8) & 0xFF;
    gaSlot[10] = (durability >> 16) & 0xFF;
    gaSlot[11] = (durability >> 24) & 0xFF;
    // byte 16: 0x01 (from Python template)
    gaSlot[16] = 0x01;
    // 0x80 sentinels at bytes 23, 31, 39, 47, 55 (from Python template)
    gaSlot[23] = 0x80; gaSlot[31] = 0x80; gaSlot[39] = 0x80;
    gaSlot[47] = 0x80; gaSlot[55] = 0x80;

    const origLen = data.length;

    // Step 1: insert 60 bytes at gaEmptyOff → data grows by 60
    const step1 = new Uint8Array(origLen + 60);
    step1.set(data.slice(0, gaEmptyOff));
    step1.set(gaSlot, gaEmptyOff);
    step1.set(data.slice(gaEmptyOff), gaEmptyOff + 60);

    // Step 2: re-scan with 6145 slots, delete earliest empty 8-byte entry → net +52
    const { empty: empty2 } = this.scanGATable(step1, 6145);
    if (empty2.length < 1) {
      console.warn('[DS3 GA] No empty slot found after insertion');
      return 0;
    }
    const gaDelOff = empty2.reduce((m, e) => (e.offset < m ? e.offset : m), empty2[0].offset);
    const step2 = new Uint8Array(origLen + 52);
    step2.set(step1.slice(0, gaDelOff));
    step2.set(step1.slice(gaDelOff + 8), gaDelOff);

    // Step 3: delete 52 bytes from near end (keep last 13 bytes) → net 0
    const END_CUTOFF = 0x0D;
    const delStart = step2.length - 52 - END_CUTOFF;
    if (delStart < 0) {
      console.warn('[DS3 GA] Cannot trim end: delStart < 0');
      return 0;
    }
    const finalBuf = new Uint8Array(origLen);
    finalBuf.set(step2.slice(0, delStart));
    finalBuf.set(step2.slice(delStart + 52), delStart);

    data.set(finalBuf);
    this.character.invalidatePatternCache();
    console.log(`[DS3 GA] Entry written for itemId=0x${finalItemId.toString(16)} gaHighest=${gaHighest}`);
    return gaHighest;
  }

  private getInventoryStartOffset(): number {
    const data = this.character.getRawData();
    const gaEnd = this.gaTableEnd(data);
    return gaEnd + DS3Inventory.INV_OFFSET_FROM_GA_END;
  }

  /** Byte offset in data[] for a given virtual slot index */
  private getSlotOffset(slotIndex: number): number {
    const invStart = this.getInventoryStartOffset();
    if (slotIndex >= DS3Inventory.KEY_SLOT_BASE) {
      const keyIdx = slotIndex - DS3Inventory.KEY_SLOT_BASE;
      return invStart + DS3Inventory.KEY_SECTION_OFFSET + 4 + keyIdx * DS3Inventory.ITEM_SIZE;
    }
    return invStart + slotIndex * DS3Inventory.ITEM_SIZE;
  }

  private getKeyItemCount(data: Uint8Array): number {
    const invStart = this.getInventoryStartOffset();
    const off = invStart + DS3Inventory.KEY_SECTION_OFFSET;
    if (off + 4 > data.length) return 0;
    return (data[off] | (data[off+1]<<8) | (data[off+2]<<16) | (data[off+3]<<24)) >>> 0;
  }

  private setKeyItemCount(data: Uint8Array, count: number): void {
    const invStart = this.getInventoryStartOffset();
    const off = invStart + DS3Inventory.KEY_SECTION_OFFSET;
    data[off]   = count & 0xFF;
    data[off+1] = (count >> 8) & 0xFF;
    data[off+2] = (count >> 16) & 0xFF;
    data[off+3] = (count >> 24) & 0xFF;
  }

  /**
   * Find character pattern in data (used for stat offsets)
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
  // @ts-expect-error - Disabled: offsets unverified, caused stat corruption
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
   * Update Counter 2 (Pattern + 35300) to max(current, newIndex).
   * The game rejects items whose index exceeds counter2 by more than ~10.
   * Always increase, never decrease — safe to call after every addItem.
   */
  private updateCounter2(newIndex: number): void {
    const data = this.character.getRawData();
    const patternOffset = this.findPattern(data);
    if (patternOffset === -1) return;

    const counter2Offset = patternOffset + 35300;
    if (counter2Offset + 1 >= data.length) return;

    const current = (data[counter2Offset] | (data[counter2Offset + 1] << 8)) >>> 0;
    if (newIndex <= current) return;

    data[counter2Offset]     = newIndex & 0xFF;
    data[counter2Offset + 1] = (newIndex >> 8) & 0xFF;
    console.log(`[DS3 Inventory] counter2 updated: 0x${current.toString(16)} → 0x${newIndex.toString(16)}`);
  }

  /**
   * Get all non-empty items from inventory (regular + key section)
   */
  getAllItems(): DS3InventoryItem[] {
    const items: DS3InventoryItem[] = [];
    const data = this.character.getRawData();
    const inventoryStart = this.getInventoryStartOffset();

    // Regular inventory (slots 0 … REGULAR_SLOTS-1)
    for (let i = 0; i < DS3Inventory.REGULAR_SLOTS; i++) {
      const offset = inventoryStart + i * DS3Inventory.ITEM_SIZE;
      if (offset + DS3Inventory.ITEM_SIZE > data.length) break;
      const item = new DS3InventoryItem(data.slice(offset, offset + DS3Inventory.ITEM_SIZE), i, this.catalog);
      if (!item.isEmpty) items.push(item);
    }

    // Key items section (separate area at KEY_SECTION_OFFSET)
    const keyCount = Math.min(this.getKeyItemCount(data), DS3Inventory.MAX_KEY_SLOTS);
    for (let i = 0; i < keyCount; i++) {
      const offset = inventoryStart + DS3Inventory.KEY_SECTION_OFFSET + 4 + i * DS3Inventory.ITEM_SIZE;
      if (offset + DS3Inventory.ITEM_SIZE > data.length) break;
      const item = new DS3InventoryItem(data.slice(offset, offset + DS3Inventory.ITEM_SIZE), DS3Inventory.KEY_SLOT_BASE + i, this.catalog);
      if (!item.isEmpty) items.push(item);
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
   * Read item from specific slot (regular or key section)
   */
  readSlot(slotIndex: number): DS3InventoryItem {
    const data = this.character.getRawData();
    const offset = this.getSlotOffset(slotIndex);
    if (offset < 0 || offset + DS3Inventory.ITEM_SIZE > data.length) {
      throw new Error('Slot index out of range');
    }
    return new DS3InventoryItem(data.slice(offset, offset + DS3Inventory.ITEM_SIZE), slotIndex, this.catalog);
  }

  /**
   * Write item to specific slot (regular or key section)
   */
  writeSlot(slotIndex: number, item: DS3InventoryItem): void {
    const data = this.character.getRawData();
    const offset = this.getSlotOffset(slotIndex);
    if (offset < 0 || offset + DS3Inventory.ITEM_SIZE > data.length) {
      throw new Error('Slot index out of range');
    }
    data.set(item.getRawData(), offset);
  }

  /** True when the regular slot holds no item (byte 3 is the category separator). */
  private isSlotEmpty(data: Uint8Array, slotIndex: number): boolean {
    const off = this.getInventoryStartOffset() + slotIndex * DS3Inventory.ITEM_SIZE;
    if (off + DS3Inventory.ITEM_SIZE > data.length) return false;
    return data[off + 3] === 0x00;
  }

  /**
   * Find the next free slot (2 consecutive empty ones) in the regular inventory,
   * starting the scan at `from`. Reads bytes directly to avoid one GA scan per slot.
   *
   * Returns -1 when there is no room: writing into slot 0 as a fallback used to
   * overwrite whatever the character was already carrying.
   */
  findNextAvailableSlot(from = 0): number {
    const data = this.character.getRawData();
    const invStart = this.getInventoryStartOffset();
    for (let i = Math.max(0, from); i < DS3Inventory.REGULAR_SLOTS - 1; i++) {
      const off1 = invStart + i * DS3Inventory.ITEM_SIZE;
      const off2 = off1 + DS3Inventory.ITEM_SIZE;
      if (off2 + DS3Inventory.ITEM_SIZE <= data.length && data[off1 + 3] === 0x00 && data[off2 + 3] === 0x00) return i;
    }
    return -1;
  }

  /**
   * Find existing item in inventory (regular + key section)
   */
  findExistingItem(itemInfo: Item): DS3InventoryItem | null {
    const baseId = itemInfo.rawId;
    const collectionType = this.getCollectionTypeFromItem(itemInfo);
    let expectedSeparator = 0xB0;
    if (collectionType === ItemCollectionType.Weapon || collectionType === ItemCollectionType.Ammunition) expectedSeparator = 0x80;
    else if (collectionType === ItemCollectionType.Armor) expectedSeparator = 0x90;
    else if (collectionType === ItemCollectionType.Ring || collectionType === ItemCollectionType.Covenant) expectedSeparator = 0xA0;

    for (const item of this.getAllItems()) {
      if (!item.isEmpty && item.separator === expectedSeparator && item.baseItemId === baseId) return item;
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
      itemInfo.stackMax > 1
    ) {
      const existing = this.findExistingItem(itemInfo);
      if (existing) {
        const newQuantity = Math.min(existing.quantity + quantity, itemInfo.stackMax);
        existing.quantity = newQuantity;
        this.writeSlot(existing.slotIndex, existing);
        return existing.slotIndex;
      }
    }

    // Key items always go into the key section regardless of targetSlot
    if (collectionType === ItemCollectionType.Key) {
      return this.addKeyItem(itemInfo);
    }

    // Determine insert index — read bytes directly to avoid one GA scan per slot
    let insertIndex = -1;

    if (targetSlot !== undefined) {
      if (targetSlot < 0 || targetSlot >= DS3Inventory.REGULAR_SLOTS) {
        console.warn(`[DS3 Inventory] Invalid target slot ${targetSlot}`);
        return null;
      }
      // Never write over an item that is already there: the slot the caller asks
      // for may have filled up since it was picked, and overwriting it loses the
      // item along with the equipment reference pointing at it.
      if (!this.isSlotEmpty(this.character.getRawData(), targetSlot)) {
        console.warn(`[DS3 Inventory] Target slot ${targetSlot} is occupied`);
        return null;
      }
      insertIndex = targetSlot;
    } else {
      insertIndex = this.findNextAvailableSlot();
      if (insertIndex === -1) {
        console.warn('[DS3 Inventory] Could not find 2 consecutive empty slots');
        return null;
      }
    }
    let finalItemId = itemInfo.rawId;

    // For weapons, apply upgrade and infusion: id = base_id + (infusion * 100) + upgrade.
    // Added to the whole id, so weapons sitting near a 0x10000 boundary (Caestus,
    // Avelyn, Large Club, …) carry into the upper half instead of wrapping into
    // some other weapon's id.
    if (collectionType === ItemCollectionType.Weapon && (upgradeLevel > 0 || infusion > 0)) {
      finalItemId = (finalItemId + (infusion * 100) + upgradeLevel) >>> 0;
    }

    // Determine separator based on category
    // Covenant badges have 0x2000XXXX IDs (ring type) → use 0xA0, not 0xB0
    // Ammunition uses 0x80 (weapon type) — same GA table structure as weapons
    let separator = 0xB0; // Default: Consumables/Goods
    if (collectionType === ItemCollectionType.Weapon || collectionType === ItemCollectionType.Ammunition) separator = 0x80;
    else if (collectionType === ItemCollectionType.Armor) separator = 0x90;
    else if (collectionType === ItemCollectionType.Ring || collectionType === ItemCollectionType.Covenant) separator = 0xA0;

    // For weapons/armor/ammunition, write GA entry first (modifies raw data; inventory offset shifts after)
    let gaHighest = 0;
    if (collectionType === ItemCollectionType.Weapon || collectionType === ItemCollectionType.Armor || collectionType === ItemCollectionType.Ammunition) {
      // The catalogue reports 0 when an entry carries no durability, which is
      // every DS3 weapon and armour piece — the game expects the per-type
      // default there, not zero. `??` would not fire on 0.
      const durability = collectionType === ItemCollectionType.Ammunition ? 0
        : (itemInfo.durability || (collectionType === ItemCollectionType.Weapon ? 75 : 360));
      gaHighest = this.addGAEntry(finalItemId, collectionType, durability);
    }

    // Create new item data from scratch
    const newItemData = new Uint8Array(16);

    // Bytes 4-7: Item ID (little-endian) - write this first
    newItemData[4] = finalItemId & 0xFF;
    newItemData[5] = (finalItemId >> 8) & 0xFF;
    newItemData[6] = (finalItemId >> 16) & 0xFF;
    newItemData[7] = (finalItemId >> 24) & 0xFF;

    // Bytes 0-2 + 3: depends on type
    if (collectionType === ItemCollectionType.Weapon || collectionType === ItemCollectionType.Armor || collectionType === ItemCollectionType.Ammunition) {
      // Bytes 0-1: gaHighest (GA table index), byte 2: 0x80
      newItemData[0] = gaHighest & 0xFF;
      newItemData[1] = (gaHighest >> 8) & 0xFF;
      newItemData[2] = 0x80;
      newItemData[3] = separator;
    } else {
      // Bytes 0-2: Copy first 3 bytes of Item ID (bytes 4-6)
      newItemData[0] = newItemData[4];
      newItemData[1] = newItemData[5];
      newItemData[2] = newItemData[6];
      newItemData[3] = separator;
    }

    // Bytes 8-11: Quantity (uint32, little-endian)
    const clampedQty = Math.min(quantity, itemInfo.stackMax);
    newItemData[8]  = clampedQty & 0xFF;
    newItemData[9]  = (clampedQty >> 8) & 0xFF;
    newItemData[10] = (clampedQty >> 16) & 0xFF;
    newItemData[11] = (clampedQty >> 24) & 0xFF;

    // Find highest existing index across all items (regular + covenant inventory)
    let highestIndex = 0;
    for (const item of this.getAllItems()) {
      const raw = item.getRawData();
      const indexValue = raw[12] | ((raw[13] & 0x0F) << 8);
      if (indexValue > highestIndex) highestIndex = indexValue;
    }
    const newIndex = highestIndex + 1;
    newItemData[12] = newIndex & 0xFF;

    // Covenant badges require item-specific byte13_upper and bytes14-15 (game validates them).
    // All other types use a random upper nibble for byte13, which the game does not validate.
    if (collectionType === ItemCollectionType.Covenant) {
      const badgeBytes = COVENANT_BADGE_INVENTORY[finalItemId];
      const upper = badgeBytes ? badgeBytes.byte13_upper : 0x4; // fallback: 0x4
      newItemData[13] = ((upper & 0xF) << 4) | ((newIndex >> 8) & 0x0F);
      newItemData[14] = badgeBytes ? badgeBytes.byte14 : 0x77;
      newItemData[15] = badgeBytes ? badgeBytes.byte15 : 0x02;
    } else {
      const randomByte = Math.floor(Math.random() * 256);
      newItemData[13] = (randomByte & 0xF0) | ((newIndex >> 8) & 0x0F);
      // Bytes 14-15: type-specific constants from game templates
      if (separator === 0x80) {        // Weapon / Ammunition
        newItemData[14] = 0x18; newItemData[15] = 0xFB;
      } else if (separator === 0x90) { // Armor
        newItemData[14] = 0x65; newItemData[15] = 0xFE;
      } else {                         // Rings / Goods
        newItemData[14] = 0xCF; newItemData[15] = 0x1F;
      }
    }

    console.log(`[DS3 Add Item] Adding ${itemInfo.name} to slot ${insertIndex}`);
    console.log(`  Item ID: 0x${finalItemId.toString(16).toUpperCase()}`);
    console.log(`  Full bytes: ${Array.from(newItemData).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

    // Write the new item
    const newItem = new DS3InventoryItem(newItemData, insertIndex, this.catalog);
    this.writeSlot(insertIndex, newItem);

    // Keep counter2 (pattern+35300) >= newIndex so the game accepts the item on load.
    this.updateCounter2(newIndex);

    return insertIndex;
  }

  private getStorageBoxStart(data: Uint8Array): number {
    try {
      const inventoryStart = this.getInventoryStartOffset();
      if (inventoryStart < 0 || inventoryStart >= data.length) return -1;

      const inventoryEnd = inventoryStart + 0x8808;
      const aboveStorageCounter = inventoryEnd + 0x11C;
      if (aboveStorageCounter + 4 > data.length) return -1;

      const aboveStorageSize = (
        data[aboveStorageCounter] |
        (data[aboveStorageCounter + 1] << 8) |
        (data[aboveStorageCounter + 2] << 16) |
        (data[aboveStorageCounter + 3] << 24)
      ) >>> 0;

      // Sanity check: a value over 10000 almost certainly means the offset is wrong
      if (aboveStorageSize > 10000) {
        console.warn(`[DS3 Storage] aboveStorageSize=${aboveStorageSize} looks invalid, skipping storage`);
        return -1;
      }

      const table1End = aboveStorageCounter + 4 + (aboveStorageSize * 8);
      if (table1End >= data.length) return -1;

      const faceDataMaybe = table1End + 0x18C;
      const storageStart = faceDataMaybe + 0x4;

      if (storageStart < 0 || storageStart + DS3Inventory.ITEM_SIZE > data.length) return -1;

      return storageStart;
    } catch {
      return -1;
    }
  }

  getAllStorageItems(): DS3InventoryItem[] {
    const items: DS3InventoryItem[] = [];
    const data = this.character.getRawData();
    const storageStart = this.getStorageBoxStart(data);
    if (storageStart < 0 || storageStart + DS3Inventory.ITEM_SIZE > data.length) return items;
    const maxSlots = Math.floor(Math.min(0x7800, data.length - storageStart) / DS3Inventory.ITEM_SIZE);
    for (let i = 0; i < maxSlots; i++) {
      const offset = storageStart + i * DS3Inventory.ITEM_SIZE;
      if (offset + DS3Inventory.ITEM_SIZE > data.length) break;
      const item = new DS3InventoryItem(data.slice(offset, offset + DS3Inventory.ITEM_SIZE), i, this.catalog);
      if (!item.isEmpty) items.push(item);
    }
    return items;
  }

  getStorageItemsByType(collectionType: ItemCollectionType): DS3InventoryItem[] {
    return this.getAllStorageItems().filter(item => item.collectionType === collectionType);
  }

  getStorageQuantity(baseItemId: number): number {
    try {
      return this.getAllStorageItems()
        .filter(item => item.baseItemId === baseItemId)
        .reduce((sum, item) => sum + item.quantity, 0);
    } catch {
      return 0;
    }
  }

  /**
   * Set (or create) a storage box entry for a stackable item.
   * Finds existing slot and updates quantity, or writes to first empty slot.
   * Returns true on success, false if storage offset is unavailable.
   */
  setStorageQuantity(itemInfo: Item, quantity: number): boolean {
    try {
      const data = this.character.getRawData();
      const storageStart = this.getStorageBoxStart(data);
      if (storageStart < 0) return false;

      const clampedQty = Math.min(600, Math.max(0, quantity));
      const baseId = itemInfo.rawId;
      const maxSlots = Math.floor(Math.min(0x7800, data.length - storageStart) / DS3Inventory.ITEM_SIZE);

      // Try to find existing slot for this item
      for (let i = 0; i < maxSlots; i++) {
        const offset = storageStart + i * DS3Inventory.ITEM_SIZE;
        if (offset + DS3Inventory.ITEM_SIZE > data.length) break;
        const item = new DS3InventoryItem(data.slice(offset, offset + DS3Inventory.ITEM_SIZE), i, this.catalog);
        if (!item.isEmpty && item.baseItemId === baseId) {
          if (clampedQty === 0) {
            // Remove from storage
            data.fill(0x00, offset, offset + DS3Inventory.ITEM_SIZE);
          } else {
            data[offset + 8]  = clampedQty & 0xFF;
            data[offset + 9]  = (clampedQty >> 8) & 0xFF;
            data[offset + 10] = (clampedQty >> 16) & 0xFF;
            data[offset + 11] = (clampedQty >> 24) & 0xFF;
          }
          return true;
        }
      }

      if (clampedQty === 0) return true; // Nothing to add

      // Item not in storage — find first empty slot
      const collectionType = this.getCollectionTypeFromItem(itemInfo);
      let separator = 0xB0;
      if (collectionType === ItemCollectionType.Ring) separator = 0xA0;

      for (let i = 0; i < maxSlots; i++) {
        const offset = storageStart + i * DS3Inventory.ITEM_SIZE;
        if (offset + DS3Inventory.ITEM_SIZE > data.length) break;
        const slot = new DS3InventoryItem(data.slice(offset, offset + DS3Inventory.ITEM_SIZE), i, this.catalog);
        if (slot.isEmpty) {
          const newSlot = new Uint8Array(16);
          newSlot[0] = baseId & 0xFF;
          newSlot[1] = (baseId >> 8) & 0xFF;
          newSlot[2] = (baseId >> 16) & 0xFF;
          newSlot[3] = separator;
          newSlot[4] = baseId & 0xFF;
          newSlot[5] = (baseId >> 8) & 0xFF;
          newSlot[6] = (baseId >> 16) & 0xFF;
          newSlot[7] = (baseId >> 24) & 0xFF;
          newSlot[8]  = clampedQty & 0xFF;
          newSlot[9]  = (clampedQty >> 8) & 0xFF;
          newSlot[10] = (clampedQty >> 16) & 0xFF;
          newSlot[11] = (clampedQty >> 24) & 0xFF;
          newSlot[12] = 0x90;
          newSlot[13] = 0xA0;
          newSlot[14] = 0xEE;
          newSlot[15] = 0x02;
          data.set(newSlot, offset);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  editItem(slotIndex: number, qty: number, upgradeLevel: number, infusion: number): void {
    const item = this.readSlot(slotIndex);
    if (item.isEmpty) return;
    const raw = new Uint8Array(item.getRawData());

    // Update quantity
    raw[8]  = qty & 0xFF;
    raw[9]  = (qty >> 8) & 0xFF;
    raw[10] = (qty >> 16) & 0xFF;
    raw[11] = (qty >> 24) & 0xFF;

    // Update upgrade/infusion for weapons
    if (raw[3] === 0x80) {
      const baseId = item.baseItemId;
      // Whole-id arithmetic, same reason as in addItem: masking the lower half
      // turned an infused Caestus into a different item entirely.
      const finalItemId = (baseId + (infusion * 100) + upgradeLevel) >>> 0;
      raw[4] = finalItemId & 0xFF;
      raw[5] = (finalItemId >> 8) & 0xFF;
      raw[6] = (finalItemId >> 16) & 0xFF;
      raw[7] = (finalItemId >> 24) & 0xFF;
      // bytes 0-2 stay as gaHighest (don't change)

      // Also update the GA table entry — the game reads item ID from there
      const gaHighest = raw[0] | (raw[1] << 8);
      this.updateGAEntryItemId(gaHighest, finalItemId);
    }

    this.writeSlot(slotIndex, new DS3InventoryItem(raw, slotIndex, this.catalog));
  }

  /**
   * Update item ID in an existing GA table entry identified by its gaHighest index.
   * Bytes 4-7 of the 60-byte entry hold the item ID.
   */
  private updateGAEntryItemId(gaHighest: number, newItemId: number): void {
    const data = this.character.getRawData();
    const { items } = this.scanGATable(data);
    for (const entry of items) {
      if (entry.handle === 0) continue;
      if ((entry.handle & 0xFFFF) === gaHighest) {
        data[entry.offset + 4] = newItemId & 0xFF;
        data[entry.offset + 5] = (newItemId >> 8) & 0xFF;
        data[entry.offset + 6] = (newItemId >> 16) & 0xFF;
        data[entry.offset + 7] = (newItemId >> 24) & 0xFF;
        console.log(`[DS3 GA] Updated itemId for gaHighest=${gaHighest} → 0x${newItemId.toString(16)}`);
        return;
      }
    }
    console.warn(`[DS3 GA] GA entry for gaHighest=${gaHighest} not found`);
  }

  // ===== WEAPON MEMORY =====

  get weaponMemory(): number {
    return this.character.weaponMemory;
  }

  set weaponMemory(value: number) {
    this.character.weaponMemory = value;
  }

  /**
   * Returns the effective Weapon Level for a single weapon item.
   * Unique/boss weapons (MaxUpgrade=5) count x2: WL = upgradeLevel * 2.
   * Regular weapons (MaxUpgrade=10): WL = upgradeLevel.
   */
  getWeaponLevel(item: DS3InventoryItem): number {
    if (item.separator !== 0x80) return 0;
    // `?? 10` fires only when the item is unknown to the catalogue; a real
    // MaxUpgrade of 0 (Dark Hand) means "cannot be upgraded" and must stay 0.
    const maxUp = item.itemInfo?.maxUpgrade ?? 10;
    return item.upgradeLevel * (maxUp === 5 ? 2 : 1);
  }

  /**
   * Sets weaponMemory to the highest WL found in the regular inventory.
   * exact=true (user click): can lower; exact=false (auto): only raises.
   */
  calibrateWeaponMemory(exact = false): number {
    let maxWL = 0;
    for (const item of this.getAllItems()) {
      if (item.collectionType === ItemCollectionType.Weapon) {
        const wl = this.getWeaponLevel(item);
        if (wl > maxWL) maxWL = wl;
      }
    }
    if (exact || maxWL > this.weaponMemory) {
      this.weaponMemory = maxWL;
    }
    return this.weaponMemory;
  }

  addAllItems(collectionType: ItemCollectionType, targetWL = 0): void {
    const catalog = this.getCatalog();
    if (catalog.isEmpty) return;

    // Build covenant ID set to exclude covenant badges from ring_items (they share IDs)
    const covenantIds = new Set(
      catalog.byCollection('covenant_items').map(i => i.rawId)
    );

    const collection = COLLECTION_FOR_TYPE[collectionType];
    const items = (collection ? catalog.byCollection(collection) : []).filter(item => {
      if (!item.safe) return false;
      const id = item.rawId;
      // Estus Flask (0x40000096–0x400000AB) and Ashen Estus Flask (0x400000BE–0x400000D3)
      if (id >= 0x40000096 && id <= 0x400000AB) return false;
      if (id >= 0x400000BE && id <= 0x400000D3) return false;
      // Exclude covenant items from ring_items (they share the same ID prefix)
      if (collectionType === ItemCollectionType.Ring && covenantIds.has(id)) return false;
      return true;
    });

    if (collectionType === ItemCollectionType.Weapon) {
      // Walk the free slots instead of rescanning from 0 every time: the scan
      // resumes right after the slot just filled, so occupied slots further on
      // are skipped rather than written over.
      let nextSlot = this.findNextAvailableSlot();
      for (const item of items) {
        if (nextSlot === -1) break;
        try {
          const maxUp = item.maxUpgrade;
          // Unique weapons (MaxUpgrade=5) count x2 per upgrade level.
          const upgradeLevel = maxUp === 5
            ? Math.min(Math.floor(targetWL / 2), 5)
            : Math.min(targetWL, maxUp);
          const slotUsed = this.addItem(item, 1, upgradeLevel, 0, nextSlot);
          nextSlot = this.findNextAvailableSlot(slotUsed === null ? nextSlot + 1 : slotUsed + 1);
        } catch {
          // skip if no space
        }
      }
    } else if (collectionType === ItemCollectionType.Armor) {
      let nextSlot = this.findNextAvailableSlot();
      for (const item of items) {
        if (nextSlot === -1) break;
        try {
          const slotUsed = this.addItem(item, 1, 0, 0, nextSlot);
          nextSlot = this.findNextAvailableSlot(slotUsed === null ? nextSlot + 1 : slotUsed + 1);
        } catch {
          // skip if no space
        }
      }
    } else if (collectionType === ItemCollectionType.Ammunition) {
      // Ammunition creates GA entries (like weapons) so track slots to avoid O(n²) scans.
      let nextSlot = this.findNextAvailableSlot();
      for (const item of items) {
        if (nextSlot === -1) break;
        try {
          const slotUsed = this.addItem(item, item.stackMax, 0, 0, nextSlot);
          nextSlot = this.findNextAvailableSlot(slotUsed === null ? nextSlot + 1 : slotUsed + 1);
        } catch {
          // skip if no space
        }
      }
    } else {
      for (const item of items) {
        try {
          // Add max quantity to inventory
          this.addItem(item, item.stackMax);
          // Also fill storage box (bottomless box) to 600 for stackable items
          if (item.stackMax > 1) {
            this.setStorageQuantity(item, 600);
          }
        } catch {
          // skip if no space
        }
      }
    }
  }

  clearAllItems(collectionType: ItemCollectionType): void {
    for (const item of this.getItemsByType(collectionType)) {
      if (item.itemInfo?.safe === false) continue;
      this.deleteItem(item.slotIndex);
    }
  }

  /**
   * Add a key item to the key section (separate from regular inventory)
   */
  private addKeyItem(itemInfo: Item): number | null {
    const data = this.character.getRawData();
    const currentCount = this.getKeyItemCount(data);
    if (currentCount >= DS3Inventory.MAX_KEY_SLOTS) {
      console.warn('[DS3 Inventory] Key section full');
      return null;
    }

    // Check if key already exists
    const existing = this.findExistingItem(itemInfo);
    if (existing) return existing.slotIndex;

    const finalItemId = itemInfo.rawId;
    const newSlot = new Uint8Array(16);
    newSlot[0] = finalItemId & 0xFF;
    newSlot[1] = (finalItemId >> 8) & 0xFF;
    newSlot[2] = (finalItemId >> 16) & 0xFF;
    newSlot[3] = 0xB0;
    newSlot[4] = finalItemId & 0xFF;
    newSlot[5] = (finalItemId >> 8) & 0xFF;
    newSlot[6] = (finalItemId >> 16) & 0xFF;
    newSlot[7] = (finalItemId >> 24) & 0xFF;
    newSlot[8]  = 1; // quantity
    newSlot[12] = 0x90; newSlot[13] = 0xA0;
    newSlot[14] = 0xEE; newSlot[15] = 0x02;

    const slotIndex = DS3Inventory.KEY_SLOT_BASE + currentCount;
    const newItem = new DS3InventoryItem(newSlot, slotIndex, this.catalog);
    this.writeSlot(slotIndex, newItem);
    this.setKeyItemCount(data, currentCount + 1);

    console.log(`[DS3 Key] Added ${itemInfo.name} to key slot ${currentCount}`);
    return slotIndex;
  }

  /**
   * Delete item from slot (regular or key section)
   */
  deleteItem(slotIndex: number): void {
    const emptyItem = new DS3InventoryItem(new Uint8Array(16).fill(0x00), slotIndex, this.catalog);
    this.writeSlot(slotIndex, emptyItem);
    // For key items: decrement count and compact
    if (slotIndex >= DS3Inventory.KEY_SLOT_BASE) {
      const data = this.character.getRawData();
      const count = this.getKeyItemCount(data);
      const keyIdx = slotIndex - DS3Inventory.KEY_SLOT_BASE;
      const invStart = this.getInventoryStartOffset();
      const sectionBase = invStart + DS3Inventory.KEY_SECTION_OFFSET + 4;
      // Shift remaining key items down to fill the gap
      for (let i = keyIdx; i < count - 1; i++) {
        const src = sectionBase + (i + 1) * DS3Inventory.ITEM_SIZE;
        const dst = sectionBase + i * DS3Inventory.ITEM_SIZE;
        data.set(data.slice(src, src + DS3Inventory.ITEM_SIZE), dst);
      }
      // Zero last slot
      data.fill(0x00, sectionBase + (count - 1) * DS3Inventory.ITEM_SIZE, sectionBase + count * DS3Inventory.ITEM_SIZE);
      this.setKeyItemCount(data, Math.max(0, count - 1));
    }
  }

  /**
   * Classify a catalogue entry by value rather than by object identity.
   *
   * Uses the composite key here — the caller hands over the full entry, so
   * `Type` is available and tells a ring apart from the covenant badge that
   * shares its id. Slot-side lookups have only the id and fall back to
   * `byRawId`, where covenant precedence applies.
   */
  private getCollectionTypeFromItem(item: Item): ItemCollectionType {
    const key = item.key;
    const found = this.getCatalog().byKey(key);
    if (!found) return ItemCollectionType.Unknown;
    return ds3CollectionType(found);
  }
}
