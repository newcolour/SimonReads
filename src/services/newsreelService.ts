import { Article, AppSettings } from '../types';
import { summarizeArticle } from '../summaryService';
import { fetchRelatedArticles } from '../relatedArticlesService';
import { safeFetch } from '../utils/fetchUtils';
import { scoreAndSortArticles, buildNewsreelScoringPrompt } from './newsreelRankingService';

// Global state for background newsreel generation
interface NewsreelState {
    isGenerating: boolean;
    summary: string | null;
    articleHash: string | null;
    error: string | null;
    progress: string;
    generatedAt: number | null;
}

const STORAGE_KEY = 'simonreads_daily_newsreel';

function loadPersistedNewsreel(): Partial<NewsreelState> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            if (data && data.summary) {
                return {
                    summary: data.summary,
                    articleHash: data.articleHash || null,
                    generatedAt: data.generatedAt || null
                };
            }
        }
    } catch (e) {
        console.error('Failed to load newsreel from localStorage', e);
    }
    return {};
}

function persistNewsreel(state: NewsreelState) {
    try {
        if (state.summary) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                summary: state.summary,
                articleHash: state.articleHash,
                generatedAt: state.generatedAt
            }));
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {
        console.error('Failed to persist newsreel to localStorage', e);
    }
}

const persisted = loadPersistedNewsreel();

let currentState: NewsreelState = {
    isGenerating: false,
    summary: persisted.summary || null,
    articleHash: persisted.articleHash || null,
    error: null,
    progress: '',
    generatedAt: persisted.generatedAt || null
};

// Listeners for state changes
type StateListener = (state: NewsreelState) => void;
const listeners: Set<StateListener> = new Set();

export function getNewsreelState(): NewsreelState {
    return { ...currentState };
}

export function subscribeToNewsreel(listener: StateListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notifyListeners() {
    const state = getNewsreelState();
    listeners.forEach(listener => listener(state));
}

function updateState(updates: Partial<NewsreelState>) {
    currentState = { ...currentState, ...updates };
    notifyListeners();
}

export function clearNewsreelCache() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('Failed to remove newsreel from localStorage', e);
    }
    updateState({
        summary: null,
        articleHash: null,
        error: null,
        generatedAt: null
    });
}

