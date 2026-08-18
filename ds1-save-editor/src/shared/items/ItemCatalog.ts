import {
  Item,
  keyFromEmbeddedId,
  makeItemKey,
  parseHex,
  type ItemKey,
  type RawItemEntry,
} from './Item';

/** The catalogue JSON as loaded from disk: collection name → entries. */
export type RawItemDatabase = Record<string, RawItemEntry[] | undefined>;

export interface ItemCatalogOptions {
  /**
   * Collections to index first. Only matters for {@link ItemCatalog.byRawId},
   * where several entries can share a raw `Id` and the first one indexed wins.
   *
   * DS3 needs `covenant_items` ahead of `ring_items`: the nine covenant badges
   * repeat the ring ids, and a save holding one of those ids means the badge.
   */
  collectionOrder?: readonly string[];
}

/**
 * Indexed, read-only view over a game's item catalogue.
 *
 * Construction is pure — no fetch, no environment sniffing — so it can be
 * built from a literal in a test. I/O lives in `loadItemCatalog`.
 *
 * Lookups go through {@link ItemKey}, never object identity. The DS1 editor
 * used to classify items with `collection.includes(entry)`, which silently
 * mislabelled any structurally identical copy; keying by value removes that
 * whole class of bug. It also turns what was a linear scan over the flattened
 * catalogue on *every* `itemInfo` read into a single map hit.
 */
export class ItemCatalog {
  private readonly byKeyIndex: Map<ItemKey, Item>;
  private readonly byRawIdIndex: Map<number, Item>;
  private readonly byCollectionIndex: Map<string, Item[]>;
  private readonly items: readonly Item[];

  private constructor(items: Item[]) {
    this.items = items;
    this.byKeyIndex = new Map();
    this.byRawIdIndex = new Map();
    this.byCollectionIndex = new Map();

    for (const item of items) {
      // Raw-id index: first writer wins, so collectionOrder decides ties.
      const rawId = parseHex(item.source.Id);
      if (!this.byRawIdIndex.has(rawId)) this.byRawIdIndex.set(rawId, item);

      // First entry wins. The shipped catalogues have no key collisions
      // (tests/data/itemsDatabase.test.ts pins that), so this only guards
      // against a future data mistake instead of silently shadowing.
      if (!this.byKeyIndex.has(item.key)) {
        this.byKeyIndex.set(item.key, item);
      } else {
        console.warn(
          `[ItemCatalog] duplicate key 0x${item.key.toString(16)} for "${item.name}" ` +
            `(${item.collection}); keeping "${this.byKeyIndex.get(item.key)!.name}"`,
        );
      }

      const bucket = this.byCollectionIndex.get(item.collection);
      if (bucket) bucket.push(item);
      else this.byCollectionIndex.set(item.collection, [item]);
    }
  }

  /** Build a catalogue from raw JSON. Missing or non-array collections are skipped. */
  static from(
    raw: RawItemDatabase | null | undefined,
    options: ItemCatalogOptions = {},
  ): ItemCatalog {
    if (!raw) return ItemCatalog.empty();

    const present = Object.keys(raw);
    const preferred = (options.collectionOrder ?? []).filter((name) => present.includes(name));
    const ordered = [...preferred, ...present.filter((name) => !preferred.includes(name))];

    const items: Item[] = [];
    for (const collection of ordered) {
      const entries = raw[collection];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry && typeof entry === 'object') items.push(new Item(entry, collection));
      }
    }
    return new ItemCatalog(items);
  }

  static empty(): ItemCatalog {
    return new ItemCatalog([]);
  }

  get size(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  all(): readonly Item[] {
    return this.items;
  }

  collections(): string[] {
    return [...this.byCollectionIndex.keys()];
  }

  byCollection(collection: string): readonly Item[] {
    return this.byCollectionIndex.get(collection) ?? [];
  }

  byKey(key: ItemKey): Item | null {
    return this.byKeyIndex.get(key) ?? null;
  }

  has(key: ItemKey): boolean {
    return this.byKeyIndex.has(key);
  }

  /**
   * Resolve by the pair a save actually stores: category nibble plus item id.
   * `type` takes a bare nibble or an already-shifted value; see `makeItemKey`.
   */
  lookup(type: number, id: number): Item | null {
    return this.byKey(makeItemKey(type, id));
  }

  /**
   * Resolve by the `Id` field exactly as written in the JSON, ignoring `Type`.
   *
   * This is what a DS3 save needs: it stores the id verbatim, and when two
   * collections share one (the covenant/ring badges) the collection listed
   * first in `collectionOrder` wins.
   */
  byRawId(id: number): Item | null {
    return this.byRawIdIndex.get(id >>> 0) ?? null;
  }

  /**
   * Resolve an id that already carries its category nibble (DS3 style), then
   * fall back to reading it as a bare id under `fallbackType`.
   */
  lookupById(id: number, fallbackType = 0): Item | null {
    return this.byKey(keyFromEmbeddedId(id)) ?? this.lookup(fallbackType, id);
  }

  filter(predicate: (item: Item) => boolean): Item[] {
    return this.items.filter(predicate);
  }

  /** Every item except DS3 cut/debug content. */
  safeItems(): Item[] {
    return this.items.filter((item) => item.safe);
  }

  /** Drop every translated name, falling back to the canonical English ones. */
  clearDisplayNames(): void {
    for (const item of this.items) item.setDisplayName(undefined);
  }
}
