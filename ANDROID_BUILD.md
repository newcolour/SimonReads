# SimonReads - Android Build Guide

## Overview
SimonReads can now be built as a native Android app using Capacitor! The Android project is located in the `android/` folder.

---

## Prerequisites

### Required Software
1. **Android Studio** (latest version)
   - Download from: https://developer.android.com/studio
   - Install Android SDK (API 33 or higher recommended)
   - Install Android SDK Build-Tools
   - Install Android Emulator (optional, for testing)

2. **Java Development Kit (JDK)**
   - JDK 17 or higher
   - Set `JAVA_HOME` environment variable

3. **Node.js & npm** (already installed)

### Environment Setup

#### macOS/Linux
```bash
# Add to ~/.zshrc or ~/.bashrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
```

#### Windows
```powershell
# Add to System Environment Variables
ANDROID_HOME=C:\Users\YourUsername\AppData\Local\Android\Sdk
JAVA_HOME=C:\Program Files\Java\jdk-17
```

---

## Project Structure

```
RSSReader/
├── android/                    # Android native project (Capacitor)
│   ├── app/
│   │   ├── src/
│   │   │   └── main/
│   │   │       ├── assets/
│   │   │       │   └── public/  # Web app files (auto-synced)
│   │   │       ├── java/
│   │   │       ├── res/         # Android resources (icons, etc.)
│   │   │       └── AndroidManifest.xml
│   │   └── build.gradle
│   ├── gradle/
│   ├── build.gradle
│   └── settings.gradle
├── src/                        # React/TypeScript source
├── dist/                       # Built web app
└── capacitor.config.ts         # Capacitor configuration
```

---

## Build Commands

### 1. Development Build (Opens Android Studio)
```bash
npm run build:android
```
This will:
1. Build the TypeScript/React app
2. Sync files to Android project
3. Open Android Studio

### 2. Debug APK (Command Line)
```bash
npm run build:android:apk
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 3. Release APK (Signed)
```bash
npm run build:android:release
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

### 4. Sync Only (After Code Changes)
```bash
npm run sync:android
```

### 5. Open Android Studio
```bash
npm run open:android
```

---

## Step-by-Step Build Process

### First Time Setup

1. **Build the web app**
   ```bash
   npm run build
   ```

2. **Sync to Android**
   ```bash
   npm run sync:android
   ```

3. **Open in Android Studio**
   ```bash
   npm run open:android
   ```

4. **In Android Studio:**
   - Wait for Gradle sync to complete
   - Click "Run" (green play button)
   - Select an emulator or connected device
   - App will install and launch

### Subsequent Builds

After making code changes:

```bash
# Option 1: Full rebuild and open Android Studio
npm run build:android

# Option 2: Build APK directly
npm run build:android:apk

# Option 3: Just sync (if only web code changed)
npm run sync:android
```

---

## Testing

### Using Android Emulator

1. **Create an emulator in Android Studio:**
   - Tools → Device Manager
   - Create Device
   - Select a phone (e.g., Pixel 6)
   - Select system image (API 33+)
   - Finish

2. **Run the app:**
   ```bash
   npm run build:android
   # Then click Run in Android Studio
   ```

### Using Physical Device

1. **Enable Developer Options on your Android device:**
   - Settings → About Phone
   - Tap "Build Number" 7 times
   - Go back → Developer Options
   - Enable "USB Debugging"

2. **Connect device via USB**

3. **Run the app:**
   ```bash
   npm run build:android
   # Select your device in Android Studio
   ```

---

## App Configuration

### App ID & Name
Edit `capacitor.config.ts`:
```typescript
const config: CapacitorConfig = {
  appId: 'com.simonbianco.simonreads',  // Unique app identifier
  appName: 'SimonReads',                 // App display name
  // ...
};
```

### App Icon & Splash Screen

1. **Icon:**
   - Place icon files in `android/app/src/main/res/`
   - Use Android Studio's Image Asset Studio:
     - Right-click `res` → New → Image Asset
     - Select icon type and source image
     - Generate

2. **Splash Screen:**
   - Edit `capacitor.config.ts`:
     ```typescript
     plugins: {
       SplashScreen: {
         launchShowDuration: 2000,
         backgroundColor: '#000000',
         showSpinner: false
       }
     }
     ```

### Permissions

Edit `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<!-- Add more permissions as needed -->
```

---

## Signing the Release APK

### Generate Keystore

```bash
keytool -genkey -v -keystore simonreads-release.keystore \
  -alias simonreads -keyalg RSA -keysize 2048 -validity 10000
```

