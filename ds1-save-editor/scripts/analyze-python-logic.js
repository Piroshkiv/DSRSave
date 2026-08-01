/*
Анализ Python кода (Final.py):

=== add_weapon логика ===

1. Находит fixed_pattern_3:
   00 FF FF FF FF 00 00 00 00 00 00 00 00 00 00 00 00
   FF FF FF FF 00 00 00 00 00 00 00 00 00 00 00 00 ...

2. Находит fixed_pattern_1:
   80 00 00 00 00 00 00 00 00 FF FF FF FF 00 00 00 00

3. inject_offset = fixed_pattern_1_offset + 5

4. Создает default_pattern_1:
   B7 12 80 80 90 AB 1E 00 46 00 00 00 02 00 00 00 ...
   [4:8] = weapon_id_bytes (Item ID)

5. Берет bytes 0-1 из ПРЕДЫДУЩЕГО слота:
   byte_60th_offset = inject_offset - 60
   byte_59th_offset = inject_offset - 59

   byte_60th = file.read(byte_60th_offset)  // Byte 0 предыдущего
   byte_59th = file.read(byte_59th_offset)  // Byte 1 предыдущего

   new_byte_60th = (byte_60th + 1) & 0xFF
   default_pattern_1[0] = new_byte_60th
   default_pattern_1[1] = byte_59th

   if new_byte_60th == 0:
       new_byte_59th = (byte_59th + 1) & 0xFF
       default_pattern_1[1] = new_byte_59th

6. Берет byte 12 из ПРЕДЫДУЩЕГО слота:
   third_counter_offset = default_pattern_2_offset - 4
   reference_value = file.read(third_counter_offset)
   new_third_counter_value = (reference_value + 1) & 0xFF
   default_pattern_2[12] = new_third_counter_value

7. Bytes 14-15 остаются 0x00 0x00

=== Ключевые отличия ===

Python:
- Вставляет в КОНКРЕТНОЕ место (fixed_pattern_1_offset + 5)
- Bytes 0-1: берет из предыдущего слота (offset - 60) и инкрементирует
- Byte 12: берет из предыдущего слота (offset - 4) и инкрементирует
- Bytes 14-15: всегда 0x00 0x00

Мой код:
- Ищет 2 пустых слота подряд
- Bytes 0-1: использует Counter1
- Byte 12: берет из предыдущего непустого слота и инкрементирует
- Bytes 14-15: копирует из существующего или 0x00 0x00
*/

console.log('=== Python Logic Analysis ===\n');

console.log('Python берет bytes 0-1 из ПРЕДЫДУЩЕГО СЛОТА (inject_offset - 60):');
console.log('  byte_60th = file[inject_offset - 60]');
console.log('  byte_59th = file[inject_offset - 59]');
console.log('  new_byte_60th = (byte_60th + 1) & 0xFF');
console.log('  if new_byte_60th == 0: byte_59th++');
console.log('');

console.log('Мой код берет bytes 0-1 из Counter1:');
console.log('  const itemCounter = this.readCounter1();');
console.log('  newItemData[0] = itemCounter & 0xFF;');
console.log('  newItemData[1] = (itemCounter >> 8) & 0xFF;');
console.log('');

console.log('=== ПРОБЛЕМА ===');
console.log('Python: bytes 0-1 = предыдущий слот + 1');
console.log('Мой код: bytes 0-1 = Counter1');
console.log('');
console.log('Но мы видели что Counter1 != bytes 0-1 последнего предмета!');
console.log('');
console.log('Нужно проверить: inject_offset - 60 это предыдущий СЛОТ или предыдущий НЕПУСТОЙ предмет?');

const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot1_raw (11).bin';

console.log('\n=== Проверка логики Python ===');
console.log('Читаем сохранение...\n');

const data = fs.readFileSync(SAVE_FILE);

// Find pattern
const pattern = [
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
];

function findPattern(data) {
  for (let i = 0; i <= data.length - pattern.length; i++) {
    let found = true;
    for (let j = 0; j < pattern.length; j++) {
      if (data[i + j] !== pattern[j]) {
        found = false;
        break;
      }
    }
    if (found) {
      return i;
    }
  }
  return -1;
}

