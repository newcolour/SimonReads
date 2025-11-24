# SimonReads 2.0 - Known Issues

## Summary Window Loading Issue

### **Problem**
The AI summary popup window shows a rotating "Loading summary..." message but the summary content never appears.

### **Status**
🔍 **Under Investigation** - This is a pre-existing issue from version 1.0, not introduced by version 2.0 changes.

### **What's Working**
- ✅ Summary window opens correctly
- ✅ Routing to `#/summary/article-id` works
- ✅ Theme is applied correctly
- ✅ IPC renderer is exposed via preload script

### **What's Not Working**
- ❌ Summary data not being received by the window
- ❌ IPC communication between main process and summary window appears to fail

### **Technical Details**

**Expected Flow:**
1. User clicks "Summarize" button in ArticleView
2. Main process creates summary window (`electron/main.ts` line 139)
3. Summary window loads and sends 'summary-window-ready' event
4. Main process receives event and sends 'update-summary' with data
5. Summary window receives data and displays it

**Actual Behavior:**
- Steps 1-3 complete successfully
- Step 4 or 5 appears to fail (data not received)

### **Debugging Steps Taken**
1. ✅ Verified routing in `src/main.tsx` - Works correctly
2. ✅ Verified IPC exposure in `electron/preload.ts` - Correct
3. ✅ Verified summary window component has retry logic - Present
4. ✅ Verified main process stores pending data - Implemented

### **Possible Causes**
1. **Timing Issue**: Window might not be fully ready when data is sent
2. **IPC Event Not Firing**: 'summary-window-ready' event might not reach main process
3. **Context Isolation**: Despite `contextIsolation: false`, IPC might not work in packaged app
4. **Webview Loading**: Summary window might be loading wrong URL/hash

### **Next Steps to Fix**
1. Add console.log statements to main process to verify events are received
2. Check if issue occurs in dev mode (`npm run electron:dev`) vs packaged app
3. Verify the summary window URL is correct in packaged app
4. Consider using a different IPC pattern (invoke/handle instead of send/on)
5. Test with a simple hardcoded summary to isolate the issue

### **Workaround**
Use **Inline Summary Mode** instead of Popup:
1. Right-click the "Summarize" button
2. This toggles to inline mode
3. Summary appears directly in the article view
4. This mode works correctly! ✅

### **Files Involved**
- `electron/main.ts` (lines 122-232) - Summary window creation and IPC
- `src/components/SummaryWindow.tsx` - Summary window component
- `src/components/ArticleView.tsx` - Summarize button and mode toggle
- `src/main.tsx` - Hash-based routing
- `electron/preload.ts` - IPC exposure

---

## Other Known Issues

### Email Service - ✅ FIXED in 2.0
- **Issue**: Module not found errors in packaged app
- **Status**: Fixed with build-electron.sh script
- **Commits**: b1bf8df, bb3c10a, 2fc278d

### Podcast Player - ✅ NEW in 2.0
- **Status**: Fully functional
- **Features**: Audio/video playback, controls, media badges

---

**Last Updated**: 2025-11-24
**Version**: 2.0.0
