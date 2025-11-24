# Summary Window Debugging Guide

## 🔍 How to Debug the Summary Window Issue

### **Step 1: Install the Debug Build**

```bash
open release/SimonReads-2.0.0-arm64.dmg
```

Install the app to Applications folder.

### **Step 2: Test the Summary Window**

1. Open SimonReads
2. Select any article
3. Click the **Summarize** button (🧠 brain icon)
4. Wait for the summary to generate
5. A popup window should open **with DevTools already open**

### **Step 3: Check the Console Logs**

You'll see **TWO DevTools windows**:
- **Main Window DevTools** - Shows ArticleView logs
- **Summary Window DevTools** - Shows SummaryWindow logs

#### **In Main Window Console:**
Look for these logs:
```
ArticleView: Creating summary window with data: {
  summaryLength: 1234,
  articleTitle: "Article Title",
  articleId: "some-id",
  theme: "dark"
}
ArticleView: Summary window creation response: { success: true }
```

#### **In Summary Window Console:**
Look for these logs:
```
SummaryWindow: Component mounted, setting up IPC listener
SummaryWindow: Article ID from hash: some-id
SummaryWindow: IPC renderer found, registering listener
SummaryWindow: Fetching data via invoke for article: some-id
SummaryWindow: Successfully fetched data via invoke
```

OR if it's failing:
```
SummaryWindow: No data available yet, will retry
SummaryWindow: Retry 1/10 - fetching data
SummaryWindow: Retry 2/10 - fetching data
...
```

### **Step 4: Check Electron Main Process Logs**

If you're running from terminal, check the terminal output for:
```
Main: Stored pending summary data for article: some-id
Main: Creating new summary window for article: some-id
Main: Summary window finished loading for article: some-id
Main: Sending summary data via did-finish-load
Main: Received get-summary-data request for article: some-id
Main: Returning summary data for article: some-id
```

### **Step 5: Common Issues to Check**

#### **Issue 1: Article ID Mismatch**
- Check if the article ID in the URL hash matches the stored data
- Look for: `SummaryWindow: Article ID from hash: xxx`
- Compare with: `Main: Stored pending summary data for article: yyy`
- **They must match!**

#### **Issue 2: IPC Renderer Not Available**
- Look for: `SummaryWindow: IPC renderer not available!`
- This means preload script didn't load
- **Solution**: Check webPreferences in main.ts

#### **Issue 3: Data Not Stored**
- Look for: `Main: No pending data found for article: xxx`
- This means data wasn't stored before window opened
- **Solution**: Check timing in ArticleView

#### **Issue 4: Window Destroyed Before Data Sent**
- Look for: `Main: Summary window closed for article: xxx`
- Happening too early means window closed before data arrived
- **Solution**: Increase retry timeout

### **Step 6: Manual Test in Console**

In the **Summary Window DevTools Console**, try this:

```javascript
// Check if IPC is available
console.log('IPC available:', !!window.ipcRenderer);

// Get article ID from URL
const hash = window.location.hash;
const articleId = hash.split('/')[2]?.split('?')[0];
console.log('Article ID:', articleId);

// Try to fetch data manually
window.ipcRenderer.invoke('get-summary-data', articleId)
  .then(result => console.log('Manual fetch result:', result))
  .catch(err => console.error('Manual fetch error:', err));
```

### **Step 7: Expected Success Output**

When working correctly, you should see:

**Main Window:**
```
ArticleView: Creating summary window with data: {...}
ArticleView: Summary window creation response: { success: true }
```

**Electron Main (Terminal):**
```
Main: Stored pending summary data for article: abc123
Main: Creating new summary window for article: abc123
Main: Summary window finished loading for article: abc123
Main: Sending summary data via did-finish-load
Main: Received get-summary-data request for article: abc123
Main: Returning summary data for article: abc123
```

**Summary Window:**
```
SummaryWindow: Component mounted
SummaryWindow: Article ID from hash: abc123
SummaryWindow: IPC renderer found
SummaryWindow: Fetching data via invoke for article: abc123
SummaryWindow: Successfully fetched data via invoke
```

### **Step 8: Report Findings**

Please share:
1. ✅ What logs you see in **Main Window Console**
2. ✅ What logs you see in **Summary Window Console**
3. ✅ What logs you see in **Terminal** (Electron main process)
4. ✅ Any error messages
5. ✅ The article ID being used

---

## 🚀 Quick Test Commands

### Test in Development Mode
```bash
npm run electron:dev
```
Then try the summary window and check all three consoles.

### Test in Packaged App
```bash
open release/mac-arm64/SimonReads.app
```
DevTools will open automatically.

---

## 📝 What to Look For

### ✅ Good Signs:
- "Successfully fetched data via invoke"
- "Returning summary data for article"
- Summary appears in window

### ❌ Bad Signs:
- "No data available yet, will retry"
- "IPC renderer not available"
- "No pending data found"
- "Failed to load data after max retries"

---

**With DevTools now enabled, we can see exactly what's happening!**
