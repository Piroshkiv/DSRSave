import React, { useState, useEffect, useRef } from 'react';
import { DS3Inventory, ItemCollectionType, Item, ItemInfusion } from '../lib/Inventory';
import { NumberInput } from '../../ds1/components/NumberInput';

interface ItemCreateDialogProps {
  inventory: DS3Inventory;
  collectionType: ItemCollectionType;
  onClose: () => void;
  onItemCreated: (slotIndex: number | null) => void;
  safeMode: boolean;
}

export const ItemCreateDialog: React.FC<ItemCreateDialogProps> = ({
  inventory,
  collectionType,
  onClose,
  onItemCreated,
  safeMode,
}) => {
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [upgradeLevel, setUpgradeLevel] = useState<number>(0);
  const [infusion, setInfusion] = useState<ItemInfusion>(ItemInfusion.Standard);
  const [maxUpgrade, setMaxUpgrade] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetSlot, setTargetSlot] = useState<number>(0);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const dialogBodyRef = useRef<HTMLDivElement>(null);

  // Set default slot on mount
  useEffect(() => {
    const nextSlot = inventory.findNextAvailableSlot();
    setTargetSlot(nextSlot);
  }, [inventory]);

  useEffect(() => {
    const db = inventory.getItemsDatabase();
    if (!db) return;

    // Hide Fists and Unknown items in safe mode
    const hiddenNames = ['Fists', 'Fist'];

    const filterItems = (items: Item[]) => {
      if (safeMode) {
        return items.filter(item => {
          if (hiddenNames.includes(item.Name)) return false;
          if (item.Name.startsWith('Unknown (')) return false;
          return true;
        });
      }
      return items;
    };

    let items: Item[] = [];
    switch (collectionType) {
      case ItemCollectionType.Weapon:
        items = filterItems(db.weapon_items || []);
        break;
      case ItemCollectionType.Armor:
        items = filterItems(db.armor_items || []);
        break;
      case ItemCollectionType.Ring:
        items = filterItems(db.ring_items || []);
        break;
      case ItemCollectionType.Consumable:
        items = filterItems(db.consumable_items || []);
        break;
      case ItemCollectionType.Magic:
        items = filterItems(db.magic_items || []);
        break;
      case ItemCollectionType.Ore:
        items = filterItems(db.ore_items || []);
        break;
      case ItemCollectionType.Key:
        items = filterItems(db.key_items || []);
        break;
      case ItemCollectionType.Ammunition:
        items = filterItems(db.ammunition_items || []);
        break;
      case ItemCollectionType.Covenant:
        items = filterItems(db.covenant_items || []);
        break;
    }

    setAvailableItems(items);
  }, [collectionType, safeMode, inventory]);

  useEffect(() => {
    if (selectedItem && selectedItem.MaxUpgrade !== undefined) {
      setMaxUpgrade(selectedItem.MaxUpgrade);
      if (upgradeLevel > selectedItem.MaxUpgrade) {
        setUpgradeLevel(selectedItem.MaxUpgrade);
      }
    } else {
      setMaxUpgrade(0);
      setUpgradeLevel(0);
    }
  }, [selectedItem]);

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    setQuantity(Math.min(1, item.MaxStackCount));
    setUpgradeLevel(0);
    setInfusion(ItemInfusion.Standard);
  };

  const handleCreate = () => {
    if (!selectedItem) return;

    try {
      const slotIndex = inventory.addItem(
        selectedItem,
        quantity,
        upgradeLevel,
        infusion,
        targetSlot
      );
      onItemCreated(slotIndex);
      onClose();
    } catch (error) {
      alert(`Error creating item: ${error}`);
    }
  };

  const isStaffPyromancyOrChime = selectedItem ? checkIsStaffPyromancyOrChime(selectedItem) : false;

  // Infusion rules (like DS1, but without durability):
  // Safe mode: MaxUpgrade == 10 AND not staff/pyromancy/chime
  // Unsafe mode: always allow if MaxUpgrade == 10
  const canInfuse = safeMode
    ? (selectedItem?.MaxUpgrade === 10 && !isStaffPyromancyOrChime)
    : (selectedItem?.MaxUpgrade === 10);

  const canUpgrade = selectedItem?.MaxUpgrade !== undefined && selectedItem.MaxUpgrade > 0;
  const canStack = selectedItem && selectedItem.MaxStackCount > 1;

  function checkIsStaffPyromancyOrChime(item: Item): boolean {
    const category = item.Category?.toLowerCase() || '';
    const name = item.Name?.toLowerCase() || '';

    // Check category
    if (category.includes('staff') || category.includes('staves')) return true;
    if (category.includes('pyromancy') || category.includes('flames')) return true;
    if (category.includes('chime') || category.includes('talisman')) return true;

    // Check name patterns
    if (name.includes('staff')) return true;
    if (name.includes('chime')) return true;
    if (name.includes('talisman')) return true;
    if (name.includes('flame') && name.includes('pyromancy')) return true;

    return false;
  }

  const filteredItems = availableItems.filter((item) =>
    item.Name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Prevent body scroll when dialog is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Scroll to quantity field when item is selected
  useEffect(() => {
    if (selectedItem && canStack && quantityInputRef.current) {
      // Use setTimeout to ensure the DOM is updated
      setTimeout(() => {
        quantityInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [selectedItem, canStack]);

  // Redirect scroll from overlay to dialog body
  useEffect(() => {
    const dialogBody = dialogBodyRef.current;
    const dialogContent = dialogBody?.closest('.dialog-content');
    const dialogOverlay = dialogBody?.closest('.dialog-overlay');
    if (!dialogBody || !dialogContent || !dialogOverlay) return;

    const handleWheel = (e: Event) => {
      if (!(e instanceof WheelEvent)) return;

      const target = e.target as HTMLElement;

      // If scrolling is inside dialog content, allow it
      if (dialogContent.contains(target)) {
        // Don't prevent default - let dialog scroll normally
        return;
      }

      // If scrolling is on overlay (empty space), redirect it to dialog body
      e.preventDefault();
      e.stopPropagation();

      // Scroll the dialog body instead
      dialogBody.scrollBy({
        top: e.deltaY,
        left: e.deltaX,
        behavior: 'auto'
      });
    };

    // Add listener to overlay in capture phase to catch all scroll events
    dialogOverlay.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      dialogOverlay.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Create Item</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-body" ref={dialogBodyRef}>
          <div className="form-group">
            <label>Search Item</label>
            <input
              type="text"
              placeholder="Type to search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="form-group">
            <label>Select Item</label>
            <div className="items-select-list">
              {filteredItems.map((item) => (
                <div
                  key={`${item.Type}-${item.Id}`}
                  className={`item-select-option ${selectedItem === item ? 'selected' : ''}`}
                  onClick={() => handleItemSelect(item)}
                >
                  {item.Name}
                </div>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Slot Index (0-1999)</label>
            <NumberInput
              value={targetSlot}
              onChange={setTargetSlot}
              min={0}
              max={1999}
            />
          </div>

          {selectedItem && (
            <>
              {canStack && (
                <div className="form-group">
                  <label>Quantity (max: {selectedItem.MaxStackCount})</label>
                  <NumberInput
                    value={quantity}
                    onChange={setQuantity}
                    min={1}
                    max={selectedItem.MaxStackCount}
                  />
                </div>
              )}

              {canInfuse && (
                <div className="form-group">
                  <label>Infusion</label>
                  <select value={infusion} onChange={(e) => setInfusion(parseInt(e.target.value) as ItemInfusion)}>
                    <option value={ItemInfusion.Standard}>Standard</option>
                    <option value={ItemInfusion.Heavy}>Heavy</option>
                    <option value={ItemInfusion.Sharp}>Sharp</option>
                    <option value={ItemInfusion.Refined}>Refined</option>
                    <option value={ItemInfusion.Simple}>Simple</option>
                    <option value={ItemInfusion.Crystal}>Crystal</option>
                    <option value={ItemInfusion.Fire}>Fire</option>
                    <option value={ItemInfusion.Chaos}>Chaos</option>
                    <option value={ItemInfusion.Lightning}>Lightning</option>
                    <option value={ItemInfusion.Deep}>Deep</option>
                    <option value={ItemInfusion.Dark}>Dark</option>
                    <option value={ItemInfusion.Poison}>Poison</option>
                    <option value={ItemInfusion.Blood}>Blood</option>
                    <option value={ItemInfusion.Raw}>Raw</option>
                    <option value={ItemInfusion.Blessed}>Blessed</option>
                    <option value={ItemInfusion.Hollow}>Hollow</option>
                  </select>
                </div>
              )}

              {canUpgrade && (
                <div className="form-group">
                  <label>Upgrade Level (max: +{maxUpgrade})</label>
                  <NumberInput
                    value={upgradeLevel}
                    onChange={setUpgradeLevel}
                    min={0}
                    max={safeMode ? maxUpgrade : 9999}
                  />
                </div>
              )}
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="create-button"
            onClick={handleCreate}
            disabled={!selectedItem}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
