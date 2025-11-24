# Newspaper PDF Export - NYT-Style Update

## Overview
Updated the newspaper PDF export to follow New York Times styling with enhanced content and actual image embedding.

## Major Changes

### 1. Removed "Today's Headlines" Section ❌
- **Previous**: PDF started with AI-generated newsreel summary
- **Now**: PDF goes directly to articles in newspaper layout
- **Rationale**: More focused, article-centric approach like NYT

### 2. Expanded Article Summaries (3 Paragraphs) 📝
- **Previous**: 1-2 sentence summaries
- **Now**: 3-paragraph summaries covering:
  - **Paragraph 1**: Main story details and key facts
  - **Paragraph 2**: Background and context
  - **Paragraph 3**: Implications and significance
- **AI Prompt**: Specifically instructs AI to generate structured 3-paragraph summaries

### 3. Actual Image Embedding 🖼️
- **Previous**: Gray placeholder boxes with "[Image]" text
- **Now**: Real images fetched from article web pages and embedded in PDF

#### Image Extraction Strategy:
1. **RSS Content**: Check for images in RSS feed content first
2. **Open Graph**: Look for `og:image` meta tag
3. **Twitter Card**: Look for `twitter:image` meta tag
4. **Article Content**: Find first large image in HTML (filters out icons/logos)
5. **Base64 Conversion**: Images converted to base64 for PDF embedding

#### Image Display:
- **Top Story**: Full-width image (70mm height) with source caption
- **Regular Articles**: Column-width image (40mm height)
- **Captions**: Shows source hostname in italic gray text

### 4. NYT-Inspired Formatting 📰

#### Typography:
- **Top Story Title**: 20pt bold (increased from 18pt)
- **Regular Title**: 13pt bold (increased from 12pt)
- **Body Text**: 10pt for top story, 9pt for columns
- **Line Height**: 1.4 for top story, 1.3 for columns

#### Layout:
- **Thin Separators**: Light gray lines (220, 220, 220) instead of dark
- **Better Spacing**: Increased spacing between paragraphs
- **Professional Look**: Clean, readable, newspaper-quality

#### Color Scheme:
- **Titles**: Pure black (0, 0, 0)
- **Body**: Dark gray (30, 30, 30) for better readability
- **Captions**: Medium gray (120, 120, 120)
- **Separators**: Light gray (220, 220, 220)

## Technical Implementation

### Updated Functions

1. **`generateNewspaperPDF()`**
   - Removed newsreel summary section
   - Goes directly to article layout
   - Simplified parameter list

2. **`rankArticlesByImportance()`**
   - Updated AI prompt for 3-paragraph summaries
   - Specific instructions for paragraph structure
   - Example format in JSON response

3. **`extractArticleImages()`** (MAJOR REWRITE)
   - Fetches actual article HTML from web
   - Multiple image extraction strategies
   - Converts images to base64 for embedding
   - Error handling for failed fetches

4. **`extractMainImageFromHTML()`** (NEW)
   - Prioritizes Open Graph images
   - Falls back to Twitter cards
   - Filters out small images (icons, logos)
   - Returns best quality image URL

5. **`resolveImageUrl()`** (NEW)
   - Handles absolute URLs
   - Handles protocol-relative URLs (`//example.com/image.jpg`)
   - Handles absolute paths (`/images/photo.jpg`)
   - Handles relative paths

6. **`fetchImageAsBase64()`** (NEW)
   - Fetches image as blob
   - Converts to base64 using FileReader
   - Returns data URL for PDF embedding
   - Error handling for network failures

7. **`addTopStory()`**
   - Embeds actual images using `pdf.addImage()`
   - Adds image captions
   - Renders 3 paragraphs with proper spacing
   - NYT-style thin separators

8. **`addRegularArticle()`**
   - Embeds smaller images for column layout
   - Limits paragraph display to prevent overflow
   - Condensed formatting for columns
   - Maintains readability

## PDF Structure (NYT-Style)

```
┌─────────────────────────────────┐
│     SimonDailyNews              │ ← Masthead (36pt)
│  All the News That's Fit...     │ ← Tagline
├─────────────────────────────────┤
│  Friday, November 21, 2025      │ ← Date
├─────────────────────────────────┤
│                                 │
│  TOP STORY TITLE (20pt bold)    │ ← Largest article
│  (original article in Italian)  │ ← Language indicator
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │ ← Actual image
│  │      [Article Image]      │  │   (70mm height)
│  │                           │  │
│  └───────────────────────────┘  │
│  Source: nytimes.com            │ ← Caption
│                                 │
│  Paragraph 1: Main story with   │ ← 3 paragraphs
│  key details and facts...       │   (10pt text)
│                                 │
│  Paragraph 2: Background and    │
│  context explaining...          │
│                                 │
│  Paragraph 3: Implications and  │
│  what this means...             │
│                                 │
├─────────────────────────────────┤ ← Thin separator
│                                 │
├──────────────┬──────────────────┤
│ Article 2    │ Article 3        │ ← Two columns
│ (13pt bold)  │ (13pt bold)      │
│              │                  │
│ ┌──────────┐ │ ┌──────────┐    │ ← Column images
│ │  Image   │ │ │  Image   │    │   (40mm height)
│ └──────────┘ │ └──────────┘    │
│              │                  │
│ Paragraph 1  │ Paragraph 1      │ ← 3 paragraphs
│ details...   │ details...       │   (9pt text)
│              │                  │
│ Paragraph 2  │ Paragraph 2      │
│ context...   │ context...       │
│              │                  │
│ Paragraph 3  │ Paragraph 3      │
│ impact...    │ impact...        │
└──────────────┴──────────────────┘
```

## Image Fetching Process

```
For each article:
  ├─ Try RSS content image
  │  └─ If found → Fetch & convert to base64
  │
  ├─ Fetch article HTML
  │  ├─ Look for og:image meta tag
  │  ├─ Look for twitter:image meta tag
  │  └─ Look for first large <img> tag
  │
  ├─ Resolve relative URLs
  │  ├─ Protocol-relative: //cdn.com/img.jpg
  │  ├─ Absolute path: /images/photo.jpg
  │  └─ Relative path: ../img/photo.jpg
  │
  └─ Fetch image & convert to base64
     └─ Embed in PDF using pdf.addImage()
```

## Benefits

1. **Professional Appearance**: Looks like a real newspaper
2. **Rich Content**: Actual images make articles more engaging
3. **Better Readability**: 3-paragraph summaries provide depth
4. **NYT Quality**: Clean, sophisticated design
5. **Smart Image Selection**: Prioritizes high-quality images
6. **Robust Fallbacks**: Continues without images if fetch fails

## Performance Considerations

- **Image Fetching**: Adds ~2-5 seconds per article
- **Total Export Time**: ~10-30 seconds for typical newsreel
- **Network Dependent**: Requires internet for image fetching
- **Async Processing**: All images fetched in parallel
- **Error Handling**: Failed images don't break PDF generation

## Future Enhancements

- Image caching to speed up repeated exports
- Image optimization (resize, compress)
- Support for more image formats (PNG, WebP)
- Video thumbnails for video articles
- Infographics and charts
- Multi-page articles with page breaks
- Table of contents
- Article categories/sections
