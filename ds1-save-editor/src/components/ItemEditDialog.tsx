import React, { useState, useEffect } from 'react';
import { Inventory, ItemInfusion, InventoryItem, Item } from '../lib/Inventory';

interface ItemEditDialogProps {
  inventory: Inventory;
  item: InventoryItem;
  onClose: () => void;
  onItemUpdated: () => void;
  safeMode: boolean;
}

export const ItemEditDialog: React.FC<ItemEditDialogProps> = ({
  inventory,
  item,
  onClose,
  onItemUpdated,
  safeMode,
}) => {
  const itemInfo = item.itemInfo;
  // For Estus Flask: if empty, quantity must be 0; if not empty, use current quantity or default to 20
  const initialQuantity = itemInfo?.Name?.includes('Estus Flask') 
    ? (itemInfo.Name.includes('(empty)') ? 0 : (item.quantity || 20))
    : item.quantity;
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [upgradeLevel, setUpgradeLevel] = useState<number>(item.upgradeLevel);
  const [infusion, setInfusion] = useState<ItemInfusion>(item.infusion);
  const [durability, setDurability] = useState<number>(item.durability);
  const [maxUpgrade, setMaxUpgrade] = useState<number>(0);
  const [selectedEstusFlask, setSelectedEstusFlask] = useState<Item | null>(null);

  const isPyromancyFlame = itemInfo?.Name === 'Pyromancy Flame' || itemInfo?.Name === 'Pyromancy Flame (Ascended)';
  const isEstusFlask = itemInfo?.Name?.includes('Estus Flask');
  const isEstusFlaskEmpty = isEstusFlask && itemInfo?.Name?.includes('(empty)');

  useEffect(() => {
    if (isPyromancyFlame) {
      // Pyromancy Flame special logic: can upgrade from 0 to 15 for base, 0 to 5 for ascended
      if (itemInfo?.Name === 'Pyromancy Flame (Ascended)') {
        setMaxUpgrade(5);
      } else {
        setMaxUpgrade(15);
      }
    } else if (itemInfo && itemInfo.MaxUpgrade !== undefined) {
      let max: number;
      if (safeMode) {
        max = Inventory.getMaxUpgradeForInfusion(itemInfo.MaxUpgrade, infusion);
      } else {
        // In unsafe mode, allow max upgrade based on item's absolute max
        max = itemInfo.MaxUpgrade;
      }
      setMaxUpgrade(max);
      // Only auto-cap upgrade level in safe mode
      if (safeMode && upgradeLevel > max) {
        setUpgradeLevel(max);
      }
    }
  }, [itemInfo, isPyromancyFlame, safeMode, safeMode ? infusion : undefined]);

  const handleUpdate = () => {
    try {
      // Special handling for Estus Flask - change to selected variant
      if (isEstusFlask && selectedEstusFlask) {
        const typeNumeric = Math.floor(parseInt(selectedEstusFlask.Type.replace('0x', ''), 16) / 0x10000000);
        const idNumeric = parseInt(selectedEstusFlask.Id.replace('0x', ''), 16);

        item.itemType = typeNumeric;
        item.itemId = idNumeric;
        // For empty Estus Flask, quantity must be 0, otherwise use the specified quantity
        if (selectedEstusFlask.Name?.includes('(empty)')) {
          item.quantity = 0;
        } else {
          item.quantity = quantity;
        }
      } else if (isEstusFlask) {
        // If Estus Flask but no variant selected, just update quantity
        // For empty Estus Flask, quantity must be 0
        if (isEstusFlaskEmpty) {
          item.quantity = 0;
        } else {
          item.quantity = quantity;
        }
      } else {
        item.quantity = quantity;

        // Special handling for Pyromancy Flame upgrade level
        if (isPyromancyFlame) {
          const baseId = item.baseItemId;
          if (baseId === 1330000) { // Pyromancy Flame
            item.itemId = 1330000 + upgradeLevel * 100;
          } else if (baseId === 1332000) { // Pyromancy Flame (Ascended)
            item.itemId = 1332000 + upgradeLevel * 100;
          }
        } else {
          item.upgradeLevel = upgradeLevel;
        }

        item.infusion = infusion;
      }

      item.durability = durability;

      inventory.writeSlot(item.slotIndex, item);
      onItemUpdated();
      onClose();
    } catch (error) {
      alert(`Error updating item: ${error}`);
    }
  };

  const canUpgrade = isPyromancyFlame || (itemInfo?.MaxUpgrade !== undefined && itemInfo.MaxUpgrade > 0);
  const canInfuse = safeMode ? (itemInfo?.CanInfuse === true && !isPyromancyFlame) : !isPyromancyFlame;
  const canStack = itemInfo && itemInfo.MaxStackCount > 1;
  const hasDurability = (item.collectionType === 'Weapon' || item.collectionType === 'Armor') && itemInfo?.Durability !== undefined;

  // Get all Estus Flask variants
  const getEstusFlaskVariants = (): Item[] => {
    const db = inventory.getItemsDatabase();
    if (!db || !db.usable_items) return [];

    return db.usable_items.filter(i => i.Name?.includes('Estus Flask'));
  };

  const estusFlaskVariants = isEstusFlask ? getEstusFlaskVariants() : [];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Edit Item</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-body">
          <div className="form-group">
            <label>Item Name</label>
            <div className="item-name-display">{item.itemName}</div>
          </div>

          {isEstusFlask ? (
            <>
              <div className="form-group">
                <label>Estus Flask Variant</label>
                <select
                  value={selectedEstusFlask?.Id || itemInfo?.Id || ''}
                  onChange={(e) => {
                    const selected = estusFlaskVariants.find(v => v.Id === e.target.value);
                    setSelectedEstusFlask(selected || null);
                    // If empty variant selected, set quantity to 0, otherwise default to 20
                    if (selected) {
                      if (selected.Name?.includes('(empty)')) {
                        setQuantity(0);
                      } else {
                        setQuantity(20);
                      }
                    }
                  }}
                >
                  <option value="">Keep Current</option>
                  {estusFlaskVariants.map(variant => (
                    <option key={variant.Id} value={variant.Id}>
                      {variant.Name}
                    </option>
                  ))}
                </select>
              </div>
              {(() => {
                // Show quantity field if:
                // 1. No variant selected (Keep Current) and current item is not empty
                // 2. Variant selected and it's not empty
                const showQuantity = selectedEstusFlask 
                  ? !selectedEstusFlask.Name?.includes('(empty)')
                  : !isEstusFlaskEmpty;
                
                return showQuantity ? (
                  <div className="form-group">
                    <label>Quantity</label>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    />
                  </div>
                ) : null;
              })()}
            </>
          ) : (
            <>
              {canStack && (
                <div className="form-group">
                  <label>Quantity (max: {itemInfo.MaxStackCount})</label>
                  <input
                    type="number"
                    min={1}
                    max={itemInfo.MaxStackCount}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.min(parseInt(e.target.value) || 1, itemInfo.MaxStackCount))}
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
                  <input
                    type="number"
                    min={0}
                    max={safeMode ? maxUpgrade : 9999}
                    value={upgradeLevel}
                    onChange={(e) => setUpgradeLevel(safeMode ? Math.min(parseInt(e.target.value) || 0, maxUpgrade) : (parseInt(e.target.value) || 0))}
                  />
                </div>
              )}
            </>
          )}

          {hasDurability && (
            <div className="form-group">
              <label>Durability</label>
              <input
                type="number"
                min={0}
                max={9999}
                value={durability}
                onChange={(e) => setDurability(parseInt(e.target.value) || 0)}
              />
            </div>
          )}

          <div className="info-text">
            Slot Index: {item.slotIndex}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="create-button" onClick={handleUpdate}>
            Update
          </button>
        </div>
      </div>
    </div>
  );
};
