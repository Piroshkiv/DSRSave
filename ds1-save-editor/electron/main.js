const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

// Check for debug mode: environment variable or custom command line argument
const isDebug =
  process.env.NODE_ENV === 'development' ||
  process.env.ELECTRON_DEBUG === '1' ||
  process.argv.includes('--devtools');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../build/icon.ico')
  });

  // Remove menu bar
  mainWindow.setMenu(null);

  // Load the app
  const startUrl = path.join(__dirname, '../dist/index.html');
  mainWindow.loadFile(startUrl);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Intercept navigation to external links
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Enable console logging in debug mode
  if (isDebug) {
    console.log('🐛 Debug mode enabled - Console logging active');
    console.log('   App starting at:', startUrl);

    // Log console messages from renderer process
    mainWindow.webContents.on('console-message', (event, level, message) => {
      const levelNames = { 0: 'verbose', 1: 'info', 2: 'warning', 3: 'error' };
      const levelName = levelNames[level] || 'unknown';
      const prefix = `[Renderer ${levelName}]`;

      if (level === 3) { // error
        console.error(prefix, message);
      } else if (level === 2) { // warning
        console.warn(prefix, message);
      } else {
        console.log(prefix, message);
      }
    });

    // Log page load events
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✓ Page loaded successfully');
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('✗ Page failed to load:', errorCode, errorDescription);
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
