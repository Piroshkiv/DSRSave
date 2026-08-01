import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import { applyChineseNames } from '../lib/itemNamesZh';
import { Inventory, ItemCollectionType, ItemInfusion, InventoryItem } from '../lib/Inventory';
import { ItemCreateDialog } from './ItemCreateDialog';
import { ItemEditDialog } from './ItemEditDialog';
import { NumberInput } from './NumberInput';

interface InventoryTabProps {
  character: Character;
  onCharacterUpdate: () => void;
  safeMode: boolean;
}

type SubTabType =
  | 'consumables'
  | 'materials'
  | 'key'
  | 'magic'
  | 'weapons'
  | 'armor'
  | 'ammunition'
  | 'rings';

const SUB_TAB_KEYS: Record<SubTabType, string> = {
  consumables: 'consumables',
  materials: 'materials',
  key: 'keyItems',
  magic: 'magic',
  weapons: 'weapons',
  armor: 'armor',
  ammunition: 'ammunition',
  rings: 'rings',
};

const SUB_TAB_TO_COLLECTION: Record<SubTabType, ItemCollectionType> = {
  consumables: ItemCollectionType.Usable,
  materials: ItemCollectionType.Material,
  key: ItemCollectionType.Key,
  magic: ItemCollectionType.Magic,
  weapons: ItemCollectionType.Weapon,
  armor: ItemCollectionType.Armor,
  ammunition: ItemCollectionType.Ammunition,
  rings: ItemCollectionType.Ring,
};

