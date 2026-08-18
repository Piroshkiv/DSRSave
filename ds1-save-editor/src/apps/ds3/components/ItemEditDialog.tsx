import React, { useState, useEffect, useRef } from 'react';
import { DS3Inventory, DS3InventoryItem, ItemInfusion, ItemCollectionType } from '../lib/Inventory';
import { NumberInput } from '../../ds1/components/NumberInput';

interface ItemEditDialogProps {
  inventory: DS3Inventory;
  item: DS3InventoryItem;
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
  const [quantity, setQuantity] = useState(item.quantity);
  const [storageQty, setStorageQty] = useState(() => {
    try { return inventory.getStorageQuantity(item.baseItemId); } catch { return 0; }
  });
  const [upgradeLevel, setUpgradeLevel] = useState(item.upgradeLevel);
  const [infusion, setInfusion] = useState<ItemInfusion>(item.infusion);
  const dialogBodyRef = useRef<HTMLDivElement>(null);

  const maxUpgrade = itemInfo?.maxUpgrade ?? 0;
  const canUpgrade = item.collectionType === ItemCollectionType.Weapon && maxUpgrade > 0;
  const canInfuse = item.collectionType === ItemCollectionType.Weapon && (
    safeMode ? (itemInfo?.canInfuse === true) : true
  );
  const canStack = (itemInfo?.stackMax ?? 1) > 1;

  // Recalculate safe upgrade max when infusion changes
  const effectiveMaxUpgrade = (() => {
    if (!canUpgrade) return 0;
    if (safeMode && maxUpgrade === 10 && infusion !== ItemInfusion.Standard) return 10;
    return maxUpgrade;
  })();

  useEffect(() => {
    if (safeMode && upgradeLevel > effectiveMaxUpgrade) {
      setUpgradeLevel(effectiveMaxUpgrade);
    }
  }, [infusion, safeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lock body scroll
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, []);

  // Redirect scroll from overlay to dialog
  useEffect(() => {
    const body = dialogBodyRef.current;
    const overlay = body?.closest('.dialog-overlay');
    const content = body?.closest('.dialog-content');
    if (!body || !overlay || !content) return;
    const handler = (e: Event) => {
      if (!(e instanceof WheelEvent)) return;
      if (content.contains(e.target as HTMLElement)) return;
      e.preventDefault();
      e.stopPropagation();
      body.scrollBy({ top: e.deltaY, left: e.deltaX, behavior: 'auto' });
    };
    overlay.addEventListener('wheel', handler, { passive: false, capture: true });
    return () => overlay.removeEventListener('wheel', handler, { capture: true });
  }, []);

  const handleUpdate = () => {
    try {
      const clampedQty = Math.min(quantity, itemInfo?.stackMax ?? 1);
      inventory.editItem(item.slotIndex, clampedQty, upgradeLevel, infusion);
      if (canStack && itemInfo) {
        inventory.setStorageQuantity(itemInfo, storageQty);
      }
      onItemUpdated();
      onClose();
    } catch (err) {
      alert(`Error updating item: ${err}`);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <h2>Edit Item</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="dialog-body" ref={dialogBodyRef}>
          <div className="form-group">
            <label>Item Name</label>
            <div className="item-name-display">{item.itemName}</div>
          </div>

          {canStack && (
            <>
              <div className="form-group">
                <label>Quantity (max: {itemInfo!.stackMax})</label>
                <NumberInput
                  value={quantity}
                  onChange={setQuantity}
                  min={1}
                  max={itemInfo!.stackMax}
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
              <select value={infusion} onChange={e => setInfusion(parseInt(e.target.value) as ItemInfusion)}>
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
              <label>Upgrade Level (max: +{effectiveMaxUpgrade})</label>
              <NumberInput
                value={upgradeLevel}
                onChange={setUpgradeLevel}
                min={0}
                max={safeMode ? effectiveMaxUpgrade : 99}
              />
            </div>
          )}
        </div>
        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>Cancel</button>
          <button className="create-button" onClick={handleUpdate}>Update</button>
        </div>
      </div>
    </div>
  );
};
