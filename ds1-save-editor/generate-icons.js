const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputIcon = path.join(__dirname, 'public', 'logo.png');
const outputDir = path.join(__dirname, 'src-tauri', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  // Windows Store logos
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

async function generateIcons() {
  console.log('Generating icons from:', inputIcon);

  for (const { name, size } of sizes) {
    const outputPath = path.join(outputDir, name);
    try {
      await sharp(inputIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${name}`);
    } catch (error) {
      console.error(`✗ Failed to generate ${name}:`, error.message);
    }
  }

  // Generate .ico file (Windows icon)
  // ICO format needs multiple sizes embedded
  try {
    const icoSizes = [16, 32, 48, 64, 128, 256];
    const icoBuffers = [];

    for (const size of icoSizes) {
      const buffer = await sharp(inputIcon)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      icoBuffers.push(buffer);
    }

    // For now, just create a 256x256 PNG and rename to .ico
    // A proper ICO would need a dedicated library
    await sharp(inputIcon)
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon.ico'));

    console.log('✓ Generated icon.ico (Note: Install @fiahfy/icns for proper ICO format)');
  } catch (error) {
    console.error('✗ Failed to generate icon.ico:', error.message);
  }

  console.log('\n✅ Icon generation complete!');
  console.log('\nNote: For production builds, you may want to:');
  console.log('1. Install png-to-ico: npm install -g png-to-ico');
  console.log('2. Convert icon.png to proper .ico format');
  console.log('3. For macOS .icns, use: npm install -g png2icons');
}

generateIcons().catch(console.error);
