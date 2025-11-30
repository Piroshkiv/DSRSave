import React, { useState, useEffect, useRef } from 'react';
import { Inventory, ItemCollectionType, Item, ItemInfusion } from '../lib/Inventory';
import { NumberInput } from './NumberInput';

interface ItemCreateDialogProps {
  inventory: Inventory;
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
  const [durability, setDurability] = useState<number>(0);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const dialogBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const db = inventory.getItemsDatabase();
    if (!db) return;

    // Names to hide in safe mode: Fists, No helm, No armor, No gauntlets, No legs
    const hiddenNames = ['Fists', 'No helm', 'No armor', 'No gauntlets', 'No legs'];

    const filterItems = (items: Item[]) => {
      if (safeMode) {
        return items.filter(item => !hiddenNames.includes(item.Name));
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
      case ItemCollectionType.Soul:
        items = filterItems(db.soul_items || []);
        break;
      case ItemCollectionType.Upgrade:
        items = filterItems(db.upgrade_items || []);
        break;
      case ItemCollectionType.Key:
        items = filterItems(db.key_items || []);
        break;
      case ItemCollectionType.Spell:
        items = filterItems(db.spell_items || []);
        break;
      case ItemCollectionType.Usable:
        items = filterItems(db.usable_items || []);
        break;
      case ItemCollectionType.Ammunition:
        items = filterItems(db.ammunition_items || []);
        break;
      case ItemCollectionType.Material:
        items = filterItems(db.material_items || []);
        break;
      case ItemCollectionType.Magic:
        items = filterItems(db.magic_items || []);
        break;
      case ItemCollectionType.Special:
        items = filterItems(db.specials || []);
        break;
    }

    setAvailableItems(items);
  }, [collectionType, safeMode]);

  useEffect(() => {
    if (selectedItem) {
      // Special handling for Pyromancy Flame
      const isPyromancyFlame = selectedItem.Name === 'Pyromancy Flame' || selectedItem.Name === 'Pyromancy Flame (Ascended)';
      if (isPyromancyFlame) {
        // Pyromancy Flame special logic: can upgrade from 0 to 15 for base, 0 to 5 for ascended
        if (selectedItem.Name === 'Pyromancy Flame (Ascended)') {
          setMaxUpgrade(5);
        } else {
          setMaxUpgrade(15);
        }
      } else if (selectedItem.MaxUpgrade !== undefined) {
        let max: number;
        if (safeMode) {
          max = Inventory.getMaxUpgradeForInfusion(selectedItem.MaxUpgrade, infusion);
        } else {
          // In unsafe mode, allow max upgrade based on item's absolute max
          max = selectedItem.MaxUpgrade;
        }
        setMaxUpgrade(max);
        // Only auto-cap upgrade level in safe mode
        if (safeMode && upgradeLevel > max) {
          setUpgradeLevel(max);
        }
      } else {
        setMaxUpgrade(0);
        setUpgradeLevel(0);
      }
    }
  }, [selectedItem, safeMode, safeMode ? infusion : undefined]);

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    // Special handling for Estus Flask
    if (item.Name?.includes('Estus Flask')) {
      if (item.Name?.includes('(empty)')) {
        setQuantity(0);
      } else {
        setQuantity(20);
      }
    } else {
      setQuantity(Math.min(1, item.MaxStackCount));
    }
    setUpgradeLevel(0);
    setInfusion(ItemInfusion.Standard);
    if (item.Durability !== undefined) {
      setDurability(item.Durability);
    }
  };

  const handleCreate = () => {
    if (!selectedItem) return;

    try {
      // For empty Estus Flask, quantity must be 0
      const finalQuantity = isEstusFlaskEmpty ? 0 : quantity;
      const slotIndex = inventory.addItem(selectedItem, finalQuantity, upgradeLevel, infusion);

      if (slotIndex !== null) {
        const item = inventory.readSlot(slotIndex);

        // Special handling for Pyromancy Flame upgrade level
        if (isPyromancyFlame) {
          const baseId = item.baseItemId;
          if (baseId === 1330000) { // Pyromancy Flame
            item.itemId = 1330000 + upgradeLevel * 100;
          } else if (baseId === 1332000) { // Pyromancy Flame (Ascended)
            item.itemId = 1332000 + upgradeLevel * 100;
          }
          inventory.writeSlot(slotIndex, item);
        }

        // Update durability if applicable
        if (hasDurability) {
          item.durability = durability;
          inventory.writeSlot(slotIndex, item);
        }
      }

      onItemCreated(slotIndex);
      onClose();
    } catch (error) {
      alert(`Error creating item: ${error}`);
    }
  };

  const isPyromancyFlame = selectedItem?.Name === 'Pyromancy Flame' || selectedItem?.Name === 'Pyromancy Flame (Ascended)';
  const isEstusFlask = selectedItem?.Name?.includes('Estus Flask');
  const isEstusFlaskEmpty = isEstusFlask && selectedItem?.Name?.includes('(empty)');
  const canUpgrade = isPyromancyFlame || (selectedItem?.MaxUpgrade !== undefined && selectedItem.MaxUpgrade > 0);
  const canInfuse = safeMode ? (selectedItem?.CanInfuse === true && !isPyromancyFlame) : !isPyromancyFlame;
  const canStack = selectedItem && selectedItem.MaxStackCount > 1;
  const hasDurability = selectedItem?.Durability !== undefined &&
    (collectionType === ItemCollectionType.Weapon || collectionType === ItemCollectionType.Armor);

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
    if (selectedItem && (canStack || isEstusFlask) && quantityInputRef.current) {
      // Use setTimeout to ensure the DOM is updated
      setTimeout(() => {
        quantityInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [selectedItem, canStack, isEstusFlask]);

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

          {selectedItem && (
            <>
              {(canStack || isEstusFlask) && (
                <div className="form-group">
                  <label>
                    {isEstusFlask
                      ? `Quantity ${isEstusFlaskEmpty ? '(empty flask, must be 0)' : '(max: 20)'}`
                      : `Quantity (max: ${selectedItem.MaxStackCount})`
                    }
                  </label>
                  <NumberInput
                    value={quantity}
                    onChange={(value) => {
                      if (isEstusFlaskEmpty) {
                        setQuantity(0);
                      } else {
                        setQuantity(value);
                      }
                    }}
                    min={isEstusFlaskEmpty ? 0 : (isEstusFlask ? 0 : 1)}
                    max={isEstusFlask ? 20 : selectedItem.MaxStackCount}
                    disabled={isEstusFlaskEmpty}
                  />
                </div>
              )}

              {canInfuse && (
                <div className="form-group">
                  <label>Infusion</label>
                  <select value={infusion} onChange={(e) => setInfusion(parseInt(e.target.value) as ItemInfusion)}>
                    <option value={ItemInfusion.Standard}>Standard</option>
                    <option value={ItemInfusion.Crystal}>Crystal</option>
                    <option value={ItemInfusion.Lightning}>Lightning</option>
                    <option value={ItemInfusion.Raw}>Raw</option>
                    <option value={ItemInfusion.Magic}>Magic</option>
                    <option value={ItemInfusion.Enchanted}>Enchanted</option>
                    <option value={ItemInfusion.Divine}>Divine</option>
                    <option value={ItemInfusion.Occult}>Occult</option>
                    <option value={ItemInfusion.Fire}>Fire</option>
                    <option value={ItemInfusion.Chaos}>Chaos</option>
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

              {hasDurability && (
                <div className="form-group">
                  <label>Durability</label>
                  <NumberInput
                    value={durability}
                    onChange={setDurability}
                    min={0}
                    max={9999}
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
