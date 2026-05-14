const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, shell } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');

// Initialize electron store for persistent data
const store = new Store();

let mainWindow;
let tray;

// Backend server configuration
const BACKEND_PORT = process.env.BACKEND_PORT || 4000;
const FRONTEND_PORT = process.env.FRONTEND_PORT || 8080;
const PRODUCTION_FRONTEND_PORT = 8082; // Changed from 8081 to 8082

// No frontend server needed - removed completely
function startBackendServer() {
  return new Promise((resolve) => {
    // NO LOCAL BACKEND IN PRODUCTION - Always use hosted server
    console.log('Desktop app: Using hosted backend only');
    resolve();
  });
}

/**
 * Create the main application window
 */
function createWindow() {
  // Get saved window bounds or use defaults
  const windowBounds = store.get('windowBounds', {
    width: 1400,
    height: 900,
  });

  mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 1024,
    minHeight: 768,
    title: 'Rush CRM',
    // icon: path.join(__dirname, 'assets/icon.png'), // Commented out for now
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true, // Re-enable for HTTP server
    },
    frame: true,
    titleBarStyle: 'default',
  });

  // Load the app - Use hosted server directly in production
  const startURL = isDev
    ? `http://localhost:${FRONTEND_PORT}`
    : `https://rms.rushcorporation.com`;  // Direct hosted server

  console.log('Loading URL:', startURL);
  mainWindow.loadURL(startURL);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();

    // Always open DevTools to debug the issue
    mainWindow.webContents.openDevTools();
  });

  // Save window bounds
  mainWindow.on('resize', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('move', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  createMenu();
}

function createTray() {
  try {
    const trayIconPath = path.join(__dirname, 'assets/tray-icon.png');
    
    // Check if tray icon exists, if not skip tray creation
    const fs = require('fs');
    if (!fs.existsSync(trayIconPath)) {
      console.log('Tray icon not found, skipping system tray');
      return;
    }
    
    tray = new Tray(trayIconPath);

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          mainWindow.show();
        },
      },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Rush CRM');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    });
  } catch (error) {
    console.log('Failed to create system tray:', error.message);
  }
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.reload();
          },
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Rush CRM',
              message: 'Rush CRM Desktop',
              detail: `Version: ${app.getVersion()}`,
            });
          },
        },
      ],
    },
  ];

  if (isDev) {
    template.push({
      label: 'Developer',
      submenu: [
        { role: 'toggleDevTools' },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function setupIpcHandlers() {
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('store-get', (event, key) => {
    return store.get(key);
  });

  ipcMain.handle('store-set', (event, key, value) => {
    store.set(key, value);
  });

  ipcMain.handle('show-notification', (event, { title, body }) => {
    const { Notification } = require('electron');
    new Notification({ title, body }).show();
  });

  ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
  });
}

app.whenReady().then(async () => {
  try {
    console.log('Starting backend server...');
    await startBackendServer();
    console.log('Backend server started');

    // No frontend server needed - direct hosted server
    console.log('Skipping frontend server - using hosted server directly');

    setupIpcHandlers();
    createWindow();
    createTray();

    console.log('Application ready!');
  } catch (error) {
    console.error('Failed to start application:', error);
    dialog.showErrorBox('Startup Error', 'Failed to start the application.');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  // No cleanup needed - using hosted server directly
});
