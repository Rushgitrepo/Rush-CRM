# Rush CRM - Mobile App Setup

## Overview
Your CRM now supports mobile development with Capacitor! This allows you to create native iOS and Android apps from your existing web application.

## What's Added
- ✅ Capacitor iOS & Android support
- ✅ Mobile build scripts
- ✅ Native project folders (`frontend/android`, `frontend/ios`)
- ✅ No changes to existing desktop or web functionality

## Development Commands

### From Root Directory:
```bash
# Build and sync mobile apps
npm run mobile:sync

# Open Android Studio
npm run mobile:android

# Open Xcode (Mac only)
npm run mobile:ios

# Build and run on device/emulator
npm run mobile:run:android
npm run mobile:run:ios
```

### From Frontend Directory:
```bash
# Sync web assets to native projects
npm run cap:sync

# Open native IDEs
npm run cap:android   # Opens Android Studio
npm run cap:ios       # Opens Xcode

# Run on device/emulator
npm run cap:run:android
npm run cap:run:ios
```

## Development Workflow

1. **Develop normally**: Your existing `npm run dev` workflow unchanged
2. **Build for mobile**: Run `npm run mobile:sync` to copy latest changes
3. **Test on device**: Use `npm run mobile:run:android` or similar

## Platform Requirements

### Android:
- ✅ Works on Windows/Mac/Linux
- Android Studio installed
- Android SDK configured

### iOS:
- ❗ Mac required for development
- Xcode installed
- Apple Developer Account for App Store

## Project Structure
```
frontend/
├── android/          # Native Android project
├── ios/              # Native iOS project
├── dist/             # Built web assets (copied to mobile)
├── capacitor.config.ts # Mobile app configuration
└── src/              # Your React app (unchanged)
```

## Mobile-Specific Features
You can add mobile features using Capacitor plugins:
- Camera access
- Push notifications
- Native device features
- Biometric authentication

## Existing Functionality Unchanged
- ✅ Desktop Electron app works exactly the same
- ✅ Web development workflow unchanged
- ✅ Backend API unchanged
- ✅ All existing scripts work as before

## Next Steps
1. Install Android Studio for Android development
2. Run `npm run mobile:android` to open Android project
3. Build and test on Android emulator/device
4. For iOS: Use Mac with Xcode installed