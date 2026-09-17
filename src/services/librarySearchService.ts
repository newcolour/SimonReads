import { Article, AppSettings } from '../types';
import { safeFetch } from '../utils/fetchUtils';

export interface LibraryQueryOptions {
    timeRange?: 'all' | 'last24h' | 'last7d' | 'last30d';
    scope?: 'all' | 'saved' | 'unread';
    category?: string;
    feedId?: string;
    maxArticles?: number;
}

export interface RetrievedArticle {
    article: Article;
    score: number;
    matchedKeywords: string[];
    index: number;
}

export interface LibraryAnswer {
    answer: string;
    retrievedArticles: RetrievedArticle[];
    query: string;
    generatedAt: string;
    provider: string;
}

/**
 * Extract meaningful search tokens from query
 */
function extractQueryTokens(query: string): string[] {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
        'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
        'these', 'those', 'it', 'its', 'they', 'them', 'their', 'what', 'who',
        'when', 'where', 'why', 'how', 'which', 'all', 'any', 'about', 'tell',
        'me', 'summarize', 'find', 'show', 'give'
    ]);

    return query
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 1 && !stopWords.has(t));
}

/**
 * Score and retrieve the most relevant articles from the local library
 */
export function searchLibraryArticles(
    articles: Article[],
    query: string,
    options: LibraryQueryOptions = {}
): RetrievedArticle[] {
    if (!articles || articles.length === 0 || !query.trim()) {
        return [];
    }

    const {
        timeRange = 'all',
        scope = 'all',
        category,
        feedId,
        maxArticles = 8
    } = options;

    const tokens = extractQueryTokens(query);
    const queryLower = query.toLowerCase().trim();
    const now = Date.now();

    // 1. Filter by timeRange and scope
    const filtered = articles.filter(a => {
        // Scope filter
        if (scope === 'saved' && !a.isSaved) return false;
        if (scope === 'unread' && a.isRead) return false;

        // Feed filter
        if (feedId && a.feedId !== feedId) return false;
        if (category && (a as any).category !== category && !((a as any).categories || []).includes(category)) return false;

        // Time range filter
        if (timeRange !== 'all' && a.pubDate) {
            const ageHours = (now - new Date(a.pubDate).getTime()) / (1000 * 60 * 60);
            if (timeRange === 'last24h' && ageHours > 24) return false;
            if (timeRange === 'last7d' && ageHours > 7 * 24) return false;
            if (timeRange === 'last30d' && ageHours > 30 * 24) return false;
        }

        return true;
    });

    // 2. Score articles
    const scored: RetrievedArticle[] = [];

    for (const article of filtered) {
        let score = 0;
        const matched: string[] = [];

        const titleLower = (article.title || '').toLowerCase();
        const snippetLower = (article.contentSnippet || '').toLowerCase();
        const contentLower = (article.content || '').toLowerCase();
        const feedLower = (article.feedTitle || article.creator || '').toLowerCase();

        // Exact phrase match in title
        if (queryLower.length > 3 && titleLower.includes(queryLower)) {
            score += 25;
            matched.push(query);
        }

        // Token matches
        for (const token of tokens) {
            let tokenMatched = false;

            if (titleLower.includes(token)) {
                score += 8;
                tokenMatched = true;
            }
            if (feedLower.includes(token)) {
                score += 4;
                tokenMatched = true;
            }
            if (snippetLower.includes(token)) {
                score += 3;
                tokenMatched = true;
            } else if (contentLower.includes(token)) {
                score += 1.5;
                tokenMatched = true;
            }

            if (tokenMatched && !matched.includes(token)) {
                matched.push(token);
            }
        }

        if (score > 0) {
            // Recency boost (within 48 hours = 1.3x)
            if (article.pubDate) {
                const ageHours = (now - new Date(article.pubDate).getTime()) / (1000 * 60 * 60);
                if (ageHours <= 48) score *= 1.3;
                else if (ageHours <= 168) score *= 1.1; // 7 days
            }

            // Starred / saved boost
            if (article.isSaved) score *= 1.2;

            scored.push({
                article,
                score,
                matchedKeywords: matched,
                index: 0
            });
        }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Limit and assign 1-based indices for citations
    const topArticles = scored.slice(0, maxArticles);
    topArticles.forEach((item, idx) => {
        item.index = idx + 1;
    });

    return topArticles;
}

/**
 * Synthesize cross-source answer using user's configured AI provider
 */
export async function askLibraryAI(
    query: string,
    articles: Article[],
    settings: AppSettings,
    options: LibraryQueryOptions = {}
): Promise<LibraryAnswer> {
    const provider = settings.aiProvider || 'gemini';
    const targetLanguage = settings.summaryLanguage || 'English';

    // Retrieve most relevant articles
    const retrieved = searchLibraryArticles(articles, query, options);

    if (retrieved.length === 0) {
        return {
            answer: `No matching articles found in your library for "${query}". Try broadening your search or adjusting the time range filter.`,
            retrievedArticles: [],
            query,
            generatedAt: new Date().toISOString(),
            provider
        };
    }

    // Build context document with citation markers [1], [2], etc.
    const contextEntries = retrieved.map(({ article, index }) => {
        const pubDateStr = article.pubDate ? new Date(article.pubDate).toLocaleDateString() : 'Unknown date';
        const sourceStr = article.feedTitle || article.creator || 'RSS Feed';
        const cleanContent = (article.content || article.contentSnippet || article.title || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 3000);

        return `[Source ${index}]
Title: ${article.title}
Source: ${sourceStr}
Published: ${pubDateStr}
URL: ${article.link}
Content: ${cleanContent}`;
    }).join('\n\n---\n\n');

    const prompt = `You are SimonReads Library AI Assistant. You are analyzing articles from the user's personal RSS library to answer their question.

USER QUESTION: "${query}"

AVAILABLE ARTICLES FROM LIBRARY:
${contextEntries}

INSTRUCTIONS:
1. Synthesize a comprehensive, well-structured answer in ${targetLanguage}.
2. Use citation markers [1], [2], [3] whenever referencing information from a specific source (matching [Source 1], [Source 2], etc.).
3. Format with clean Markdown (bold headings, concise bullet points, executive takeaway).
4. Highlight agreements or differing perspectives between different sources when applicable.
5. If the articles do not contain complete information to fully answer the question, state what is known from the library and note the gaps.
6. Do NOT invent citations or references not provided in the articles above.`;

    let answerText = '';

    if (provider === 'gemini') {
        const apiKey = settings.geminiApiKey;
        if (!apiKey) throw new Error('Gemini API key is not configured in Settings → AI');
        const model = settings.geminiModel || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await safeFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2048
                }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Gemini library synthesis failed');
        }
        const data = await response.json();
        answerText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No answer could be generated.';
    } else if (provider === 'openai') {
        const apiKey = settings.openaiApiKey;
        if (!apiKey) throw new Error('OpenAI API key is not configured in Settings → AI');
        const model = settings.openaiModel || 'gpt-4o-mini';

        const response = await safeFetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: 'You are SimonReads Library AI, an expert research assistant synthesising news and RSS content.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.4,
                max_tokens: 2048
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'OpenAI library synthesis failed');
        }
        const data = await response.json();
        answerText = data.choices?.[0]?.message?.content || 'No answer could be generated.';
    } else if (provider === 'claude') {
        const apiKey = settings.claudeApiKey;
        if (!apiKey) throw new Error('Claude API key is not configured in Settings → AI');
        const model = settings.claudeModel || 'claude-3-haiku-20240307';

        const response = await safeFetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model,
                max_tokens: 2048,
                temperature: 0.4,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Claude library synthesis failed');
        }
        const data = await response.json();
        answerText = data.content?.[0]?.text || 'No answer could be generated.';
    } else if (provider === 'ollama') {
        const baseUrl = (settings.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
        const model = settings.ollamaModel || 'llama3';

        const response = await safeFetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                stream: false,
                messages: [
                    { role: 'system', content: 'You are SimonReads Library AI, an expert research assistant synthesising news and RSS content.' },
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        answerText = data.message?.content || 'No answer could be generated.';
    }

    return {
        answer: answerText,
        retrievedArticles: retrieved,
        query,
        generatedAt: new Date().toISOString(),
        provider
    };
}
