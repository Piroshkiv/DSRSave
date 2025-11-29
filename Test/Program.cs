using DSRSave;
using DSRSave.Editors;
using System.ComponentModel;
var path = "C:/Users/Iho/Documents/NBGI/DARK SOULS REMASTERED/834633765/DRAKS0005.sl2";
//1874967625
var save = DSRSaveEditor.ReadSave(path);
//save.ToList()[0].Stats.Humanity = 2;
//DSRSaveEditor.WriteSave(save, path);
var a = save.ToList()[0].Inventory.GetAllInventoryItems();
var b1 = save.ToList()[1].Inventory.Ring1;
var b2 = save.ToList()[1].Inventory.Ring2;
//var data = save.ToList()[8].GetRawData();
//// диапазон с 0x300 по 0x323 включительно (то есть 0x324 - 0x300 = 36 байт)
//int start = 0x300;
//int end = 0x323;

//for (int i = start; i <= end && i < data.Length; i++)
//{
//    Console.Write($"{data[i]:X2}");
//}

//var b = save.ToList()[9].Inventory.RightHand2;

//save.ToList()[9].Inventory.LeftHand1 = 496;
//var b = 0;
//Console.WriteLine();
//foreach (var (slotIndex, item) in a)
//{
//    b = int.Max(b, item.WeaponLevel);
//}

foreach (var (slotIndex, item) in a)
{
    //if (item.ItemInfo != null && item.ItemInfo.CollectionType == ItemCollectionType.Weapon)
    //{
    //    Console.WriteLine($"{item.ItemName} {item.UpgradeLevel} {item.Durability} {item.WeaponLevel} {item.ItemInfo.CollectionType} {slotIndex}");
    //}

    //if (slotIndex == b1)
    //{
    //    Console.WriteLine($"{item.ItemName} {item.ItemType} {item.ItemId} {slotIndex}");
    //    Console.WriteLine(item.ToByteString());
    //}
    //if (slotIndex == b2)
    {
        Console.WriteLine($"{item.ItemName} {item.ItemType} {item.ItemId} {slotIndex}");

        //Console.WriteLine(item.ToByteString());
    }


    //if (slotIndex  > 160)
    //{
    //    Console.WriteLine();
    //    foreach (var i in item.GetRawData())
    //    {
    //        Console.Write(i);
    //    }
    //}

}
//foreach (var item in save.ToList()[1].Inventory.ItemsData.AllItems)
//{
//    Console.WriteLine(item.TypeNumeric);
//}


//save.ToList()[9].Inventory.WeaponLevel = (byte)b;

DSRSaveEditor.WriteSave(save, path);