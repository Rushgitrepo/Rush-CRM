# 🚀 Rush CRM Desktop - Build Guide

Complete guide to build and run Rush CRM as a desktop application using Electron.

## 📋 Prerequisites

- Node.js 18+ installed
- npm or yarn
- Git

## 🛠️ Installation

### Step 1: Install Root Dependencies

```bash
# Install root level dependencies
npm install
```

This will automatically install dependencies for:
- Frontend (React + Vite)
- Backend (Node.js + Express)
- Electron wrapper

### Step 2: Setup Environment Variables

Create `.env` files if not already present:

**Backend (.env)**
```env
PORT=5000
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
NODE_ENV=development
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:5000
```

## 🏃 Running in Development

### Option 1: Run Everything Together (Recommended)

```bash
npm run dev
```

This will start:
1. Backend server on port 5000
2. Frontend dev server on port 5173
3. Electron app (waits for frontend to be ready)

### Option 2: Run Separately

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend

# Terminal 3 - Electron (after frontend is ready)
npm run dev:electron
```

## 📦 Building for Production

### Build for Windows

```bash
npm run build:win
```

Output: `electron/dist/Rush CRM-Setup-1.0.0.exe`

### Build for macOS

```bash
npm run build:mac
```

Output: `electron/dist/Rush CRM-1.0.0.dmg`

### Build for Linux

```bash
npm run build:linux
```

Output: `electron/dist/Rush CRM-1.0.0.AppImage`

### Build for All Platforms

```bash
npm run build
```

## 🎨 Customizing Icons

Place your app icons in `electron/assets/`:

1. **Windows**: `icon.ico` (256x256)
2. **macOS**: `icon.icns` (512x512)
3. **Linux**: `icon.png` (512x512)
4. **System Tray**: `tray-icon.png` (16x16 or 32x32)

### Creating Icons

**From PNG to ICO (Windows):**
```bash
# Using ImageMagick
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

**From PNG to ICNS (macOS):**
```bash
# Using iconutil (macOS only)
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
# ... (repeat for all sizes)
iconutil -c icns icon.iconset
```

## 🔧 Configuration

### Electron Builder Config

Edit `electron/package.json` → `build` section:

```json
{
  "build": {
    "appId": "com.yourcompany.rushcrm",
    "productName": "Rush CRM",
    "win": {
      "target": ["nsis"],
      "icon": "assets/icon.ico"
    }
  }
}
```

### App Metadata

Update in `electron/package.json`:
- `name`: Internal app name
- `productName`: Display name
- `version`: App version
- `author`: Your name/company
- `description`: App description

## 🌟 Features

### ✅ Implemented Features

- ✅ Auto-start backend server
- ✅ System tray integration
- ✅ Window state persistence
- ✅ Native menus
- ✅ Auto-updates ready
- ✅ Dev tools in development
- ✅ External link handling
- ✅ Notifications support
- ✅ Secure IPC communication

### 🔜 Optional Enhancements

1. **Auto-Updates**
   - Configure electron-updater
   - Setup update server

2. **Code Signing**
   - Windows: Get code signing certificate
   - macOS: Apple Developer account

3. **Crash Reporting**
   - Integrate Sentry or similar

4. **Analytics**
   - Add usage analytics

## 🐛 Troubleshooting

### Backend Not Starting

```bash
# Check if port 5000 is available
netstat -ano | findstr :5000

# Kill process if needed
taskkill /PID <PID> /F
```

### Frontend Not Loading

```bash
# Clear Vite cache
cd frontend
rm -rf node_modules/.vite
npm run dev
```

### Build Errors

```bash
# Clean and rebuild
rm -rf electron/dist
rm -rf frontend/dist
npm run build
```

### Electron Not Opening

```bash
# Check Electron installation
cd electron
npm list electron

# Reinstall if needed
npm install electron --save-dev
```

## 📁 Project Structure

```
rush-crm/
├── electron/              # Electron wrapper
│   ├── main.js           # Main process
│   ├── preload.js        # Preload script
│   ├── package.json      # Electron config
│   └── assets/           # App icons
├── frontend/             # React app
│   ├── src/
│   ├── dist/            # Build output
│   └── package.json
├── backend/              # Node.js API
│   ├── src/
│   └── package.json
└── package.json          # Root config
```

## 🔐 Security Best Practices

1. ✅ Context isolation enabled
2. ✅ Node integration disabled
3. ✅ Remote module disabled
4. ✅ Secure IPC with contextBridge
5. ✅ External links open in browser
6. ✅ CSP headers (configure in backend)

## 📊 Performance Tips

1. **Lazy Loading**: Load heavy modules on demand
2. **Code Splitting**: Split frontend bundles
3. **Database**: Use connection pooling
4. **Caching**: Implement Redis for API caching
5. **Minification**: Enable in production builds

## 🚀 Deployment

### Windows Installer

The NSIS installer includes:
- Installation wizard
- Desktop shortcut
- Start menu entry
- Uninstaller
- Auto-launch option

### Distribution

1. **Direct Download**: Host .exe on your website
2. **Microsoft Store**: Submit via Partner Center
3. **Auto-Updates**: Setup update server

## 📝 License

MIT License - See LICENSE.txt

## 🤝 Support

For issues and questions:
- GitHub Issues
- Email: support@rushcrm.com
- Documentation: https://docs.rushcrm.com

---

**Built with ❤️ using Electron + React + Node.js**
