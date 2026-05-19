const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  onUpdateChecking: (callback) => ipcRenderer.on('update-checking', callback),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', (_e, info) => callback(info)),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', (_e, info) => callback(info)),
  onUpdateDownloadProgress: (callback) => ipcRenderer.on('update-download-progress', (_e, info) => callback(info)),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', (_e, info) => callback(info)),
  onUpdateError: (callback) => ipcRenderer.on('update-error', (_e, info) => callback(info)),

  // Store
  storeGet: (key) => ipcRenderer.invoke('store-get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store-set', key, value),

  // Notifications
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  showCRMMessageNotification: (options) => ipcRenderer.invoke('show-crm-message-notification', options),
  getNotificationSettings: () => ipcRenderer.invoke('get-notification-settings'),
  updateNotificationSettings: (settings) => ipcRenderer.invoke('update-notification-settings', settings),

  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Event listeners for notifications
  onNotificationClicked: (callback) => ipcRenderer.on('notification-clicked', callback),
  onNavigateToChat: (callback) => ipcRenderer.on('navigate-to-chat', callback),
  onCallAcceptedFromOverlay: (callback) => ipcRenderer.on('call-accepted-from-overlay', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Call Overlay
  showIncomingCall: (callData) => ipcRenderer.invoke('show-incoming-call', callData),
  closeIncomingCall: () => ipcRenderer.invoke('close-incoming-call'),
  acceptIncomingCall: () => ipcRenderer.invoke('accept-incoming-call'),

  // Message Overlay
  showMessageOverlay: (msgData) => ipcRenderer.invoke('show-message-overlay', msgData),
  closeMessageOverlay: () => ipcRenderer.invoke('close-message-overlay'),
  sendMessageReply: (data) => ipcRenderer.invoke('send-message-reply', data),
  onMessageReplyReceived: (callback) => ipcRenderer.on('message-reply-received', callback),

  // Platform info
  platform: process.platform,
  isElectron: true,
});

// Log that preload script has loaded
console.log('Electron preload script loaded successfully');

// Simple desktop app enhancements without interfering with React
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded - Desktop app ready');
  
  // Add minimal desktop styling without interfering with the app
  const desktopStyles = document.createElement('style');
  desktopStyles.innerHTML = `
    /* Desktop app enhancements */
    body {
      user-select: none;
      -webkit-user-select: none;
      -webkit-app-region: no-drag;
    }
    
    /* Prevent text selection in desktop app */
    * {
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }
    
    /* Allow text selection in input fields */
    input, textarea, [contenteditable] {
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      user-select: text !important;
    }
  `;
  
  document.head.appendChild(desktopStyles);
  console.log('Desktop enhancements applied');
});