export const InventoryTab: React.FC<InventoryTabProps> = ({ character, onCharacterUpdate, safeMode }) => {
  const { lang } = useLang();
  const [inventory, setInventory] = useState(() => new Inventory(character));
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('consumables');
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [weaponLevel, setWeaponLevel] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [infusionFilter, setInfusionFilter] = useState<ItemInfusion | 'all'>('all');
  const [wlFilter, setWlFilter] = useState<number | 'all'>('all');
  const [showAddAllWLDialog, setShowAddAllWLDialog] = useState(false);
  const [addAllWL, setAddAllWL] = useState<number>(0);
  const [equippedSlots, setEquippedSlots] = useState<Map<number, string>>(new Map());
  const parentRef = useRef<HTMLDivElement>(null);
  const pendingScrollSlot = useRef<number | null>(null);

  const refreshItems = useCallback((inventoryInstance?: Inventory) => {
    const inv = inventoryInstance || inventory;
    if (!inv) return;
    
    const collectionType = SUB_TAB_TO_COLLECTION[activeSubTab];
    let filteredItems = inv.getItemsByType(collectionType);

    // Hide Fists and No armor items in safe mode
    if (safeMode) {
      const hiddenNames = ['Fists', 'No helm', 'No armor', 'No gauntlets', 'No legs'];
      filteredItems = filteredItems.filter(item => !hiddenNames.includes(item.itemName));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filteredItems = filteredItems.filter(item =>
        item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply infusion filter (only for weapons, armor)
    if (infusionFilter !== 'all' && (activeSubTab === 'weapons' || activeSubTab === 'armor')) {
      filteredItems = filteredItems.filter(item => item.infusion === infusionFilter);
    }

    // Apply WL filter (only for weapons)
    if (wlFilter !== 'all' && activeSubTab === 'weapons') {
      filteredItems = filteredItems.filter(item => {
        const itemWL = inv.getWeaponLevel(item);
        return itemWL === wlFilter;
      });
    }

    setItems(filteredItems);
    setWeaponLevel(inv.weaponLevel);
    setEquippedSlots(inv.getEquippedWeaponSlots());
  }, [inventory, activeSubTab, safeMode, searchQuery, infusionFilter, wlFilter]);

  // Recreate inventory when character changes
  useEffect(() => {
    const newInventory = new Inventory(character);
    setInventory(newInventory);
    
    const loadInventory = async () => {
      setLoading(true);
      try {
        await newInventory.loadItemsDatabase();
        // Apply Chinese names if language is Chinese
        if (lang === 'zh') {
          const db = newInventory.getItemsDatabase();
          if (db) await applyChineseNames(db);
        }
        // Refresh items after loading database
        const collectionType = SUB_TAB_TO_COLLECTION[activeSubTab];
        let filteredItems = newInventory.getItemsByType(collectionType);

        // Hide Fists and No armor items in safe mode
        if (safeMode) {
          const hiddenNames = ['Fists', 'No helm', 'No armor', 'No gauntlets', 'No legs'];
          filteredItems = filteredItems.filter(item => !hiddenNames.includes(item.itemName));
        }

        // Apply search filter
        if (searchQuery.trim()) {
          filteredItems = filteredItems.filter(item =>
            item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        // Apply infusion filter (only for weapons, armor)
        if (infusionFilter !== 'all' && (activeSubTab === 'weapons' || activeSubTab === 'armor')) {
          filteredItems = filteredItems.filter(item => item.infusion === infusionFilter);
        }

        // Apply WL filter (only for weapons)
        if (wlFilter !== 'all' && activeSubTab === 'weapons') {
          filteredItems = filteredItems.filter(item => {
            const itemWL = newInventory.getWeaponLevel(item);
            return itemWL === wlFilter;
          });
        }

        setItems(filteredItems);
        setWeaponLevel(newInventory.weaponLevel);
        setEquippedSlots(newInventory.getEquippedWeaponSlots());
      } catch (error) {
        console.error('Error loading inventory:', error);
        alert(`Failed to load items database: ${error instanceof Error ? error.message : String(error)}\n\nPlease ensure items.json is available.`);
        setItems([]);
        setWeaponLevel(0);
      } finally {
        setLoading(false);
      }
    };
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);

  useEffect(() => {
    if (!loading && inventory) {
      refreshItems();
    }
  }, [activeSubTab, loading, searchQuery, infusionFilter, wlFilter, safeMode, inventory, refreshItems]);

  // Apply Chinese names when language changes
  useEffect(() => {
    if (!loading && inventory) {
      const db = inventory.getItemsDatabase();
      if (db) {
        if (lang === 'zh') {
          applyChineseNames(db).then(() => refreshItems());
        } else {
          // Reset to English names
          for (const cat of Object.values(db)) {
            if (Array.isArray(cat)) {
              for (const item of cat) {
                item.displayName = undefined;
              }
            }
          }
          refreshItems();
        }
      }
    }
  }, [lang]);

  // Scroll to newly added item after items state updates
  useEffect(() => {
    if (pendingScrollSlot.current === null) return;
    const idx = items.findIndex(item => item.slotIndex === pendingScrollSlot.current);
    if (idx >= 0) virtualizer.scrollToIndex(idx, { behavior: 'smooth' });
    pendingScrollSlot.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10,
    measureElement: el => el.getBoundingClientRect().height,
  });

  const handleItemCreated = (slotIndex: number | null) => {
    if (safeMode) {
      inventory.calibrateWeaponLevel();
    }
    if (slotIndex !== null) pendingScrollSlot.current = slotIndex;
    refreshItems();
    onCharacterUpdate();
  };

  const handleDeleteItem = (slotIndex: number) => {
    if (confirm(t('deleteConfirm', lang))) {
      inventory.deleteItem(slotIndex);
      refreshItems();
      onCharacterUpdate();
    }
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
  };

  const handleItemUpdated = () => {
    if (safeMode) {
      inventory.calibrateWeaponLevel();
    }
    refreshItems();
    onCharacterUpdate();
  };

  const handleWeaponLevelChange = (numValue: number) => {
    inventory.weaponLevel = numValue;
    setWeaponLevel(numValue);
    onCharacterUpdate();
  };

  const handleCalibrateWL = () => {
    const calibratedWL = inventory.calibrateWeaponLevel(true);
    setWeaponLevel(calibratedWL);
    setSearchQuery('');
    setWlFilter(calibratedWL);
    onCharacterUpdate();
  };

  const handleAddAll = () => {
    if (activeSubTab === 'weapons') {
      setAddAllWL(weaponLevel);
      setShowAddAllWLDialog(true);
    } else {
      const collectionType = SUB_TAB_TO_COLLECTION[activeSubTab];
      inventory.addAllItems(collectionType);
      refreshItems();
      onCharacterUpdate();
    }
  };

  const handleConfirmAddAllWeapons = () => {
    inventory.addAllItems(ItemCollectionType.Weapon, addAllWL);
    if (safeMode) {
      inventory.calibrateWeaponLevel();
    }
    refreshItems();
    onCharacterUpdate();
    setShowAddAllWLDialog(false);
  };

  const getInfusionName = (infusion: ItemInfusion): string => {
    switch (infusion) {
      case ItemInfusion.Standard: return '';
      case ItemInfusion.Crystal: return t('crystal', lang);
      case ItemInfusion.Lightning: return t('lightning', lang);
      case ItemInfusion.Raw: return t('raw', lang);
      case ItemInfusion.Magic: return t('magic_inf', lang);
      case ItemInfusion.Enchanted: return t('enchanted', lang);
      case ItemInfusion.Divine: return t('divine', lang);
      case ItemInfusion.Occult: return t('occult', lang);
      case ItemInfusion.Fire: return t('fire', lang);
      case ItemInfusion.Chaos: return t('chaos', lang);
      default: return '';
    }
  };

  const formatItemDisplay = (item: InventoryItem): string => {
    const infusionStr = item.infusion !== ItemInfusion.Standard ? `${getInfusionName(item.infusion)} ` : '';
    const upgradeStr = item.upgradeLevel > 0 ? ` +${item.upgradeLevel}` : '';
    return `${infusionStr}${item.itemName}${upgradeStr}`;
  };

  if (loading) {
    return (
      <div className="inventory-tab">
        <div className="loading">{t('loadingInventory', lang)}</div>
      </div>
    );
  }

  return (
    <div className="inventory-tab">
      <div className="inventory-header">
        <button className="create-item-button" onClick={() => setShowCreateDialog(true)}>
          {t('createItem', lang)}
        </button>
        <button className="create-item-button add-all-button" onClick={handleAddAll}>
          {t('addAll', lang)}
        </button>
        <button className="delete-button clear-all-button" onClick={() => {
          const collectionType = SUB_TAB_TO_COLLECTION[activeSubTab];
          inventory.clearAllItems(collectionType);
          refreshItems();
          onCharacterUpdate();
        }}>
          {t('clearAll', lang)}
        </button>

        <div className="inventory-search">
          <input
            type="text"
            placeholder={t('searchItems', lang)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {(activeSubTab === 'weapons' || activeSubTab === 'armor') && (
          <div className="filter-group">
            <label>{t('infusion', lang)}</label>
            <select
              value={infusionFilter}
              onChange={(e) => setInfusionFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as ItemInfusion)}
              className="filter-select"
            >
              <option value="all">{t('all', lang)}</option>
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

        {activeSubTab === 'weapons' && (
          <>
            <div className="filter-group">
              <label>{t('wl', lang)}</label>
              <select
                value={wlFilter}
                onChange={(e) => setWlFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="filter-select"
              >
                <option value="all">{t('all', lang)}</option>
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            <div className="weapon-level-display">
              <label>{t('weaponLevel', lang)}</label>
              <NumberInput
                value={weaponLevel}
                onChange={handleWeaponLevelChange}
                min={0}
                max={15}
                disabled={safeMode}
              />
              <button
                className="calibrate-button"
                onClick={handleCalibrateWL}
                title={t('calibrateWL', lang)}
              >
                {t('calibrateWL', lang)}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="sub-tabs">
        {(Object.keys(SUB_TAB_KEYS) as SubTabType[]).map((subTab) => (
          <button
            key={subTab}
            className={`sub-tab ${activeSubTab === subTab ? 'active' : ''}`}
            onClick={() => setActiveSubTab(subTab)}
          >
            {t(SUB_TAB_KEYS[subTab], lang)}
          </button>
        ))}
      </div>

      <div className="inventory-content" ref={parentRef}>
        {items.length === 0 ? (
          <div className="no-items">{t('noItems', lang)}</div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    paddingBottom: '2px',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                <div className="item-row">
                  <div className="item-info">
                    <span className="item-name">{formatItemDisplay(item)}</span>
                    <div className="item-details">
                      {item.quantity > 1 && (
                        <span className="item-detail">Qty: {item.quantity}</span>
                      )}
                      {item.infusion !== ItemInfusion.Standard && (
                        <span className="item-detail">{getInfusionName(item.infusion)}</span>
                      )}
                      {equippedSlots.has(item.slotIndex) && (
                        <span className="item-detail item-detail-equipped">{equippedSlots.get(item.slotIndex)}</span>
                      )}
                    </div>
                  </div>
                  <div className="item-actions">
                    <button className="edit-button" onClick={() => handleEditItem(item)}>{t('edit', lang)}</button>
                    <button className="delete-button" onClick={() => handleDeleteItem(item.slotIndex)}>{t('delete', lang)}</button>
                  </div>
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateDialog && (
        <ItemCreateDialog
          inventory={inventory}
          collectionType={SUB_TAB_TO_COLLECTION[activeSubTab]}
          onClose={() => setShowCreateDialog(false)}
          onItemCreated={handleItemCreated}
          safeMode={safeMode}
        />
      )}

      {editingItem && (
        <ItemEditDialog
          inventory={inventory}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onItemUpdated={handleItemUpdated}
          safeMode={safeMode}
        />
      )}

      {showAddAllWLDialog && (
        <div className="dialog-overlay" onClick={() => setShowAddAllWLDialog(false)}>
          <div className="dialog-content dialog-content-small" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>Add All Weapons</h2>
              <button className="close-button" onClick={() => setShowAddAllWLDialog(false)}>×</button>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Target Weapon Level (0–15)</label>
                <select
                  value={addAllWL}
                  onChange={(e) => setAddAllWL(parseInt(e.target.value))}
                  className="filter-select"
                >
                  {Array.from({ length: 16 }, (_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <p className="info-text">
                Each weapon will be added at the highest upgrade level that keeps its WL at or below the selected value.
                Weapons whose minimum WL exceeds this value will be skipped.
              </p>
            </div>
            <div className="dialog-footer">
              <button className="cancel-button" onClick={() => setShowAddAllWLDialog(false)}>Cancel</button>
              <button className="create-button" onClick={handleConfirmAddAllWeapons}>Add All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
