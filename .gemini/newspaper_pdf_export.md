# Newspaper PDF Export Feature

## Overview
Export your Daily Newsreel as a beautifully formatted newspaper-style PDF with AI-powered article ranking, clickable links, and professional layout.

## Features

### 1. AI-Powered Article Ranking
- Articles are analyzed and ranked by importance (1-10 scale)
- Ranking considers:
  - Impact and significance
  - Timeliness
  - Relevance
  - Newsworthiness
- Top-ranked articles get prominent placement

### 2. Newspaper-Style Layout
- **Masthead**: Large "SimonDailyNews" header with tagline
- **Date**: Full date with edition information
- **Top Story**: Most important article gets:
  - Full-width placement
  - Larger title (18pt bold)
  - Image placeholder (when available)
  - Extended summary
- **Regular Articles**: Two-column layout with:
  - Medium titles (12pt bold)
  - Condensed summaries
  - Professional spacing

### 3. Interactive Elements
- **Clickable Titles**: All article titles are hyperlinks to original sources
- **Professional Formatting**: Clean, readable typography
- **Proper Pagination**: Automatic page breaks when needed

### 4. AI-Generated Summaries
- Each article gets a concise 1-2 sentence summary
- Summaries are generated during the ranking process
- Optimized for newspaper-style presentation

## How to Use

1. **Generate Daily Newsreel**: Click "Daily Newsreel" button
2. **Wait for Summary**: Let AI generate the newsreel
3. **Export to PDF**: Click the download icon (📄) in the newsreel header
4. **Wait for Processing**: AI ranks articles and generates PDF
5. **Download**: PDF automatically downloads with filename `SimonDailyNews_YYYY-MM-DD.pdf`

## Technical Implementation

### PDF Generation
- **Library**: jsPDF
- **Format**: A4 portrait
- **Fonts**: Helvetica (bold, normal, italic)
- **Layout**: Professional newspaper grid

### Article Ranking Algorithm
1. **AI Analysis**: Sends article titles and snippets to configured AI provider
2. **Scoring**: AI assigns importance score (1-10) to each article
3. **Summarization**: AI generates brief summary for each article
4. **Sorting**: Articles sorted by importance score (descending)
5. **Fallback**: If AI fails, uses publication date as ranking

### Layout Strategy
```
┌─────────────────────────────┐
│    SimonDailyNews           │ ← Masthead
│  All the News...            │ ← Tagline
├─────────────────────────────┤
│  Friday, November 21, 2025  │ ← Date
├─────────────────────────────┤
│                             │
│  TOP STORY (Full Width)     │ ← Highest ranked
│  [Image if available]       │
│  Extended summary...        │
│                             │
├──────────────┬──────────────┤
│ Article 2    │ Article 3    │ ← 2-column
│ Summary...   │ Summary...   │   layout
├──────────────┼──────────────┤
│ Article 4    │ Article 5    │
│ Summary...   │ Summary...   │
└──────────────┴──────────────┘
```

### Image Extraction
- Attempts to extract first image from article HTML content
- Uses `<img>` tag src attribute
- Falls back to placeholder if no image found
- Currently shows placeholder box (future: actual image rendering)

## Dependencies
- **jsPDF**: PDF generation library
- **html2canvas**: (installed but not yet used for image rendering)

## Future Enhancements
- Actual image rendering from URLs
- Custom color schemes
- Multiple layout templates
- Category-based sections
- Weather/stocks widgets
- QR codes for articles
- Print optimization

## File Structure
```
src/
├── newspaperPdfService.ts    # PDF generation logic
├── components/
│   └── Newsreel.tsx          # Export button integration
└── types.ts                  # Type definitions
```

## Error Handling
- Graceful fallback if AI ranking fails (uses date-based ranking)
- Alert notification if PDF export fails
- Loading state during export process
- Prevents multiple simultaneous exports

## Performance Notes
- AI ranking adds ~2-5 seconds to export time
- PDF generation is fast (~1 second)
- Total export time: ~3-6 seconds for typical newsreel
- Runs entirely client-side (no server needed)
