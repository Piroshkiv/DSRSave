import React, { useState, useEffect, useRef } from 'react';
import { Inventory, ItemCollectionType, ItemInfusion, COLLECTION_FOR_TYPE } from '../lib/Inventory';
import { matchesItemSearch, type Item } from '../../../shared/items';
import { useLang } from '../../../core/context/LanguageContext';
import { applyChineseNames } from '../lib/itemNamesZh';
import { NumberInput } from './NumberInput';
import { t } from '../lib/i18n';

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
  const { lang } = useLang();

  useEffect(() => {
    const catalog = inventory.getCatalog();
    if (catalog.isEmpty) return;

    // Names to hide in safe mode: Fists, No helm, No armor, No gauntlets, No legs
    const hiddenNames = ['Fists', 'No helm', 'No armor', 'No gauntlets', 'No legs'];

    const collection = COLLECTION_FOR_TYPE[collectionType];
    const all = collection ? catalog.byCollection(collection) : [];
    const items = safeMode
      ? all.filter(item => item.safe && !hiddenNames.includes(item.name))
      : [...all];

    // Chinese names are an overlay on the catalogue entries themselves, so the
    // list only needs re-rendering once the overlay has been applied.
    if (lang === 'zh') {
      applyChineseNames(catalog).then(() => setAvailableItems([...items]));
    } else {
      setAvailableItems(items);
    }
  }, [collectionType, safeMode, lang, inventory]);

  useEffect(() => {
    if (selectedItem) {
      // Special handling for Pyromancy Flame
      const isPyromancyFlame = selectedItem.name === 'Pyromancy Flame' || selectedItem.name === 'Pyromancy Flame (Ascended)';
      if (isPyromancyFlame) {
        // Pyromancy Flame special logic: can upgrade from 0 to 15 for base, 0 to 5 for ascended
        if (selectedItem.name === 'Pyromancy Flame (Ascended)') {
          setMaxUpgrade(5);
        } else {
          setMaxUpgrade(15);
        }
      } else if (selectedItem.maxUpgrade !== undefined) {
        let max: number;
        if (safeMode) {
          max = Inventory.getMaxUpgradeForInfusion(selectedItem.maxUpgrade, infusion);
        } else {
          // In unsafe mode, allow max upgrade based on item's absolute max
          max = selectedItem.maxUpgrade;
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
    if (item.name?.includes('Estus Flask')) {
      if (item.name?.includes('(empty)')) {
        setQuantity(0);
      } else {
        setQuantity(20);
      }
    } else {
      setQuantity(Math.min(1, item.stackMax));
    }
    setUpgradeLevel(0);
    setInfusion(ItemInfusion.Standard);
    if (item.durability !== undefined) {
      setDurability(item.durability);
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
      alert(`${t('errorCreatingItem', lang)} ${error}`);
    }
  };

  const isPyromancyFlame = selectedItem?.name === 'Pyromancy Flame' || selectedItem?.name === 'Pyromancy Flame (Ascended)';
  const isEstusFlask = selectedItem?.name?.includes('Estus Flask');
  const isEstusFlaskEmpty = isEstusFlask && selectedItem?.name?.includes('(empty)');
  const canUpgrade = isPyromancyFlame || (selectedItem?.maxUpgrade !== undefined && selectedItem.maxUpgrade > 0);
  const canInfuse = safeMode ? (selectedItem?.canInfuse === true && !isPyromancyFlame) : !isPyromancyFlame;
  const canStack = selectedItem && selectedItem.stackMax > 1;
  const hasDurability = selectedItem?.durability !== undefined &&
    (collectionType === ItemCollectionType.Weapon || collectionType === ItemCollectionType.Armor);

  const filteredItems = availableItems.filter((item) =>
    matchesItemSearch(item.displayName || item.name, searchQuery) ||
    matchesItemSearch(item.name, searchQuery)
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
          <h2>{t('createItemTitle', lang)}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="dialog-body" ref={dialogBodyRef}>
          <div className="form-group">
            <label>{t('searchItem', lang)}</label>
            <input
              type="text"
              placeholder={t('typeToSearch', lang)}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="form-group">
            <label>{t('selectItem', lang)}</label>
            <div className="items-select-list">
              {filteredItems.map((item) => (
                <div
                  key={item.key}
                  className={`item-select-option ${selectedItem === item ? 'selected' : ''}`}
                  onClick={() => handleItemSelect(item)}
                >
                  {item.displayName}
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
                      ? `${t('quantity', lang)} ${isEstusFlaskEmpty ? `(${t('estusFlaskEmpty', lang)})` : '(max: 20)'}`
                      : `${t('quantity', lang)} (max: ${selectedItem.stackMax})`
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
                    max={isEstusFlask ? 20 : selectedItem.stackMax}
                    disabled={isEstusFlaskEmpty}
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
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="cancel-button" onClick={onClose}>
            {t('cancel', lang)}
          </button>
          <button
            className="create-button"
            onClick={handleCreate}
            disabled={!selectedItem}
          >
            {t('create', lang)}
          </button>
        </div>
      </div>
    </div>
  );
};
