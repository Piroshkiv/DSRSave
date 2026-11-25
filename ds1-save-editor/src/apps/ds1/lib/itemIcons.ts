/**
 * DS1 item icon sprite lookup.
 *
 * Icons live as a handful of full-res sprite sheets extracted from the
 * game's own `menu_0..5.tpf.dcx` (see `public/json/ds1_item_icons.json` for
 * provenance). Every cell is a fixed 164x184 px block; a position is just
 * `{sheet, x, y}` keyed by the item's base (unupgraded) decimal id.
 */

export interface IconPosition {
  sheet: string;
  x: number;
  y: number;
}

export interface Ds1IconData {
  meta: {
    cellWidth: number;
    cellHeight: number;
    sheetFiles: Record<string, string>;
    sheetPixelSize: Record<string, { width: number; height: number }>;
  };
  items: {
    weapon?: Record<string, IconPosition>;
    protector?: Record<string, IconPosition>;
    ring?: Record<string, IconPosition>;
    goods?: Record<string, IconPosition>;
    [category: string]: Record<string, IconPosition> | undefined;
  };
}

export const ICON_CELL_WIDTH = 164;
export const ICON_CELL_HEIGHT = 184;

/**
 * Gesture icons sit on the same `Icon30` sheet as the magic icons, right
 * after them: a 12-wide block starting at grid row 8 (0-indexed), running
 * for 15 cells (row 8 cols 0-11, then row 9 cols 0-2) in the same order as
 * `Character`'s gesture bit index (0 = Point Forward ... 14 = Praise the Sun).
 * There's no param table id for these — just a fixed block position — so
 * it's a direct index, not a `findIconPosition` lookup.
 */
const GESTURE_SHEET = 'Icon30';
const GESTURE_FIRST_ROW = 8;
const GESTURE_COLS = 12;

export function gestureIconPosition(index: number): IconPosition {
  const row = GESTURE_FIRST_ROW + Math.floor(index / GESTURE_COLS);
  const col = index % GESTURE_COLS;
  return { sheet: GESTURE_SHEET, x: col * ICON_CELL_WIDTH, y: row * ICON_CELL_HEIGHT };
}

/** Maps `InventoryItem.itemType` / `Item.typeNibble` to an icon JSON category. */
const CATEGORY_FOR_NIBBLE: Record<number, string> = {
  0: 'weapon',
  1: 'protector',
  2: 'ring',
  4: 'goods',
};

let dataPromise: Promise<Ds1IconData | null> | null = null;

/** Fetches and caches `ds1_item_icons.json` for the lifetime of the page. */
export function loadDs1IconData(): Promise<Ds1IconData | null> {
  if (!dataPromise) {
    dataPromise = fetch('/json/ds1_item_icons.json')
      .then((res) => (res.ok ? (res.json() as Promise<Ds1IconData>) : null))
      .catch(() => null);
  }
  return dataPromise;
}

/** Looks up the sprite position for a base item id, or `null` if none exists. */
export function findIconPosition(
  data: Ds1IconData | null,
  typeNibble: number,
  baseItemId: number,
): IconPosition | null {
  if (!data) return null;
  const category = CATEGORY_FOR_NIBBLE[typeNibble];
  if (!category) return null;
  const table = data.items[category];
  return table?.[String(baseItemId)] ?? null;
}
