const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function fixIco() {
  console.log('Creating proper ICO file...');

  // Use only the 256x256 PNG for ICO
  const inputPng = path.join(__dirname, 'src-tauri', 'icons', 'icon.png');
  const outputIco = path.join(__dirname, 'src-tauri', 'icons', 'icon.ico');

  try {
    const buf = await pngToIco(inputPng);
    fs.writeFileSync(outputIco, buf);
    console.log('✓ Created valid icon.ico');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixIco();
