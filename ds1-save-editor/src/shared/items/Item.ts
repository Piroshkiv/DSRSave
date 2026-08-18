/**
 * Normalised item model shared by the DS1 and DS3 editors.
 *
 * Both games ship their catalogue as the same JSON entry shape — only the set
 * of collections differs — so one model and one normaliser serve both.
 */

/** A raw entry exactly as it appears in `public/json/items.json` / `ds3_items.json`. */
export interface RawItemEntry {
  Type: string;
  Id: string;
  Name: string;
  MaxStackCount: number;
  Category?: string | null;
  MaxUpgrade?: number | null;
  CanInfuse?: boolean | null;
  Durability?: number | null;
  /** DS3 only: `false` marks cut/debug content that must not be added to a save. */
  Safe?: boolean;
  /** Written in place by the localisation overlay (see itemNamesZh). */
  displayName?: string;
  [extra: string]: unknown;
}

/**
 * Stable identity of an item: the category nibble in the high 4 bits, the
 * numeric item id in the low 28.
 *
 * This composite is required, not cosmetic. DS1 keeps the category in `Type`
 * and reuses ids across collections — `Dagger` and `Helm of Favor` are both
 * id `0x186A0` — so an id alone is ambiguous there. DS3 already carries the
 * nibble inside its ids. Combining the two fields yields a key that is unique
 * in both catalogues (717 keys for DS1, 1311 for DS3, no collisions).
 */
export type ItemKey = number;

export const ITEM_TYPE_MASK = 0xf0000000;
export const ITEM_ID_MASK = 0x0fffffff;

/** Parse a `"0x…"` string from the catalogue JSON. Returns 0 for junk. */
export function parseHex(value: string | number | null | undefined): number {
  if (typeof value === 'number') return value >>> 0;
  if (!value) return 0;
  const parsed = parseInt(String(value).replace(/^0[xX]/, ''), 16);
  return Number.isNaN(parsed) ? 0 : parsed >>> 0;
}

/**
 * Build an {@link ItemKey}.
 *
 * `type` accepts either a bare nibble (`4`) as DS1's `InventoryItem.itemType`
 * reports it, or an already-shifted value (`0x40000000`) as the JSON stores
 * it. `id` may include a category prefix (DS3) or not (DS1); it is masked
 * either way.
 */
export function makeItemKey(type: number, id: number): ItemKey {
  const shifted = type < 0x10 ? (type << 28) >>> 0 : (type & ITEM_TYPE_MASK) >>> 0;
  return ((shifted | (id & ITEM_ID_MASK)) >>> 0) as ItemKey;
}

/**
 * Build a key from an id that already carries its category nibble, which is
 * how DS3 stores item ids in the save (`0x40000869` = goods `0x869`).
 */
export function keyFromEmbeddedId(id: number): ItemKey {
  return (id >>> 0) as ItemKey;
}

/** The category nibble of a key, as a bare number 0-15. */
export function keyTypeNibble(key: ItemKey): number {
  return (key >>> 28) & 0xf;
}

/** The numeric item id of a key, without the category nibble. */
export function keyItemId(key: ItemKey): number {
  return key & ITEM_ID_MASK;
}

/**
 * One catalogue entry, normalised.
 *
 * Field names follow the domain rather than the JSON, but `source` keeps the
 * original entry reachable — the Chinese-name overlay writes `displayName`
 * onto it in place, and callers that still need a raw field can reach it.
 */
export class Item {
  readonly key: ItemKey;
  /** Numeric id without the category nibble. This is what DS1 stores in a slot. */
  readonly id: number;
  /**
   * The `Id` field exactly as the catalogue writes it, category nibble and
   * all. DS3 stores this verbatim in a slot; DS1's ids carry no nibble, so
   * there `rawId === id`.
   */
  readonly rawId: number;
  /** Category nibble, bare (0 = weapon, 1 = armour, 2 = ring, 4 = goods). */
  readonly typeNibble: number;
  readonly name: string;
  /** Collection the entry came from, e.g. `weapon_items`. */
  readonly collection: string;
  /** Game-provided sub-category, e.g. `greatswords`; empty when absent. */
  readonly category: string;
  readonly stackMax: number;
  /** 0 when the item cannot be upgraded. */
  readonly maxUpgrade: number;
  /** DS1 only; 0 elsewhere. */
  readonly durability: number;
  /** DS1 only: whether the weapon accepts an infusion. */
  readonly canInfuse: boolean;
  /** `false` only for DS3 cut/debug content. DS1 entries are always safe. */
  readonly safe: boolean;
  readonly source: RawItemEntry;

  /** Localised name, set by a translation overlay. */
  private localisedName: string | undefined;

  constructor(source: RawItemEntry, collection: string) {
    this.source = source;
    this.collection = collection;

    const type = parseHex(source.Type);
    const rawId = parseHex(source.Id);

    this.key = makeItemKey(type, rawId);
    this.rawId = rawId;
    this.id = rawId & ITEM_ID_MASK;
    this.typeNibble = keyTypeNibble(this.key);

    this.name = source.Name ?? '';
    this.category = source.Category ?? '';
    this.stackMax = Number.isFinite(source.MaxStackCount) ? source.MaxStackCount : 1;
    this.maxUpgrade = source.MaxUpgrade ?? 0;
    this.durability = source.Durability ?? 0;
    this.canInfuse = source.CanInfuse === true;
    this.safe = source.Safe !== false;
  }

  /** Localised name once a translation overlay ran, otherwise the canonical one. */
  get displayName(): string {
    return this.localisedName ?? this.name;
  }

  /** Apply a translated name. Pass `undefined` to fall back to the canonical one. */
  setDisplayName(name: string | undefined): void {
    this.localisedName = name;
  }

  get isUpgradable(): boolean {
    return this.maxUpgrade > 0;
  }

  get isStackable(): boolean {
    return this.stackMax > 1;
  }
}
