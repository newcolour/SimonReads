# 📱 Android Development Setup Guide for SimonReads

## Current Status

✅ **Capacitor is configured** - The Android project structure is ready  
✅ **Build scripts are in place** - npm commands are configured  
⚠️ **Java Runtime needed** - Required for Android builds  
⚠️ **Some features need adaptation** - Electron-specific features need Capacitor equivalents

---

## 🚀 Quick Setup (Step by Step)

### Step 1: Install Java Development Kit (JDK)

The Android build requires Java. Install JDK 17 (recommended for Android):

```bash
# Using Homebrew (recommended for macOS)
brew install openjdk@17

# Add to your shell profile (~/.zshrc or ~/.bash_profile)
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc

# Reload your shell
source ~/.zshrc

# Verify installation
java -version
```

### Step 2: Install Android Studio

1. Download from: https://developer.android.com/studio
2. Install Android Studio
3. Open Android Studio
4. Go to: **Tools → SDK Manager**
5. Install:
   - Android SDK Platform 34 (or latest)
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
   - Android Emulator

### Step 3: Set Android Environment Variables

Add to your `~/.zshrc` or `~/.bash_profile`:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Then reload:
```bash
source ~/.zshrc
```

Verify:
```bash
echo $ANDROID_HOME
adb --version
```

### Step 4: Build the Android App

```bash
# Build debug APK
npm run build:android:apk

# Or open in Android Studio for development
npm run build:android
```

---

## 📦 Available Build Commands

| Command | Description | Output |
|---------|-------------|--------|
| `npm run build:android` | Build and open in Android Studio | Opens IDE |
| `npm run build:android:apk` | Build debug APK | `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run build:android:release` | Build release APK | `android/app/build/outputs/apk/release/app-release.apk` |
| `npm run sync:android` | Sync web files to Android | Updates Android project |
| `npm run open:android` | Open Android Studio | Opens IDE |

---

## 🔧 Feature Compatibility

### ✅ Features that Work on Android

- **Core RSS functionality**: Feed management, article reading
- **Local storage**: All data stored locally using Capacitor Storage
- **UI/UX**: All themes (Light, Dark, Sepia, Black)
- **Article list and reading**: Full article view
- **Search**: Article search functionality
- **PDF export**: Using html2canvas and jsPDF
- **AI features**: Summaries and chat (if API keys configured)

### ⚠️ Features that Need Adaptation

These features currently use Electron IPC and need Capacitor equivalents:

1. **External link opening** (`open-external`)
   - **Solution**: Use Capacitor Browser plugin
   - **Status**: Needs implementation

2. **Article content fetching** (`fetch-url`)
   - **Solution**: Use Capacitor HTTP plugin or direct fetch
   - **Status**: Partially works (fetch API available)

3. **TTS (Text-to-Speech)** (`fetch-tts`)
   - **Solution**: Use Capacitor Text-to-Speech plugin
   - **Status**: Needs implementation

4. **Email scheduling** (Electron-specific)
   - **Solution**: Not available on mobile (server-side feature)
   - **Status**: Should be disabled on Android

5. **File system operations**
   - **Solution**: Use Capacitor Filesystem plugin
   - **Status**: Needs implementation for OPML import/export

---

## 🛠️ Required Capacitor Plugins

To make all features work, install these plugins:

```bash
# Browser for opening external links
npm install @capacitor/browser

# HTTP for fetching content
npm install @capacitor/http

# Text-to-Speech
npm install @capacitor-community/text-to-speech

# Filesystem for OPML import/export
npm install @capacitor/filesystem

# Share for sharing articles
npm install @capacitor/share

# Haptics for feedback
npm install @capacitor/haptics
```

---

## 📝 Code Adaptations Needed

### 1. Create Platform Detection Utility

Create `src/utils/platform.ts`:

```typescript
import { Capacitor } from '@capacitor/core';

export const isElectron = () => {
  return !!(window as any).ipcRenderer;
};

export const isAndroid = () => {
  return Capacitor.getPlatform() === 'android';
};

export const isWeb = () => {
  return Capacitor.getPlatform() === 'web';
};

export const isMobile = () => {
  return isAndroid() || Capacitor.getPlatform() === 'ios';
};
```

### 2. Adapt External Link Opening

Replace Electron IPC calls with:

