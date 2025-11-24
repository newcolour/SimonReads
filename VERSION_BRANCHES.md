# SimonReads Version 2.0 - Branch Summary

## 📦 Repository Structure

### Branches

#### `main` - Version 1.0.19 (Stable)
**Current stable version** - RSS Reader with AI features

**Features:**
- RSS feed management and reading
- AI-powered summaries (Gemini, OpenAI, Claude)
- Chat with articles
- PDF export (NYT-style newspaper)
- Daily newsreel generation
- Email delivery (desktop only)
- Multi-theme support (Dark, Light, Sepia, Black/OLED)
- Font customization (cleaned up, 4 curated fonts)
- Android build support (Capacitor)
- Read aloud with TTS

**Status:** ✅ Production-ready, fully tested

---

#### `2.0` - Version 2.0.0 (Podcast Support)
**New major version** - Media Reader with Podcast Support

**All features from 1.0.19 PLUS:**
- 🎧 **Audio podcast playback**
- 📹 **Video podcast playback**
- 🎮 **Full media controls** (play/pause, seek, volume, speed)
- 🏷️ **Media type indicators** (badges in article list)
- ⏱️ **Episode duration display**
- 🖼️ **Episode artwork support**
- 🔍 **Automatic podcast detection**
- 📊 **iTunes metadata parsing**

**Status:** ✨ New feature branch, ready for testing

---

## 🔄 Switching Between Versions

### Use Version 1.0 (RSS Reader Only)
```bash
git checkout main
npm install
npm run dev
```

### Use Version 2.0 (With Podcasts)
```bash
git checkout 2.0
npm install
npm run dev
```

---

## 📊 Feature Comparison

| Feature | Version 1.0 (main) | Version 2.0 (2.0 branch) |
|---------|-------------------|--------------------------|
| RSS Feeds | ✅ | ✅ |
| Article Reading | ✅ | ✅ |
| AI Summaries | ✅ | ✅ |
| Chat with Articles | ✅ | ✅ |
| PDF Export | ✅ | ✅ |
| Daily Newsreel | ✅ | ✅ |
| Email Delivery | ✅ | ✅ |
| Themes | ✅ (4 themes) | ✅ (4 themes) |
| Font Options | ✅ (4 fonts) | ✅ (4 fonts) |
| Android Build | ✅ | ✅ |
| **Audio Podcasts** | ❌ | ✅ **NEW** |
| **Video Podcasts** | ❌ | ✅ **NEW** |
| **Media Player** | ❌ | ✅ **NEW** |
| **Playback Controls** | ❌ | ✅ **NEW** |
| **Episode Artwork** | ❌ | ✅ **NEW** |

---

## 🎯 Version 2.0 New Files

### Components
- `src/components/PodcastPlayer.tsx` - Media player component
- `src/components/PodcastPlayer.css` - Player styling

### Documentation
- `PODCAST_FEATURE.md` - Comprehensive podcast feature guide

### Modified Files
- `src/types.ts` - Added podcast types
- `src/rssService.ts` - Added podcast parsing
- `src/components/ArticleView.tsx` - Integrated player
- `src/components/ArticleList.tsx` - Added media badges
- `src/components/ArticleList.css` - Badge styling
- `package.json` - Version bump to 2.0.0

---

## 🚀 Development Workflow

### Working on Version 1.0
```bash
git checkout main
# Make changes
git add .
git commit -m "Your changes"
```

### Working on Version 2.0
```bash
git checkout 2.0
# Make changes
git add .
git commit -m "Your changes"
```

### Merging 1.0 fixes into 2.0
```bash
git checkout 2.0
git merge main
# Resolve any conflicts
git commit
```

---

## 📝 Commit History

### Main Branch (1.0.19)
```
1e1b6ca - Version 1.0.19 - Current stable version with RSS reader, 
          AI summaries, PDF export, and font cleanup
```

### 2.0 Branch (2.0.0)
```
a79cbe2 - Version 2.0.0 - Add comprehensive podcast support (audio/video)
          - Full-featured podcast player
          - Audio and video support
          - iTunes metadata parsing
          - Media type indicators
          - Episode duration and artwork
```

---

## 🧪 Testing Recommendations

### Version 1.0 Testing
- ✅ RSS feed import/export
- ✅ AI summary generation
- ✅ PDF export functionality
- ✅ Theme switching
- ✅ Font customization
- ✅ Android build

### Version 2.0 Testing
- ✅ All Version 1.0 tests
- ✅ Audio podcast playback
- ✅ Video podcast playback
- ✅ Player controls (play, pause, seek)
- ✅ Volume and speed controls
- ✅ Media badge display
- ✅ Episode duration display
- ✅ Artwork loading

### Test Podcast Feeds
```
Audio: https://feeds.npr.org/500005/podcast.xml
Video: https://feeds.twit.tv/twit.xml
Tech: https://feed.syntax.fm/rss
```

---

## 📦 Build Commands

### Desktop (Electron)
```bash
# Development
npm run electron:dev

# Production build (Mac)
npm run build:mac

# Production build (Windows)
npm run build:win

# Production build (Linux)
npm run build:linux
```

### Android (Capacitor)
```bash
# Development
npm run build:android

# Debug APK
npm run build:android:apk

# Release APK
npm run build:android:release
```

---

## 🔐 Version Control Best Practices

### Keep Both Versions
- **DO NOT** delete the `main` branch
- **DO NOT** force merge 2.0 into main without testing
- Maintain both branches independently
- Users can choose which version to use

### Future Updates
- Bug fixes: Apply to both branches
- New features: Decide per-feature which branch
- Security updates: Apply to both branches immediately

---

## 📖 Documentation

### Version 1.0
- `README.md` - General app documentation
- `ANDROID_BUILD.md` - Android build guide
- `ANDROID_QUICKSTART.md` - Quick Android setup
- `.gemini/*.md` - Feature documentation

### Version 2.0
- All Version 1.0 documentation
- `PODCAST_FEATURE.md` - Podcast feature guide

---

## 🎉 Summary

**Version 1.0.19 (main)**: Stable, production-ready RSS reader with AI features
**Version 2.0.0 (2.0 branch)**: Enhanced media reader with full podcast support

Both versions are fully functional and can be used independently. The 2.0 branch is backward compatible with all 1.0 features while adding comprehensive podcast capabilities.

**Current Branch:** `2.0` ✨
**Previous Stable:** `main` (1.0.19)

---

## 🤝 Contributing

When contributing:
1. Specify which version (1.0 or 2.0)
2. Create feature branches from the appropriate base
3. Test thoroughly before merging
4. Update relevant documentation

---

**Happy Reading & Listening! 📰🎧📹**
