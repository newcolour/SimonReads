# Testing Guide - Reading Personalities v3.0

## How to Test

### 1. Install the App

1. Open **Finder** and navigate to:
   ```
   /Users/simone/Antigravity/RSSReader/release/
   ```

2. Double-click **`SimonReads-3.0.0-arm64.dmg`**

3. Drag **SimonReads** to your **Applications** folder

4. Open SimonReads from Applications
   - If you get a security warning, go to **System Settings → Privacy & Security → Allow**

### 2. Access Personality Settings

1. Click the **⚙️ Settings** button in the top-right corner

2. Click the **Personality** tab (new tab!)

3. You should see the personality selector with 5 cards:
   - 🎯 Focused Minimalist
   - 💬 Conversational Curator (currently selected by default)
   - 🔬 Deep Diver
   - 📋 Daily Brief
   - 🎲 Serendipity Explorer

### 3. Test Each Personality

#### Test 1: 🎯 Focused Minimalist
**What to look for:**

1. Click the **Focused Minimalist** card
2. Click **Save Changes**
3. Go back to your article list

**Expected changes:**
- ✅ **Single column layout** - Articles appear centered in a narrow column (800px max)
- ✅ **Large text** - Titles should be noticeably bigger (1.5x normal size)
- ✅ **Minimal metadata** - Only publication date shown (no author, no duration)
- ✅ **High contrast** - Text should be darker/more readable
- ✅ **Spacious padding** - More breathing room between articles
- ✅ **Thicker borders** - Articles separated by 2px borders instead of 1px

**What WON'T work yet:**
- ⏳ Keyboard shortcuts (infrastructure ready, not implemented)

---

#### Test 2: 💬 Conversational Curator
**What to look for:**

1. Click the **Conversational Curator** card
2. Click **Save Changes**
3. Return to article list

**Expected changes:**
- ✅ **Card layout** - Articles in rounded cards with shadows
- ✅ **Hover effect** - Cards lift slightly on hover
- ✅ **Purple accent** - Left border appears on hover
- ✅ **Full metadata** - Shows author, duration, AND date
- ✅ **Medium text** - Normal reading size

**What WON'T work yet:**
- ⏳ Inline AI summaries (needs UI integration)
- ⏳ Quick action buttons (needs UI integration)

---

#### Test 3: 🔬 Deep Diver
**What to look for:**

1. Select **Deep Diver** personality
2. Save and return to article list

**Expected changes:**
- ✅ **Two-column grid** - Articles side-by-side (if window is wide enough)
- ✅ **Full metadata** - All information displayed
- ✅ **Responsive** - Collapses to single column on narrow windows

**What WON'T work yet:**
- ⏳ Related articles panel (needs UI integration)
- ⏳ Citation mode formatting (needs UI integration)

---

#### Test 4: 📋 Daily Brief
**What to look for:**

1. Select **Daily Brief** personality
2. Save and return to article list

**Expected changes:**
- ✅ **List layout** - Simple, compact article list
- ✅ **Small text** - Condensed for quick scanning
- ✅ **Minimal metadata** - Only essentials shown
- ✅ **Morning colors** - Warm yellow gradient in header (if visible)

**What WON'T work yet:**
- ⏳ Importance score badges (needs UI integration)
- ⏳ 3-line AI summaries (needs UI integration)

---

#### Test 5: 🎲 Serendipity Explorer
**What to look for:**

1. Select **Serendipity Explorer** personality
2. Save and return to article list

**Expected changes:**
- ✅ **Card layout** - Similar to Conversational Curator
- ✅ **Slide-in animations** - Articles animate in when loading
- ✅ **Orange accent** - Warm discovery colors

**What WON'T work yet:**
- ⏳ Shuffled order (needs UI integration)
- ⏳ Playful microcopy (needs UI integration)
- ⏳ Thumbnail images (needs UI integration)

---

## What to Test - Checklist

### Visual Changes (Should Work Now)
- [ ] Layout changes when switching personalities
- [ ] Font sizes change (small → large)
- [ ] Metadata shows/hides correctly
- [ ] Single column vs multi-column vs cards
- [ ] High contrast mode (Focused Minimalist)
- [ ] Card hover effects (Conversational Curator)
- [ ] Animations play (Serendipity Explorer)
- [ ] Settings are saved and persist on app restart

### Auto-Switching (Should Work Now)
- [ ] Enable "Automatic Switching"
- [ ] Select "Time of Day"
- [ ] Click "Time Schedule" tab
- [ ] Enable schedule
- [ ] Set different personality for each time period
- [ ] Wait 1 minute - app should auto-switch (check every minute)

### What WON'T Work Yet (Phase 2.5 Needed)
- ⏳ Inline AI summaries in Conversational Curator
- ⏳ Importance score badges in Daily Brief
- ⏳ Related articles in Deep Diver
- ⏳ Article shuffling in Serendipity Explorer
- ⏳ Playful messages
- ⏳ Quick action buttons

---

## Troubleshooting

### "I don't see the Personality tab"
- Make sure you're running the latest build (3.0.0)
- Close and reopen the app
- Clear app cache: Delete `~/Library/Application Support/SimonReads`

### "Changes don't apply"
- Click **Save Changes** in settings
- The changes should be instant (no need to restart)
- Try switching to a different feed to refresh the view

### "It looks the same after switching"
- Some changes are subtle - compare:
  - **Focused Minimalist** vs **Conversational Curator** (single column vs cards)
  - **Deep Diver** (multi-column if window wide enough)
  - **Daily Brief** (smaller text, compact)

### "I want to reset to default"
- Select **Conversational Curator** (the default)
- Or: Delete settings and restart app

---

## Reporting Issues

When testing, note:
1. **Which personality** you selected
2. **What you expected** to see
3. **What actually happened**
4. **Screenshots** if possible

---

## Next Steps After Testing

Once you've confirmed the basics work, we can:
1. **Proceed with Phase 2.5** - Add UI integration for advanced features
2. **Fix any issues** you find
3. **Tweak styling** if needed
4. **Add more personalities** if you want

**Current Status:**
- ✅ Phase 1: Layout and basic styling
- ✅ Phase 2: Infrastructure and utilities
- ⏳ Phase 2.5: UI integration (pending)

Happy testing! 🎉
