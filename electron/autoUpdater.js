const { autoUpdater } = require('electron-updater');
const { dialog, app } = require('electron');

let mainWindow = null;
let updateCheckInProgress = false;

function getMainWindow() {
  return mainWindow;
}

function setMainWindow(win) {
  mainWindow = win;
}

function sendToRenderer(channel, payload) {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] Checking for updates...');
    sendToRenderer('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] Update available:', info.version);
    sendToRenderer('update-available', {
      version: info.version,
      releaseDate: info.releaseDate,
    });

    const parent = getMainWindow();
    dialog
      .showMessageBox(parent || undefined, {
        type: 'info',
        title: 'Update Available',
        message: `Rush CRM ${info.version} is available.`,
        detail: 'Download and install the update now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate().catch((err) => {
            console.error('[updater] Download failed:', err);
          });
        }
      });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[updater] Up to date:', info?.version || app.getVersion());
    sendToRenderer('update-not-available', { version: app.getVersion() });
    updateCheckInProgress = false;
  });

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update-download-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[updater] Update downloaded:', info.version);
    sendToRenderer('update-downloaded', { version: info.version });

    const parent = getMainWindow();
    dialog
      .showMessageBox(parent || undefined, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'Restart the app to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] Error:', err.message);
    sendToRenderer('update-error', { message: err.message });
    updateCheckInProgress = false;
  });
}

async function checkForUpdates({ silent = false } = {}) {
  if (updateCheckInProgress) {
    return { status: 'busy' };
  }

  updateCheckInProgress = true;

  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      status: 'ok',
      updateInfo: result?.updateInfo,
      cancelled: result?.cancellationToken != null,
    };
  } catch (err) {
    console.error('[updater] Check failed:', err.message);
    if (!silent) {
      dialog.showMessageBox(getMainWindow() || undefined, {
        type: 'error',
        title: 'Update Check Failed',
        message: err.message || 'Could not check for updates.',
        buttons: ['OK'],
      });
    }
    return { status: 'error', message: err.message };
  } finally {
    updateCheckInProgress = false;
  }
}

function scheduleUpdateCheck(delayMs = 15000) {
  setTimeout(() => {
    checkForUpdates({ silent: true }).catch((err) => {
      console.error('[updater] Scheduled check failed:', err);
    });
  }, delayMs);
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates,
  scheduleUpdateCheck,
  setMainWindow,
};
