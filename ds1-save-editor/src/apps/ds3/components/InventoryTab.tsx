import React, { useState, useEffect, useCallback } from 'react';
import { DS3Character } from '../lib/Character';
import { DS3Inventory, ItemCollectionType, DS3InventoryItem, ItemInfusion } from '../lib/Inventory';
import { ItemCreateDialog } from './ItemCreateDialog';

interface InventoryTabProps {
  character: DS3Character;
  onCharacterUpdate: () => void;
  safeMode: boolean;
}

type SubTabType =
  | 'consumables'
  | 'magic'
  | 'weapons'
  | 'armor'
  | 'ores'
  | 'ammunition'
  | 'rings';

const SUB_TAB_LABELS: Record<SubTabType, string> = {
  consumables: 'Consumables',
  magic: 'Magic',
  weapons: 'Weapons',
  armor: 'Armor',
  ores: 'Ores',
  ammunition: 'Ammunition',
  rings: 'Rings',
};

const SUB_TAB_TO_COLLECTION: Record<SubTabType, ItemCollectionType> = {
  consumables: ItemCollectionType.Consumable,
  magic: ItemCollectionType.Magic,
  weapons: ItemCollectionType.Weapon,
  armor: ItemCollectionType.Armor,
  ores: ItemCollectionType.Ore,
  ammunition: ItemCollectionType.Ammunition,
  rings: ItemCollectionType.Ring,
};

export const InventoryTab: React.FC<InventoryTabProps> = ({ character, onCharacterUpdate, safeMode }) => {
  const [inventory, setInventory] = useState(() => new DS3Inventory(character));
  const [items, setItems] = useState<DS3InventoryItem[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('consumables');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const refreshItems = useCallback((inventoryInstance?: DS3Inventory) => {
    const inv = inventoryInstance || inventory;
    if (!inv) return;

    const collectionType = SUB_TAB_TO_COLLECTION[activeSubTab];
    let filteredItems = inv.getItemsByType(collectionType);

    // Hide UNKNOWN/GARBAGE and Fist items in safe mode
    if (safeMode) {
      filteredItems = filteredItems.filter(item => {
        const itemName = item.itemName;
        // Filter out Unknown items
        if (itemName.startsWith('Unknown (')) {
          return false;
        }
        // Filter out Fist
        if (itemName === 'Fists' || itemName === 'Fist') {
          return false;
        }
        return true;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      filteredItems = filteredItems.filter(item =>
        item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setItems(filteredItems);
  }, [inventory, activeSubTab, safeMode, searchQuery]);

  // Recreate inventory when character changes
  useEffect(() => {
    const newInventory = new DS3Inventory(character);
    setInventory(newInventory);

    const loadInventory = async () => {
      setLoading(true);
      try {
        await newInventory.loadItemsDatabase();
        refreshItems(newInventory);
      } catch (error) {
        console.error('Error loading DS3 inventory:', error);
        alert(`Failed to load DS3 items database: ${error instanceof Error ? error.message : String(error)}\n\nPlease ensure ds3_items.json is available.`);
        setItems([]);
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
  }, [activeSubTab, loading, searchQuery, safeMode, inventory, refreshItems]);

  const handleDeleteItem = (slotIndex: number) => {
    if (confirm('Are you sure you want to delete this item?')) {
      inventory.deleteItem(slotIndex);
      refreshItems();
      onCharacterUpdate();
    }
  };

  const handleItemCreated = (_slotIndex: number | null) => {
    refreshItems();
    onCharacterUpdate();
  };

  const getInfusionName = (infusion: ItemInfusion): string => {
    switch (infusion) {
      case ItemInfusion.Standard: return '';
      case ItemInfusion.Heavy: return 'Heavy';
      case ItemInfusion.Sharp: return 'Sharp';
      case ItemInfusion.Refined: return 'Refined';
      case ItemInfusion.Simple: return 'Simple';
      case ItemInfusion.Crystal: return 'Crystal';
      case ItemInfusion.Fire: return 'Fire';
      case ItemInfusion.Chaos: return 'Chaos';
      case ItemInfusion.Lightning: return 'Lightning';
      case ItemInfusion.Deep: return 'Deep';
      case ItemInfusion.Dark: return 'Dark';
      case ItemInfusion.Poison: return 'Poison';
      case ItemInfusion.Blood: return 'Blood';
      case ItemInfusion.Raw: return 'Raw';
      case ItemInfusion.Blessed: return 'Blessed';
      case ItemInfusion.Hollow: return 'Hollow';
      default: return '';
    }
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
              >
                <div className="item-info">
                  <span className="item-name">
                    {getInfusionName(item.infusion) && `${getInfusionName(item.infusion)} `}
                    {item.itemName}
                    {item.upgradeLevel > 0 && ` +${item.upgradeLevel}`}
                  </span>
                  <div className="item-details">
                    {item.quantity > 1 && (
                      <span className="item-detail">Quantity: {item.quantity}</span>
                    )}
                    {item.upgradeLevel > 0 && (
                      <span className="item-detail">Upgrade: +{item.upgradeLevel}</span>
                    )}
                    {item.infusion > 0 && (
                      <span className="item-detail">Infusion: {getInfusionName(item.infusion)}</span>
                    )}
                    <span className="item-detail">Slot: {item.slotIndex}</span>
                  </div>
                  <div className="item-bytes">
                    <span className="item-detail" style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
                      Bytes: {Array.from(item.getRawData()).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}
                    </span>
                  </div>
                </div>
                <div className="item-actions">
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
    </div>
  );
};
