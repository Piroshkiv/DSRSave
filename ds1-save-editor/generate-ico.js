const pngToIco = require('png-to-ico');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputIcon = path.join(__dirname, 'public', 'logo.png');
const outputDir = path.join(__dirname, 'src-tauri', 'icons');

async function generateIco() {
  console.log('Generating proper .ico file...');

  // Generate multiple PNG sizes for the ICO
  const tempDir = path.join(__dirname, 'temp-icons');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const sizes = [16, 32, 48, 64, 128, 256];
  const pngFiles = [];

  for (const size of sizes) {
    const tempFile = path.join(tempDir, `icon-${size}.png`);
    await sharp(inputIcon)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(tempFile);
    pngFiles.push(tempFile);
    console.log(`✓ Created temp ${size}x${size} PNG`);
  }

  // Create .ico file
  const icoBuffer = await pngToIco(pngFiles);
  fs.writeFileSync(path.join(outputDir, 'icon.ico'), icoBuffer);
  console.log('✓ Generated icon.ico');

  // Clean up temp files
  for (const file of pngFiles) {
    fs.unlinkSync(file);
  }
  fs.rmdirSync(tempDir);

  console.log('✅ ICO generation complete!');
}

generateIco().catch(console.error);
