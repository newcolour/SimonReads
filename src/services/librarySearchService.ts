import { Article, Feed, AppSettings } from '../types';
import { safeFetch } from '../utils/fetchUtils';

export interface LibraryQueryOptions {
    timeRange?: 'all' | 'last24h' | 'last7d' | 'last30d';
    scope?: 'all' | 'saved' | 'unread';
    category?: string;
    feedId?: string;
    maxArticles?: number;
    feeds?: Feed[];
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
    isFollowUp?: boolean;
    targetArticleTitle?: string;
}

export interface DeepDiveOptions {
    followUpQuery: string;
    targetArticles: Article[];
    previousAnswer?: string;
    conversationHistory?: { role: 'user' | 'assistant'; text: string }[];
    specificArticleId?: string;
}

const STOP_WORDS = new Set([
    // English
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'it', 'its', 'they', 'them', 'their', 'what', 'who',
    'when', 'where', 'why', 'how', 'which', 'all', 'any', 'about', 'tell',
    'me', 'summarize', 'find', 'show', 'give', 'latest', 'news', 'recent',
    'article', 'articles', 'feed', 'feeds', 'my', 'your',
    // Italian
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', "un'",
    'del', 'dello', 'della', 'dei', 'degli', 'delle',
    'al', 'allo', 'alla', 'ai', 'agli', 'alle',
    'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
    'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
    'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
    'con', 'per', 'tra', 'fra', 'su', 'in', 'di', 'a', 'da',
    'e', 'ed', 'o', 'od', 'ma', 'se', 'perché', 'perche',
    'come', 'chi', 'che', 'cosa', 'cos', 'quale', 'quali',
    'quando', 'dove', 'quanto', 'quanti', 'quanta', 'quante',
    'mi', 'ti', 'ci', 'vi', 'si', 'lui', 'lei', 'loro',
    'mio', 'mia', 'miei', 'mie', 'tuo', 'tua', 'tuoi', 'tue',
    'suo', 'sua', 'suoi', 'sue', 'nostro', 'nostra', 'nostri', 'nostre',
    'questo', 'questa', 'questi', 'queste', 'quello', 'quella', 'quelli', 'quelle',
    'ho', 'hai', 'ha', 'abbiamo', 'avete', 'hanno',
    'sono', 'sei', 'siamo', 'siete',
    'fanno', 'fare', 'fatto', 'dire', 'detto', 'dicono',
    'notizie', 'notizia', 'novità', 'novita', 'ultime', 'ultimi',
    'parla', 'parlami', 'dimmi', 'spiegami', 'cerca', 'trova', 'riassumi',
    'mostra', 'fammi', 'sapere', 'sapresti', 'approfondisci', 'libreria'
]);

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract meaningful search tokens from query (supports English and Italian)
 */
