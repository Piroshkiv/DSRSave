const PNG2Icons = require('png2icons');
const fs = require('fs');
const path = require('path');

const inputIcon = path.join(__dirname, 'src-tauri', 'icons', 'icon.png');
const outputIcon = path.join(__dirname, 'src-tauri', 'icons', 'icon.icns');

async function generateIcns() {
  console.log('Generating ICNS file...');

  const input = fs.readFileSync(inputIcon);
  const output = PNG2Icons.createICNS(input, PNG2Icons.BICUBIC, 0);

  fs.writeFileSync(outputIcon, output);
  console.log('✓ Generated icon.icns');
}

generateIcns().catch(console.error);
