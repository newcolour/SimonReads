# SimonReads 📰

A beautiful, cross-platform RSS reader with AI-powered features. Built with Electron, React, and Capacitor. 
This started as an attempt at using Google's Antigravity and seeing how far I could push without actually writing a single line of code. It evolved into something I really like and that I think it is missing in its current form. Feel free to fork it, modify it, distribute it, etc.

Enjoy it!

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Android-lightgrey.svg)

## ✨ Features

- **📖 Beautiful Reader View** - Clean, distraction-free reading experience with multiple themes
- **🤖 AI-Powered Summaries** - Summarize articles using Gemini, OpenAI, or Claude
- **💬 AI Chat** - Have conversations about articles with AI
- **📰 Daily Newsreel** - AI-generated digest of your recent articles
- **🎨 Multiple Themes** - Dark, Light, Sepia, Nord, Solarized, Dracula, Gruvbox, Tokyo Night, Sorcerer
- **🎧 Podcast Support** - Play audio and video podcasts directly in the app
- **📱 Cross-Platform** - Works on macOS, Linux, and Android
- **🔍 Feed Discovery** - Discover new feeds based on your interests
- **🏷️ Smart Organization** - Folders, unread counts, and article management
- **📧 Email Digests** - Receive daily newsreels via email (with PDF attachment)
- **👁️ Unread Filter** - Toggle to show only unread articles in any feed
- **🐘 Share to Mastodon** - Share articles directly to Mastodon apps (Ivory, Ice Cubes, Mona, and more)

## 🖥️ Screenshots

*Coming soon*

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- For Android: Android Studio with SDK

### Installation

```bash
# Clone the repository
git clone https://github.com/newcolour/SimonReads.git
cd SimonReads

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building

```bash
# Build for macOS
npm run build

# Build for Linux
npm run build:linux

# Build for Android
npm run build:android:apk
```

## 🔧 Configuration

### AI Features

To use AI features (summaries, chat, newsreel), add your API key in Settings:

- **Gemini** (recommended): Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- **OpenAI**: Get an API key from [OpenAI](https://platform.openai.com/api-keys)
- **Claude**: Get an API key from [Anthropic](https://console.anthropic.com/)

### Email Digests

Configure SMTP settings in Settings to receive daily newsreels via email.

## 📁 Project Structure

```
SimonReads/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── utils/             # Utility functions
│   └── ...
├── electron/              # Electron main process
├── android/               # Android (Capacitor) project
├── public/                # Static assets
└── release/               # Built applications
```

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Desktop**: Electron
- **Mobile**: Capacitor (Android)
- **AI**: Gemini, OpenAI, Claude APIs
- **Styling**: CSS with CSS Variables for theming

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Simone Bianco**

## 🙏 Acknowledgments

- All the open-source libraries that made this possible
- The RSS community for keeping the open web alive

---

Made with ❤️ by Simone Bianco
