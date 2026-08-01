const fs = require('fs');

const SAVE_FILE = 'C:\\Users\\Iho\\Downloads\\character_slot0_raw (7).bin';

// Известные ID из предыдущих скриптов
const knownItems = [
  { id: 0x000F695A, name: 'Bandit\'s Knife +10' },
  { id: 0x00C96A85, name: 'Izalith Staff +5' },
  { id: 0x006C7D75, name: 'Dragonslayer Greataxe +5' },
  { id: 0x01511115, name: 'Wolf Knight\'s Greatshield +5' },
  { id: 0x00D8379A, name: 'Sniper Crossbow +10' },
  { id: 0x0001ADB0, name: 'Fists +0' },
];

function main() {
  const saveData = fs.readFileSync(SAVE_FILE);

  for (const item of knownItems) {
    console.log(`\n=== Searching for: ${item.name} (0x${item.id.toString(16).toUpperCase().padStart(8, '0')}) ===\n`);

    let found = 0;

    for (let i = 0; i < saveData.length - 4; i++) {
      const readId = saveData.readUInt32LE(i);

      if (readId === item.id) {
        found++;

        console.log(`Found #${found} at offset 0x${i.toString(16).toUpperCase()}`);

        // Показываем 48 байт: 16 до, ID (4), и 28 после
        const bytes = [];
        for (let j = Math.max(0, i - 16); j < Math.min(saveData.length, i + 32); j++) {
          const hex = saveData[j].toString(16).toUpperCase().padStart(2, '0');
          if (j === i) {
            bytes.push(`[${hex}`);
          } else if (j === i + 3) {
            bytes.push(`${hex}]`);
          } else {
            bytes.push(hex);
          }
        }

        console.log(`  ${bytes.join(' ')}`);

        // Анализируем структуру после ID
        if (i + 16 <= saveData.length) {
          const qty1 = saveData.readUInt32LE(i + 4);
          const qty2 = saveData.readUInt16LE(i + 4);
          const byte8 = saveData[i + 8];
          const byte9 = saveData[i + 9];
          const uint16_10 = saveData.readUInt16LE(i + 10);
          const uint16_12 = saveData.readUInt16LE(i + 12);
          const uint32_12 = saveData.readUInt32LE(i + 12);

          console.log(`    +4 (qty?): ${qty2} (uint16) / ${qty1} (uint32)`);
          console.log(`    +8: 0x${byte8.toString(16).toUpperCase()}`);
          console.log(`    +9: 0x${byte9.toString(16).toUpperCase()}`);
          console.log(`    +10 (dur?): ${uint16_10}`);
          console.log(`    +12: ${uint16_12} (uint16) / ${uint32_12} (uint32)`);
        }

        console.log('');

        if (found >= 5) break; // Показываем максимум 5 вхождений
      }
    }

    if (found === 0) {
      console.log('  Not found');
    }
  }
}

main();
