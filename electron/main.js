const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, shell, nativeImage, Notification } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const {
  setupAutoUpdater,
  checkForUpdates,
  scheduleUpdateCheck,
  setMainWindow: setUpdaterMainWindow,
} = require('./autoUpdater');

// Initialize electron store for persistent data
const store = new Store();

let mainWindow;
let tray;

// Persist cookies/localStorage for the hosted app between app restarts
const PERSISTENT_SESSION = 'persist:rushcrm';

/**
 * Get the correct icon path for different environments
 */
function getIconPath() {
  const iconPaths = [
    path.join(__dirname, '../frontend/public/crm3.png'),
    path.join(__dirname, 'assets/crm3.png'),
    path.join(process.resourcesPath, 'crm3.png'),
    path.join(__dirname, 'crm3.png')
  ];

  const fs = require('fs');
  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      console.log('Using icon from:', iconPath);
      return iconPath;
    }
  }

  console.log('No custom icon found, using default');
  return null;
}

const FRONTEND_PORT = process.env.FRONTEND_PORT || 8080;
const HOSTED_APP_URL = 'https://rms.rushcorporation.com';

/**
 * Base URL for the renderer (dev server vs hosted production app).
 */
function getAppBaseURL() {
  return isDev ? `http://localhost:${FRONTEND_PORT}` : HOSTED_APP_URL;
}

/**
 * setHighlightMode is macOS-only; calling it on Windows throws.
 */
function setTrayHighlightMode(mode) {
  if (process.platform !== 'darwin' || !tray) return;
  if (typeof tray.setHighlightMode === 'function') {
    tray.setHighlightMode(mode);
  }
}

// Notification settings
let notificationSettings = {
  enabled: true,
  sound: true,
  showPreview: true,
  minimizeToTray: true
};

/**
 * Create the main application window
 * @param {boolean} hiddenOnStart - Whether to start the window hidden (for auto-launch)
 */
function createWindow(hiddenOnStart = false) {
  // Get saved window bounds or use defaults
  const windowBounds = store.get('windowBounds', {
    width: 1400,
    height: 900,
  });

  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    ...windowBounds,
    minWidth: 1024,
    minHeight: 768,
    title: 'Rush CRM',
    icon: iconPath,
    backgroundColor: '#ffffff',
    show: false,
    frame: true, // Keep frame but hide menu
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
      partition: PERSISTENT_SESSION,
    },
    skipTaskbar: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    center: true,
    autoHideMenuBar: true, // Auto-hide menu bar
  });

  // COMPLETELY REMOVE MENU - Multiple approaches for different platforms
  if (process.platform === 'darwin') {
    // macOS - Create empty menu
    const template = [];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    // Windows/Linux - Remove menu completely
    Menu.setApplicationMenu(null);
  }

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);

  const startURL = getAppBaseURL();
  console.log('Loading URL:', startURL);

  const showMainWindow = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
    setTrayHighlightMode('always');
  };

  mainWindow.loadURL(startURL).catch((err) => {
    console.error('Failed to load URL:', err);
    if (startURL !== HOSTED_APP_URL) {
      console.log('Trying hosted fallback URL...');
      mainWindow.loadURL(HOSTED_APP_URL).catch((fallbackErr) => {
        console.error('Fallback URL also failed:', fallbackErr);
        showMainWindow();
      });
    } else {
      showMainWindow();
    }
  });

  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    
    if (hiddenOnStart) {
      console.log('Starting app minimized to tray (auto-launch)...');
      mainWindow.hide();
    } else {
      showMainWindow();
    }

    if (isDev) {
      console.log('Development mode - DevTools available via F12');
    }
  });

  mainWindow.on('focus', () => setTrayHighlightMode('always'));
  mainWindow.on('blur', () => setTrayHighlightMode('never'));

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // aborted navigation (e.g. redirect)
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);

    if (!isDev && validatedURL !== HOSTED_APP_URL) {
      console.log('Retrying with hosted URL...');
      mainWindow.loadURL(HOSTED_APP_URL).catch((err) => {
        console.error('Hosted fallback failed:', err);
        showMainWindow();
      });
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });

  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM ready');
  });

  // Window state management
  mainWindow.on('resize', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('move', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting && notificationSettings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();

      // Show notification when minimizing to tray
      if (Notification.isSupported()) {
        const iconPath = getIconPath();
        new Notification({
          title: 'Rush CRM',
          body: 'App minimized to system tray. You will receive notifications for new messages.',
          icon: iconPath,
          silent: true
        }).show();
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    setUpdaterMainWindow(null);
  });

  setUpdaterMainWindow(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  try {
    const iconPath = getIconPath();

    tray = new Tray(iconPath || nativeImage.createEmpty());

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🚀 Rush CRM',
        enabled: false
      },
      { type: 'separator' },
      {
        label: '📱 Show App',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: '🙈 Hide App',
        click: () => {
          if (mainWindow) {
            mainWindow.hide();
          }
        },
      },
      { type: 'separator' },
      {
        label: '❌ Quit Rush CRM',
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ]);

    tray.setToolTip('Rush CRM - Customer Relationship Management System');
    tray.setContextMenu(contextMenu);
    setTrayHighlightMode('always');

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

    tray.on('click', () => {
      if (process.platform !== 'darwin') {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });

  } catch (error) {
    console.log('Failed to create system tray:', error.message);
  }
}

