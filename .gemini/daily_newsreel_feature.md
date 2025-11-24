# Daily Newsreel Feature

## Overview
The Daily Newsreel feature automatically generates an AI-powered summary of recent articles from all your feeds based on a configurable time horizon.

## How It Works

### 1. Time Horizon Configuration
- Navigate to **Settings → AI → Daily Newsreel**
- Choose your preferred time horizon:
  - **Last Hour**: Articles from the past 60 minutes
  - **Last 4 Hours**: Articles from the past 4 hours
  - **Last 12 Hours**: Articles from the past 12 hours
  - **Today (24 Hours)**: Articles from the past 24 hours (default)

### 2. Generating a Daily Newsreel
- Click the **"Daily Newsreel"** button in the toolbar
- The system will:
  1. Filter all articles based on your selected time horizon
  2. Fetch and analyze the content of each article
  3. Generate a comprehensive AI summary organized by topic
  4. Present article titles as clickable links

### 3. Interactive Features
- **Clickable Titles**: Article titles in the Daily Newsreel are links
  - Click any title to open the full article in the main view
  - Seamlessly switch between the newsreel and individual articles
- **Read Aloud**: Use the speaker icon to have the newsreel read to you
- **Regenerate**: Click the refresh icon to create a new summary

## Differences from Regular Newsreel

| Feature | Daily Newsreel | Regular Newsreel |
|---------|---------------|------------------|
| Article Selection | Automatic (time-based) | Manual (user-selected) |
| Time Filter | Configurable (1-24 hours) | None |
| Organization | Organized by topic | Sequential summary |
| Title Format | Clickable markdown links | Plain text |
| Use Case | Daily digest of recent news | Custom summary of specific articles |

## Technical Implementation

### Key Components Modified
1. **`src/types.ts`**: Added `dailyNewsreelTimeHorizon` setting
2. **`src/components/Toolbar.tsx`**: Added Daily Newsreel button and time horizon selector
3. **`src/components/Newsreel.tsx`**: Enhanced to support clickable article links
4. **`src/App.tsx`**: Added Daily Newsreel state management and article filtering

### AI Prompt Differences
- **Daily Newsreel**: Instructs AI to create markdown links for titles and organize by topic
- **Regular Newsreel**: Focuses on bullet-point summaries without links

### Article Link Handling
- Uses a `Map` to track article URLs to Article objects
- Custom ReactMarkdown link renderer intercepts clicks on article URLs
- Calls `onArticleClick` handler to switch to article view

## User Workflow
1. Configure time horizon in settings (one-time setup)
2. Click "Daily Newsreel" button anytime
3. Review AI-generated summary of recent articles
4. Click article titles to read full content
5. Use Read Aloud or Regenerate as needed
