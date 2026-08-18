// Chinese item names loader
// Maps item IDs to Chinese names using the official DS1 translations

import type { ItemCatalog } from '../../../shared/items';

interface ChineseNames {
  weapons: Record<string, string>;
  armor: Record<string, string>;
  rings: Record<string, string>;
  magic: Record<string, string>;
  items: Record<string, string>;
}

/** Which translation namespace each catalogue collection draws from. */
const COLLECTION_NAMESPACE: Record<string, keyof ChineseNames> = {
  weapon_items: 'weapons',
  armor_items: 'armor',
  ring_items: 'rings',
  magic_items: 'magic',
  // Consumables, keys, materials and ammunition share one namespace.
  usable_items: 'items',
  key_items: 'items',
  material_items: 'items',
  ammunition_items: 'items',
};

let cachedNames: ChineseNames | null = null;

export async function loadChineseNames(): Promise<ChineseNames> {
  if (cachedNames) return cachedNames;

  try {
    const isElectron =
      typeof window !== 'undefined' && window.location.protocol === 'file:';
    const basePath = isElectron ? './json/item_names_zh.json' : '/json/item_names_zh.json';

    const response = await fetch(basePath);
    if (!response.ok) throw new Error(`Failed to load Chinese names: ${response.status}`);
    cachedNames = await response.json();
    return cachedNames!;
  } catch (err) {
    console.error('Failed to load Chinese item names:', err);
    return { weapons: {}, armor: {}, rings: {}, magic: {}, items: {} };
  }
}

/**
 * Overlay Chinese names onto a catalogue.
 *
 * The translation tables are keyed by decimal item id within a namespace, so
 * the collection an item came from decides which table to consult. Names land
 * on the catalogue entries themselves — previously this wrote `displayName`
 * into the raw JSON objects, which coupled the overlay to the raw database.
 */
export async function applyChineseNames(catalog: ItemCatalog): Promise<void> {
  const names = await loadChineseNames();

  for (const [collection, namespace] of Object.entries(COLLECTION_NAMESPACE)) {
    const table = names[namespace];
    if (!table) continue;

    for (const item of catalog.byCollection(collection)) {
      const translated = table[String(item.rawId)];
      if (translated) item.setDisplayName(translated);
    }
  }
}
