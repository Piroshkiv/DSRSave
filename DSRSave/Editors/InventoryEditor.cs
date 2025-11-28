using DSRSave;
using DSRSave.Editors;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

public class InventoryEditor
{
    private readonly Character _character;
    private readonly ItemsCollection _itemsData;

    private const int INVENTORY_START = 0x370;
    private const int ITEM_SIZE = 28;
    private const int MAX_SLOTS = 2048;

    public InventoryEditor(Character character)
    {
        _character = character ?? throw new ArgumentNullException(nameof(character));

        string json = File.ReadAllText("json/items.json");
        _itemsData = JsonSerializer.Deserialize<ItemsCollection>(json)
                     ?? throw new Exception("Failed to parse items.json");
    }

    public byte WeaponLevel
    {
        get => _character[0x0179];
        set => _character[0x0179] = value;
    }

    public ItemsCollection ItemsData => _itemsData;

    public Item GetItemById(string itemId, string itemType = null)
    {
        if (string.IsNullOrEmpty(itemId))
            throw new ArgumentException("Item ID cannot be null or empty", nameof(itemId));

        string idStr = itemId.Replace("0x", "").Replace("0X", "");
        uint idNumeric = Convert.ToUInt32(idStr, 16);

        if (!string.IsNullOrEmpty(itemType))
        {
            string typeStr = itemType.Replace("0x", "").Replace("0X", "")[0].ToString();
            uint typeNumeric = uint.Parse(typeStr);

            return _itemsData.AllItems.FirstOrDefault(item =>
                item.TypeNumeric == typeNumeric && item.IdNumeric == idNumeric);
        }
        else
        {
            return _itemsData.AllItems.FirstOrDefault(item => item.IdNumeric == idNumeric);
        }
    }

    public InventoryItem ReadInventorySlot(int slotIndex)
    {
        if (slotIndex < 0 || slotIndex >= MAX_SLOTS)
            throw new ArgumentOutOfRangeException(nameof(slotIndex), "Slot index must be between 0 and 2047");

        int absoluteOffset = INVENTORY_START + (slotIndex * ITEM_SIZE);
        byte[] characterData = _character.GetRawData();

        if (absoluteOffset + ITEM_SIZE > characterData.Length)
            throw new ArgumentOutOfRangeException(nameof(slotIndex), "Slot index exceeds character data bounds");

        var itemData = new byte[ITEM_SIZE];
        Array.Copy(characterData, absoluteOffset, itemData, 0, ITEM_SIZE);
        return new InventoryItem(itemData, absoluteOffset, _itemsData);
    }

    public void WriteInventorySlot(int slotIndex, InventoryItem item)
    {
        if (item == null)
            throw new ArgumentNullException(nameof(item));

        if (slotIndex < 0 || slotIndex >= MAX_SLOTS)
            throw new ArgumentOutOfRangeException(nameof(slotIndex), "Slot index must be between 0 and 2047");

        int absoluteOffset = INVENTORY_START + (slotIndex * ITEM_SIZE);
        byte[] characterData = _character.GetRawData();

        if (absoluteOffset + ITEM_SIZE > characterData.Length)
            throw new ArgumentOutOfRangeException(nameof(slotIndex), "Slot index exceeds character data bounds");

        var itemData = item.GetRawData();
        Array.Copy(itemData, 0, characterData, absoluteOffset, ITEM_SIZE);
    }

    public IEnumerable<(int slotIndex, InventoryItem item)> GetAllInventoryItems()
    {
        byte[] data = _character.GetRawData();

        for (int i = 0; i < MAX_SLOTS; i++)
        {
            int absoluteOffset = INVENTORY_START + (i * ITEM_SIZE);

            if (absoluteOffset + ITEM_SIZE > data.Length)
                yield break;

            var itemData = new byte[ITEM_SIZE];
            Array.Copy(data, absoluteOffset, itemData, 0, ITEM_SIZE);
            var item = new InventoryItem(itemData, absoluteOffset, _itemsData);

            if (!item.IsEmpty)
                yield return (i, item);
        }
    }

