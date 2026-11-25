import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Character } from '../lib/Character';
import { useLang } from '../../../core/context/LanguageContext';
import { t } from '../lib/i18n';
import { applyChineseNames } from '../lib/itemNamesZh';
import { Inventory, ItemCollectionType, ItemInfusion, InventoryItem, RepositoryItem } from '../lib/Inventory';
import { ItemCreateDialog } from './ItemCreateDialog';
import { ItemEditDialog } from './ItemEditDialog';
import { ItemIcon } from './ItemIcon';
import { NumberInput } from './NumberInput';
import { matchesItemSearch } from '../../../shared/items';

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

/**
 * Tabs whose items the real Bottomless Box accepts. Unlike stackable goods
 * (which live in the inventory and the box at once, as two independent
 * quantities), a weapon/ring/piece of armor is in exactly one of the two —
 * hence the separate "Bottomless Box" section with move-to/-from buttons,
 * rather than a second quantity field like the stackable tabs get.
 */
const BOX_ELIGIBLE_TABS: SubTabType[] = ['weapons', 'armor', 'rings'];

export const InventoryTab: React.FC<InventoryTabProps> = ({ character, onCharacterUpdate, safeMode }) => {
  const { lang } = useLang();
  const [inventory, setInventory] = useState(() => new Inventory(character));
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [boxItems, setBoxItems] = useState<RepositoryItem[]>([]);
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
      filteredItems = filteredItems.filter(item => matchesItemSearch(item.itemName, searchQuery));
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

    if (BOX_ELIGIBLE_TABS.includes(activeSubTab)) {
      let boxFiltered = inv.getStorageItemsByType(collectionType);
      if (searchQuery.trim()) {
        boxFiltered = boxFiltered.filter(item => matchesItemSearch(item.itemName, searchQuery));
      }
      setBoxItems(boxFiltered);
    } else {
      setBoxItems([]);
    }
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
          await applyChineseNames(newInventory.getCatalog());
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
          filteredItems = filteredItems.filter(item => matchesItemSearch(item.itemName, searchQuery));
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

        if (BOX_ELIGIBLE_TABS.includes(activeSubTab)) {
          let boxFiltered = newInventory.getStorageItemsByType(collectionType);
          if (searchQuery.trim()) {
            boxFiltered = boxFiltered.filter(item => matchesItemSearch(item.itemName, searchQuery));
          }
          setBoxItems(boxFiltered);
        } else {
          setBoxItems([]);
        }
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
    if (loading || !inventory) return;

    const catalog = inventory.getCatalog();
    if (lang === 'zh') {
      applyChineseNames(catalog).then(() => refreshItems());
    } else {
      catalog.clearDisplayNames();
      refreshItems();
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

  const handleMoveToBox = (item: InventoryItem) => {
    if (equippedSlots.has(item.slotIndex)) {
      alert(t('cannotMoveEquipped', lang));
      return;
    }
    const moved = inventory.moveToStorage(item.slotIndex, item.quantity);
    if (moved === null) {
      alert(t('bottomlessBox', lang) + ': full or nothing to move.');
      return;
    }
    refreshItems();
    onCharacterUpdate();
  };

  const handleMoveToInventory = (item: RepositoryItem) => {
    const moved = inventory.moveFromStorage(item.slotIndex, item.quantity);
    if (moved === null) {
      alert(t('createItem', lang) + ': inventory full or nothing to move.');
      return;
    }
    refreshItems();
    onCharacterUpdate();
  };

  const handleDeleteBoxItem = (slotIndex: number) => {
    if (confirm(t('deleteConfirm', lang))) {
      inventory.removeStorageItem(slotIndex);
      refreshItems();
      onCharacterUpdate();
    }
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

  const formatItemDisplay = (item: Pick<InventoryItem, 'itemName' | 'infusion' | 'upgradeLevel'>): string => {
    const infusionStr = item.infusion !== ItemInfusion.Standard ? `${getInfusionName(item.infusion)} ` : '';
    const upgradeStr = item.upgradeLevel > 0 ? ` +${item.upgradeLevel}` : '';
    return `${infusionStr}${item.itemName}${upgradeStr}`;
  };

  const getBoxQty = (item: InventoryItem): number => {
    const info = item.itemInfo;
    return info ? inventory.getStorageQuantityFor(info) : 0;
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
        {activeSubTab === 'weapons' && (
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
              className="toolbar-button"
              onClick={handleCalibrateWL}
              title={t('calibrateWL', lang)}
            >
              {t('calibrateWL', lang)}
            </button>
          </div>
        )}

        <div className="inventory-controls-right">
          <button className="toolbar-button" onClick={() => {
            const collectionType = SUB_TAB_TO_COLLECTION[activeSubTab];
            inventory.clearAllItems(collectionType);
            refreshItems();
            onCharacterUpdate();
          }}>
            {t('clearAll', lang)}
          </button>
          <button className="toolbar-button" onClick={() => setShowCreateDialog(true)}>
            {t('createItem', lang)}
          </button>
          <button className="toolbar-button toolbar-button-accent" onClick={handleAddAll}>
            {t('addAll', lang)}
          </button>
        </div>
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

      <div className="inventory-filters">
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
        )}
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
                    <ItemIcon typeNibble={item.itemType} itemId={item.baseItemId} size={44} />
                    <div className="item-info-text">
                      <span className="item-name">{formatItemDisplay(item)}</span>
                      <div className="item-details">
                        {item.quantity > 1 && (
                          <span className="item-detail">
                            Qty: {item.quantity}
                            {item.itemInfo && item.itemInfo.stackMax > 1 && getBoxQty(item) > 0
                              ? ` / ${t('destBox', lang)}: ${getBoxQty(item)}`
                              : ''}
                          </span>
                        )}
                        {item.infusion !== ItemInfusion.Standard && (
                          <span className="item-detail">{getInfusionName(item.infusion)}</span>
                        )}
                        {equippedSlots.has(item.slotIndex) && (
                          <span className="item-detail item-detail-equipped">{equippedSlots.get(item.slotIndex)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="item-actions">
                    {BOX_ELIGIBLE_TABS.includes(activeSubTab) && (
                      <button
                        className="move-button"
                        onClick={() => handleMoveToBox(item)}
                        disabled={equippedSlots.has(item.slotIndex)}
                        title={equippedSlots.has(item.slotIndex) ? t('cannotMoveEquipped', lang) : t('destBox', lang)}
                      >
                        {t('moveToBox', lang)}
                      </button>
                    )}
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

      {BOX_ELIGIBLE_TABS.includes(activeSubTab) && (
        <div className="bottomless-box-section">
          <h3>{t('bottomlessBox', lang)}</h3>
          {boxItems.length === 0 ? (
            <div className="no-items">{t('noItems', lang)}</div>
          ) : (
            <div className="box-items-list">
              {boxItems.map((item) => (
                <div className="item-row" key={item.slotIndex}>
                  <div className="item-info">
                    <ItemIcon typeNibble={item.itemType} itemId={item.baseItemId} size={44} />
                    <div className="item-info-text">
                      <span className="item-name">{formatItemDisplay(item)}</span>
                      <div className="item-details">
                        {item.quantity > 1 && <span className="item-detail">Qty: {item.quantity}</span>}
                        {item.infusion !== ItemInfusion.Standard && (
                          <span className="item-detail">{getInfusionName(item.infusion)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="item-actions">
                    <button className="move-button" onClick={() => handleMoveToInventory(item)} title={t('destInventory', lang)}>
                      {t('moveToInventory', lang)}
                    </button>
                    <button className="delete-button" onClick={() => handleDeleteBoxItem(item.slotIndex)}>{t('delete', lang)}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
