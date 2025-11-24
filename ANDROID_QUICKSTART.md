# Android Quick Start Guide

## ✅ Setup Complete!

Your SimonReads app is now ready to build for Android! The Android project has been created in the `android/` folder.

---

## 🚀 Quick Start (3 Steps)

### Step 1: Install Android Studio
Download and install from: https://developer.android.com/studio

### Step 2: Build the App
```bash
npm run build:android
```

This will:
1. Build your React app
2. Copy files to Android project
3. Open Android Studio automatically

### Step 3: Run in Android Studio
1. Wait for Gradle sync to finish (bottom status bar)
2. Click the green "Run" button (▶️)
3. Select an emulator or connected device
4. Your app will install and launch!

---

## 📱 Build APK (Without Android Studio)

### Debug APK
```bash
npm run build:android:apk
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK
```bash
npm run build:android:release
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🔄 After Making Code Changes

```bash
# Option 1: Rebuild everything and open Android Studio
npm run build:android

# Option 2: Just sync files (faster)
npm run sync:android
# Then run from Android Studio

# Option 3: Build APK directly
npm run build:android:apk
```

---

## 📂 Project Structure

```
RSSReader/
├── android/              ← Android native project (NEW!)
│   ├── app/
│   │   └── build/
│   │       └── outputs/
│   │           └── apk/  ← Your APK files will be here
│   └── ...
├── src/                  ← Your React/TypeScript code
├── dist/                 ← Built web app (auto-synced to Android)
└── capacitor.config.ts   ← Android configuration
```

---

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run build:android` | Build and open in Android Studio |
| `npm run build:android:apk` | Build debug APK |
| `npm run build:android:release` | Build release APK (signed) |
| `npm run sync:android` | Sync web files to Android |
| `npm run open:android` | Open Android Studio |

---

## ⚙️ Configuration

### App Details
Edit `capacitor.config.ts`:
- **App ID**: `com.simonbianco.simonreads`
- **App Name**: `SimonReads`

### Change App Icon
1. Open Android Studio
2. Right-click `android/app/src/main/res`
3. New → Image Asset
4. Select your icon image
5. Generate

---

## 🐛 Troubleshooting

### "Gradle sync failed"
```bash
cd android
./gradlew clean
cd ..
npm run sync:android
```

### "Permission denied: gradlew"
```bash
cd android
chmod +x gradlew
cd ..
```

### "White screen on launch"
```bash
# Make sure dist/ folder exists
npm run build
npm run sync:android
```

---

## 📖 Full Documentation

See `ANDROID_BUILD.md` for complete documentation including:
- Detailed setup instructions
- Publishing to Google Play Store
- Signing release builds
- Adding Capacitor plugins
- Performance optimization
- And more!

---

## 🎯 Next Steps

1. **Test on emulator**: Create an Android Virtual Device in Android Studio
2. **Test on device**: Enable USB debugging on your Android phone
3. **Customize**: Change app icon, splash screen, colors
4. **Publish**: Build release APK and upload to Google Play Store

---

## 💡 Tips

- **First build takes longer**: Gradle downloads dependencies
- **Use sync for quick iterations**: `npm run sync:android` is faster than full rebuild
- **Check Logcat**: View → Tool Windows → Logcat in Android Studio for debugging
- **Enable USB debugging**: Settings → Developer Options on your Android device

---

## 🌟 Features on Android

All desktop features work on Android:
- ✅ RSS feed management
- ✅ Article reading
- ✅ AI summaries and chat
- ✅ PDF export
- ✅ Dark/Light/Sepia/Black themes
- ✅ Newsreel generation
- ✅ Local storage

---

## 🆘 Need Help?

1. Check `ANDROID_BUILD.md` for detailed documentation
2. Review Android Studio Logcat for errors
3. Ensure Android SDK is installed properly
4. Make sure `ANDROID_HOME` environment variable is set

Happy building! 🚀📱