    public int? AddItem(string itemId, string itemType = null, uint quantity = 1, uint upgradeLevel = 0, ItemInfusion infusion = ItemInfusion.Standard)
    {
        var itemInfo = GetItemById(itemId, itemType);
        if (itemInfo == null)
        {
            string searchStr = string.IsNullOrEmpty(itemType)
                ? $"ID '{itemId}'"
                : $"Type '{itemType}', ID '{itemId}'";
            throw new Exception($"Item with {searchStr} not found in database");
        }

        if (infusion != ItemInfusion.Standard)
        {
            if (itemInfo.CanInfuse == false)
            {
                throw new Exception($"Item '{itemInfo.Name}' cannot be infused");
            }
        }

        if (upgradeLevel > 0)
        {
            if (!itemInfo.MaxUpgrade.HasValue)
            {
                throw new Exception($"Item '{itemInfo.Name}' cannot be upgraded");
            }

            int maxUpgradeForInfusion = InventoryItem.GetMaxUpgradeForInfusion(itemInfo.MaxUpgrade.Value, infusion);

            if(itemInfo.Name == "Pyromancy Flame (Ascended)")
            {
                maxUpgradeForInfusion = 5;
            }

            if (upgradeLevel > maxUpgradeForInfusion)
            {
                string infusionStr = infusion != ItemInfusion.Standard ? $" with {infusion} infusion" : "";
                throw new Exception($"Item '{itemInfo.Name}'{infusionStr} cannot be upgraded beyond +{maxUpgradeForInfusion}. Requested: +{upgradeLevel}");
            }
        }

        if (quantity > itemInfo.MaxStackCount)
        {
            throw new Exception($"Item '{itemInfo.Name}' max stack count is {itemInfo.MaxStackCount}. Requested: {quantity}");
        }

        byte[] data = _character.GetRawData();

        for (int i = 64; i < MAX_SLOTS; i++)
        {
            int absoluteOffset = INVENTORY_START + (i * ITEM_SIZE);
            if (absoluteOffset + ITEM_SIZE > data.Length)
                return null;

            var itemData = new byte[ITEM_SIZE];
            Array.Copy(data, absoluteOffset, itemData, 0, ITEM_SIZE);
            var slot = new InventoryItem(itemData, absoluteOffset, _itemsData);

            if (slot.IsEmpty)
            {
                slot.ItemType = itemInfo.TypeNumeric;
                slot.ItemId = itemInfo.IdNumeric;
                slot.Quantity = Math.Min(quantity, (uint)itemInfo.MaxStackCount);
                slot.Order = (uint)i;
                slot.Exists = 1;

                uint baseDurability = itemInfo.Durability ?? 0;

                if (infusion == ItemInfusion.Crystal)
                {
                    baseDurability = baseDurability / 10;
                }

                slot.Durability = baseDurability;
                slot.Unknown = 0;
                slot.UpgradeLevel = upgradeLevel;
                slot.Infusion = infusion;

                WriteInventorySlot(i, slot);

                ItemsNumber = int.Max(i, ItemsNumber);

                return i;
            }
        }

        return null;
    }

