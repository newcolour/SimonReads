import { Article, Feed, AppSettings } from '../types';
import { safeFetch } from '../utils/fetchUtils';
import { searchDuckDuckGo } from '../webSearchService';

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

export interface OnlineSource {
    index: number;
    title: string;
    snippet: string;
    url: string;
    domain: string;
}

export interface LibraryAnswer {
    answer: string;
    retrievedArticles: RetrievedArticle[];
    onlineSources?: OnlineSource[];
    query: string;
    generatedAt: string;
    provider: string;
    isFollowUp?: boolean;
    isOnline?: boolean;
    targetArticleTitle?: string;
}

export interface DeepDiveOptions {
    followUpQuery: string;
    targetArticles: Article[];
    previousAnswer?: string;
    conversationHistory?: { role: 'user' | 'assistant'; text: string }[];
    specificArticleId?: string;
}

export interface OnlineDeepDiveOptions {
    followUpQuery: string;
    targetArticles: Article[];
    previousAnswer?: string;
    conversationHistory?: { role: 'user' | 'assistant'; text: string }[];
    specificArticleId?: string;
    initialQuery?: string;
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
 * Detects whether a paragraph is pure conversational fluff, greeting, self-introduction,
 * or meta-lead-in ("Ecco una sintesi...", "Dalle fonti disponibili emerge...")
 */
function isPreambleParagraph(para: string): boolean {
    const trimmed = para.trim();
    if (!trimmed) return true; // empty paragraph

    // Markdown headers, bullet points, numbered lists, blockquotes, code blocks are substantive content
    if (/^(#{1,6}\s|[-*+]\s|\d+\.\s|>|```)/.test(trimmed)) {
        return false;
    }

    // Common greetings at start of paragraph
    const greetingMatch = /^(?:ciao|salve|buongiorno|buonasera|hello|hi|hey)[!,\.\s]/i.test(trimmed);
    const selfIntroMatch = /(?:sono|mi chiamo|i am|as an ai|in qualità di|in qualita di)\s+simonreads/i.test(trimmed);
    const aiAssistantMatch = /simonreads\s+(?:library\s+ai|online\s+intelligence|ai\s+assistant|assistant)/i.test(trimmed);
    const certMatch = /^(?:certamente|sicuramente|eccoci|certo|senza dubbio|sure|certainly|of course)[!,\.:\s]/i.test(trimmed);

    if (greetingMatch || selfIntroMatch || aiAssistantMatch || certMatch) {
        return true;
    }

    // Lead-ins / Meta-announcements like:
    // "Dalle fonti disponibili, emerge un quadro..."
    // "Ecco una sintesi completa e strutturata su..."
    // "In base agli articoli trovati nella tua libreria, ecco l'analisi..."
    // "Ecco cosa emerge dai feed:"
    const leadInPattern = /^(?:dalle fonti(?: disponibili)?|in base a(?:gli|lle|i)?|sulla base d(?:i|elle|ei|agli)|dagli articoli(?: analizzati| disponibili| trovati)?|dall'analisi delle fonti|dall'analisi degli articoli|dai documenti disponibili|based on the (?:available )?sources|according to the (?:retrieved )?articles)[\s\S]*?(?:emerge|si evince|risulta|possiamo notare|mostra|tocca|evidenzia|delinea|ecco|di seguito|presento|riporto|trovi)/i;
    const summaryAnnouncement = /^(?:ecco|di seguito|qui di seguito|ti presento|ti fornisco|ti propongo|here is|here are|below is)\s+(?:(?:un|una|il|la|i|le|l'|alcuni|alcune)?\s*(?:sintesi|riassunto|panoramica|quadro|analisi|approfondimento|resoconto|overview|summary|breakdown|dettagli|risposta)|cosa emerge|quanto emerge)[^:\n]*:?$/i;

    if (leadInPattern.test(trimmed) || summaryAnnouncement.test(trimmed)) {
        return true;
    }

    return false;
}

/**
 * Strips conversational preambles, greetings, self-introductions, and meta-filler
 * so the answer goes directly to the substantive content.
 */
export function stripConversationalPreamble(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let cleaned = text.trim();

    // 1. Process paragraphs to eliminate leading preamble paragraphs
    const paragraphs = cleaned.split(/\n\s*\n/);
    let firstSubstantiveIdx = 0;

    while (firstSubstantiveIdx < paragraphs.length) {
        const para = paragraphs[firstSubstantiveIdx].trim();
        if (isPreambleParagraph(para)) {
            firstSubstantiveIdx++;
        } else {
            break;
        }
    }

    if (firstSubstantiveIdx > 0 && firstSubstantiveIdx < paragraphs.length) {
        cleaned = paragraphs.slice(firstSubstantiveIdx).join('\n\n').trim();
    } else if (firstSubstantiveIdx >= paragraphs.length) {
        // If everything was matched as preamble, fallback to original cleaned
        cleaned = text.trim();
    }

    // 2. Strip any inline greeting / filler remaining at the start of the first paragraph
    cleaned = cleaned
        .replace(/^(?:(?:Ciao|Salve|Buongiorno|Buonasera|Hello|Hi|Hey|Certamente|Certainly|Sure)[!,\.\s]+)+(?:(?:Sono|Mi chiamo|I am)\s+SimonReads[^.!\n]*[.!\n]+)?\s*/i, '')
        .replace(/^(?:(?:Ecco|Di seguito|Qui di seguito|Here is|Below is)\s+(?:un|una|il|la|i|le|l'|alcuni|alcune)?\s*(?:sintesi|riassunto|panoramica|quadro|analisi|approfondimento|overview|summary)[^:\n]*[:\.\n]+\s*)*/i, '')
        .replace(/^---+\s*\n*/, '')
        .trim();

    return cleaned || text.trim();
}

/**
 * Unified AI call supporting Gemini, OpenAI, Claude, and Ollama
 */
async function callAI(
    prompt: string,
    settings: AppSettings,
    systemInstruction: string = 'You are an expert research analyst. Deliver direct, high-density synthesis without conversational preambles, greetings, or self-introductions.'
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
                    maxOutputTokens: 8192
                }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Gemini AI synthesis request failed');
        }
        const data = await response.json();
        const candidate = data.candidates?.[0];

        if (candidate?.finishReason === 'SAFETY') {
            return 'La risposta è stata bloccata dai filtri di sicurezza di Gemini.';
        }

        const parts = candidate?.content?.parts || [];
        // Concatenate all text parts, filtering out thoughts/thinking tokens
        let fullText = parts
            .filter((p: any) => !p.thought && typeof p.text === 'string')
            .map((p: any) => p.text)
            .join('');

        // Fallback: if fullText is empty, take any available text part
        if (!fullText) {
            fullText = parts.map((p: any) => p.text || '').join('');
        }

        return fullText ? stripConversationalPreamble(fullText) : 'Nessuna risposta generata da Gemini.';
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
                max_tokens: 4096
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'OpenAI synthesis request failed');
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return content ? stripConversationalPreamble(content) : 'Nessuna risposta generata da OpenAI.';
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
                max_tokens: 4096,
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
        const textBlocks = (data.content || [])
            .filter((b: any) => b.type === 'text')
            .map((b: any) => b.text)
            .join('');
        return textBlocks ? stripConversationalPreamble(textBlocks) : 'Nessuna risposta generata da Claude.';
    } else if (provider === 'ollama') {
        const baseUrl = (settings.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
        const model = settings.ollamaModel || 'llama3';

        const response = await safeFetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                stream: false,
                options: {
                    num_predict: -1, // Do not truncate output; allow full thinking and response
                    num_ctx: 16384,  // Adequate context window for multi-article synthesis
                    temperature: 0.35
                },
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const err = await response.text().catch(() => '');
            throw new Error(`Richiesta Ollama fallita (${response.status}): ${err || response.statusText}`);
        }
        const data = await response.json();
        const content = data.message?.content?.trim();
        const thinking = data.message?.thinking?.trim();

        if (content) return stripConversationalPreamble(content);
        if (thinking) return stripConversationalPreamble(thinking);

        if (data.done_reason === 'length') {
            return 'Il modello Ollama ha raggiunto il limite massimo di lunghezza prima di completare la risposta.';
        }

        return 'Nessuna risposta generata dal modello Ollama.';
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
            .slice(0, 1800);

        return `[Source ${index}]
Title: ${article.title}
Source: ${sourceStr}
Published: ${pubDateStr}
URL: ${article.link}
Content: ${cleanContent}`;
    }).join('\n\n---\n\n');

    const prompt = `Analyze the following articles from the user's RSS library to answer their question directly.

USER QUESTION: "${query}"

AVAILABLE ARTICLES FROM LIBRARY:
${contextEntries}

CRITICAL RULES:
1. NO GREETINGS OR PREAMBLE: Absolutely DO NOT include any greetings, self-introductions, polite pleasantries, or lead-in statements (e.g. NEVER say "Ciao!", "Sono SimonReads...", "Dalle fonti disponibili emerge...", "Ecco una sintesi...", "Certamente!"). Start DIRECTLY and IMMEDIATELY with the substantive answer or first Markdown section heading.
2. Synthesize a comprehensive, authoritative, and well-structured answer in ${targetLanguage} (or match the language of the user question).
3. Use citation markers [1], [2], [3] whenever referencing information from a specific source (matching [Source 1], [Source 2], etc.).
4. Format with clean Markdown (bold headings, bullet points, executive takeaway).
5. Highlight agreements or differing perspectives between different sources when applicable.
6. If the articles do not contain complete information, state what is known from the library and note the gaps.
7. Do NOT invent citations or references not provided in the articles above.
8. Conclude your entire response completely without ending abruptly or leaving sections half-finished.`;

    const rawAnswer = await callAI(
        prompt,
        settings,
        'You are an expert research analyst. Deliver direct, high-density synthesis without conversational preambles, greetings, or self-introductions.'
    );
    const answerText = stripConversationalPreamble(rawAnswer);

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

    const prompt = `Conduct an investigative DEEP DIVE follow-up answering the user's specific inquiry based on the news articles retrieved below.

${historyBlock}FOCUSED ARTICLES FOR THIS DEEP DIVE:
${articlesBlock}

USER'S DEEP DIVE QUESTION:
"${followUpQuery}"

CRITICAL RULES & INVESTIGATIVE INSTRUCTIONS:
1. NO GREETINGS OR PREAMBLE: Absolutely DO NOT include any greetings, self-introductions, polite pleasantries, or lead-in statements (e.g. NEVER say "Ciao!", "Sono SimonReads...", "Ecco un approfondimento...", "Certamente!"). Start DIRECTLY and IMMEDIATELY with the substantive analysis or first Markdown section heading.
2. Provide an exhaustive, detailed, and penetrating analysis specifically addressing the user's follow-up request.
3. Unpack key details: specific figures, data points, quotes, chronological sequence, causes, context, and implications described in the articles.
4. Reference the sources clearly using citation markers [1], [2], etc.
5. Structure your response with clean Markdown headings, bullet points, and actionable insights.
6. If the user asks about an angle not covered in the text, clearly distinguish between what the articles verify and what remains unmentioned.
7. Conclude your entire deep dive analysis completely without ending abruptly or leaving sections half-finished.
8. Respond in ${targetLanguage} (or in the language of the user's inquiry if Italian/English).`;

    const rawAnswer = await callAI(
        prompt,
        settings,
        'You are an investigative journalist. Deliver direct, high-density deep dives without conversational preambles, greetings, or self-introductions.'
    );
    const answerText = stripConversationalPreamble(rawAnswer);

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

function extractDomain(urlStr: string): string {
    try {
        const u = new URL(urlStr);
        return u.hostname.replace(/^www\./, '');
    } catch {
        return 'web';
    }
}

function cleanNewsTitle(title: string): string {
    return title
        .replace(/\s*[-–—|:]\s*(ANSA|Corriere|Repubblica|BBC|CNN|Reuters|Il Sole 24 Ore|Sky TG24|The Verge|TechCrunch|Wired|Sole 24 Ore|TGCOM24|La Stampa|HuffPost|Il Post|AGI).*$/i, '')
        .replace(/\s*[-–—|]\s*[^–—|-]{2,25}$/, '')
        .trim();
}

/**
 * Conducts an in-depth follow-up investigation / Deep Dive searching online sources on the Web
 */
export async function onlineDeepDiveLibraryAI(
    options: OnlineDeepDiveOptions,
    settings: AppSettings
): Promise<LibraryAnswer> {
    const provider = settings.aiProvider || 'gemini';
    const targetLanguage = settings.summaryLanguage || 'Italian';
    const {
        followUpQuery,
        targetArticles = [],
        previousAnswer,
        conversationHistory,
        specificArticleId,
        initialQuery
    } = options;

    let targetArticle: Article | undefined;
    if (specificArticleId && specificArticleId !== 'all') {
        targetArticle = targetArticles.find(a => a.id === specificArticleId);
    }
    if (!targetArticle && targetArticles.length > 0) {
        targetArticle = targetArticles[0];
    }

    const newsTopic = targetArticle ? cleanNewsTitle(targetArticle.title) : (initialQuery || '');
    
    // Construct focused search queries for web search
    const cleanFollowUp = followUpQuery.replace(/[?!.]/g, '').trim();
    const primarySearchQuery = newsTopic ? `${newsTopic} ${cleanFollowUp}`.slice(0, 160) : cleanFollowUp;

    let webResults = await searchDuckDuckGo(primarySearchQuery, 6);

    // Fallback search strategies if initial web query returns few or no results
    if (webResults.length < 2 && newsTopic) {
        const fallbackResults = await searchDuckDuckGo(newsTopic, 5);
        if (fallbackResults.length > 0) {
            webResults = [...webResults, ...fallbackResults];
        }
    }
    if (webResults.length === 0 && cleanFollowUp) {
        webResults = await searchDuckDuckGo(cleanFollowUp, 5);
    }

    // Deduplicate results by URL
    const seenUrls = new Set<string>();
    const uniqueResults = webResults.filter(r => {
        if (!r.url || seenUrls.has(r.url)) return false;
        seenUrls.add(r.url);
        return true;
    }).slice(0, 6);

    const onlineSources: OnlineSource[] = uniqueResults.map((r, idx) => ({
        index: idx + 1,
        title: r.title,
        snippet: r.snippet,
        url: r.url,
        domain: extractDomain(r.url)
    }));

    if (onlineSources.length === 0) {
        return {
            answer: `Non è stato possibile reperire fonti web pertinenti in questo momento per "${followUpQuery}". Prova a riformulare la richiesta o a verificare la connessione di rete.`,
            retrievedArticles: [],
            onlineSources: [],
            query: followUpQuery,
            generatedAt: new Date().toISOString(),
            provider,
            isFollowUp: true,
            isOnline: true,
            targetArticleTitle: targetArticle?.title
        };
    }

    const webSourcesBlock = onlineSources.map(s => `[Web Source ${s.index}]
Title: ${s.title}
Domain: ${s.domain}
URL: ${s.url}
Snippet: ${s.snippet}`).join('\n\n---\n\n');

    let historyBlock = '';
    if (conversationHistory && conversationHistory.length > 0) {
        historyBlock = 'PREVIOUS CONVERSATION CONTEXT:\n' +
            conversationHistory.slice(-4).map(h => `${h.role.toUpperCase()}: ${h.text}`).join('\n\n') + '\n\n';
    } else if (previousAnswer) {
        historyBlock = `PREVIOUS CONTEXT:\n${previousAnswer.slice(0, 1500)}\n\n`;
    }

    const prompt = `Conduct an in-depth ONLINE DEEP DIVE using real-time web search results to answer the user's specific inquiry.

FOCUS NEWS TOPIC: "${targetArticle?.title || newsTopic}"
${historyBlock}
LIVE WEB SEARCH RESULTS:
${webSourcesBlock}

USER'S ONLINE DEEP DIVE QUESTION:
"${followUpQuery}"

CRITICAL RULES & INVESTIGATION INSTRUCTIONS:
1. NO GREETINGS OR PREAMBLE: Absolutely DO NOT include any greetings, self-introductions, polite pleasantries, or lead-in statements (e.g. NEVER say "Ciao!", "Sono SimonReads...", "Ecco quanto emerso dal web...", "Certamente!"). Start DIRECTLY and IMMEDIATELY with the substantive analysis or first Markdown section heading.
2. Provide an exhaustive, detailed, and up-to-date analysis answering the user's follow-up request.
3. Unpack key details: specific figures, data points, quotes, chronological sequence, causes, context, and implications described in the online sources.
4. Synthesize information from the live web sources above, connecting them with the original story context.
5. Reference the online sources clearly using citation markers [1], [2], etc. matching [Web Source 1], [Web Source 2].
6. Structure your response with clean Markdown headings, bullet points, and clear actionable takeaways.
7. Clearly highlight what is newly reported or confirmed online versus remaining uncertainties.
8. Conclude your entire response completely without ending abruptly or leaving sentences or sections unfinished.
9. Respond in ${targetLanguage} (or match the user language).`;

    const rawAnswer = await callAI(
        prompt,
        settings,
        'You are an investigative web intelligence analyst. Deliver direct, high-density analysis without conversational preambles, greetings, or self-introductions.'
    );
    const answerText = stripConversationalPreamble(rawAnswer);

    return {
        answer: answerText,
        retrievedArticles: [],
        onlineSources,
        query: followUpQuery,
        generatedAt: new Date().toISOString(),
        provider,
        isFollowUp: true,
        isOnline: true,
        targetArticleTitle: targetArticle?.title
    };
}

