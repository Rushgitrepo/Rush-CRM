const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

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
    icon: path.join(__dirname, '../frontend/public/crm3.png'), // Use crm3.png from public folder
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
    // Use crm3.png from frontend public folder
    let trayIconPath = path.join(__dirname, '../frontend/public/crm3.png');
    
    // Check if tray icon exists
    const fs = require('fs');
    if (!fs.existsSync(trayIconPath)) {
      console.log('Tray icon not found at:', trayIconPath);
      // Fallback to assets folder
      trayIconPath = path.join(__dirname, 'assets/crm3.png');
      if (!fs.existsSync(trayIconPath)) {
        console.log('Using default tray icon');
        trayIconPath = null;
      }
    }
    
    tray = new Tray(trayIconPath || nativeImage.createEmpty());

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Rush CRM',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Show App',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Hide App',
        click: () => {
          if (mainWindow) {
            mainWindow.hide();
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Notifications',
        type: 'checkbox',
        checked: true,
        click: (menuItem) => {
          store.set('notifications-enabled', menuItem.checked);
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Rush CRM',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Rush CRM - Customer Relationship Management');
    tray.setContextMenu(contextMenu);

    // Double click to show/hide
    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // Single click to show
    tray.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
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

function setupAutoUpdater() {
  if (isDev) {
    console.log('Auto-updater disabled in development');
    return;
  }

  // Configure auto updater
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    
    // Show notification
    const { Notification } = require('electron');
    if (Notification.isSupported()) {
      new Notification({
        title: 'Rush CRM Update Available',
        body: `Version ${info.version} is available. Downloading...`,
        icon: path.join(__dirname, '../frontend/public/crm3.png') // Use crm3.png
      }).show();
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available:', info.version);
  });

  autoUpdater.on('error', (err) => {
    console.log('Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "Download speed: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    console.log(log_message);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version);
    
    // Show dialog to restart
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: `Rush CRM ${info.version} has been downloaded. Restart the application to apply the update.`,
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 60 * 60 * 1000);
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

  ipcMain.handle('show-notification', (event, { title, body, icon }) => {
    const { Notification } = require('electron');
    
    if (Notification.isSupported()) {
      const notification = new Notification({ 
        title, 
        body,
        icon: icon || path.join(__dirname, '../frontend/public/crm3.png'), // Use crm3.png for notifications
        silent: false
      });
      
      notification.show();
      
      notification.on('click', () => {
        // Show main window when notification clicked
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });
      
      return true;
    }
    return false;
  });

  ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
  });

  // Check for updates manually
  ipcMain.handle('check-for-updates', () => {
    if (!isDev) {
      autoUpdater.checkForUpdatesAndNotify();
    }
    return !isDev;
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
    setupAutoUpdater();
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