    public bool EditItem(int slotIndex, string itemId = null, string itemType = null, uint? quantity = null, uint? upgradeLevel = null, ItemInfusion? infusion = null)
    {
        if (slotIndex < 0 || slotIndex >= MAX_SLOTS)
            throw new ArgumentOutOfRangeException(nameof(slotIndex), $"Slot index must be between 0 and {MAX_SLOTS - 1}");

        byte[] data = _character.GetRawData();
        int absoluteOffset = INVENTORY_START + (slotIndex * ITEM_SIZE);

        if (absoluteOffset + ITEM_SIZE > data.Length)
            return false;

        var itemData = new byte[ITEM_SIZE];
        Array.Copy(data, absoluteOffset, itemData, 0, ITEM_SIZE);
        var slot = new InventoryItem(itemData, absoluteOffset, _itemsData);

        if (slot.IsEmpty)
            throw new Exception($"Slot {slotIndex} is empty");

        // Get current item info for validation
        var currentItemInfo = _itemsData.AllItems.FirstOrDefault(x =>
            x.TypeNumeric == slot.ItemType && x.IdNumeric == slot.ItemId);

        // Change item if itemId is provided
        if (!string.IsNullOrEmpty(itemId))
        {
            var newItemInfo = GetItemById(itemId, itemType);
            if (newItemInfo == null)
            {
                string searchStr = string.IsNullOrEmpty(itemType)
                    ? $"ID '{itemId}'"
                    : $"Type '{itemType}', ID '{itemId}'";
                throw new Exception($"Item with {searchStr} not found in database");
            }

            slot.ItemType = newItemInfo.TypeNumeric;
            slot.ItemId = newItemInfo.IdNumeric;
            currentItemInfo = newItemInfo;

            // Reset durability for new item
            uint baseDurability = newItemInfo.Durability ?? 0;
            if (infusion.HasValue && infusion.Value == ItemInfusion.Crystal)
            {
                baseDurability = baseDurability / 10;
            }
            else if (slot.Infusion == ItemInfusion.Crystal && !infusion.HasValue)
            {
                baseDurability = baseDurability / 10;
            }
            slot.Durability = baseDurability;
        }

        // Update quantity
        if (quantity.HasValue)
        {
            if (currentItemInfo != null && quantity.Value > currentItemInfo.MaxStackCount)
            {
                throw new Exception($"Item '{currentItemInfo.Name}' max stack count is {currentItemInfo.MaxStackCount}. Requested: {quantity.Value}");
            }
            slot.Quantity = quantity.Value;
        }

        // Update infusion
        if (infusion.HasValue)
        {
            if (infusion.Value != ItemInfusion.Standard)
            {
                if (currentItemInfo?.CanInfuse == false)
                {
                    throw new Exception($"Item '{currentItemInfo.Name}' cannot be infused");
                }
            }

            // Recalculate durability if infusion changes
            if (slot.Infusion != infusion.Value && currentItemInfo != null)
            {
                uint baseDurability = currentItemInfo.Durability ?? 0;
                if (infusion.Value == ItemInfusion.Crystal)
                {
                    baseDurability = baseDurability / 10;
                }
                slot.Durability = baseDurability;
            }

            slot.Infusion = infusion.Value;
        }

        // Update upgrade level
        if (upgradeLevel.HasValue)
        {
            if (upgradeLevel.Value > 0)
            {
                if (currentItemInfo?.MaxUpgrade == null)
                {
                    throw new Exception($"Item '{currentItemInfo?.Name}' cannot be upgraded");
                }

                ItemInfusion currentInfusion = infusion ?? slot.Infusion;
                int maxUpgradeForInfusion = InventoryItem.GetMaxUpgradeForInfusion(currentItemInfo.MaxUpgrade.Value, currentInfusion);

                if (upgradeLevel.Value > maxUpgradeForInfusion)
                {
                    string infusionStr = currentInfusion != ItemInfusion.Standard ? $" with {currentInfusion} infusion" : "";
                    throw new Exception($"Item '{currentItemInfo.Name}'{infusionStr} cannot be upgraded beyond +{maxUpgradeForInfusion}. Requested: +{upgradeLevel.Value}");
                }
            }
            slot.UpgradeLevel = upgradeLevel.Value;
        }

        WriteInventorySlot(slotIndex, slot);
        return true;
    }

    public bool RepairItem(int slotIndex)
    {
        if (slotIndex < 0 || slotIndex >= MAX_SLOTS)
            throw new ArgumentOutOfRangeException(nameof(slotIndex), $"Slot index must be between 0 and {MAX_SLOTS - 1}");

        byte[] data = _character.GetRawData();
        int absoluteOffset = INVENTORY_START + (slotIndex * ITEM_SIZE);

        if (absoluteOffset + ITEM_SIZE > data.Length)
            return false;

        var itemData = new byte[ITEM_SIZE];
        Array.Copy(data, absoluteOffset, itemData, 0, ITEM_SIZE);
        var slot = new InventoryItem(itemData, absoluteOffset, _itemsData);

        if (slot.IsEmpty)
            throw new Exception($"Slot {slotIndex} is empty");

        // Get item info
        var itemInfo = slot.ItemInfo;

        if (itemInfo == null)
            throw new Exception($"Item info not found for slot {slotIndex}");

        // Calculate max durability based on infusion
        uint baseDurability = itemInfo.Durability ?? 0;
        if (slot.Infusion == ItemInfusion.Crystal)
        {
            baseDurability = baseDurability / 10;
        }

        slot.Durability = baseDurability - 1;
        WriteInventorySlot(slotIndex, slot);

        return true;
    }

    public int? RemoveItem(string itemId, string itemType = null)
    {
        var itemInfo = GetItemById(itemId, itemType);
        if (itemInfo == null)
        {
            string searchStr = string.IsNullOrEmpty(itemType)
                ? $"ID '{itemId}'"
                : $"Type '{itemType}', ID '{itemId}'";
            throw new Exception($"Item with {searchStr} not found in database");
        }

        foreach (var (slotIndex, item) in GetAllInventoryItems())
        {
            if (item.ItemType == itemInfo.TypeNumeric && item.BaseItemId == itemInfo.IdNumeric)
            {
                var emptyData = new byte[28];
                Array.Fill(emptyData, (byte)0xFF); 
                var emptyItem = new InventoryItem(emptyData, item.SlotOffset, _itemsData);
                emptyItem.Exists = 0; 
                emptyItem.Unknown = 0; 

                WriteInventorySlot(slotIndex, emptyItem);
                return slotIndex; 
            }
        }

        return null;
    }

