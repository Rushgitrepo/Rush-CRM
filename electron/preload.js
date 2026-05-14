const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Store
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // Notifications
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // File system
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // Platform info
  platform: process.platform,
  isElectron: true,
});

// Log that preload script has loaded
console.log('Electron preload script loaded');