function extractQueryTokens(query: string): string[] {
    return query
        .toLowerCase()
        .replace(/[^\w\s\u00C0-\u017F]/g, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 1 && !STOP_WORDS.has(t));
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
        maxArticles = 8,
        feeds = []
    } = options;

    // Map feeds to categories for accurate category filtering
    const feedCategoryMap = new Map<string, string>();
    if (feeds && feeds.length > 0) {
        feeds.forEach(f => {
            if (f.category) {
                feedCategoryMap.set(f.id, f.category);
            }
        });
    }

    const tokens = extractQueryTokens(query);
    const queryLower = query.toLowerCase().trim();
    const now = Date.now();

    const runFilterAndScore = (currentTimeRange: 'all' | 'last24h' | 'last7d' | 'last30d'): RetrievedArticle[] => {
        // 1. Filter articles
        const filtered = articles.filter(a => {
            // Scope filter
            if (scope === 'saved' && !a.isSaved) return false;
            if (scope === 'unread' && a.isRead) return false;

            // Feed filter
            if (feedId && a.feedId !== feedId) return false;

            // Category filter using feed map
            if (category && category !== 'all') {
                const feedCat = feedCategoryMap.get(a.feedId);
                const articleCat = (a as any).category;
                const articleCats = (a as any).categories || [];
                const matches = feedCat === category || articleCat === category || articleCats.includes(category);
                if (!matches) return false;
            }

            // Time range filter
            if (currentTimeRange !== 'all' && a.pubDate) {
                const ageHours = (now - new Date(a.pubDate).getTime()) / (1000 * 60 * 60);
                if (currentTimeRange === 'last24h' && ageHours > 24) return false;
                if (currentTimeRange === 'last7d' && ageHours > 7 * 24) return false;
                if (currentTimeRange === 'last30d' && ageHours > 30 * 24) return false;
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
                score += 35;
                matched.push(query);
            } else if (queryLower.length > 3 && snippetLower.includes(queryLower)) {
                score += 15;
                matched.push(query);
            }

            // Word token matches with word-boundary awareness
            for (const token of tokens) {
                let tokenMatched = false;
                const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(token)}`, 'i');

                if (wordBoundaryRegex.test(titleLower)) {
                    score += 12;
                    tokenMatched = true;
                }
                if (wordBoundaryRegex.test(feedLower)) {
                    score += 5;
                    tokenMatched = true;
                }
                if (wordBoundaryRegex.test(snippetLower)) {
                    score += 4;
                    tokenMatched = true;
                } else if (wordBoundaryRegex.test(contentLower)) {
                    score += 2;
                    tokenMatched = true;
                }

                // Stem match for words > 4 chars (handles plurals / Italian verb endings)
                if (!tokenMatched && token.length > 4) {
                    const stem = token.slice(0, -1);
                    const stemRegex = new RegExp(`\\b${escapeRegex(stem)}`, 'i');
                    if (stemRegex.test(titleLower)) {
                        score += 7;
                        tokenMatched = true;
                    } else if (stemRegex.test(snippetLower)) {
                        score += 3;
                        tokenMatched = true;
                    }
                }

                if (tokenMatched && !matched.includes(token)) {
                    matched.push(token);
                }
            }

            // Only consider articles with relevant matches (minimum score threshold)
            if (score >= 4 || (tokens.length === 0 && queryLower.length > 0 && titleLower.includes(queryLower))) {
                // Recency boost (within 48 hours = 1.3x, within 7 days = 1.15x)
                if (article.pubDate) {
                    const ageHours = (now - new Date(article.pubDate).getTime()) / (1000 * 60 * 60);
                    if (ageHours <= 48) score *= 1.3;
                    else if (ageHours <= 168) score *= 1.15;
                }

                // Starred / saved boost
                if (article.isSaved) score *= 1.25;

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
        return scored;
    };

    let scoredArticles = runFilterAndScore(timeRange);

    // Fallback: If timeRange was restricted and yielded 0 articles, broaden to 'all' automatically
    if (scoredArticles.length === 0 && timeRange !== 'all') {
        scoredArticles = runFilterAndScore('all');
    }

    // Limit and assign 1-based indices for citations
    const topArticles = scoredArticles.slice(0, maxArticles);
    topArticles.forEach((item, idx) => {
        item.index = idx + 1;
    });

    return topArticles;
}

/**
 * Helper to fetch full web content for rich deep dive analysis
 */
async function getRichArticleContent(article: Article): Promise<string> {
    const rawContent = (article.content || article.contentSnippet || article.title || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (rawContent.length >= 1000) {
        return rawContent.slice(0, 4500);
    }

    try {
        const ipcRenderer = (window as any).ipcRenderer;
        if (ipcRenderer && article.link) {
            const result = await ipcRenderer.invoke('fetch-url', article.link);
            if (result && result.success && result.content) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(result.content, 'text/html');
                doc.querySelectorAll('script, style, nav, header, footer, aside, .ad, .advertisement').forEach(el => el.remove());
                const bodyText = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
                if (bodyText.length > rawContent.length) {
                    return bodyText.slice(0, 5000);
                }
            }
        }
    } catch {
        // Fallback to raw content if web fetch fails
    }

    return rawContent.slice(0, 4500);
}

/**
 * Unified AI call supporting Gemini, OpenAI, Claude, and Ollama
 */
async function callAI(
    prompt: string,
    settings: AppSettings,
    systemInstruction: string = 'You are SimonReads Library AI, an expert cross-source research analyst.'
): Promise<string> {
    const provider = settings.aiProvider || 'gemini';

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
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    temperature: 0.35,
                    maxOutputTokens: 2500
                }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Gemini AI synthesis request failed');
        }
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
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
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.35,
                max_tokens: 2500
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'OpenAI synthesis request failed');
        }
        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'No response generated.';
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
                max_tokens: 2500,
                temperature: 0.35,
                system: systemInstruction,
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Claude synthesis request failed');
        }
        const data = await response.json();
        return data.content?.[0]?.text || 'No response generated.';
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
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.message?.content || 'No response generated.';
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
}

/**
 * Synthesize cross-source answer using user's configured AI provider (Global Library Search)
 */
export async function askLibraryAI(
    query: string,
    articles: Article[],
    settings: AppSettings,
    options: LibraryQueryOptions = {}
): Promise<LibraryAnswer> {
    const provider = settings.aiProvider || 'gemini';
    const targetLanguage = settings.summaryLanguage || 'Italian';

    // Retrieve most relevant articles
    const retrieved = searchLibraryArticles(articles, query, options);

    if (retrieved.length === 0) {
        return {
            answer: `Nessun articolo corrispondente trovato nella tua libreria per "${query}". Prova a formulare la domanda in modo più ampio o controlla i filtri selezionati.`,
            retrievedArticles: [],
            query,
            generatedAt: new Date().toISOString(),
            provider,
            isFollowUp: false
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
1. Synthesize a comprehensive, authoritative, and well-structured answer in ${targetLanguage} (or match the language of the user question).
2. Use citation markers [1], [2], [3] whenever referencing information from a specific source (matching [Source 1], [Source 2], etc.).
3. Format with clean Markdown (bold headings, bullet points, executive takeaway).
4. Highlight agreements or differing perspectives between different sources when applicable.
5. If the articles do not contain complete information, state what is known from the library and note the gaps.
6. Do NOT invent citations or references not provided in the articles above.`;

    const answerText = await callAI(prompt, settings, 'You are SimonReads Library AI, an expert cross-source research analyst synthesising news and RSS content.');

    return {
        answer: answerText,
        retrievedArticles: retrieved,
        query,
        generatedAt: new Date().toISOString(),
        provider,
        isFollowUp: false
    };
}

/**
 * Conducts an in-depth follow-up investigation / Deep Dive on specific articles or sources
 */
export async function deepDiveLibraryAI(
    options: DeepDiveOptions,
    settings: AppSettings
): Promise<LibraryAnswer> {
    const provider = settings.aiProvider || 'gemini';
    const targetLanguage = settings.summaryLanguage || 'Italian';
    const { followUpQuery, targetArticles, previousAnswer, conversationHistory, specificArticleId } = options;

    let articlesToUse = targetArticles;
    let targetArticleTitle: string | undefined;

    if (specificArticleId) {
        const found = targetArticles.find(a => a.id === specificArticleId);
        if (found) {
            articlesToUse = [found];
            targetArticleTitle = found.title;
        }
    }

    if (articlesToUse.length === 0) {
        throw new Error('Nessun articolo selezionato per il Deep Dive.');
    }

    // Fetch rich web content in parallel to provide deep context
    const richContents = await Promise.all(
        articlesToUse.map(async (article, idx) => {
            const rich = await getRichArticleContent(article);
            const pubDateStr = article.pubDate ? new Date(article.pubDate).toLocaleDateString() : 'Unknown date';
            const sourceStr = article.feedTitle || article.creator || 'RSS Feed';
            return `[Source ${idx + 1}]
Title: ${article.title}
Source: ${sourceStr}
Published: ${pubDateStr}
URL: ${article.link}
Full Article Text:
${rich}`;
        })
    );

    const articlesBlock = richContents.join('\n\n---\n\n');

    let historyBlock = '';
    if (conversationHistory && conversationHistory.length > 0) {
        historyBlock = 'PREVIOUS CONVERSATION CONTEXT:\n' +
            conversationHistory.slice(-4).map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n\n') + '\n\n';
    } else if (previousAnswer) {
        historyBlock = `PREVIOUS SYNTHESIS OVERVIEW:\n${previousAnswer.slice(0, 1500)}\n\n`;
    }

    const prompt = `You are SimonReads Library AI Assistant conducting an investigative DEEP DIVE follow-up.
The user is asking an in-depth question specifically about the news articles retrieved below.

${historyBlock}FOCUSED ARTICLES FOR THIS DEEP DIVE:
${articlesBlock}

USER'S DEEP DIVE QUESTION:
"${followUpQuery}"

INVESTIGATIVE DEEP DIVE INSTRUCTIONS:
1. Provide an exhaustive, detailed, and penetrating analysis specifically addressing the user's follow-up request.
2. Unpack key details: specific figures, data points, quotes, chronological sequence, causes, context, and implications described in the articles.
3. Reference the sources clearly using citation markers [1], [2], etc.
4. Structure your response with clean Markdown headings, bullet points, and actionable insights.
5. If the user asks about an angle not covered in the text, clearly distinguish between what the articles verify and what remains unmentioned.
6. Respond in ${targetLanguage} (or in the language of the user's inquiry if Italian/English).`;

    const answerText = await callAI(prompt, settings, 'You are SimonReads Library AI, an investigative journalist conducting deep dives on news stories.');

    const retrievedItems: RetrievedArticle[] = articlesToUse.map((article, idx) => ({
        article,
        score: 100,
        matchedKeywords: [],
        index: idx + 1
    }));

    return {
        answer: answerText,
        retrievedArticles: retrievedItems,
        query: followUpQuery,
        generatedAt: new Date().toISOString(),
        provider,
        isFollowUp: true,
        targetArticleTitle
    };
}