const patternOffset = findPattern(data);
const inventoryStart = patternOffset + 0x9C;

// Shortsword в Slot 26
const shortswordSlot = 26;
const shortswordOffset = inventoryStart + (shortswordSlot * 16);

console.log(`Shortsword в Slot ${shortswordSlot}:`);
console.log(`  Offset: 0x${shortswordOffset.toString(16).toUpperCase()}`);

const shortswordBytes = Array.from(data.slice(shortswordOffset, shortswordOffset + 16));
console.log(`  Bytes: ${shortswordBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);

const bytes01 = shortswordBytes[0] | (shortswordBytes[1] << 8);
console.log(`  Bytes 0-1: 0x${bytes01.toString(16).toUpperCase()} (${bytes01})`);

// Проверим что на offset - 60 (это будет предыдущий слот, Slot 25, т.к. 60 байт назад = 3 слота + 12 байт)
console.log('\nПроверка offset - 60:');
const prevOffset60 = shortswordOffset - 60;
const slot60 = Math.floor((prevOffset60 - inventoryStart) / 16);
console.log(`  offset - 60 = 0x${prevOffset60.toString(16).toUpperCase()} (это Slot ${slot60}, byte ${(prevOffset60 - inventoryStart) % 16})`);

// 60 байт назад = 3 слота назад + 12 байт
// Slot 26 offset = inventoryStart + 26*16
// offset - 60 = inventoryStart + 26*16 - 60 = inventoryStart + 416 - 60 = inventoryStart + 356
// 356 / 16 = 22.25, значит это Slot 22, byte 4

const byte60 = data[prevOffset60];
const byte59 = data[prevOffset60 + 1];
console.log(`  Byte на offset-60: 0x${byte60.toString(16).toUpperCase()}`);
console.log(`  Byte на offset-59: 0x${byte59.toString(16).toUpperCase()}`);
console.log(`  Это байты 4-5 слота ${slot60}`);

// Читаем весь Slot 22
const slot22Offset = inventoryStart + (22 * 16);
const slot22Bytes = Array.from(data.slice(slot22Offset, slot22Offset + 16));
console.log(`\nSlot 22 (offset - 60 указывает сюда):`);
console.log(`  Bytes: ${slot22Bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
console.log(`  Bytes 0-1: 0x${(slot22Bytes[0] | (slot22Bytes[1] << 8)).toString(16).toUpperCase()}`);
console.log(`  Bytes 4-5: 0x${byte60.toString(16).toUpperCase()} 0x${byte59.toString(16).toUpperCase()}`);

// Проверим Slot 25 (реальный предыдущий слот)
const slot25Offset = inventoryStart + (25 * 16);
const slot25Bytes = Array.from(data.slice(slot25Offset, slot25Offset + 16));
console.log(`\nSlot 25 (предыдущий слот перед Shortsword):`);
console.log(`  Bytes: ${slot25Bytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}`);
const slot25_bytes01 = slot25Bytes[0] | (slot25Bytes[1] << 8);
console.log(`  Bytes 0-1: 0x${slot25_bytes01.toString(16).toUpperCase()} (${slot25_bytes01})`);

console.log(`\n=== Анализ ===`);
console.log(`Shortsword bytes 0-1: ${bytes01}`);
console.log(`Slot 25 bytes 0-1: ${slot25_bytes01}`);
console.log(`Разница: ${bytes01 - slot25_bytes01}`);
console.log(`Это slot25 + 1? ${bytes01 === slot25_bytes01 + 1 ? 'YES ✓' : 'NO ✗'}`);

// Проверим Counter1
const counter1Offset = patternOffset + 472;
const counter1 = data[counter1Offset] | (data[counter1Offset + 1] << 8);
console.log(`\nCounter1: ${counter1}`);
console.log(`Shortsword bytes 0-1: ${bytes01}`);
console.log(`Counter1 == bytes 0-1? ${counter1 === bytes01 ? 'YES ✓' : 'NO ✗'}`);
