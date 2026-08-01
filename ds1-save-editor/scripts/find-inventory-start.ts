import * as fs from 'fs';
import * as path from 'path';
import { DS3SaveFileEditor } from '../src/apps/ds3/lib/SaveFileEditor';
import { DS3Character } from '../src/apps/ds3/lib/Character';

// Загружаем ds3_items.json
const itemsJsonPath = path.join(__dirname, '../public/json/ds3_items.json');
const itemsData = JSON.parse(fs.readFileSync(itemsJsonPath, 'utf8'));

// Создаем Map для быстрого поиска по ID
const itemsById = new Map<number, { name: string; category: string; maxStack: number }>();

// Обрабатываем все категории предметов
Object.keys(itemsData).forEach(category => {
  if (Array.isArray(itemsData[category])) {
    itemsData[category].forEach((item: any) => {
      if (item.Id) {
        // Конвертируем hex string в число
        const id = parseInt(item.Id, 16);
        itemsById.set(id, {
          name: item.Name,
          category: category,
          maxStack: item.MaxStackCount || 1
        });
      }
    });
  }
});

console.log(`Loaded ${itemsById.size} items from ds3_items.json\n`);

async function findInventoryStart(savePath: string, slotIndex: number) {
  // Читаем файл
  const fileBuffer = fs.readFileSync(savePath);
  const file = new File([fileBuffer], path.basename(savePath));

  // Загружаем сейв через SaveFileEditor
  const editor = await DS3SaveFileEditor.fromFile(file);
  const character = editor.getCharacter(slotIndex);

  if (!character) {
    console.error(`Character slot ${slotIndex} not found or is empty!`);
    return;
  }

  console.log(`Character slot ${slotIndex} loaded successfully!`);

  // Получаем сырые данные персонажа
  const characterData = character.getRawData();
  console.log(`Character data size: ${characterData.length} bytes\n`);

  // Получаем оффсет паттерна через приватное поле (хак)
  // @ts-ignore - доступ к приватному полю
  const pattern1Offset = character.patternOffset;

  if (pattern1Offset === null || pattern1Offset === -1) {
    console.error('Pattern not found in character data!');
    return;
  }

  console.log(`Pattern found at offset: 0x${pattern1Offset.toString(16).toUpperCase()}`);

  const knownQuantityOffset = 0x404;
  const absoluteQuantityOffset = pattern1Offset + knownQuantityOffset;

  console.log(`Known item quantity offset: 0x404 (relative to pattern 1)`);
  console.log(`Absolute quantity offset: 0x${absoluteQuantityOffset.toString(16).toUpperCase()}\n`);

  console.log('='.repeat(100));
  console.log('Scanning BACKWARDS from known item, parsing item structures...');
  console.log('='.repeat(100));
  console.log('');

  console.log('Offset (rel) | Offset (abs) | Hex Data (16 bytes)                              | ItemID     | Qty | Name');
  console.log('-'.repeat(140));

  // Идем назад на 2000 байт от известной позиции
  for (let relOffset = knownQuantityOffset; relOffset >= knownQuantityOffset - 2000; relOffset--) {
    const absOffset = pattern1Offset + relOffset;

    if (absOffset < 0 || absOffset >= characterData.length) continue;

    // Читаем 16 байт для анализа
    const hexData = characterData.slice(absOffset, Math.min(absOffset + 16, characterData.length));
    const hexString = Array.from(hexData)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    // Пытаемся прочитать как количество (на текущей позиции)
    const quantity = characterData[absOffset];

    // Пытаемся прочитать Item ID 4 байтами раньше (если это количество)
    if (absOffset - 4 >= 0) {
      const itemIdOffset = absOffset - 4;
      const itemId = new DataView(characterData.buffer, characterData.byteOffset).getUint32(itemIdOffset, true);

      // Проверяем есть ли такой предмет
      const item = itemsById.get(itemId);

      if (item) {
        const relOffsetHex = `0x${relOffset.toString(16).toUpperCase().padStart(3, '0')}`;
        const absOffsetHex = `0x${absOffset.toString(16).toUpperCase()}`;
        const itemIdHex = `0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`;

        console.log(
          `${relOffsetHex.padEnd(12)} | ${absOffsetHex.padEnd(12)} | ${hexString.padEnd(48)} | ${itemIdHex} | ${quantity.toString().padStart(3)} | ${item.name}`
        );
      }
    }

    // Также пытаемся прочитать как Item ID (на текущей позиции)
    if (absOffset + 4 <= characterData.length) {
      const itemId = new DataView(characterData.buffer, characterData.byteOffset).getUint32(absOffset, true);
      const item = itemsById.get(itemId);

      // Проверяем количество после Item ID
      if (item && absOffset + 4 < characterData.length) {
        const qtyAfter = characterData[absOffset + 4];

        // Выводим только если это не было выведено выше
        const prevItemId = absOffset - 4 >= 0
          ? new DataView(characterData.buffer, characterData.byteOffset).getUint32(absOffset - 4, true)
          : 0;

        if (!itemsById.get(prevItemId)) {
          const relOffsetHex = `0x${relOffset.toString(16).toUpperCase().padStart(3, '0')}`;
          const absOffsetHex = `0x${absOffset.toString(16).toUpperCase()}`;
          const itemIdHex = `0x${itemId.toString(16).toUpperCase().padStart(8, '0')}`;

          console.log(
            `${relOffsetHex.padEnd(12)} | ${absOffsetHex.padEnd(12)} | ${hexString.padEnd(48)} | ${itemIdHex} | ${qtyAfter.toString().padStart(3)} | ${item.name} [ID at offset]`
          );
        }
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('Scan complete. When garbage/null data appears - that\'s the inventory start!');
  console.log('='.repeat(100));
}

// Получаем путь к сейв файлу и слот из аргументов командной строки
const savePath = process.argv[2];
const slotIndex = parseInt(process.argv[3] || '0', 10);

if (!savePath) {
  console.error('Usage: ts-node find-inventory-start.ts <path-to-save-file> [slot-index]');
  console.error('Example: ts-node find-inventory-start.ts "C:\\Users\\...\\DS30000.sl2" 0');
  process.exit(1);
}

if (!fs.existsSync(savePath)) {
  console.error(`File not found: ${savePath}`);
  process.exit(1);
}

console.log(`Analyzing save file: ${savePath}`);
console.log(`Character slot: ${slotIndex}\n`);

findInventoryStart(savePath, slotIndex).catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
