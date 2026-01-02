---
description: Debug Android Conversational Curator AI summaries
---

# Debug Android Conversational Curator

## Prerequisites
- Pixel 9 XL Pro emulator running (or real device connected)
- App installed on device

## Debugging Steps

### 1. Start the emulator (if not already running)
```bash
emulator -avd Pixel_9_XL_Pro_API_35 -no-snapshot-load &
```

### 2. Wait for device
```bash
adb wait-for-device
```

### 3. Build and install the app
```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug && cd ..
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### 4. Launch the app
```bash
adb shell am start -n com.simonbianco.simonreads/.MainActivity
```

### 5. Open Chrome DevTools for remote debugging
1. Open Chrome and go to: `chrome://inspect`
2. Look for the SimonReads WebView under "Remote Target"
3. Click "inspect" to open DevTools
4. Go to the Console tab

### 6. Test the Conversational Curator
1. In the app, go to Settings → Reading Personality
2. Select "Conversational Curator" (💬)
3. Return to a feed with articles
4. Watch the Console in Chrome DevTools

### 7. What to look for in the logs

**Success path:**
```
📊 [ArticleList] Effect triggered for article: <id>
📊 [ArticleList] Checking API key availability
🚀 [ArticleList] Starting inline summary generation for article: <id>
🤖 [InlineSummary] Starting generation for article: <id>
🤖 [InlineSummary] Content length: XXX
🤖 [InlineSummary] API Provider: gemini
🤖 [InlineSummary] Has API Key: true
🤖 [InlineSummary] Calling summarizeArticle...
🤖 [InlineSummary] Summary generated, length: XXX
✅ [ArticleList] Summary received for article: <id>
```

**Failure indicators:**
- `❌ [ArticleList] Inline summaries require an AI API key...` - No API key configured
- `❌ [InlineSummary] Failed to generate inline summary` - API call failed
- `📝 [ArticleList] Using fallback snippet` - Fallback activated due to error

### 8. Common issues to check

**No summaries appearing:**
- Check if API key is configured in Settings → AI
- Verify network connectivity on the emulator
- Look for CORS or network errors in Console
- Check if `allowInlineSummary` is true (should be when viewing a specific feed)

**Summaries slow or timing out:**
- Check network speed
- Try a different AI provider (OpenAI vs Gemini vs Claude)
- Reduce article content length in the API call

**Empty or error responses:**
- Check API key validity
- Verify API quota/limits haven't been exceeded
- Check for rate limiting errors

### 9. View full logcat output (alternative)
```bash
adb logcat | grep -E "(Console|chromium:I)"
```

### 10. Stop emulator when done
```bash
adb emu kill
```

## Troubleshooting

### Emulator won't start
Check that the system image symlink exists:
```bash
ls -la $HOME/Library/Android/sdk/system-images/android-35/google_apis_playstore
```

If missing, create it:
```bash
mkdir -p $HOME/Library/Android/sdk/system-images/android-35
ln -sf /opt/homebrew/share/android-commandlinetools/system-images/android-35/google_apis_playstore $HOME/Library/Android/sdk/system-images/android-35/
```

### App crashes on startup
Clear app data and try again:
```bash
adb shell pm clear com.simonbianco.simonreads
adb shell am start -n com.simonbianco.simonreads/.MainActivity
```

### Can't see device in chrome://inspect
1. Ensure `webContentsDebuggingEnabled: true` in `capacitor.config.ts`
2. Restart the app
3. Check USB debugging is enabled on device/emulator