    public void ClearInventory()
    {
        byte[] data = _character.GetRawData();
        int startOffset = INVENTORY_START;
        int totalSize = MAX_SLOTS * ITEM_SIZE;

        if (startOffset + totalSize <= data.Length)
        {
            Array.Clear(data, startOffset, totalSize);
        }
    }

    public int CalibrateWL()
    {
        var b = 0;
        Console.WriteLine();

        foreach (var (slotIndex, item) in GetAllInventoryItems())
        {
            b = int.Max(b, item.WeaponLevel);
        }

        WeaponLevel = (byte)b;

        return b;
    }

    public int ItemsNumber
    {
        get => _character[0xE370] | (_character[0xE371] << 8) | (_character[0xE372] << 16) | (_character[0xE373] << 24);
        set
        {
            _character[0xE370] = (byte)(value & 0xFF);
            _character[0xE371] = (byte)((value >> 8) & 0xFF);
            _character[0xE372] = (byte)((value >> 16) & 0xFF);
            _character[0xE373] = (byte)((value >> 24) & 0xFF);
        }
    }

    private int GetEquipmentSlot(int baseOffset, int dataOffset)
    {
        int value = _character[baseOffset] |
                    (_character[baseOffset + 1] << 8) |
                    (_character[baseOffset + 2] << 16) |
                    (_character[baseOffset + 3] << 24);

        return value == unchecked((int)0xFFFFFFFF) ? -1 : value;
    }

    private void SetEquipmentSlot(int baseOffset, int dataOffset, int value)
    {
        if (value == -1)
        {
            _character[baseOffset] = 255;
            _character[baseOffset + 1] = 255;
            _character[baseOffset + 2] = 255;
            _character[baseOffset + 3] = 255;
            _character[dataOffset] = 255;
            _character[dataOffset + 1] = 255;
            _character[dataOffset + 2] = 255;
            _character[dataOffset + 3] = 255;
        }
        else
        {
            _character[baseOffset] = (byte)(value & 0xFF);
            _character[baseOffset + 1] = (byte)((value >> 8) & 0xFF);
            _character[baseOffset + 2] = (byte)((value >> 16) & 0xFF);
            _character[baseOffset + 3] = (byte)((value >> 24) & 0xFF);
            _character[dataOffset] = _character[INVENTORY_START + 28 * value + 4];
            _character[dataOffset + 1] = _character[INVENTORY_START + 28 * value + 5];
            _character[dataOffset + 2] = _character[INVENTORY_START + 28 * value + 6];
            _character[dataOffset + 3] = _character[INVENTORY_START + 28 * value + 7];
        }
    }

    public int LeftHand1
    {
        get => GetEquipmentSlot(0x02A8, 0x314);
        set => SetEquipmentSlot(0x02A8, 0x314, value);
    }

    public int LeftHand2
    {
        get => GetEquipmentSlot(0x02B0, 0x31C);
        set => SetEquipmentSlot(0x02B0, 0x31C, value);
    }

    public int RightHand1
    {
        get => GetEquipmentSlot(0x02AC, 0x318);
        set => SetEquipmentSlot(0x02AC, 0x318, value);
    }

    public int RightHand2
    {
        get => GetEquipmentSlot(0x02B4, 0x320);
        set => SetEquipmentSlot(0x02B4, 0x320, value);
    }

    public int Helm
    {
        get => GetEquipmentSlot(0x02C8, 0x334);
        set => SetEquipmentSlot(0x02C8, 0x334, value);
    }

    public int Armor
    {
        get => GetEquipmentSlot(0x02CC, 0x338);
        set => SetEquipmentSlot(0x02CC, 0x338, value);
    }

    public int Gauntlets
    {
        get => GetEquipmentSlot(0x02D0, 0x33C);
        set => SetEquipmentSlot(0x02D0, 0x33C, value);
    }

    public int Legs
    {
        get => GetEquipmentSlot(0x02D4, 0x340);
        set => SetEquipmentSlot(0x02D4, 0x340, value);
    }

    public int Ring1
    {
        get => GetEquipmentSlot(0x02DC, 0x348);
        set => SetEquipmentSlot(0x02DC, 0x348, value);
    }

    public int Ring2
    {
        get => GetEquipmentSlot(0x02E0, 0x34C);
        set => SetEquipmentSlot(0x02E0, 0x34C, value);
    }
}