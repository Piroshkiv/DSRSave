import React, { useState, useEffect, useRef } from 'react';
import { DS3Inventory, ItemCollectionType, ItemInfusion, COLLECTION_FOR_TYPE } from '../lib/Inventory';
import { matchesItemSearch, type Item } from '../../../shared/items';
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
  const [storageQty, setStorageQty] = useState<number>(0);
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
    // -1 means the inventory is full; keep the field at 0 so it stays usable,
    // addItem refuses to overwrite an occupied slot anyway.
    setTargetSlot(nextSlot === -1 ? 0 : nextSlot);
  }, [inventory]);

  useEffect(() => {
    const catalog = inventory.getCatalog();
    if (catalog.isEmpty) return;

    // Hide Fists, Unknown and cut/debug items in safe mode
    const hiddenNames = ['Fists', 'Fist'];

    const collection = COLLECTION_FOR_TYPE[collectionType];
    const all = collection ? catalog.byCollection(collection) : [];

    setAvailableItems(
      safeMode
        ? all.filter(
            item =>
              item.safe &&
              !hiddenNames.includes(item.name) &&
              !item.name.startsWith('Unknown ('),
          )
        : [...all],
    );
  }, [collectionType, safeMode, inventory]);

  useEffect(() => {
    if (selectedItem && selectedItem.maxUpgrade !== undefined) {
      setMaxUpgrade(selectedItem.maxUpgrade);
      if (upgradeLevel > selectedItem.maxUpgrade) {
        setUpgradeLevel(selectedItem.maxUpgrade);
      }
    } else {
      setMaxUpgrade(0);
      setUpgradeLevel(0);
    }
  }, [selectedItem]);

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    setQuantity(item.stackMax);
    setStorageQty(item.stackMax > 1 ? item.stackMax : 0);
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
      if (slotIndex === null) {
        alert(`Slot ${targetSlot} is occupied or out of range — pick another slot.`);
        return;
      }
      if (storageQty > 0 && selectedItem.stackMax > 1) {
        inventory.setStorageQuantity(selectedItem, storageQty);
      }
      onItemCreated(slotIndex);
      onClose();
    } catch (error) {
      alert(`Error creating item: ${error}`);
    }
  };

  // Safe mode: only what DS3 actually accepts a gem on — the catalogue's CanInfuse
  // flag, which excludes bows, crossbows, torches, catalysts and boss weapons.
  // Unsafe mode: no check at all, the user is on their own.
  const canInfuse = safeMode ? selectedItem?.canInfuse === true : selectedItem !== null;

  const canUpgrade = selectedItem?.maxUpgrade !== undefined && selectedItem.maxUpgrade > 0;
  const canStack = selectedItem && selectedItem.stackMax > 1;


  const filteredItems = availableItems.filter((item) =>
    matchesItemSearch(item.displayName || item.name, searchQuery)
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
                  key={item.key}
                  className={`item-select-option ${selectedItem === item ? 'selected' : ''}`}
                  onClick={() => handleItemSelect(item)}
                >
                  {item.name}
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
                <>
                  <div className="form-group">
                    <label>Quantity (max: {selectedItem.stackMax})</label>
                    <NumberInput
                      value={quantity}
                      onChange={setQuantity}
                      min={1}
                      max={selectedItem.stackMax}
                    />
                  </div>
                  <div className="form-group">
                    <label>Box Quantity (max: 600)</label>
                    <NumberInput
                      value={storageQty}
                      onChange={setStorageQty}
                      min={0}
                      max={600}
                    />
                  </div>
                </>
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
