# Feed Discovery Feature

The Feed Discovery feature allows users to find new RSS feeds based on their existing subscriptions using AI.

## How it Works

1.  **Access**: Click the "Sparkles" icon ✨ in the sidebar header (next to the "Add Feed" button).
2.  **AI Analysis**: The app sends a list of your current feed titles to the configured AI provider (Gemini, OpenAI, or Claude).
3.  **Suggestions**: The AI returns a list of 5-10 recommended feeds with titles, descriptions, and URLs.
4.  **Add**: Click "Add" on any suggestion to subscribe to it.

## Configuration

To use this feature, you must have an API key configured for one of the supported AI providers in the **Settings** menu:
*   **Gemini** (Google)
*   **OpenAI** (GPT-4o, etc.)
*   **Claude** (Anthropic)

## Technical Implementation

*   **Frontend**: `src/components/FeedDiscovery.tsx` (Modal UI)
*   **Service**: `src/feedDiscoveryService.ts` (AI interaction logic)
*   **Integration**: `src/components/Sidebar.tsx` (Entry point)

## Validation

The feature includes robust validation:
*   Before adding a feed, the app attempts to fetch and parse it.
*   If the URL is invalid or unreachable (e.g., CORS issues), an error is displayed, and the feed is not added.
