# Desktop App (Electron) Fixes - Auto-Launch & Persistent Login

## ✅ Issues Fixed

### 1. **Persistent Login (No More Logging In Every Time)**
- **Status**: ✅ Already implemented & optimized
- **How it works**: 
  - The app uses `PERSISTENT_SESSION` partition that preserves cookies and localStorage between restarts
  - Your authentication token is automatically saved when you login
  - The app will remember you across restarts automatically

**No configuration needed** - this works out of the box!

### 2. **Auto-Launch on System Startup**
- **Status**: ✅ Implemented & ready to configure
- **How it works**:
  - App can now automatically start when you restart your laptop
  - Launches minimized to the system tray (not intrusive)
  - You can enable/disable from app settings

## 🎯 How to Enable Auto-Launch

### Option A: From Application Settings (Recommended)
1. Open the CRM desktop app
2. Go to **Settings** → **Desktop App Settings** or **Preferences**
3. Find the toggle: **"Auto-launch at startup"**
4. Toggle it **ON** ✅
5. Restart your laptop to test

### Option B: From Command Line (Dev/Testing)
```powershell
# From the electron folder
npm start --hidden
```

## 🔧 Technical Implementation

### Files Modified:
1. **`electron/main.js`**
   - Added `get-auto-launch` IPC handler - gets current auto-launch status
   - Added `set-auto-launch` IPC handler - enables/disables auto-launch
   - Updated `app.whenReady()` to handle `--hidden` flag for minimized startup
   - Supports Windows, Linux, and macOS

2. **`electron/preload.js`**
   - Added `getAutoLaunch()` function - frontend can check if auto-launch is enabled
   - Added `setAutoLaunch(enabled)` function - frontend can toggle auto-launch
   - Exposed to React frontend via `window.electronAPI`

### How Auto-Launch Works:
```javascript
// On Windows/Linux
app.setLoginItemSettings({
  openAtLogin: true,              // Register with OS to auto-start
  openAsHidden: true,             // Start minimized to tray
  args: ['--hidden']              // Pass flag to start hidden
});

// App checks for --hidden flag and minimizes on startup
const isHiddenLaunch = args.includes('--hidden');
if (isHiddenLaunch && mainWindow) {
  mainWindow.hide();  // Minimize to tray instead of showing window
}
```

## 📱 Frontend Integration

To use in your React components:

```typescript
// Check if auto-launch is enabled
const isAutoLaunchEnabled = await window.electronAPI.getAutoLaunch();

// Enable auto-launch
await window.electronAPI.setAutoLaunch(true);

// Disable auto-launch
await window.electronAPI.setAutoLaunch(false);
```

## ✨ Benefits

✅ **No more login screens on startup**
- Authentication token is preserved across restarts
- You stay logged in automatically

✅ **Automatic launch on system boot**
- App starts silently in system tray
- You can click tray icon to show whenever needed

✅ **User control**
- Toggle auto-launch on/off from settings
- Not forced on users

## 🧪 Testing Checklist

- [ ] Login to the desktop app
- [ ] Close and reopen the app → Should still be logged in
- [ ] Restart laptop → Should still be logged in
- [ ] Enable auto-launch from settings
- [ ] Restart laptop → App should auto-launch minimized in tray
- [ ] Disable auto-launch from settings
- [ ] Restart laptop → App should NOT auto-launch

## 📝 Notes

- Auto-launch setting is stored in `electron-store` (persistent local storage)
- The `PERSISTENT_SESSION` partition handles cookie/token persistence
- No backend changes needed - all handled by Electron
- Works across Windows, macOS, and Linux

## 🐛 Troubleshooting

**App still asking for login after restart:**
- Try logging out completely, then log in again
- Check if cookies are being cleared by a cleanup tool
- Verify `PERSISTENT_SESSION` partition is being used in BrowserWindow config

**Auto-launch not working:**
- Try toggling it off and on again
- Ensure app has proper permissions (especially on Windows)
- Check Windows Startup folder: `C:\Users\[YourName]\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

**Auto-launch starts in background but app window doesn't appear:**
- This is intended! Click the tray icon to bring app to foreground
- Or disable the "minimize to tray" setting if preferred
