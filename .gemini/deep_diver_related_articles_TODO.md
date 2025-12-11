# Deep Diver - Related Articles Integration (In Progress)

**Status:** Infrastructure complete, UI integration pending  
**Date:** 2025-12-11

## What's Missing

The Deep Diver personality is configured to show related articles, but they don't appear yet because the UI integration in `ArticleView.tsx` needs to be completed.

## What Needs To Be Done

### 1. Update App.tsx to pass allArticles

In `/Users/simone/Antigravity/RSSReader/src/App.tsx` around line 1059:

```tsx
<ArticleView
    article={selectedArticle}
    feed={feeds.find(f => f.id === selectedArticle?.feedId)}
    settings={settings}
    allArticles={filteredArticles}  // ADD THIS LINE
    onClose={() => {
        setSelectedArticle(null);
        setMobileView('articles');
    }}
    onDelete={handleDeleteArticle}
    onToggleSaved={handleToggleSaved}
/>
```

### 2. Update ArticleView.tsx

#### A. Add imports (top of file):
```tsx
import { findRelatedArticles } from '../personalityUtils';
import { usePersonalityConfig } from '../hooks/usePersonality';
```

#### B. Update interface (around line 27):
```tsx
interface ArticleViewProps {
    article: Article | null;
    feed?: Feed;
    settings: AppSettings;
    allArticles?: Article[];  // ADD THIS
    onClose: () => void;
    onDelete: (articleId: string) => void;
    onToggleSaved?: (articleId: string) => void;
}
```

#### C. Update function signature (around line 83):
```tsx
export default function ArticleView({ 
    article, 
    feed, 
    settings, 
    allArticles = [],  // ADD THIS
    onClose, 
    onDelete, 
    onToggleSaved 
}: ArticleViewProps) {
    const feedTitle = feed?.title || article?.feedTitle;
    const personalityConfig = usePersonalityConfig(settings.readingPersonality);  // ADD THIS
```

####  D. Add state (around line 108, after isNavigatingFromChat):
```tsx
const isNavigatingFromChat = useRef(false);

// Related articles state (Deep Diver personality)
const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
```

#### E. Add useEffect (around line 219, after the webview useEffect):
```tsx
}, [viewMode, webviewUrl]);

// Find related articles for Deep Diver personality
useEffect(() => {
    if (personalityConfig.showRelatedArticles && article && allArticles.length > 0) {
        findRelatedArticles(article, allArticles, 3).then(related => {
            setRelatedArticles(related);
        });
    } else {
        setRelatedArticles([]);
    }
}, [article?.id, personalityConfig.showRelatedArticles, allArticles.length]);

// Fetch article content if missing or too short
```

#### F. Add UI (around line 1010, BEFORE Reddit Comments):
```tsx
{/* Related Articles Panel (Deep Diver) */}
{personalityConfig.showRelatedArticles && relatedArticles.length > 0 && (
    <div className="related-articles-panel">
        <h4>🔗 Related Articles</h4>
        {relatedArticles.map((related) => (
            <div
                key={related.id}
                className="related-article-item"
                onClick={() => {
                    onClose(); // Close current view
                    // Note: Clicking won't navigate yet - needs parent handler
                }}
            >
                <div className="related-article-title">
                    {cleanTitle(related.title)}
                </div>
                {related.contentSnippet && (
                    <div className="related-article-snippet">
                        {related.contentSnippet.slice(0, 100)}...
                    </div>
                )}
            </div>
        ))}
    </div>
)}

{/* Reddit Comments Integration */}
{viewMode === 'reader' && article && ...
```

## CSS

The CSS is already in `src/components/Personality.css` (lines added in Phase 2):
- `.related-articles-panel`
- `.related-article-item`
- `.related-article-title`
- `.related-article-snippet`

## How It Works

1. When viewing an article in **Deep Diver** mode
2. `findRelatedArticles()` analyzes the current article's title and content
3. Compares keywords with all other articles
4. Returns top 3 most similar articles
5. Displays them in a panel below the article content
6. User can click to navigate (when handler is added)

## Algorithm

Currently uses simple keyword-based similarity:
- Extracts words (>3 chars, excludes common words)
- Calculates Jaccard similarity (intersection/union)
- Ranks by similarity score

**Future enhancement:** Could use AI embeddings for better matching

## Status

✅ Configuration (Deep Diver has `showRelatedArticles: true`)  
✅ Utility function (`findRelatedArticles` in personalityUtils.ts)  
✅ CSS styling (in Personality.css)  
⏳ **UI Integration** - needs to be added to ArticleView.tsx  
⏳ **App.tsx update** - needs to pass allArticles prop

## Quick Test After Implementation

1. Build and run app
2. Select **Deep Diver** personality
3. Open an article
4. Scroll to bottom
5. Should see "🔗 Related Articles" panel with 1-3 similar articles