```typescript
import { Browser } from '@capacitor/browser';
import { isElectron } from './utils/platform';

async function openExternal(url: string) {
  if (isElectron()) {
    const ipcRenderer = (window as any).ipcRenderer;
    await ipcRenderer.invoke('open-external', url);
  } else {
    await Browser.open({ url });
  }
}
```

### 3. Adapt Content Fetching

```typescript
import { CapacitorHttp } from '@capacitor/core';
import { isElectron } from './utils/platform';

async function fetchUrl(url: string) {
  if (isElectron()) {
    const ipcRenderer = (window as any).ipcRenderer;
    return await ipcRenderer.invoke('fetch-url', url);
  } else {
    const response = await CapacitorHttp.get({ url });
    return { success: true, content: response.data };
  }
}
```

---

## 🎯 Testing on Android

### Using Android Emulator

1. Open Android Studio
2. Go to: **Tools → Device Manager**
3. Create a new Virtual Device
4. Select a device (e.g., Pixel 6)
5. Select a system image (e.g., Android 13)
6. Click Finish
7. Run your app: `npm run build:android`
8. Click the green Play button in Android Studio

### Using Physical Device

1. Enable Developer Options on your Android device:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
2. Enable USB Debugging:
   - Settings → Developer Options → USB Debugging
3. Connect your device via USB
4. Run: `npm run build:android`
5. Select your device in Android Studio
6. Click Run

---

## 🐛 Troubleshooting

### "Unable to locate a Java Runtime"

```bash
# Install JDK
brew install openjdk@17

# Set JAVA_HOME
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

### "ANDROID_HOME not set"

```bash
# Add to ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Reload
source ~/.zshrc
```

### "Gradle build failed"

```bash
# Clean and rebuild
cd android
./gradlew clean
cd ..
npm run sync:android
npm run build:android:apk
```

### "White screen on launch"

```bash
# Rebuild web assets
npm run build
npm run sync:android
```

### Permission errors with gradlew

```bash
cd android
chmod +x gradlew
cd ..
```

---

## 📱 App Permissions

The app needs these Android permissions (already configured in `android/app/src/main/AndroidManifest.xml`):

- `INTERNET` - For fetching RSS feeds and AI features
- `ACCESS_NETWORK_STATE` - For checking connectivity
- `WRITE_EXTERNAL_STORAGE` - For PDF export (Android < 10)
- `READ_EXTERNAL_STORAGE` - For OPML import (Android < 10)

---

## 🚢 Publishing to Google Play Store

### 1. Generate Signing Key

```bash
keytool -genkey -v -keystore simonreads-release-key.keystore \
  -alias simonreads -keyalg RSA -keysize 2048 -validity 10000
```

### 2. Configure Signing

Create `android/key.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=simonreads
storeFile=../simonreads-release-key.keystore
```

### 3. Build Release APK

```bash
npm run build:android:release
```

### 4. Upload to Google Play Console

1. Go to https://play.google.com/console
2. Create a new app
3. Upload the APK from `android/app/build/outputs/apk/release/`
4. Fill in store listing details
5. Submit for review

---

## 📊 Next Steps

1. ✅ **Install Java and Android Studio** (Step 1-3 above)
2. ✅ **Test basic build** (`npm run build:android:apk`)
3. 🔄 **Install Capacitor plugins** (for full feature parity)
4. 🔄 **Adapt Electron-specific code** (use platform detection)
5. 🔄 **Test all features** on Android emulator
6. 🔄 **Optimize for mobile** (touch interactions, responsive design)
7. 🔄 **Build release APK** and test
8. 🔄 **Publish to Google Play Store**

---

## 💡 Tips

- **Development workflow**: Use `npm run sync:android` for quick iterations
- **Debugging**: Use Chrome DevTools (chrome://inspect) for web debugging
- **Logcat**: View → Tool Windows → Logcat in Android Studio for native logs
- **Performance**: Test on real devices, emulators can be slower
- **Storage**: Android uses Capacitor Preferences API (similar to localStorage)

---

## 🆘 Need Help?

1. Check Android Studio Logcat for errors
2. Verify Java and Android SDK are installed correctly
3. Ensure environment variables are set
4. Try cleaning and rebuilding: `cd android && ./gradlew clean`
5. Check Capacitor documentation: https://capacitorjs.com/docs/android

---

**Ready to build for Android!** 🚀📱
