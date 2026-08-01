const fs = require('fs');
const path = require('path');
const https = require('https');

// GitHub URLs
const GITHUB_URLS = {
  armor: 'https://raw.githubusercontent.com/alfizari/Dark-Souls-3-Save-Editor-PS4-PC/main/src/Resources/Json/armor.json',
  goods_magic: 'https://raw.githubusercontent.com/alfizari/Dark-Souls-3-Save-Editor-PS4-PC/main/src/Resources/Json/goods_magic.json',
  goods_magic_bulk: 'https://raw.githubusercontent.com/alfizari/Dark-Souls-3-Save-Editor-PS4-PC/main/src/Resources/Json/goods_magic_bulk.json',
  itemshex: 'https://raw.githubusercontent.com/alfizari/Dark-Souls-3-Save-Editor-PS4-PC/main/src/Resources/Json/itemshex.json',
  ring: 'https://raw.githubusercontent.com/alfizari/Dark-Souls-3-Save-Editor-PS4-PC/main/src/Resources/Json/ring.json',
  weapons: 'https://raw.githubusercontent.com/alfizari/Dark-Souls-3-Save-Editor-PS4-PC/main/src/Resources/Json/weapons.json'
};

// Load local JSON
const localJsonPath = path.join(__dirname, '../public/json/ds3_items.json');
const localData = JSON.parse(fs.readFileSync(localJsonPath, 'utf8'));

// Extract all IDs from local JSON
function extractLocalIds(data) {
  const ids = new Set();

  Object.keys(data).forEach(category => {
    if (Array.isArray(data[category])) {
      data[category].forEach(item => {
        if (item.Id) {
          // Normalize to uppercase hex without 0x prefix
          const normalizedId = item.Id.replace('0x', '').replace('0X', '').toUpperCase();
          ids.add(normalizedId);
        }
      });
    }
  });

  return ids;
}

// Fetch JSON from URL
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Extract IDs from GitHub JSON (various formats)
function extractGitHubIds(data, source) {
  const ids = new Set();

  // Handle different JSON structures
  if (Array.isArray(data)) {
    // Array format
    data.forEach(item => {
      if (item.id) {
        const normalizedId = item.id.toString(16).toUpperCase().padStart(8, '0');
        ids.add(normalizedId);
      }
      if (item.ID) {
        const normalizedId = item.ID.toString(16).toUpperCase().padStart(8, '0');
        ids.add(normalizedId);
      }
      if (item.Id) {
        const normalizedId = typeof item.Id === 'string'
          ? item.Id.replace('0x', '').replace('0X', '').toUpperCase()
          : item.Id.toString(16).toUpperCase().padStart(8, '0');
        ids.add(normalizedId);
      }
      // For itemshex format
      if (item.type !== undefined && item.value !== undefined) {
        // Combine type and value
        const normalizedId = item.value.toString(16).toUpperCase().padStart(8, '0');
        ids.add(normalizedId);
      }
    });
  } else if (typeof data === 'object') {
    // Object format
    Object.values(data).forEach(item => {
      if (typeof item === 'object') {
        if (item.id) {
          const normalizedId = item.id.toString(16).toUpperCase().padStart(8, '0');
          ids.add(normalizedId);
        }
        if (item.ID) {
          const normalizedId = item.ID.toString(16).toUpperCase().padStart(8, '0');
          ids.add(normalizedId);
        }
        if (item.Id) {
          const normalizedId = typeof item.Id === 'string'
            ? item.Id.replace('0x', '').replace('0X', '').toUpperCase()
            : item.Id.toString(16).toUpperCase().padStart(8, '0');
          ids.add(normalizedId);
        }
      }
    });
  }

  console.log(`  Extracted ${ids.size} IDs from ${source}`);
  return ids;
}

async function main() {
  console.log('Loading local ds3_items.json...');
  const localIds = extractLocalIds(localData);
  console.log(`Found ${localIds.size} unique IDs in local JSON\n`);

  const allGitHubIds = new Set();
  const missingBySource = {};

  console.log('Fetching GitHub JSON files...\n');

  for (const [name, url] of Object.entries(GITHUB_URLS)) {
    try {
      console.log(`Fetching ${name}...`);
      const githubData = await fetchJson(url);
      const githubIds = extractGitHubIds(githubData, name);

      // Find missing IDs
      const missing = [...githubIds].filter(id => !localIds.has(id));

      if (missing.length > 0) {
        missingBySource[name] = missing;
        console.log(`  ⚠️  Found ${missing.length} missing IDs`);
      } else {
        console.log(`  ✅ All IDs present`);
      }

      // Add to combined set
      githubIds.forEach(id => allGitHubIds.add(id));

    } catch (error) {
      console.error(`  ❌ Error fetching ${name}:`, error.message);
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total GitHub IDs: ${allGitHubIds.size}`);
  console.log(`Total Local IDs: ${localIds.size}`);

  const totalMissing = [...allGitHubIds].filter(id => !localIds.has(id));
  console.log(`Total Missing IDs: ${totalMissing.length}\n`);

  if (totalMissing.length > 0) {
    console.log('Missing IDs by source:');
    for (const [source, ids] of Object.entries(missingBySource)) {
      console.log(`\n${source} (${ids.length} missing):`);
      ids.forEach(id => {
        console.log(`  0x${id}`);
      });
    }
  } else {
    console.log('✅ No missing IDs found!');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
