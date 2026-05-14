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
    icon: path.join(__dirname, '../frontend/public/crm3.png'),
    backgroundColor: '#ffffff',
    show: false,
    autoHideMenuBar: true, // Hide menu bar completely
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default', // Mac style
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined, // Mac glass effect
    transparent: false,
    hasShadow: true,
    thickFrame: true,
    skipTaskbar: false, // Show in taskbar
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    alwaysOnTop: false,
    fullscreenable: true,
    kiosk: false,
    center: true, // Center window on screen
  });

  // Load the app - Use hosted server directly in production
  const startURL = isDev
    ? `http://localhost:${FRONTEND_PORT}`
    : `https://rms.rushcorporation.com`;  // Direct hosted server

  console.log('Loading URL:', startURL);
  mainWindow.loadURL(startURL);

  // Show window when ready with fade-in effect
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    
    // Fade in effect
    mainWindow.setOpacity(0);
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.05;
      mainWindow.setOpacity(opacity);
      if (opacity >= 1) {
        clearInterval(fadeIn);
      }
    }, 10);

    // Always open DevTools to debug the issue
    mainWindow.webContents.openDevTools();
  });

  // Window state management
  mainWindow.on('resize', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('move', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  // Window focus/blur effects
  mainWindow.on('focus', () => {
    if (tray) {
      tray.setHighlightMode('always');
    }
  });

  mainWindow.on('blur', () => {
    if (tray) {
      tray.setHighlightMode('never');
    }
  });

  // Prevent navigation away from app
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow navigation within the app domain
    if (parsedUrl.origin !== 'https://rms.rushcorporation.com' && 
        !navigationUrl.startsWith('http://localhost')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      
      // Show notification when minimizing to tray
      const { Notification } = require('electron');
      if (Notification.isSupported()) {
        new Notification({
          title: 'Rush CRM',
          body: 'App minimized to system tray. Click tray icon to restore.',
          icon: path.join(__dirname, '../frontend/public/crm3.png'),
          silent: true
        }).show();
      }
      
      mainWindow.hide();
      
      // Flash tray icon to show it's minimized
      if (tray) {
        tray.displayBalloon({
          title: 'Rush CRM',
          content: 'Running in background. Right-click tray icon for options.',
          icon: path.join(__dirname, '../frontend/public/crm3.png')
        });
      }
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
        label: '🚀 Rush CRM',
        enabled: false,
        icon: trayIconPath ? nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 }) : undefined
      },
      { type: 'separator' },
      {
        label: '📱 Show App',
        accelerator: 'CmdOrCtrl+Shift+R',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.flashFrame(false); // Stop flashing if it was
          }
        },
      },
      {
        label: '🙈 Hide App',
        accelerator: 'CmdOrCtrl+H',
        click: () => {
          if (mainWindow) {
            mainWindow.hide();
          }
        },
      },
      { type: 'separator' },
      {
        label: '🔔 Notifications',
        type: 'checkbox',
        checked: store.get('notifications-enabled', true),
        click: (menuItem) => {
          store.set('notifications-enabled', menuItem.checked);
          
          // Show confirmation
          if (Notification.isSupported()) {
            new Notification({
              title: 'Rush CRM',
              body: `Notifications ${menuItem.checked ? 'enabled' : 'disabled'}`,
              icon: trayIconPath,
              silent: !menuItem.checked
            }).show();
          }
        }
      },
      {
        label: '🔄 Check for Updates',
        click: () => {
          if (!isDev) {
            // Trigger update check
            const { Notification } = require('electron');
            if (Notification.isSupported()) {
              new Notification({
                title: 'Rush CRM',
                body: 'Checking for updates...',
                icon: trayIconPath
              }).show();
            }
          }
        }
      },
      { type: 'separator' },
      {
        label: '⚙️ Settings',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            // Navigate to settings page
            mainWindow.webContents.executeJavaScript(`
              if (window.location.hash !== '#/settings') {
                window.location.hash = '#/settings';
              }
            `);
          }
        }
      },
      {
        label: '📊 Dashboard',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            // Navigate to dashboard
            mainWindow.webContents.executeJavaScript(`
              if (window.location.hash !== '#/dashboard') {
                window.location.hash = '#/dashboard';
              }
            `);
          }
        }
      },
      { type: 'separator' },
      {
        label: '❌ Quit Rush CRM',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Rush CRM - Customer Relationship Management System');
    tray.setContextMenu(contextMenu);

    // Tray interactions
    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
          mainWindow.hide();
        } else {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // Single click behavior (Windows/Linux)
    tray.on('click', () => {
      if (process.platform !== 'darwin') {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

    // Balloon click (Windows)
    tray.on('balloon-click', () => {
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

  // Hide menu completely for clean desktop app look
  Menu.setApplicationMenu(null);
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
// Add global shortcuts for better UX
function setupGlobalShortcuts() {
  const { globalShortcut } = require('electron');
  
  // Register global shortcuts
  globalShortcut.register('CmdOrCtrl+Shift+R', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  
  globalShortcut.register('CmdOrCtrl+Shift+H', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });
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
    setupGlobalShortcuts();
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
  // Unregister all global shortcuts
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});
