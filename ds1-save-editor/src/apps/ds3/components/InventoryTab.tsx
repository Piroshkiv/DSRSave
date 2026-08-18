import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DS3Character } from '../lib/Character';
import { DS3Inventory, ItemCollectionType, DS3InventoryItem, ItemInfusion } from '../lib/Inventory';
import { ItemCreateDialog } from './ItemCreateDialog';
import { ItemEditDialog } from './ItemEditDialog';
import { NumberInput } from '../../ds1/components/NumberInput';
import { matchesItemSearch } from '../../../shared/items';

interface InventoryTabProps {
  character: DS3Character;
  onCharacterUpdate: () => void;
  safeMode: boolean;
}

type SubTabType = 'consumables' | 'magic' | 'weapons' | 'armor' | 'ores' | 'ammunition' | 'rings' | 'key' | 'covenants';

const SUB_TAB_LABELS: Record<SubTabType, string> = {
  consumables: 'Consumables',
  magic: 'Magic',
  weapons: 'Weapons',
  armor: 'Armor',
  ores: 'Ores',
  ammunition: 'Ammunition',
  rings: 'Rings',
  key: 'Key Items',
  covenants: 'Covenants',
};

const SUB_TAB_TO_COLLECTION: Record<SubTabType, ItemCollectionType> = {
  consumables: ItemCollectionType.Consumable,
  magic: ItemCollectionType.Magic,
  weapons: ItemCollectionType.Weapon,
  armor: ItemCollectionType.Armor,
  ores: ItemCollectionType.Ore,
  ammunition: ItemCollectionType.Ammunition,
  rings: ItemCollectionType.Ring,
  key: ItemCollectionType.Key,
  covenants: ItemCollectionType.Covenant,
};