function setupIpcHandlers() {
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('check-for-updates', async () => {
    if (isDev) {
      return { status: 'dev', message: 'Updates are disabled in development mode.' };
    }
    return checkForUpdates({ silent: false });
  });

  ipcMain.handle('store-get', (event, key) => {
    return store.get(key);
  });

  ipcMain.handle('store-set', (event, key, value) => {
    store.set(key, value);
  });

  ipcMain.handle('show-notification', (event, { title, body, icon, tag, data }) => {
    if (!notificationSettings.enabled) return false;

    if (Notification.isSupported()) {
      const iconPath = icon || getIconPath();
      const notification = new Notification({
        title: title || 'Rush CRM',
        body: body || 'New notification',
        icon: iconPath,
        silent: !notificationSettings.sound,
        tag: tag || 'crm-notification',
        urgency: 'normal'
      });

      notification.show();

      notification.on('click', () => {
        // Bring window to front when notification is clicked
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();

          // If there's specific data, send it to renderer
          if (data) {
            mainWindow.webContents.send('notification-clicked', data);
          }
        }
      });

      // Auto-hide notification after 5 seconds if not clicked
      setTimeout(() => {
        try {
          notification.close();
        } catch (e) {
          // Notification might already be closed
        }
      }, 5000);

      return true;
    }
    return false;
  });

  // --- Message Overlay Logic (WhatsApp style) ---
  let messageOverlayWindow = null;

  ipcMain.handle('show-message-overlay', (event, msgData) => {
    // If a window already exists, we could either update it or close it. 
    // To keep it simple and avoid overlapping, let's close the old one if it exists.
    if (messageOverlayWindow) {
      messageOverlayWindow.close();
      messageOverlayWindow = null;
    }

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    messageOverlayWindow = new BrowserWindow({
      width: 400,
      height: 220,
      x: width - 420, // Bottom right
      y: height - 240,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        partition: PERSISTENT_SESSION,
      },
      show: false,
    });

    const overlayURL = `${getAppBaseURL()}/#/electron/message-overlay?data=${encodeURIComponent(JSON.stringify(msgData))}`;
    messageOverlayWindow.loadURL(overlayURL);

    messageOverlayWindow.once('ready-to-show', () => {
      if (messageOverlayWindow) messageOverlayWindow.show();
    });

    messageOverlayWindow.on('closed', () => {
      messageOverlayWindow = null;
    });

    // Auto-close after 10 seconds if no interaction?
    // Maybe let the user decide or keep it for now.
  });

  ipcMain.handle('close-message-overlay', () => {
    if (messageOverlayWindow) {
      messageOverlayWindow.close();
      messageOverlayWindow = null;
    }
  });

  ipcMain.handle('send-message-reply', (event, { workgroupId, reply, isDirectChat }) => {
    if (mainWindow) {
      mainWindow.webContents.send('message-reply-received', { workgroupId, reply, isDirectChat });
    }
    if (messageOverlayWindow) {
      messageOverlayWindow.close();
      messageOverlayWindow = null;
    }
  });

  ipcMain.handle('show-crm-message-notification', (event, { sender, message, type, chatId }) => {
    // Keeping this as a fallback or for simple system notifications if needed
    // But we'll mostly use the rich overlay now.
    return false;
  });

  // Notification settings management
  ipcMain.handle('get-notification-settings', () => {
    return store.get('notificationSettings', notificationSettings);
  });

  ipcMain.handle('update-notification-settings', (event, settings) => {
    notificationSettings = { ...notificationSettings, ...settings };
    store.set('notificationSettings', notificationSettings);
    return notificationSettings;
  });

  ipcMain.handle('open-external', (event, url) => {
    shell.openExternal(url);
  });

  // --- Incoming Call Overlay Logic ---
  let callWindow = null;

  ipcMain.handle('show-incoming-call', (event, callData) => {
    if (callWindow) return;

    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    callWindow = new BrowserWindow({
      width: 360,
      height: 480,
      x: width - 380, // Bottom right
      y: height - 500,
      frame: false,
      alwaysOnTop: true,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        partition: PERSISTENT_SESSION,
      },
      show: false,
    });

    // Load the specific overlay route from our React app
    const overlayURL = `${getAppBaseURL()}/#/electron/incoming-call?data=${encodeURIComponent(JSON.stringify(callData))}`;
    callWindow.loadURL(overlayURL);

    callWindow.once('ready-to-show', () => {
      if (callWindow) callWindow.show();
    });

    callWindow.on('closed', () => {
      callWindow = null;
    });
  });

  ipcMain.handle('close-incoming-call', () => {
    if (callWindow) {
      callWindow.close();
      callWindow = null;
    }
  });

  ipcMain.handle('accept-incoming-call', () => {
    if (callWindow) {
      callWindow.close();
      callWindow = null;
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('call-accepted-from-overlay');
    }
  });

  // Clear the app-closed flag on activate (for activate events)
  let isAppReallyClosed = false;
  app.on('before-quit', () => {
    isAppReallyClosed = true;
  });

  // Auto-launch settings management
  ipcMain.handle('get-auto-launch', () => {
    return store.get('autoLaunchEnabled', false);
  });

  ipcMain.handle('set-auto-launch', (event, enabled) => {
    try {
      // Set login item settings (auto-launch on startup)
      if (process.platform === 'win32' || process.platform === 'linux') {
        // For Windows and Linux
        app.setLoginItemSettings({
          openAtLogin: enabled,
          openAsHidden: true, // Start minimized to tray
          path: process.execPath,
          args: ['--hidden']
        });
      } else if (process.platform === 'darwin') {
        // For macOS
        app.setLoginItemSettings({
          openAtLogin: enabled,
          openAsHidden: true
        });
      }
      
      store.set('autoLaunchEnabled', enabled);
      console.log(`Auto-launch ${enabled ? 'enabled' : 'disabled'}`);
      return { success: true, enabled };
    } catch (error) {
      console.error('Failed to set auto-launch:', error);
      return { success: false, error: error.message };
    }
  });
}

app.whenReady().then(async () => {
  try {
    console.log('Starting Rush CRM Desktop...');

    // Load notification settings
    notificationSettings = store.get('notificationSettings', notificationSettings);

    // Request notification permission on Windows
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.rushcrm.desktop');
    }

    setupIpcHandlers();

    // Handle command line arguments for auto-launch
    const args = process.argv.slice(1);
    const isHiddenLaunch = args.includes('--hidden');
    
    createWindow(isHiddenLaunch);
    createTray();

    if (!isDev) {
      setupAutoUpdater();
      scheduleUpdateCheck();
    }

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
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow(false);
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  isAppReallyClosed = true;
});