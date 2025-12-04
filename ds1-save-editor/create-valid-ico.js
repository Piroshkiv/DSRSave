const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createValidIco() {
  console.log('Creating valid ICO file using to-ico...');

  const inputPng = path.join(__dirname, 'public', 'logo.png');
  const outputIco = path.join(__dirname, 'src-tauri', 'icons', 'icon.ico');

  try {
    // Create PNG buffers at different sizes
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const buffers = [];

    for (const size of sizes) {
      const buffer = await sharp(inputPng)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      buffers.push(buffer);
      console.log(`✓ Created ${size}x${size} PNG buffer`);
    }

    // Convert to ICO
    const ico = await toIco(buffers);
    fs.writeFileSync(outputIco, ico);

    console.log('✓ Successfully created valid icon.ico');
    console.log(`   File size: ${ico.length} bytes`);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

createValidIco();
