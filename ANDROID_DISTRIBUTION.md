# 📦 SimonReads Android - Distribution Package

## ✅ Release APK Successfully Built!

**Date:** November 30, 2025  
**Version:** 1.0  
**Build Type:** Signed Release APK

---

## 📱 APK Details

### Release APK (Signed)
- **File:** `android/app/build/outputs/apk/release/app-release.apk`
- **Size:** 4.4 MB
- **Status:** ✅ Signed and ready for distribution
- **Signature:** SHA384withRSA, 2048-bit key
- **Valid Until:** April 17, 2053

### Debug APK (For Testing)
- **File:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Size:** 5.3 MB
- **Status:** ✅ Ready for testing

---

## 🚀 Distribution Options

### Option 1: Google Play Store (Recommended)

#### Prerequisites:
1. Google Play Developer Account ($25 one-time fee)
2. Signed release APK (✅ Already built!)

#### Steps:
1. Go to [Google Play Console](https://play.google.com/console)
2. Create a new app
3. Fill in app details:
   - **App Name:** SimonReads
   - **Category:** News & Magazines
   - **Content Rating:** Everyone
4. Upload APK:
   - Go to "Release" → "Production"
   - Click "Create new release"
   - Upload `app-release.apk`
5. Complete store listing:
   - Description
   - Screenshots
   - Feature graphic
   - App icon
6. Submit for review

**Timeline:** Usually 1-3 days for review

---

### Option 2: Direct Distribution (APK Download)

#### For Your Website or Direct Sharing:

1. **Upload APK to your server/cloud storage**
   ```bash
   # Example: Upload to your website
   scp android/app/build/outputs/apk/release/app-release.apk user@yourserver.com:/var/www/downloads/
   ```

2. **Users install by:**
   - Downloading the APK
   - Enabling "Install from Unknown Sources" in Android settings
   - Opening the APK file to install

#### Security Note:
Users will see a warning about installing from unknown sources. This is normal for APKs not from Google Play.

---

### Option 3: Alternative App Stores

- **Amazon Appstore**
- **Samsung Galaxy Store**
- **F-Droid** (for open-source apps)
- **APKPure**
- **Aptoide**

---

## 🔐 Signing Key Information

**IMPORTANT:** Keep this information secure!

- **Keystore File:** `android/simonreads-release-key.keystore`
- **Keystore Password:** `simonreads2024`
- **Key Alias:** `simonreads`
- **Key Password:** `simonreads2024`
- **Validity:** 10,000 days (until 2053)

### ⚠️ Security Recommendations:

1. **Backup the keystore file** - You CANNOT update your app without it!
2. **Store passwords securely** - Use a password manager
3. **Never commit to Git** - Already added to .gitignore
4. **Keep offline backup** - Store in a secure location

### Backup Command:
```bash
# Backup keystore to a secure location
cp android/simonreads-release-key.keystore ~/Documents/SimonReads-Backup/
```

---

## 📋 Installation Instructions for End Users

### Method 1: From Google Play Store (Once Published)
1. Open Google Play Store
2. Search for "SimonReads"
3. Tap "Install"

### Method 2: Direct APK Installation
1. Download `app-release.apk` to your Android device
2. Open Settings → Security
3. Enable "Install from Unknown Sources" or "Install Unknown Apps"
4. Open the APK file from Downloads
5. Tap "Install"
6. Open SimonReads from your app drawer

---

## 🔄 Updating the App

### For Future Releases:

1. **Update version in build.gradle:**
   ```gradle
   versionCode 2  // Increment this
   versionName "1.1"  // Update version name
   ```

2. **Rebuild release APK:**
   ```bash
   npm run build:android:release
   ```

3. **Upload to Google Play Console** (if published there)

---

## 📊 App Information

### Technical Details:
- **Package Name:** `com.simonbianco.simonreads`
- **Min SDK:** Android 6.0 (API 23)
- **Target SDK:** Android 15 (API 35)
- **Architecture:** Universal (ARM, ARM64, x86, x86_64)

### Permissions:
- `INTERNET` - For fetching RSS feeds and AI features
- `ACCESS_NETWORK_STATE` - For checking connectivity

### Features:
- ✅ RSS feed management
- ✅ Article reading (Reader & Browser views)
- ✅ AI summaries and chat
- ✅ PDF export
- ✅ Dark/Light/Sepia/Black themes
- ✅ Newsreel generation
- ✅ Local storage
- ✅ Search functionality

---

## 🧪 Testing Checklist

Before distributing, test these features:

- [ ] Add RSS feed
- [ ] Read articles
- [ ] Switch themes
- [ ] Generate AI summary
- [ ] Export to PDF
- [ ] Create newsreel
- [ ] Search articles
- [ ] Delete articles
- [ ] App works offline (cached data)

---

## 📝 Store Listing Template

### Short Description (80 chars):
"Modern RSS reader with AI-powered summaries and beautiful reading experience"

### Full Description:
```
SimonReads - Your Modern RSS Reader

Stay informed with your favorite news sources in one beautiful app. SimonReads combines the simplicity of RSS with the power of AI to give you the best reading experience.

✨ KEY FEATURES:

📰 Smart Feed Management
• Add unlimited RSS feeds
• Organize by last updated or alphabetically
• Beautiful feed icons

📖 Enhanced Reading
• Clean reader view
• Full browser view option
• Multiple themes: Light, Dark, Sepia, Black

🤖 AI-Powered Features
• Instant article summaries
• Chat with articles
• Ask questions and get insights

🎬 Newsreel
• Create daily digest
• Export as beautiful PDF
• Perfect for catching up

🎨 Customization
• Choose your preferred theme
• Adjust font sizes
• Customize reading experience

💾 Privacy First
• All data stored locally
• No tracking
• Your feeds, your data

Perfect for:
• News enthusiasts
• Blog readers
• Podcast listeners
• Anyone who loves staying informed

Download SimonReads today and transform how you consume content!
```

### Keywords:
RSS, reader, news, feeds, AI, summaries, articles, blogs, podcasts, reading

---

## 🆘 Troubleshooting

### "App not installed" error:
- Uninstall any previous version first
- Ensure enough storage space
- Try rebooting device

### "App keeps stopping":
- Clear app data: Settings → Apps → SimonReads → Clear Data
- Reinstall the app
- Check Android version (requires Android 6.0+)

### Features not working:
- Check internet connection
- Verify API keys are configured (for AI features)
- Check app permissions

---

## 📞 Support

For issues or questions:
- **Email:** simone@example.com
- **GitHub:** https://github.com/simonebianco/simon-reads

---

## 🎉 Congratulations!

Your SimonReads Android app is ready for distribution!

**Next Steps:**
1. Test the APK on multiple devices
2. Prepare store listing materials (screenshots, descriptions)
3. Submit to Google Play Store
4. Share with your users!

**Good luck with your app launch!** 🚀📱
