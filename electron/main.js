const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, shell, nativeImage, Notification } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');

// Initialize electron store for persistent data
const store = new Store();

let mainWindow;
let tray;

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

// Notification settings
let notificationSettings = {
  enabled: true,
  sound: true,
  showPreview: true,
  minimizeToTray: true
};

/**
 * Create the main application window
 */
function createWindow() {
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

  // Load the app - Always use localhost for development
  const startURL = `http://localhost:${FRONTEND_PORT}`;

  console.log('Loading URL:', startURL);
  
  // Add error handling for loading
  mainWindow.loadURL(startURL).catch(err => {
    console.error('Failed to load URL:', err);
    // Fallback to hosted server if localhost fails
    console.log('Trying fallback URL...');
    mainWindow.loadURL('https://rms.rushcorporation.com').catch(fallbackErr => {
      console.error('Fallback URL also failed:', fallbackErr);
    });
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
    mainWindow.focus();

    // Open DevTools only in development and only when needed
    if (isDev) {
      console.log('Development mode - DevTools available via F12');
      // Don't auto-open DevTools, let user open with F12 if needed
    }
  });

  // Add web contents event handlers for debugging
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);
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
  });

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

  // New: Show desktop notification for CRM messages
  ipcMain.handle('show-crm-message-notification', (event, { sender, message, type, chatId }) => {
    if (!notificationSettings.enabled) return false;
    
    const title = type === 'direct' ? `New message from ${sender}` : `New message in ${sender}`;
    const body = message.length > 100 ? message.substring(0, 100) + '...' : message;
    
    if (Notification.isSupported()) {
      const iconPath = getIconPath();
      const notification = new Notification({
        title,
        body,
        icon: iconPath,
        silent: !notificationSettings.sound,
        tag: `crm-message-${chatId}`,
        urgency: 'normal'
      });
      
      notification.show();
      
      notification.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          
          // Navigate to the specific chat/channel
          mainWindow.webContents.send('navigate-to-chat', { chatId, type });
        }
      });
      
      return true;
    }
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