export async function generateNewsreelInBackground(
    articles: Article[],
    settings: AppSettings,
    isDailyNewsreel: boolean,
    force: boolean = false
): Promise<void> {
    if (articles.length === 0) return;

    // Check if already generating - never start duplicate generation
    if (currentState.isGenerating) {
        console.log('⏳ Newsreel generation already in progress, skipping trigger');
        return;
    }

    // Check if we already have a generated summary - only regenerate on explicit button push
    if (currentState.summary && !force) {
        console.log('✅ Newsreel summary already generated. Regeneration requires manual button push.');
        return;
    }

    // Create article hash
    const articleHash = articles.map(a => a.id).sort().join('|');

    updateState({
        isGenerating: true,
        error: null,
        progress: 'Starting newsreel generation...',
        articleHash: articleHash
    });

    try {
        // Build effective settings for newsreel
        const useNewsreelAI = settings.newsreelUseGlobalAI === false;

        console.log('🔍 Newsreel Settings Debug:', {
            useNewsreelAI,
            globalProvider: settings.aiProvider,
            newsreelProvider: settings.newsreelAiProvider,
            newsreelUseGlobalAI: settings.newsreelUseGlobalAI,
            fullSettings: settings,
            isDailyNewsreel
        });

        const effectiveSettings: AppSettings = useNewsreelAI ? {
            ...settings,
            aiProvider: settings.newsreelAiProvider || 'gemini',
            geminiApiKey: settings.newsreelGeminiApiKey || settings.geminiApiKey,
            geminiModel: settings.newsreelGeminiModel || settings.geminiModel || 'gemini-2.5-flash',
            openaiApiKey: settings.newsreelOpenaiApiKey || settings.openaiApiKey,
            openaiModel: settings.newsreelOpenaiModel || settings.openaiModel || 'gpt-4o-mini',
            claudeApiKey: settings.newsreelClaudeApiKey || settings.claudeApiKey,
            claudeModel: settings.newsreelClaudeModel || settings.claudeModel || 'claude-3-haiku-20240307',
            ollamaUrl: settings.newsreelOllamaUrl || settings.ollamaUrl || 'http://localhost:11434',
            ollamaModel: settings.newsreelOllamaModel || settings.ollamaModel || 'llama3',
        } : {
            ...settings,
            // Use global AI settings as-is (including Ollama)
        };

        updateState({ progress: `Ranking and fetching ${articles.length} articles...` });

        // Pre-rank candidate articles by heuristic importance (clustering, recency, impact signals)
        const rankedArticles = scoreAndSortArticles(articles);

        // Fetch article contents
        const targetTotalChars = 500000;
        const charsPerArticle = Math.max(2000, Math.floor(targetTotalChars / rankedArticles.length));

        const articleContents = await Promise.all(
            rankedArticles.map(async (article) => {
                try {
                    let html = '';
                    const ipcRenderer = (window as any).ipcRenderer;

                    if (ipcRenderer) {
                        const result = await ipcRenderer.invoke('fetch-url', article.link);
                        if (result.success) {
                            html = result.content;
                        } else {
                            const response = await safeFetch(article.link);
                            html = await response.text();
                        }
                    } else {
                        const response = await safeFetch(article.link);
                        html = await response.text();
                    }

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    doc.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());
                    const textContent = doc.body.textContent || '';
                    const cleanedContent = textContent.replace(/\s+/g, ' ').trim().slice(0, charsPerArticle);

                    return {
                        title: article.title,
                        content: cleanedContent,
                        url: article.link
                    };
                } catch (err) {
                    return {
                        title: article.title,
                        content: (article.content || article.contentSnippet || '').slice(0, charsPerArticle),
                        url: article.link
                    };
                }
            })
        );

        updateState({ progress: 'Evaluating importance and generating AI digest...' });

        const combinedContent = articleContents.map((item, index) => {
            return `Article ${index + 1}: ${item.title}\nURL: ${item.url}\n${item.content}`;
        }).join('\n\n---\n\n');

        const targetLanguage = effectiveSettings.summaryLanguage || 'English';
        const instruction = buildNewsreelScoringPrompt(rankedArticles.length, targetLanguage);

        let result = await summarizeArticle(combinedContent, effectiveSettings.geminiApiKey || '', effectiveSettings, instruction);

        updateState({ progress: 'Adding related articles...' });

        // Post-process to add "To know more" sections
        const queryRegex = /SEARCH_QUERY: (.*)/g;
        let match;
        const replacements: { fullMatch: string; query: string }[] = [];

        while ((match = queryRegex.exec(result)) !== null) {
            replacements.push({ fullMatch: match[0], query: match[1].trim() });
        }

        for (const { fullMatch, query } of replacements) {
            try {
                const related = await fetchRelatedArticles(query);
                if (related.length > 0) {
                    const relatedMd = `\n\n**To know more:**\n` +
                        related.map(r => `- [${r.title} (${r.source})](${r.url})`).join('\n');
                    result = result.replace(fullMatch, relatedMd);
                } else {
                    result = result.replace(fullMatch, '');
                }
            } catch (e) {
                result = result.replace(fullMatch, '');
            }
        }

        updateState({
            isGenerating: false,
            summary: result,
            error: null,
            progress: 'Newsreel ready!',
            generatedAt: Date.now()
        });
        persistNewsreel(currentState);

        console.log('✅ Background newsreel generation complete');

    } catch (err: any) {
        updateState({
            isGenerating: false,
            error: err.message,
            progress: ''
        });
        console.error('❌ Background newsreel generation failed:', err);
    }
}
