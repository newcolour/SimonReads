# Newspaper PDF Export - Language Support Update

## Overview
Enhanced the newspaper PDF export feature to include the AI-generated newsreel summary and add language indicators for articles in different languages.

## New Features

### 1. AI-Generated Summary Section
- **Location**: Appears after the date, before individual articles
- **Title**: "Today's Headlines"
- **Content**: Full AI-generated newsreel summary (converted from markdown to plain text)
- **Formatting**: 
  - 10pt Helvetica normal font
  - Bullet points for lists
  - Limited to 30 lines to prevent overflow
  - Bold separator line after summary

### 2. Language Detection & Indicators
- **AI Detection**: During article ranking, AI detects the original language of each article
- **Language Indicators**: Articles in a different language than the target summary language show:
  - **Top Story**: "(original article in [Language])" in 9pt italic gray text
  - **Regular Articles**: "(original in [Language])" in 8pt italic gray text
- **Smart Display**: Only shows language indicator if article language differs from target language
- **Target Language**: Uses `settings.summaryLanguage` (e.g., "English", "Italian", "Spanish")

### 3. Consistent Language Throughout
- **AI Summaries**: All article summaries generated in the target language
- **Newsreel Summary**: Already in target language from the newsreel generation
- **Language Awareness**: AI is instructed to:
  1. Detect original article language
  2. Provide summaries in the target language
  3. Maintain consistency across all content

## PDF Layout Structure

```
┌─────────────────────────────────┐
│     SimonDailyNews              │ ← Masthead
│  All the News That's Fit...     │ ← Tagline
├─────────────────────────────────┤
│  Friday, November 21, 2025      │ ← Date
├─────────────────────────────────┤
│  Today's Headlines              │ ← NEW: Section title
│                                 │
│  • AI-generated summary...      │ ← NEW: Newsreel summary
│  • Key points from articles...  │
│  • Organized overview...        │
│                                 │
├═════════════════════════════════┤ ← Bold separator
│                                 │
│  TOP STORY TITLE                │ ← Highest ranked article
│  (original article in Italian)  │ ← NEW: Language indicator
│  [Image if available]           │
│  Summary in English...          │
│                                 │
├──────────────┬──────────────────┤
│ Article 2    │ Article 3        │
│ (original in │ Summary...       │ ← Language indicator
│  Spanish)    │                  │   (if needed)
│ Summary...   │                  │
└──────────────┴──────────────────┘
```

## Technical Implementation

### Updated Functions

1. **`generateNewspaperPDF()`**
   - Now accepts `newsreelSummary` parameter
   - Calls `addNewsreelSummary()` before laying out articles
   - Passes `targetLanguage` to layout functions

2. **`addNewsreelSummary()`** (NEW)
   - Converts markdown to plain text
   - Removes markdown formatting (headers, bold, italic, links)
   - Converts list markers to bullets (•)
   - Limits display to 30 lines
   - Adds bold separator line

3. **`rankArticlesByImportance()`**
   - Updated AI prompt to request language detection
   - Requests summaries in target language
   - Returns `language` field for each article
   - Fallback returns `undefined` for language

4. **`addTopStory()` & `addRegularArticle()`**
   - Accept `targetLanguage` parameter
   - Check if article language differs from target
   - Display language indicator when needed
   - Format indicator in italic gray text

### AI Prompt Updates

**New prompt structure:**
```
Analyze these N news articles and rank them by importance...

For each article:
1. Assign an importance score (1-10)
2. Provide a 1-2 sentence summary in [Target Language]
3. Detect the original language of the article

Respond in JSON format:
{
  "rankings": [
    {
      "index": 0,
      "importance": 8,
      "summary": "Brief summary in [Target Language]",
      "language": "English" (or "Italian", "Spanish", etc.)
    },
    ...
  ]
}
```

### Markdown to Plain Text Conversion

Regex patterns used:
- `/#{ 1,6}\s/g` → Remove headers
- `/\*\*(.+?)\*\*/g` → Remove bold formatting
- `/\*(.+?)\*/g` → Remove italic formatting
- `/\[(.+?)\]\(.+?\)/g` → Remove links, keep text
- `/^[-*+]\s/gm` → Convert list markers to bullets

## Example Output

**For a multilingual newsreel:**

```
Today's Headlines
─────────────────

• Breaking news from Italy shows...
• Spanish markets react to...
• Analysis of global trends...

═════════════════════════════════

ITALIAN GOVERNMENT ANNOUNCES REFORMS
(original article in Italian)

The Italian government has announced major economic 
reforms aimed at boosting growth...

┌──────────────────┬──────────────────┐
│ Spanish Markets  │ Global Analysis  │
│ (original in     │                  │
│  Spanish)        │ International... │
│ Markets show...  │                  │
└──────────────────┴──────────────────┘
```

## Benefits

1. **Context Awareness**: Users know when reading translated summaries
2. **Language Consistency**: All summaries in user's preferred language
3. **Comprehensive Overview**: Newsreel summary provides context before details
4. **Professional Appearance**: Language indicators are subtle and non-intrusive
5. **Multilingual Support**: Works seamlessly with articles in any language

## User Experience

1. User generates Daily Newsreel (articles may be in various languages)
2. AI creates newsreel summary in user's target language
3. User clicks PDF export button
4. AI ranks articles and:
   - Detects each article's original language
   - Creates summaries in target language
5. PDF generated with:
   - Newsreel summary at top
   - Language indicators where needed
   - All content in consistent target language

## Configuration

**Target Language Setting:**
- Location: Settings → AI → Summary Language
- Options: English, Italian, Spanish, French, German, etc.
- Default: English
- Used for: AI summaries, newsreel generation, PDF content

## Future Enhancements

- Flag icons next to language indicators
- Color-coded language badges
- Language statistics in PDF footer
- Option to show original text alongside translation
- Multi-language table of contents
