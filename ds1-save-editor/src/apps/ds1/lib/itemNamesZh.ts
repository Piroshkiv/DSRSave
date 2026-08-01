// Chinese item names loader
// Maps item IDs to Chinese names using the official DS1 translations

import { ItemsDatabase } from './Inventory';

interface ChineseNames {
  weapons: Record<string, string>;
  armor: Record<string, string>;
  rings: Record<string, string>;
  magic: Record<string, string>;
  items: Record<string, string>;
}

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

function hexToDecimalId(hexId: string): string {
  return String(parseInt(hexId, 16));
}

export async function applyChineseNames(database: ItemsDatabase): Promise<void> {
  const names = await loadChineseNames();

  const applyToItems = (items: any[] | undefined, category: keyof ChineseNames) => {
    if (!items) return;
    const nameMap = names[category];
    if (!nameMap) return;

    for (const item of items) {
      const decimalId = hexToDecimalId(item.Id);
      if (nameMap[decimalId]) {
        item.displayName = nameMap[decimalId];
      }
    }
  };

  // Map items to their Chinese name categories
  applyToItems(database.weapon_items, 'weapons');
  applyToItems(database.armor_items, 'armor');
  applyToItems(database.ring_items, 'rings');

  // For magic, consumables, key items, materials, ammunition - they share the 'items' namespace
  // but magic has its own IDs, so we need to check both
  applyToItems(database.magic_items, 'magic');
  applyToItems(database.usable_items, 'items');
  applyToItems(database.key_items, 'items');
  applyToItems(database.material_items, 'items');
  applyToItems(database.ammunition_items, 'items');
}
