# Project Status: SimonReads (RSS Reader)

**Last Updated:** 2026-02-10
**Version:** 4.5.6
**Repository:** [simonebianco/simon-reads](https://github.com/simonebianco/simon-reads)

## 📌 Project Overview

**SimonReads** is a modern, cross-platform RSS reader application built with web technologies (React, TypeScript) and wrapped for desktop (Electron) and mobile (Capacitor/Android). It differentiates itself with a heavy focus on AI-powered features, privacy, and a premium user interface.

### 🛠 Tech Stack

*   **Frontend:** React 18, TypeScript, Vite
*   **Desktop Wrapper:** Electron
*   **Mobile Wrapper:** Capacitor (Android focused)
*   **State Management:** React Context + Local Storage / Supabase Sync
*   **Styling:** Native CSS with CSS Variables (Theming), Responsive Design
*   **AI Integration:** Gemini, OpenAI, Claude, Ollama (Local LLMs)
*   **Text-to-Speech:** Microsoft Edge TTS (Free, Neural), Capacitor TTS, Web Speech API

---

## 🚀 Current Status

The project is currently in a **Stable / Active Development** phase.
*   **Current Production Version:** `v4.5.6`
*   **Recent Release:** Release candidates for v4.5.x have been built for macOS (DMG) and Android (APK).
*   **Active Work:** Refinement of AI features (Fact Check, Feed Health), UI polish (Icons, Dark mode), and mobile optimization.

---

## ✨ Key Features & Modules

### 1. Core Reading Experience
*   **Universal RSS Support:** Parsing standard RSS/Atom feeds via `rss-parser`.
*   **Reading Modes:**
    *   **Classic:** Standard list/detail view.
    *   **Modern:** Card-based or magazine-style layout.
    *   **Speed Reader:** RSVP (Rapid Serial Visual Presentation) mode.
    *   **Focus Mode:** Distraction-free reading with timers.
*   **Theming:** 12+ Themes including Dark, Light, Sepia, Nord, Dracula, Tokyo Night, etc.
*   **Organization:** Folders, Feeds, Favorites, Read/Unread tracking.

### 2. AI & Intelligence (`/src/services/*`)
The app integrates multiple AI providers (Gemini, OpenAI, Claude, Ollama) for advanced features:
*   **Summarization:** Generate concise summaries of articles (Short/Medium/Long, varying depth).
*   **Chat with Article:** Context-aware chat about the specific content of an article.
*   **Daily Newsreel:** AI-curated digest of top stories, generated via a Map-Reduce approach.
*   **Fact Checking:** Cross-reference article claims with external sources (DuckDuckGo integration).
*   **Feed Health:** AI analysis of feed quality and relevance.
*   **Article Scoring:** Importance scoring (1-10) to highlight "Must Read" content.
*   **Translation:** On-the-fly translation of titles and content.

### 3. Audio & Multimedia
*   **AI Podcasts:** Converts text articles into multi-voice audio conversations (Host "Alex" & Guest "Jordan") using Edge TTS.
*   **Text-to-Speech:** Read articles aloud with neural voices.
*   **Native Media:** Support for audio/video enclosures (Podcasts/YouTube).

### 4. Search & Discovery
*   **Feed Discovery:** Search for new feeds by topic or URL.
*   **Visual Search:** (Privacy-focused) Search web using images.
*   **Local Search:** Filter articles and feeds.

### 5. Data & Sync
*   **Cross-Platform Sync:** Uses **Supabase** to sync Feeds, Read Status, and Settings between devices.
*   **Encryption:** Client-side AES encryption for sensitive data (API keys) before syncing.
*   **Import/Export:** OPML support for backing up and migrating feeds.
*   **Offline Support:** Caching of article content and images (limited).

---

## 📂 Project Structure

```
SimonReads/
├── android/                 # Android Native Project (Gradle/Capacitor)
├── electron/                # Electron Main Process code
├── src/                     # React Application Source
│   ├── components/          # UI Components (Feature-based)
│   │   ├── ArticleView.tsx  # Main reading component
│   │   ├── Chat.tsx         # AI Chat interface
│   │   ├── Sidebar.tsx      # Navigation & Feed list
│   │   └── ...
│   ├── services/            # Business Logic & API integrations
│   │   ├── aiService.js     # Core AI wrapper
│   │   ├── syncService.ts   # Supabase synchronization
│   │   ├── rssService.ts    # Feed fetching & parsing
│   │   └── ...
│   ├── hooks/               # Custom React Hooks
│   ├── utils/               # Helper functions
│   ├── App.tsx              # Main Application Controller
│   └── types.ts             # TypeScript Definitions
├── release/                 # Output directory for builds
└── package.json             # Dependencies & Scripts
```

---

## 🛠 Build & Development

### Prerequisites
*   Node.js 18+
*   NPM
*   Android Studio (for Android builds)

### Common Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start local Vite dev server (Web) |
| `npm run electron:dev` | Start Electron dev wrapper |
| `npm run build` | Build for macOS (Universal) |
| `npm run build:win` | Build for Windows (NSIS + Portable) |
| `npm run build:linux` | Build for Linux (AppImage + Deb) |
| `npm run build:android:apk`| Build Android Debug APK |
| `npm run sync:android` | Sync web assets to Android native project |

### Environment / Secrets
Secrets (API Keys) are primarily handled within the **Application Settings** UI by the user and stored in LocalStorage (encrypted).
*   **Supported Keys:** Google Gemini, OpenAI, Anthropic Claude.
*   **Supabase:** Configured for sync (URL/Key).

---

## 📝 Recent Development History

*   **Focus Mode Service:** Implementation of distraction-free reading logic.
*   **Fact Check UI:** Visual improvements to the fact-checking component `FactCheck.tsx`.
*   **Feed Health:** New service and UI for analyzing feed quality `FeedHealth.tsx`.
*   **Refactoring:**
    *   Transitioning more components to TypeScript.
    *   Refining `SyncService` to exclusively use Supabase (WebDAV removed).
    *   Fixing port issues for local LLM (Ollama) connections.

## ⚠️ Known Issues / TODOs
*   **Performance:** Large feeds can impact rendering performance in the list view. Virtualization strategies may need review.
*   **Sync:** Conflict resolution strategy is "Last Write Wins" for some data types; could be improved for edge cases.
*   **Android:**
    *   Background processing for AI tasks on mobile is limited.
    *   Dark mode chat bubble contrast issues (recently noticed).

---

## 🤝 Handoff Notes
*   **Critical Files:** `src/App.tsx` handles a lot of global state and event routing; consider looking into `src/contexts` for future refactoring to reduce complexity.
*   **AI Logic:** Most AI logic resides in `src/services/aiService.js` (legacy JS) and newer specific services like `newsreelService.ts`.
*   **Styles:** Global styles in `index.css`, component-specific styles in `*.css`. CSS Variables are used extensively for dynamic theming.
