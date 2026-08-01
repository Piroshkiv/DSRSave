const fs = require('fs');
const crypto = require('crypto');
const { md5 } = require('js-md5');

// Константы из DS1
const SAVE_SLOT_SIZE = 0x060030;
const BASE_SLOT_OFFSET = 0x02C0;
const USER_DATA_SIZE = 0x060020;
const INVENTORY_START = 0x370;
const ITEM_SIZE = 28;
const MAX_SLOTS = 2048;

const AES_KEY = Buffer.from([
  0x01, 0x23, 0x45, 0x67,
  0x89, 0xAB, 0xCD, 0xEF,
  0xFE, 0xDC, 0xBA, 0x98,
  0x76, 0x54, 0x32, 0x10
]);

// Пути к файлам
const SOURCE_FILE = 'C:\\Users\\Iho\\Downloads\\DRAKS0005 (5).sl2';
const TARGET_FILE = 'C:\\Users\\Iho\\Documents\\NBGI\\DARK SOULS REMASTERED\\834633765\\DRAKS0005.sl2';
const SLOT_INDEX = 0;

// Функции шифрования/дешифрования
function decryptAesCbc(cipherData, key, iv) {
  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(cipherData), decipher.final()]);
}

function encryptAesCbc(plainData, key, iv) {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plainData), cipher.final()]);
}

function calculateMD5(data) {
  const hash = md5.create();
  hash.update(Array.from(data));
  return Buffer.from(hash.array());
}

// Класс для работы с предметом инвентаря
class InventoryItem {
  constructor(data, slotIndex) {
    this.data = Buffer.from(data.slice(0, 28));
    this.slotIndex = slotIndex;
  }

  get itemType() {
    const value = (this.data[0] << 24) | (this.data[1] << 16) | (this.data[2] << 8) | this.data[3];
    return Math.floor(value / 16);
  }

  set itemType(value) {
    const stored = value * 16;
    this.data[0] = (stored >> 24) & 0xff;
    this.data[1] = (stored >> 16) & 0xff;
    this.data[2] = (stored >> 8) & 0xff;
    this.data[3] = stored & 0xff;
  }

  get itemId() {
    return this.data[4] | (this.data[5] << 8) | (this.data[6] << 16) | (this.data[7] << 24);
  }

  set itemId(value) {
    this.data[4] = value & 0xff;
    this.data[5] = (value >> 8) & 0xff;
    this.data[6] = (value >> 16) & 0xff;
    this.data[7] = (value >> 24) & 0xff;
  }

  get quantity() {
    return this.data[8] | (this.data[9] << 8) | (this.data[10] << 16) | (this.data[11] << 24);
  }

  set quantity(value) {
    this.data[8] = value & 0xff;
    this.data[9] = (value >> 8) & 0xff;
    this.data[10] = (value >> 16) & 0xff;
    this.data[11] = (value >> 24) & 0xff;
  }

  get exists() {
    return this.data[16] | (this.data[17] << 8) | (this.data[18] << 16) | (this.data[19] << 24);
  }

  get isEmpty() {
    return this.exists === 0 || this.data.every((b) => b === 0 || b === 0xff);
  }

  get baseItemId() {
    if (this.itemType !== 0 && this.itemType !== 1) {
      return this.itemId;
    }

    if (this.itemId >= 1330000 && this.itemId < 1332000) {
      return 1330000;
    }

    if (this.itemId >= 1332000 && this.itemId <= 1332500) {
      return 1332000;
    }

    if (this.itemId >= 311000 && this.itemId <= 312705) {
      return 311000;
    }

    const withoutUpgrade = this.itemId - (this.itemId % 100);
    const infusion = withoutUpgrade % 1000;
    return withoutUpgrade - infusion;
  }

  get upgradeLevel() {
    if (this.itemType !== 0 && this.itemType !== 1) {
      return 0;
    }

    if (this.itemId >= 1330000 && this.itemId < 1332000) {
      return Math.floor((this.itemId - 1330000) / 100);
    }

    if (this.itemId >= 1332000 && this.itemId <= 1332500) {
      return Math.floor((this.itemId - 1332000) / 100);
    }

    if (this.itemId >= 311000 && this.itemId <= 312705) {
      return this.itemId % 100;
    }

    return this.itemId % 100;
  }

