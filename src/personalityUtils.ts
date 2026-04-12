import { AppSettings, Article } from './types';
import { summarizeArticle } from './summaryService';

/**
 * Generate a concise inline summary for an article
 * Used by Conversational Curator and Daily Brief personalities
 */
export async function generateInlineSummary(
    article: Article,
    settings: AppSettings,
    maxLines: number = 3
): Promise<string> {
    console.log('🤖 [InlineSummary] Starting generation for article:', article.id);
    try {
        const content = article.contentSnippet || article.content || article.title;
        const apiKey = settings.geminiApiKey || settings.openaiApiKey || settings.claudeApiKey || '';

        console.log('🤖 [InlineSummary] Content length:', content.length);
        console.log('🤖 [InlineSummary] API Provider:', settings.aiProvider || 'gemini');
        console.log('🤖 [InlineSummary] Has API Key:', !!apiKey);

        // Use the summary service with personality-specific settings
        console.log('🤖 [InlineSummary] Calling summarizeArticle...');
        const summary = await summarizeArticle(content, apiKey, {
            ...settings,
            summaryLength: 'short',
            summaryDepth: 'brief'
        }, "Write a VERY concise 1 to 2 sentence summary of this article. Do NOT include formatting, headings, bullet points, or introductory text like 'Here is a summary'. Just output the summary text directly.", true);

        console.log('🤖 [InlineSummary] Summary generated, length:', summary.length);

        // Avoid aggressive truncation. Only clean up if it's way too long.
        const maxChars = maxLines * 120; // Allow more characters so it doesn't cut off awkwardly
        if (summary.length > maxChars) {
            let truncated = summary.substring(0, maxChars);
            // find last space to avoid cutting mid-word
            const lastSpace = truncated.lastIndexOf(' ');
            if (lastSpace > 0) {
                truncated = truncated.substring(0, lastSpace);
            }
            truncated += '...';
            console.log('🤖 [InlineSummary] Summary truncated to', truncated.length, 'chars');
            return truncated;
        }

        console.log('🤖 [InlineSummary] ✅ Summary complete');
        return summary;
    } catch (error) {
        console.error('❌ [InlineSummary] Failed to generate inline summary:', error);
        console.error('❌ [InlineSummary] Error details:', JSON.stringify(error, null, 2));
        // Fallback to snippet
        const snippet = article.contentSnippet || '';
        const maxChars = maxLines * 80;
        const fallback = snippet.length > maxChars
            ? snippet.substring(0, maxChars) + '...'
            : snippet;
        console.log('🤖 [InlineSummary] Using fallback snippet, length:', fallback.length);
        return fallback;
    }
}

/**
 * Calculate AI-driven importance score for an article
 * Used by Daily Brief personality
 */
export async function calculateImportanceScore(
    article: Article
): Promise<number> {
    try {
        // Simple heuristic-based scoring for now
        // In the future, this could use AI to analyze content relevance
        let score = 50; // Base score

        // Boost score for unread articles
        if (!article.isRead) score += 20;

        // Boost score for saved articles
        if (article.isSaved) score += 30;

        // Boost score for recent articles (within last 24 hours)
        if (article.pubDate) {
            const hoursSincePublished = (Date.now() - article.pubDate.getTime()) / (1000 * 60 * 60);
            if (hoursSincePublished < 24) {
                score += 15;
            } else if (hoursSincePublished < 48) {
                score += 5;
            }
        }

        // Boost score for articles with media
        if (article.mediaType === 'audio' || article.mediaType === 'video') {
            score += 10;
        }

        // Cap at 100
        return Math.min(100, score);
    } catch (error) {
        console.error('Failed to calculate importance score:', error);
        return 50; // Default mid-range score
    }
}

/**
 * Find related articles using simple content similarity
 * Used by Deep Diver personality
 */
export async function findRelatedArticles(
    article: Article,
    allArticles: Article[],
    limit: number = 3
): Promise<Article[]> {
    try {
        // Simple keyword-based similarity for now
        // In the future, this could use AI embeddings

        const keywords = extractKeywords(article.title + ' ' + (article.contentSnippet || ''));

        const scored = allArticles
            .filter(a => a.id !== article.id) // Exclude the current article
            .map(a => {
                const aKeywords = extractKeywords(a.title + ' ' + (a.contentSnippet || ''));
                const similarity = calculateSimilarity(keywords, aKeywords);
                return { article: a, score: similarity };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return scored.map(item => item.article);
    } catch (error) {
        console.error('Failed to find related articles:', error);
        return [];
    }
}

/**
 * Extract keywords from text (simple implementation)
 */
function extractKeywords(text: string): Set<string> {
    // Remove common words and extract meaningful terms
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can']);

    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !commonWords.has(word));

    return new Set(words);
}

/**
 * Calculate similarity between two keyword sets
 */
function calculateSimilarity(keywords1: Set<string>, keywords2: Set<string>): number {
    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    const union = new Set([...keywords1, ...keywords2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Get playful microcopy for Serendipity Explorer
 */
export function getPlayfulMicrocopy(): string[] {
    const messages = [
        "✨ What treasures will you discover today?",
        "🎲 Roll the dice of discovery!",
        "🌟 Your serendipitous journey begins...",
        "🎪 Step right up to the content carnival!",
        "🔮 Let the algorithm surprise you!",
        "🎨 Paint your day with unexpected colors",
        "🌈 Follow the rainbow to random knowledge",
        "🎭 Every article is a new adventure"
    ];

    return messages;
}

/**
 * Shuffle array (Fisher-Yates algorithm)
 */
export function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
