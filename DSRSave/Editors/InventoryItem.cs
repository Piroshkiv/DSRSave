using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace DSRSave.Editors
{
    public enum ItemCollectionType
    {
        Weapon,
        Ring,
        Armor,
        Consumable,
        Soul,
        Upgrade,
        Key,
        Spell,
        Usable,
        Ammunition,
        Material,
        Magic,
        Special,
        Unknown
    }
    public enum ItemInfusion
    {
        Standard = 0,
        Crystal = 1,
        Lightning = 2,
        Raw = 3,
        Magic = 4,
        Enchanted = 5,
        Divine = 6,
        Occult = 7,
        Fire = 8,
        Chaos = 9
    }

    public enum ItemCategory
    {
        WeaponsShields = 0x00000000,
        Armor = 0x10000000,
        Rings = 0x20000000,
        Consumables = 0x40000000
    }

    public class ItemsCollection
    {
        [JsonPropertyName("weapon_items")]
        public List<Item> WeaponItems { get; set; }

        [JsonPropertyName("ring_items")]
        public List<Item> RingItems { get; set; }

        [JsonPropertyName("armor_items")]
        public List<Item> ArmorItems { get; set; }

        [JsonPropertyName("consumable_items")]
        public List<Item> ConsumableItems { get; set; }

        [JsonPropertyName("soul_items")]
        public List<Item> SoulItems { get; set; }

        [JsonPropertyName("upgrade_items")]
        public List<Item> UpgradeItems { get; set; }

        [JsonPropertyName("key_items")]
        public List<Item> KeyItems { get; set; }

        [JsonPropertyName("spell_items")]
        public List<Item> SpellItems { get; set; }

        [JsonPropertyName("usable_items")]
        public List<Item> UsableItems { get; set; }

        [JsonPropertyName("ammunition_items")]
        public List<Item> AmmunitionItems { get; set; }

        [JsonPropertyName("material_items")]
        public List<Item> MaterialItems { get; set; }

        [JsonPropertyName("magic_items")]
        public List<Item> MagicItems { get; set; }

        [JsonPropertyName("specials")]
        public List<Item> Specials { get; set; }

        [JsonIgnore]
        public IEnumerable<Item> AllItems
        {
            get
            {
                var allItems = new List<Item>();

                if (WeaponItems != null)
                {
                    foreach (var item in WeaponItems)
                        item.SetCollectionType(ItemCollectionType.Weapon);
                    allItems.AddRange(WeaponItems);
                }

                if (RingItems != null)
                {
                    foreach (var item in RingItems)
                        item.SetCollectionType(ItemCollectionType.Ring);
                    allItems.AddRange(RingItems);
                }

                if (ArmorItems != null)
                {
                    foreach (var item in ArmorItems)
                        item.SetCollectionType(ItemCollectionType.Armor);
                    allItems.AddRange(ArmorItems);
                }

                if (ConsumableItems != null)
                {
                    foreach (var item in ConsumableItems)
                        item.SetCollectionType(ItemCollectionType.Consumable);
                    allItems.AddRange(ConsumableItems);
                }

                if (SoulItems != null)
                {
                    foreach (var item in SoulItems)
                        item.SetCollectionType(ItemCollectionType.Soul);
                    allItems.AddRange(SoulItems);
                }

                if (UpgradeItems != null)
                {
                    foreach (var item in UpgradeItems)
                        item.SetCollectionType(ItemCollectionType.Upgrade);
                    allItems.AddRange(UpgradeItems);
                }

                if (KeyItems != null)
                {
                    foreach (var item in KeyItems)
                        item.SetCollectionType(ItemCollectionType.Key);
                    allItems.AddRange(KeyItems);
                }

                if (SpellItems != null)
                {
                    foreach (var item in SpellItems)
                        item.SetCollectionType(ItemCollectionType.Spell);
                    allItems.AddRange(SpellItems);
                }

                if (UsableItems != null)
                {
                    foreach (var item in UsableItems)
                        item.SetCollectionType(ItemCollectionType.Usable);
                    allItems.AddRange(UsableItems);
                }

                if (AmmunitionItems != null)
                {
                    foreach (var item in AmmunitionItems)
                        item.SetCollectionType(ItemCollectionType.Ammunition);
                    allItems.AddRange(AmmunitionItems);
                }

                if (MaterialItems != null)
                {
                    foreach (var item in MaterialItems)
                        item.SetCollectionType(ItemCollectionType.Material);
                    allItems.AddRange(MaterialItems);
                }

                if (MagicItems != null)
                {
                    foreach (var item in MagicItems)
                        item.SetCollectionType(ItemCollectionType.Magic);
                    allItems.AddRange(MagicItems);
                }

                if (Specials != null)
                {
                    foreach (var item in Specials)
                        item.SetCollectionType(ItemCollectionType.Special);
                    allItems.AddRange(Specials);
                }

                return allItems;
            }
        }
    }

    public class Item
    {
        [JsonPropertyName("Type")]
        public string Type { get; set; }

        [JsonPropertyName("Id")]
        public string Id { get; set; }

        [JsonPropertyName("MaxStackCount")]
        public int MaxStackCount { get; set; }

        [JsonPropertyName("Category")]
        public string Category { get; set; }

        [JsonPropertyName("Name")]
        public string Name { get; set; }

        [JsonPropertyName("MaxUpgrade")]
        public int? MaxUpgrade { get; set; }

        [JsonPropertyName("CanInfuse")]
        public bool? CanInfuse { get; set; }

        [JsonPropertyName("Durability")]
        public uint? Durability { get; set; }

        [JsonPropertyName("MugenMonkeyName")]
        public string? MugenMonkeyName { get; set; }

        [JsonPropertyName("SoulsplannerName")]
        public string? SoulsplannerName { get; set; }

        [JsonIgnore]
        private ItemCollectionType _collectionType = ItemCollectionType.Unknown;

        [JsonIgnore]
        public ItemCollectionType CollectionType => _collectionType;

        internal void SetCollectionType(ItemCollectionType type)
        {
            _collectionType = type;
        }

        [JsonIgnore]
        public uint TypeNumeric
        {
            get
            {
                if (string.IsNullOrEmpty(Type))
                    return 0;

                string typeStr = Type.Replace("0x", "").Replace("0X", "");
                uint value = Convert.ToUInt32(typeStr, 16);

                return value / 0x10000000;
            }
        }

        [JsonIgnore]
        public uint IdNumeric
        {
            get
            {
                if (string.IsNullOrEmpty(Id)) return 0;
                string idStr = Id.Replace("0x", "").Replace("0X", "");
                return Convert.ToUInt32(idStr, 16);
            }
        }

        [JsonIgnore]
        public uint FullItemId => (TypeNumeric << 28) | IdNumeric;
    }

    public class InventoryItem
    {
        private readonly byte[] _data;
        private readonly ItemsCollection _itemsDatabase;
        public int SlotOffset { get; }

        public InventoryItem(byte[] data, int slotOffset, ItemsCollection itemsDatabase = null)
        {
            _data = new byte[28];
            if (data != null)
                Array.Copy(data, 0, _data, 0, Math.Min(data.Length, 28));
            SlotOffset = slotOffset;
            _itemsDatabase = itemsDatabase;
        }

        public string ToByteString()
        {
            StringBuilder sb = new StringBuilder();
            foreach (var item in _data)
            {
                sb.Append($"{item:X2} ");
            }
            return sb.ToString().TrimEnd();
        }

        // +0: Item Type (4 bytes)
        public uint ItemType
        {
            get
            {
                uint value = ((uint)_data[0] << 24) |
                             ((uint)_data[1] << 16) |
                             ((uint)_data[2] << 8) |
                              _data[3];

                return value / 16;
            }
            set
            {
                uint stored = (value * 16);

                _data[0] = (byte)(stored >> 24);
                _data[1] = (byte)(stored >> 16);
                _data[2] = (byte)(stored >> 8);
                _data[3] = (byte)stored;
            }
        }


        // +4: Item ID (4 bytes)
        public uint ItemId
        {
            get => BitConverter.ToUInt32(_data, 4);
            set => Array.Copy(BitConverter.GetBytes(value), 0, _data, 4, 4);
        }

        // +8: Quantity (4 bytes)
        public uint Quantity
        {
            get => BitConverter.ToUInt32(_data, 8);
            set => Array.Copy(BitConverter.GetBytes(value), 0, _data, 8, 4);
        }

        // +12: Order (4 bytes)
        public uint Order
        {
            get => BitConverter.ToUInt32(_data, 12);
            set => Array.Copy(BitConverter.GetBytes(value), 0, _data, 12, 4);
        }

        // +16: Exists flag (4 bytes) - 1 если предмет существует, 0 если пустой слот
        public uint Exists
        {
            get => BitConverter.ToUInt32(_data, 16);
            set => Array.Copy(BitConverter.GetBytes(value), 0, _data, 16, 4);
        }

        // +20: Durability (4 bytes)
        public uint Durability
        {
            get => BitConverter.ToUInt32(_data, 20);
            set => Array.Copy(BitConverter.GetBytes(value), 0, _data, 20, 4);
        }

        // +24: Unknown2 (4 bytes) - всегда 0
        public uint Unknown
        {
            get => BitConverter.ToUInt32(_data, 24);
            set => Array.Copy(BitConverter.GetBytes(value), 0, _data, 24, 4);
        }

        [JsonIgnore]
        public uint UpgradeLevel
        {
            get
            {
                if (ItemType != 0 && ItemType != 1)
                {
                    return 0;
                }

                if (ItemId >= 1330000 && ItemId < 1332000)
                    return (ItemId - 1330000) / 100;

                if (ItemId >= 1332000 && ItemId <= 1332500)
                    return (ItemId - 1332000) / 100;

                if (ItemId >= 311000 && ItemId <= 312705)
                    return ItemId % 100;

                return ItemId % 100;
            }
            set
            {
                uint baseId = BaseItemId;

                if (baseId == 1330000)
                {
                    ItemId = 1330000 + (value * 100);
                    return;
                }

                if (baseId == 1332000)
                {
                    ItemId = 1332000 + (value * 100);
                    return;
                }

                if (baseId == 311000)
                {
                    ItemId = 311000 + value;
                    return;
                }

                uint infusion = (uint)Infusion * 100;
                uint upgradeLevel = value;
                ItemId = baseId + infusion + upgradeLevel;
            }
        }

        [JsonIgnore]
        public ItemInfusion Infusion
        {
            get
            {
                if (ItemType != 0)
                {
                    return ItemInfusion.Standard;
                }

                if ((ItemId >= 1330000 && ItemId <= 1332500) ||
                    (ItemId >= 311000 && ItemId <= 312705))
                    return ItemInfusion.Standard;

                var withoutUpgrade = ItemId - (ItemId % 100);
                var infusionValue = (withoutUpgrade % 1000) / 100;

                if (Enum.IsDefined(typeof(ItemInfusion), (int)infusionValue))
                    return (ItemInfusion)infusionValue;

                return ItemInfusion.Standard;
            }
            set
            {
                if ((ItemId >= 1330000 && ItemId <= 1332500) ||
                    (ItemId >= 311000 && ItemId <= 312705))
                    return;

                uint baseId = BaseItemId;
                uint upgradeLevel = UpgradeLevel;

                ItemId = baseId + ((uint)value * 100) + upgradeLevel;
            }
        }

        [JsonIgnore]
        public uint BaseItemId
        {
            get
            {
                if (ItemType != 0 && ItemType != 1)
                {
                    return ItemId;
                }

                if (ItemId >= 1330000 && ItemId < 1332000)
                    return 1330000;

                if (ItemId >= 1332000 && ItemId <= 1332500)
                    return 1332000;

                if (ItemId >= 311000 && ItemId <= 312705)
                    return 311000;

                var withoutUpgrade = ItemId - (ItemId % 100);

                var infusion = (withoutUpgrade % 1000);

                return withoutUpgrade - infusion;
            }
        }

        [JsonIgnore]
        public bool IsEmpty => _data.All(b => b == 0xFF) || _data.All(b => b == 0) || Exists == 0;

        [JsonIgnore]
        public ItemCategory Category
        {
            get
            {
                if (ItemType == (uint)ItemCategory.WeaponsShields)
                    return ItemCategory.WeaponsShields;
                if (ItemType == (uint)ItemCategory.Armor)
                    return ItemCategory.Armor;
                if (ItemType == (uint)ItemCategory.Rings)
                    return ItemCategory.Rings;
                if (ItemType == (uint)ItemCategory.Consumables)
                    return ItemCategory.Consumables;

                return ItemCategory.Consumables;
            }
            set => ItemType = (uint)value;
        }

        [JsonIgnore]
        public string CategoryName
        {
            get
            {
                return Category switch
                {
                    ItemCategory.WeaponsShields => "Weapons/Shields",
                    ItemCategory.Armor => "Armor",
                    ItemCategory.Rings => "Rings",
                    ItemCategory.Consumables => GetConsumableSubCategory(),
                    _ => "Unknown"
                };
            }
        }

        private string GetConsumableSubCategory()
        {
            if (ItemId < 800) return "Consumables";
            if (ItemId >= 1000 && ItemId < 2000) return "Materials";
            if (ItemId > 3000) return "Spells";
            return "Key Items";
        }

        [JsonIgnore]
        public Item ItemInfo
        {
            get
            {
                if (IsEmpty || _itemsDatabase == null)
                    return null;

                var found = _itemsDatabase.AllItems.FirstOrDefault(item =>
                     item.IdNumeric == BaseItemId && item.TypeNumeric == ItemType);

                return found;
            }
        }

        [JsonIgnore]
        public string ItemName => ItemInfo?.Name ?? $"Unknown (Type:0x{ItemType:X}, ID:0x{ItemId:X})";

        [JsonIgnore]
        public int WeaponLevel
        {
            get
            {
                if (ItemInfo == null || !ItemInfo.MaxUpgrade.HasValue || ItemInfo.CollectionType != ItemCollectionType.Weapon)
                    return 0;

                if(BaseItemId == 0x145320)
                {
                    return 15;
                }
                    
                if (ItemInfo.MaxUpgrade == 5)
                {
                    return 5 + (int)UpgradeLevel * 2;
                }

                int baseMaxUpgrade = ItemInfo.MaxUpgrade.Value;
                int maxUpgradeForInfusion = GetMaxUpgradeForInfusion(baseMaxUpgrade, Infusion);
                int currentUpgrade = (int)UpgradeLevel;

                return maxUpgradeForInfusion switch
                {
                    15 => currentUpgrade,
                    5 => 10 + currentUpgrade,
                    10 => 5 + currentUpgrade,
                    _ => currentUpgrade
                };
            }
        }

        public string GetDebugInfo()
        {
            return $"Type: 0x{ItemType:X}, ItemId: 0x{ItemId:X8}, BaseId: 0x{BaseItemId:X8}, " +
                   $"Qty: {Quantity}, Order: {Order}, Dur: {Durability}, " +
                   $"Upg: {UpgradeLevel}, Inf: {Infusion.ToString()}, Cat: {CategoryName}, " +
                   $"Exists: {Exists}, Unk2: {Unknown}";
        }

        public byte[] GetRawData()
        {
            var result = new byte[28];
            Array.Copy(_data, result, 28);
            return result;
        }

        public override string ToString()
        {
            if (IsEmpty) return "[Empty Slot]";

            string infusionStr = Infusion != ItemInfusion.Standard ? $"{Infusion} " : "";
            string upgradeStr = UpgradeLevel > 0 ? $" +{UpgradeLevel}" : "";
            string qtyStr = Quantity > 1 ? $" x{Quantity}" : "";
            string durStr = Durability < 10000 ? $" [Dur: {Durability}]" : "";

            return $"{infusionStr}{ItemName}{upgradeStr}{qtyStr}{durStr}";
        }



        public static int GetMaxUpgradeForInfusion(int baseMaxUpgrade, ItemInfusion infusion)
        {
            return infusion switch
            {
                ItemInfusion.Standard => baseMaxUpgrade,
                ItemInfusion.Crystal => Math.Min(5, baseMaxUpgrade),
                ItemInfusion.Lightning => Math.Min(5, baseMaxUpgrade),
                ItemInfusion.Raw => Math.Min(5, baseMaxUpgrade),
                ItemInfusion.Magic => Math.Min(10, baseMaxUpgrade),
                ItemInfusion.Enchanted => Math.Min(5, baseMaxUpgrade),
                ItemInfusion.Divine => Math.Min(10, baseMaxUpgrade),
                ItemInfusion.Occult => Math.Min(5, baseMaxUpgrade),
                ItemInfusion.Fire => Math.Min(10, baseMaxUpgrade),
                ItemInfusion.Chaos => Math.Min(5, baseMaxUpgrade),
                _ => baseMaxUpgrade
            };
        }
    }
}