  get infusion() {
    if (this.itemType !== 0) {
      return 0; // Standard
    }

    if (
      (this.itemId >= 1330000 && this.itemId <= 1332500) ||
      (this.itemId >= 311000 && this.itemId <= 312705)
    ) {
      return 0; // Standard
    }

    const withoutUpgrade = this.itemId - (this.itemId % 100);
    return Math.floor((withoutUpgrade % 1000) / 100);
  }

  getKey() {
    return `${this.baseItemId}_${this.upgradeLevel}_${this.infusion}`;
  }

  getRawData() {
    return Buffer.from(this.data);
  }
}

// Загрузка и расшифровка персонажа
function loadCharacter(saveData, slotIndex) {
  const offset = BASE_SLOT_OFFSET + slotIndex * SAVE_SLOT_SIZE;
  const iv = saveData.slice(offset, offset + 16);
  const encrypted = saveData.slice(offset + 16, offset + 16 + USER_DATA_SIZE);
  return decryptAesCbc(encrypted, AES_KEY, iv);
}

// Получение всех предметов из инвентаря
function getAllItems(characterData) {
  const items = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const offset = INVENTORY_START + i * ITEM_SIZE;
    if (offset + ITEM_SIZE > characterData.length) break;

    const itemData = characterData.slice(offset, offset + ITEM_SIZE);
    const item = new InventoryItem(itemData, i);

    if (!item.isEmpty) {
      items.push(item);
    }
  }
  return items;
}

// Запись предмета в слот
function writeSlot(characterData, slotIndex, item) {
  const offset = INVENTORY_START + slotIndex * ITEM_SIZE;
  if (offset + ITEM_SIZE > characterData.length) {
    throw new Error('Slot index out of range');
  }
  const itemData = item.getRawData();
  itemData.copy(characterData, offset);
}

// Обновление счетчика предметов
function updateItemsNumber(characterData, slotIndex) {
  const currentMax =
    characterData[0xe370] |
    (characterData[0xe371] << 8) |
    (characterData[0xe372] << 16) |
    (characterData[0xe373] << 24);

  if (slotIndex > currentMax) {
    characterData[0xe370] = slotIndex & 0xff;
    characterData[0xe371] = (slotIndex >> 8) & 0xff;
    characterData[0xe372] = (slotIndex >> 16) & 0xff;
    characterData[0xe373] = (slotIndex >> 24) & 0xff;
  }
}

// Сохранение персонажа обратно в файл сохранения
function saveCharacter(saveData, characterData, slotIndex) {
  const offset = BASE_SLOT_OFFSET + slotIndex * SAVE_SLOT_SIZE;
  const iv = saveData.slice(offset, offset + 16);
  const encrypted = encryptAesCbc(characterData, AES_KEY, iv);
  const checksum = calculateMD5(encrypted);

  // Записываем контрольную сумму
  checksum.copy(saveData, offset);
  // Записываем зашифрованные данные
  encrypted.copy(saveData, offset + 16);
}