export const InventoryTab: React.FC<InventoryTabProps> = ({ character, onCharacterUpdate, safeMode }) => {
  const [inventory, setInventory] = useState(() => new DS3Inventory(character));
  const [items, setItems] = useState<DS3InventoryItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('consumables');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [infusionFilter, setInfusionFilter] = useState<ItemInfusion | 'all'>('all');
  const [upgradeFilter, setUpgradeFilter] = useState<number | 'all'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<DS3InventoryItem | null>(null);
  const [weaponMemory, setWeaponMemory] = useState<number>(0);
  const [showAddAllWLDialog, setShowAddAllWLDialog] = useState(false);
  const [addAllWL, setAddAllWL] = useState<number>(0);

  const parentRef = useRef<HTMLDivElement>(null);
  const pendingScrollSlot = useRef<number | null>(null);

  // Weapons with MaxUpgrade=5 count each level as 2 WL (so +5 = WL 10)
  const getEffectiveWL = (item: DS3InventoryItem): number => {
    const maxUp = item.itemInfo?.maxUpgrade ?? 10;
    return item.upgradeLevel * (maxUp === 5 ? 2 : 1);
  };

  const refreshItems = useCallback((inv?: DS3Inventory) => {
    const instance = inv || inventory;
    if (!instance) return;
    setWeaponMemory(instance.weaponMemory);
    const collectionType = SUB_TAB_TO_COLLECTION[activeSubTab];
    let filtered = instance.getItemsByType(collectionType);

    if (safeMode) {
      filtered = filtered.filter(item => {
        if (item.itemInfo?.safe === false) return false;
        const n = item.itemName;
        return !n.startsWith('Unknown (') && n !== 'Fists' && n !== 'Fist';
      });
    }

    if (searchQuery.trim()) {
      filtered = filtered.filter(item => matchesItemSearch(item.itemName, searchQuery));
    }

    if (infusionFilter !== 'all' && activeSubTab === 'weapons') {
      filtered = filtered.filter(item => item.infusion === infusionFilter);
    }

    if (upgradeFilter !== 'all' && activeSubTab === 'weapons') {
      filtered = filtered.filter(item => getEffectiveWL(item) === upgradeFilter);
    }

    setItems(filtered);
  }, [inventory, activeSubTab, safeMode, searchQuery, infusionFilter, upgradeFilter]);

  useEffect(() => {
    const newInventory = new DS3Inventory(character);
    setInventory(newInventory);
    const load = async () => {
      setLoading(true);
      try {
        await newInventory.loadItemsDatabase();
        refreshItems(newInventory);
      } catch (err) {
        console.error(err);
        alert(`Failed to load DS3 items database: ${err instanceof Error ? err.message : String(err)}`);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);

  useEffect(() => {
    if (!loading && inventory) refreshItems();
  }, [activeSubTab, loading, searchQuery, infusionFilter, upgradeFilter, safeMode, inventory, refreshItems]);

  // Scroll to a newly added item after items state updates
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
    if (slotIndex !== null) pendingScrollSlot.current = slotIndex;
    inventory.calibrateWeaponMemory();
    refreshItems();
    onCharacterUpdate();
  };

  const handleDeleteItem = (slotIndex: number) => {
    inventory.deleteItem(slotIndex);
    refreshItems();
    onCharacterUpdate();
  };

  const handleItemUpdated = () => {
    inventory.calibrateWeaponMemory();
    refreshItems();
    onCharacterUpdate();
  };

  const handleAddAll = () => {
    if (activeSubTab === 'weapons') {
      setAddAllWL(weaponMemory);
      setShowAddAllWLDialog(true);
    } else {
      inventory.addAllItems(SUB_TAB_TO_COLLECTION[activeSubTab]);
      refreshItems();
      onCharacterUpdate();
    }
  };

  const handleConfirmAddAllWeapons = () => {
    inventory.addAllItems(ItemCollectionType.Weapon, addAllWL);
    inventory.calibrateWeaponMemory();
    setWeaponMemory(inventory.weaponMemory);
    refreshItems();
    onCharacterUpdate();
    setShowAddAllWLDialog(false);
  };

  const handleClearAll = () => {
    inventory.clearAllItems(SUB_TAB_TO_COLLECTION[activeSubTab]);
    refreshItems();
    onCharacterUpdate();
  };

  const handleWeaponMemoryChange = (numValue: number) => {
    inventory.weaponMemory = numValue;
    setWeaponMemory(numValue);
    onCharacterUpdate();
  };

  const handleCalibrateWM = () => {
    const calibrated = inventory.calibrateWeaponMemory(true);
    setWeaponMemory(calibrated);
    onCharacterUpdate();
  };

  const getInfusionName = (inf: ItemInfusion): string => {
    const names: Record<number, string> = {
      [ItemInfusion.Standard]: '',
      [ItemInfusion.Heavy]: 'Heavy',
      [ItemInfusion.Sharp]: 'Sharp',
      [ItemInfusion.Refined]: 'Refined',
      [ItemInfusion.Simple]: 'Simple',
      [ItemInfusion.Crystal]: 'Crystal',
      [ItemInfusion.Fire]: 'Fire',
      [ItemInfusion.Chaos]: 'Chaos',
      [ItemInfusion.Lightning]: 'Lightning',
      [ItemInfusion.Deep]: 'Deep',
      [ItemInfusion.Dark]: 'Dark',
      [ItemInfusion.Poison]: 'Poison',
      [ItemInfusion.Blood]: 'Blood',
      [ItemInfusion.Raw]: 'Raw',
      [ItemInfusion.Blessed]: 'Blessed',
      [ItemInfusion.Hollow]: 'Hollow',
    };
    return names[inf] ?? '';
  };

  const formatItemDisplay = (item: DS3InventoryItem): string => {
    const infStr = item.infusion !== ItemInfusion.Standard ? `${getInfusionName(item.infusion)} ` : '';
    const upStr = item.upgradeLevel > 0 ? ` +${item.upgradeLevel}` : '';
    return `${infStr}${item.itemName}${upStr}`;
  };

  const getStorageQty = (item: DS3InventoryItem): number => {
    try {
      return inventory.getStorageQuantity(item.baseItemId);
    } catch {
      return 0;
    }
  };

  const showQtyColumn = activeSubTab !== 'weapons' && activeSubTab !== 'armor' && activeSubTab !== 'rings';

  if (loading) {
    return <div className="inventory-tab"><div className="loading">Loading inventory...</div></div>;
  }

  return (
    <div className="inventory-tab">
      <div className="inventory-header">
        <button className="create-item-button" onClick={() => setShowCreateDialog(true)}>
          + Create Item
        </button>
        <button className="create-item-button add-all-button" onClick={handleAddAll}>
          + Add All
        </button>
        <button className="delete-button clear-all-button" onClick={handleClearAll}>
          Clear All
        </button>

        <div className="inventory-search">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {activeSubTab === 'weapons' && (
          <div className="filter-group">
            <label>Infusion:</label>
            <select
              value={infusionFilter}
              onChange={e => setInfusionFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as ItemInfusion)}
              className="filter-select"
            >
              <option value="all">All</option>
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

        {activeSubTab === 'weapons' && (
          <div className="filter-group">
            <label>WL:</label>
            <select
              value={upgradeFilter}
              onChange={e => setUpgradeFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="filter-select"
            >
              <option value="all">All</option>
              {Array.from({ length: 11 }, (_, i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        )}

        {activeSubTab === 'weapons' && (
          <div className="weapon-level-display">
            <label>Weapon Memory:</label>
            <NumberInput
              value={weaponMemory}
              onChange={handleWeaponMemoryChange}
              min={0}
              max={10}
              disabled={safeMode}
            />
            <button
              className="calibrate-button"
              onClick={handleCalibrateWM}
              title="Calibrate Weapon Memory"
            >
              Calibrate
            </button>
          </div>
        )}
      </div>

      <div className="sub-tabs">
        {(Object.keys(SUB_TAB_LABELS) as SubTabType[]).map(tab => (
          <button
            key={tab}
            className={`sub-tab ${activeSubTab === tab ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab)}
          >
            {SUB_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="inventory-content" ref={parentRef}>
        {items.length === 0 ? (
          <div className="no-items">No items in this category</div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const item = items[virtualRow.index];
              const storageQty = getStorageQty(item);
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
                      {showQtyColumn && (
                        <span className="item-detail">Qty: {item.quantity} / {storageQty}</span>
                      )}
                    </div>
                  </div>
                  <div className="item-actions">
                    <button className="edit-button" onClick={() => setEditingItem(item)}>Edit</button>
                    <button className="delete-button" onClick={() => handleDeleteItem(item.slotIndex)}>Delete</button>
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
          <div className="dialog-content dialog-content-small" onClick={e => e.stopPropagation()}>
            <div className="dialog-header">
              <h2>Add All Weapons</h2>
              <button className="close-button" onClick={() => setShowAddAllWLDialog(false)}>×</button>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Target Weapon Level (0–10)</label>
                <select
                  value={addAllWL}
                  onChange={e => setAddAllWL(parseInt(e.target.value))}
                  className="filter-select"
                >
                  {Array.from({ length: 11 }, (_, i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <p className="info-text">
                Regular weapons (+10 max) will be added at the selected level.
                Unique weapons (+5 max) will be added at half the level (rounded down).
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
