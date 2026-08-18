import React, { useState, useEffect, useRef } from 'react';
import { Inventory, ItemInfusion, InventoryItem } from '../lib/Inventory';
import type { Item } from '../../../shared/items';
import { NumberInput } from './NumberInput';
import { t } from '../lib/i18n';
import { useLang } from '../../../core/context/LanguageContext';
import { applyChineseNames } from '../lib/itemNamesZh';

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
  const { lang } = useLang();
  const itemInfo = item.itemInfo;
  // For Estus Flask: if empty, quantity must be 0; if not empty, use current quantity or default to 20
  const initialQuantity = itemInfo?.name?.includes('Estus Flask') 
    ? (itemInfo.name.includes('(empty)') ? 0 : (item.quantity || 20))
    : item.quantity;
  const [quantity, setQuantity] = useState<number>(initialQuantity);
  const [upgradeLevel, setUpgradeLevel] = useState<number>(item.upgradeLevel);
  const [infusion, setInfusion] = useState<ItemInfusion>(item.infusion);
  const [durability, setDurability] = useState<number>(item.durability);
  const [maxUpgrade, setMaxUpgrade] = useState<number>(0);
  const [selectedEstusFlask, setSelectedEstusFlask] = useState<Item | null>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const dialogBodyRef = useRef<HTMLDivElement>(null);

  const isPyromancyFlame = itemInfo?.name === 'Pyromancy Flame' || itemInfo?.name === 'Pyromancy Flame (Ascended)';
  const isEstusFlask = itemInfo?.name?.includes('Estus Flask');
  const isEstusFlaskEmpty = isEstusFlask && itemInfo?.name?.includes('(empty)');

  useEffect(() => {
    if (isPyromancyFlame) {
      // Pyromancy Flame special logic: can upgrade from 0 to 15 for base, 0 to 5 for ascended
      if (itemInfo?.name === 'Pyromancy Flame (Ascended)') {
        setMaxUpgrade(5);
      } else {
        setMaxUpgrade(15);
      }
    } else if (itemInfo && itemInfo.maxUpgrade !== undefined) {
      let max: number;
      if (safeMode) {
        max = Inventory.getMaxUpgradeForInfusion(itemInfo.maxUpgrade, infusion);
      } else {
        // In unsafe mode, allow max upgrade based on item's absolute max
        max = itemInfo.maxUpgrade;
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
        item.itemType = selectedEstusFlask.typeNibble;
        item.itemId = selectedEstusFlask.id;
        // For empty Estus Flask, quantity must be 0, otherwise use the specified quantity
        if (selectedEstusFlask.name?.includes('(empty)')) {
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
      inventory.syncEquipmentSlots(item.slotIndex);
      onItemUpdated();
      onClose();
    } catch (error) {
      alert(`Error updating item: ${error}`);
    }
  };

  const canUpgrade = isPyromancyFlame || (itemInfo?.maxUpgrade !== undefined && itemInfo.maxUpgrade > 0);
  const canInfuse = safeMode ? (itemInfo?.canInfuse === true && !isPyromancyFlame) : !isPyromancyFlame;
  const canStack = itemInfo && itemInfo.stackMax > 1;
  const hasDurability = (item.collectionType === 'Weapon' || item.collectionType === 'Armor') && itemInfo?.durability !== undefined;

  // Get all Estus Flask variants
  const getEstusFlaskVariants = (): Item[] => {
    return inventory
      .getCatalog()
      .byCollection('usable_items')
      .filter(i => i.name.includes('Estus Flask'));
  };

  const estusFlaskVariants = isEstusFlask ? getEstusFlaskVariants() : [];

  // Apply Chinese names when language is Chinese
  useEffect(() => {
    if (lang === 'zh') {
      applyChineseNames(inventory.getCatalog());
    }
  }, [lang, inventory]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Scroll to quantity field when dialog opens (if quantity field exists)
  useEffect(() => {
    // Check if quantity field should be visible
    const shouldHaveQuantity = canStack || (isEstusFlask && (!selectedEstusFlask ? !isEstusFlaskEmpty : !selectedEstusFlask.name?.includes('(empty)')));
    
    if (shouldHaveQuantity && quantityInputRef.current) {
      // Use setTimeout to ensure the DOM is updated
      setTimeout(() => {
        quantityInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [canStack, isEstusFlask, isEstusFlaskEmpty, selectedEstusFlask]);

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
          <h2>{t('editItemTitle', lang)}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-body" ref={dialogBodyRef}>
          <div className="form-group">
            <label>{t('itemName', lang)}</label>
            <div className="item-name-display">{item.itemName}</div>
          </div>

          {isEstusFlask ? (
            <>
              <div className="form-group">
                <label>{t('estusFlask', lang)}</label>
                <select
                  value={String(selectedEstusFlask?.id ?? itemInfo?.id ?? '')}
                  onChange={(e) => {
                    // Catalogue ids are numbers; the select carries them as strings.
                    const selected = estusFlaskVariants.find(v => String(v.id) === e.target.value);
                    setSelectedEstusFlask(selected || null);
                    // If empty variant selected, set quantity to 0, otherwise default to 20
                    if (selected) {
                      if (selected.name?.includes('(empty)')) {
                        setQuantity(0);
                      } else {
                        setQuantity(20);
                      }
                    }
                  }}
                >
                  <option value="">{t('keepCurrent', lang)}</option>
                  {estusFlaskVariants.map(variant => (
                    <option key={variant.id} value={variant.id}>
                      {variant.displayName || variant.name}
                    </option>
                  ))}
                </select>
              </div>
              {(() => {
                // Show quantity field if:
                // 1. No variant selected (Keep Current) and current item is not empty
                // 2. Variant selected and it's not empty
                const showQuantity = selectedEstusFlask
                  ? !selectedEstusFlask.name?.includes('(empty)')
                  : !isEstusFlaskEmpty;

                return showQuantity ? (
                  <div className="form-group">
                    <label>{t('quantity', lang)} (max: 20)</label>
                    <NumberInput
                      value={quantity}
                      onChange={setQuantity}
                      min={0}
                      max={20}
                    />
                  </div>
                ) : null;
              })()}
            </>
          ) : (
            <>
              {canStack && (
                <div className="form-group">
                  <label>{t('quantity', lang)} (max: {itemInfo.stackMax})</label>
                  <NumberInput
                    value={quantity}
                    onChange={setQuantity}
                    min={1}
                    max={itemInfo.stackMax}
                  />
                </div>
              )}

              {canInfuse && (
                <div className="form-group">
                  <label>{t('infusion', lang).replace(':', '')}</label>
                  <select value={infusion} onChange={(e) => setInfusion(parseInt(e.target.value) as ItemInfusion)}>
                    <option value={ItemInfusion.Standard}>{t('standard', lang)}</option>
                    <option value={ItemInfusion.Crystal}>{t('crystal', lang)}</option>
                    <option value={ItemInfusion.Lightning}>{t('lightning', lang)}</option>
                    <option value={ItemInfusion.Raw}>{t('raw', lang)}</option>
                    <option value={ItemInfusion.Magic}>{t('magic_inf', lang)}</option>
                    <option value={ItemInfusion.Enchanted}>{t('enchanted', lang)}</option>
                    <option value={ItemInfusion.Divine}>{t('divine', lang)}</option>
                    <option value={ItemInfusion.Occult}>{t('occult', lang)}</option>
                    <option value={ItemInfusion.Fire}>{t('fire', lang)}</option>
                    <option value={ItemInfusion.Chaos}>{t('chaos', lang)}</option>
                  </select>
                </div>
              )}

              {canUpgrade && (
                <div className="form-group">
                  <label>{t('upgradeLevel', lang)} (max: +{maxUpgrade})</label>
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

          {hasDurability && (
            <div className="form-group">
              <label>{t('durability', lang)}</label>
              <NumberInput
                value={durability}
                onChange={setDurability}
                min={0}
                max={9999}
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
