import React, { useState, useEffect, useCallback } from 'react';
import { Character } from '../lib/Character';
import { Inventory, ItemCollectionType, ItemInfusion, InventoryItem } from '../lib/Inventory';
import { ItemCreateDialog } from './ItemCreateDialog';
import { ItemEditDialog } from './ItemEditDialog';

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

const SUB_TAB_LABELS: Record<SubTabType, string> = {
  consumables: 'Consumables',
  materials: 'Materials',
  key: 'Key Items',
  magic: 'Magic',
  weapons: 'Weapons',
  armor: 'Armor',
  ammunition: 'Ammunition',
  rings: 'Rings',
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
  const itemRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());

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
  }, [inventory, activeSubTab, safeMode, searchQuery, infusionFilter, wlFilter]);

  // Recreate inventory when character changes
  useEffect(() => {
    const newInventory = new Inventory(character);
    setInventory(newInventory);
    
    const loadInventory = async () => {
      setLoading(true);
      await newInventory.loadItemsDatabase();
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
      setLoading(false);
    };
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character]);

  useEffect(() => {
    if (!loading && inventory) {
      refreshItems();
    }
  }, [activeSubTab, loading, searchQuery, infusionFilter, wlFilter, safeMode, inventory, refreshItems]);

  const handleItemCreated = (slotIndex: number | null) => {
    if (safeMode) {
      inventory.calibrateWeaponLevel();
    }
    refreshItems();
    onCharacterUpdate();

    // Scroll to the newly added item
    if (slotIndex !== null) {
      setTimeout(() => {
        const element = itemRefs.current.get(slotIndex);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const handleDeleteItem = (slotIndex: number) => {
    if (confirm('Are you sure you want to delete this item?')) {
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

  const handleWeaponLevelChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 15) {
      inventory.weaponLevel = numValue;
      setWeaponLevel(numValue);
      onCharacterUpdate();
    }
  };

  const handleCalibrateWL = () => {
    const calibratedWL = inventory.calibrateWeaponLevel();
    setWeaponLevel(calibratedWL);
    setSearchQuery('');
    setWlFilter(calibratedWL);
    onCharacterUpdate();
  };

  const getInfusionName = (infusion: ItemInfusion): string => {
    switch (infusion) {
      case ItemInfusion.Standard: return '';
      case ItemInfusion.Crystal: return 'Crystal';
      case ItemInfusion.Lightning: return 'Lightning';
      case ItemInfusion.Raw: return 'Raw';
      case ItemInfusion.Magic: return 'Magic';
      case ItemInfusion.Enchanted: return 'Enchanted';
      case ItemInfusion.Divine: return 'Divine';
      case ItemInfusion.Occult: return 'Occult';
      case ItemInfusion.Fire: return 'Fire';
      case ItemInfusion.Chaos: return 'Chaos';
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
        <div className="loading">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="inventory-tab">
      <div className="inventory-header">
        <button className="create-item-button" onClick={() => setShowCreateDialog(true)}>
          + Create Item
        </button>

        <div className="inventory-search">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        {(activeSubTab === 'weapons' || activeSubTab === 'armor') && (
          <div className="filter-group">
            <label>Infusion:</label>
            <select
              value={infusionFilter}
              onChange={(e) => setInfusionFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value) as ItemInfusion)}
              className="filter-select"
            >
              <option value="all">All</option>
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

        {activeSubTab === 'weapons' && (
          <>
            <div className="filter-group">
              <label>WL:</label>
              <select
                value={wlFilter}
                onChange={(e) => setWlFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                className="filter-select"
              >
                <option value="all">All</option>
                {Array.from({ length: 16 }, (_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>

            <div className="weapon-level-display">
              <label>Weapon Level:</label>
              <input
                type="number"
                min={0}
                max={15}
                value={weaponLevel}
                onChange={(e) => handleWeaponLevelChange(e.target.value)}
                disabled={safeMode}
              />
              <button
                className="calibrate-button"
                onClick={handleCalibrateWL}
                title="Calibrate Weapon Level"
              >
                Calibrate WL
              </button>
            </div>
          </>
        )}
      </div>

      <div className="sub-tabs">
        {(Object.keys(SUB_TAB_LABELS) as SubTabType[]).map((subTab) => (
          <button
            key={subTab}
            className={`sub-tab ${activeSubTab === subTab ? 'active' : ''}`}
            onClick={() => setActiveSubTab(subTab)}
          >
            {SUB_TAB_LABELS[subTab]}
          </button>
        ))}
      </div>

      <div className="inventory-content">
        {items.length === 0 ? (
          <div className="no-items">No items in this category</div>
        ) : (
          <div className="items-list">
            {items.map((item) => (
              <div
                key={item.slotIndex}
                className="item-row"
                ref={(el) => {
                  if (el) {
                    itemRefs.current.set(item.slotIndex, el);
                  } else {
                    itemRefs.current.delete(item.slotIndex);
                  }
                }}
              >
                <div className="item-info">
                  <span className="item-name">{formatItemDisplay(item)}</span>
                  <div className="item-details">
                    {item.quantity > 1 && (
                      <span className="item-detail">Quantity: {item.quantity}</span>
                    )}
                    {item.infusion !== ItemInfusion.Standard && (
                      <span className="item-detail">Infusion: {getInfusionName(item.infusion)}</span>
                    )}
                    {item.upgradeLevel > 0 && (
                      <span className="item-detail">Upgrade: +{item.upgradeLevel}</span>
                    )}
                  </div>
                </div>
                <div className="item-actions">
                  <button
                    className="edit-button"
                    onClick={() => handleEditItem(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteItem(item.slotIndex)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
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
    </div>
  );
};
