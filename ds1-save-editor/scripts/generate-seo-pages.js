const fs = require('fs');
const path = require('path');

// Meta tags для каждого роута
const routeMetaTags = {
  '/ds1': {
    title: 'Dark Souls Remastered Save Editor - DSR/DS1 Online Editor',
    description: 'Free online Dark Souls Remastered (DSR) save editor. Edit stats, level, humanity, inventory, and character data directly in your browser. No download required.',
    keywords: 'dark souls save editor, dark souls 1 save editor, dsr save editor, ds1 save editor online, dark souls remastered save editor, dark souls character editor, dark souls stats editor, dark souls inventory editor, ptde save editor, dark souls editor online, save editor dark souls, ds1 editor, dark souls 1 editor, ds remastered editor',
    ogTitle: 'Dark Souls Remastered Save Editor (DSR) — Online',
    ogDescription: 'Free online Dark Souls Remastered (DSR) save editor. Edit stats, level, humanity, inventory, and character data directly in your browser.',
    canonical: 'https://dsrsaveeditor.pages.dev/ds1',
  },
  '/ds3': {
    title: 'Dark Souls 3 Save Editor - DS3 Online Editor',
    description: 'Free online Dark Souls 3 (DS3) save editor. Edit character stats, level, embers, inventory, weapons, armor, and more directly in your browser.',
    keywords: 'dark souls 3 save editor, ds3 save editor, dark souls 3 editor, ds3 character editor, dark souls 3 stats editor, ds3 inventory editor, dark souls iii save editor, ds3 online editor',
    ogTitle: 'Dark Souls 3 Save Editor — Online',
    ogDescription: 'Free online Dark Souls 3 (DS3) save editor. Edit stats, embers, inventory, and more in your browser.',
    canonical: 'https://dsrsaveeditor.pages.dev/ds3',
  },
};

function updateMetaTags(html, meta) {
  let result = html;

  // Update title (all occurrences)
  result = result.replace(
    /<title>.*?<\/title>/g,
    `<title>${meta.title}</title>`
  );

  // Update description (all occurrences)
  result = result.replace(
    /<meta name="description" content=".*?"(\s*\/?>)/g,
    `<meta name="description" content="${meta.description}" />`
  );

  // Update keywords (all occurrences)
  result = result.replace(
    /<meta name="keywords" content=".*?"(\s*\/?>)/g,
    `<meta name="keywords" content="${meta.keywords}" />`
  );

  // Update canonical (all occurrences)
  result = result.replace(
    /<link rel="canonical" href=".*?"(\s*\/>|>)/g,
    `<link rel="canonical" href="${meta.canonical}">`
  );

  // Update og:url (all occurrences)
  result = result.replace(
    /<meta property="og:url" content=".*?"(\s*\/?>)/g,
    `<meta property="og:url" content="${meta.canonical}" />`
  );

  // Update og:title (all occurrences)
  result = result.replace(
    /<meta property="og:title" content=".*?"(\s*\/?>)/g,
    `<meta property="og:title" content="${meta.ogTitle}" />`
  );

  // Update og:description (all occurrences)
  result = result.replace(
    /<meta property="og:description" content=".*?"(\s*\/?>)/g,
    `<meta property="og:description" content="${meta.ogDescription}" />`
  );

  // Update twitter:title (all occurrences)
  result = result.replace(
    /<meta name="twitter:title" content=".*?"(\s*\/?>)/g,
    `<meta name="twitter:title" content="${meta.ogTitle}" />`
  );

  // Update twitter:description (all occurrences)
  result = result.replace(
    /<meta name="twitter:description" content=".*?"(\s*\/?>)/g,
    `<meta name="twitter:description" content="${meta.ogDescription}" />`
  );

  return result;
}

function generateSeoPages() {
  const distDir = path.join(__dirname, '..', 'dist');
  const indexPath = path.join(distDir, 'index.html');

  // Read the base index.html
  const baseHtml = fs.readFileSync(indexPath, 'utf8');

  // Generate HTML for each route
  Object.entries(routeMetaTags).forEach(([route, meta]) => {
    const routeDir = path.join(distDir, route.slice(1)); // Remove leading slash
    const routeIndexPath = path.join(routeDir, 'index.html');

    // Create directory if it doesn't exist
    if (!fs.existsSync(routeDir)) {
      fs.mkdirSync(routeDir, { recursive: true });
    }

    // Update meta tags
    const updatedHtml = updateMetaTags(baseHtml, meta);

    // Write the file
    fs.writeFileSync(routeIndexPath, updatedHtml);
    console.log(`✓ Generated ${route}/index.html with SEO meta tags`);
  });

  console.log('\n✅ All SEO pages generated successfully!');
}

// Run the script
generateSeoPages();