// Основная функция
function main() {
  console.log('=== Копирование инвентаря Dark Souls Remastered ===\n');

  // Проверяем существование файлов
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Ошибка: Исходный файл не найден: ${SOURCE_FILE}`);
    process.exit(1);
  }

  if (!fs.existsSync(TARGET_FILE)) {
    console.error(`Ошибка: Целевой файл не найден: ${TARGET_FILE}`);
    process.exit(1);
  }

  console.log(`Исходный файл: ${SOURCE_FILE}`);
  console.log(`Целевой файл: ${TARGET_FILE}`);
  console.log(`Слот: ${SLOT_INDEX}\n`);

  // Загружаем файлы
  const sourceSaveData = fs.readFileSync(SOURCE_FILE);
  const targetSaveData = fs.readFileSync(TARGET_FILE);

  console.log('Файлы загружены успешно');

  // Загружаем и расшифровываем персонажей
  const sourceCharacter = loadCharacter(sourceSaveData, SLOT_INDEX);
  const targetCharacter = loadCharacter(targetSaveData, SLOT_INDEX);

  console.log('Персонажи расшифрованы');

  // Получаем инвентарь
  const sourceItems = getAllItems(sourceCharacter);
  const targetItems = getAllItems(targetCharacter);

  console.log(`\nИсходный инвентарь: ${sourceItems.length} предметов`);
  console.log(`Целевой инвентарь: ${targetItems.length} предметов`);

  // Создаем карту существующих предметов в целевом инвентаре
  const targetItemKeys = new Set();
  for (const item of targetItems) {
    targetItemKeys.add(item.getKey());
  }

  console.log('\nПоиск предметов для добавления...');

  // Ищем предметы для добавления
  const itemsToAdd = [];
  for (const sourceItem of sourceItems) {
    const key = sourceItem.getKey();
    if (!targetItemKeys.has(key)) {
      itemsToAdd.push(sourceItem);
      console.log(`  [+] Предмет: Type=${sourceItem.itemType}, ID=${sourceItem.itemId}, Кол-во=${sourceItem.quantity}, Улучшение=${sourceItem.upgradeLevel}, Инфузия=${sourceItem.infusion}`);
    }
  }

  if (itemsToAdd.length === 0) {
    console.log('\nНет новых предметов для добавления. Все предметы из исходного инвентаря уже есть в целевом.');
    return;
  }

  console.log(`\nНайдено ${itemsToAdd.length} предметов для добавления`);

  // Находим пустые слоты и добавляем предметы
  let addedCount = 0;
  for (const item of itemsToAdd) {
    // Ищем пустой слот
    let emptySlot = -1;
    for (let i = 64; i < MAX_SLOTS; i++) {
      const offset = INVENTORY_START + i * ITEM_SIZE;
      if (offset + ITEM_SIZE > targetCharacter.length) break;

      const itemData = targetCharacter.slice(offset, offset + ITEM_SIZE);
      const slot = new InventoryItem(itemData, i);

      if (slot.isEmpty) {
        emptySlot = i;
        break;
      }
    }

    if (emptySlot === -1) {
      console.log(`  [!] Предупреждение: Не найден пустой слот для предмета Type=${item.itemType}, ID=${item.itemId}`);
      continue;
    }

    // Создаем новый предмет в целевом инвентаре
    const newItem = new InventoryItem(Buffer.alloc(28), emptySlot);
    newItem.itemType = item.itemType;
    newItem.itemId = item.itemId;
    newItem.quantity = item.quantity;

    // Копируем все данные из исходного предмета
    item.getRawData().copy(newItem.data);

    // Устанавливаем order для нового слота
    const orderOffset = 12;
    newItem.data[orderOffset] = emptySlot & 0xff;
    newItem.data[orderOffset + 1] = (emptySlot >> 8) & 0xff;
    newItem.data[orderOffset + 2] = (emptySlot >> 16) & 0xff;
    newItem.data[orderOffset + 3] = (emptySlot >> 24) & 0xff;

    writeSlot(targetCharacter, emptySlot, newItem);
    updateItemsNumber(targetCharacter, emptySlot);
    addedCount++;
    console.log(`  [✓] Добавлен в слот ${emptySlot}: Type=${item.itemType}, ID=${item.itemId}, Кол-во=${item.quantity}`);
  }

  console.log(`\nУспешно добавлено ${addedCount} предметов`);

  // Создаем резервную копию
  const backupFile = TARGET_FILE + '.backup';
  fs.copyFileSync(TARGET_FILE, backupFile);
  console.log(`\nСоздана резервная копия: ${backupFile}`);

  // Сохраняем обновленный файл
  saveCharacter(targetSaveData, targetCharacter, SLOT_INDEX);
  fs.writeFileSync(TARGET_FILE, targetSaveData);

  console.log(`\n✓ Файл успешно сохранен: ${TARGET_FILE}`);
  console.log('\n=== Копирование завершено успешно ===');
}

// Запускаем скрипт
try {
  main();
} catch (error) {
  console.error('\n✗ Ошибка при выполнении скрипта:');
  console.error(error);
  process.exit(1);
}