### Configure Signing

1. Create `android/keystore.properties`:
   ```properties
   storePassword=YOUR_STORE_PASSWORD
   keyPassword=YOUR_KEY_PASSWORD
   keyAlias=simonreads
   storeFile=../simonreads-release.keystore
   ```

2. Edit `android/app/build.gradle`:
   ```gradle
   android {
       signingConfigs {
           release {
               def keystorePropertiesFile = rootProject.file("keystore.properties")
               def keystoreProperties = new Properties()
               keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
               
               keyAlias keystoreProperties['keyAlias']
               keyPassword keystoreProperties['keyPassword']
               storeFile file(keystoreProperties['storeFile'])
               storePassword keystoreProperties['storePassword']
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled false
               proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

3. Build signed release:
   ```bash
   npm run build:android:release
   ```

---

## Troubleshooting

### Gradle Build Fails
```bash
cd android
./gradlew clean
cd ..
npm run sync:android
```

### App Crashes on Launch
- Check Android Studio Logcat for errors
- Ensure all web assets are in `android/app/src/main/assets/public/`
- Run `npm run sync:android` again

### White Screen on Launch
- Check that `dist/` folder exists and has content
- Run `npm run build` first
- Check browser console in Android Studio (View → Tool Windows → Logcat)

### Permission Denied Errors
```bash
cd android
chmod +x gradlew
```

---

## Publishing to Google Play Store

### 1. Prepare Release Build
```bash
npm run build:android:release
```

### 2. Create Google Play Developer Account
- Cost: $25 one-time fee
- https://play.google.com/console

### 3. Create App Listing
- App name, description, screenshots
- Privacy policy URL
- Content rating

### 4. Upload APK/AAB
- Recommended: Build AAB (Android App Bundle)
  ```bash
  cd android
  ./gradlew bundleRelease
  ```
- Upload to Google Play Console
- Fill in release notes
- Submit for review

### 5. Review Process
- Usually takes 1-3 days
- May require additional information

---

## Key Differences from Desktop App

### What Works:
- ✅ All UI components
- ✅ RSS feed fetching
- ✅ Article reading
- ✅ AI summaries and chat
- ✅ Local storage
- ✅ PDF export
- ✅ Dark/Light themes

### What Needs Adaptation:
- ⚠️ **File System**: Use Capacitor Filesystem plugin instead of Electron
- ⚠️ **Window Controls**: No window drag/resize (mobile UI)
- ⚠️ **External Browser**: Opens in-app browser or system browser
- ⚠️ **Notifications**: Use Capacitor Local Notifications plugin
- ⚠️ **Notifications**: Use Capacitor Local Notifications plugin
- ❌ **Daily Email**: The automated daily email feature relies on Node.js (Electron) and is **automatically hidden** on Android.

### Mobile-Specific Features to Add:
- Pull-to-refresh
- Swipe gestures
- Share functionality
- Offline mode
- Push notifications

---

## Capacitor Plugins

### Recommended Plugins for Mobile:

```bash
# Filesystem
npm install @capacitor/filesystem

# Share
npm install @capacitor/share

# Browser
npm install @capacitor/browser

# Haptics (vibration feedback)
npm install @capacitor/haptics

# Status Bar
npm install @capacitor/status-bar

# Keyboard
npm install @capacitor/keyboard
```

After installing plugins:
```bash
npm run sync:android
```

---

## Performance Optimization

### 1. Enable ProGuard (Code Shrinking)
Edit `android/app/build.gradle`:
```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
    }
}
```

### 2. Optimize Images
- Use WebP format
- Compress images
- Use appropriate resolutions

### 3. Enable Caching
- Service Workers
- LocalStorage for offline data

---

## Useful Commands

```bash
# Check Android devices
adb devices

# Install APK manually
adb install android/app/build/outputs/apk/debug/app-debug.apk

# View logs
adb logcat

# Clear app data
adb shell pm clear com.simonbianco.simonreads

# Uninstall app
adb uninstall com.simonbianco.simonreads
```

---

## Resources

- **Capacitor Docs**: https://capacitorjs.com/docs
- **Android Studio**: https://developer.android.com/studio
- **Gradle**: https://gradle.org/
- **Google Play Console**: https://play.google.com/console

---

## Support

For issues specific to Android build:
1. Check `android/` folder for Gradle errors
2. Review Capacitor logs
3. Check Android Studio Logcat
4. Ensure Android SDK is properly installed

Happy building! 🚀
