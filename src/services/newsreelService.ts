import { Article, AppSettings } from '../types';
import { summarizeArticle } from '../summaryService';
import { fetchRelatedArticles } from '../relatedArticlesService';

// Global state for background newsreel generation
interface NewsreelState {
    isGenerating: boolean;
    summary: string | null;
    articleHash: string | null;
    error: string | null;
    progress: string;
}

let currentState: NewsreelState = {
    isGenerating: false,
    summary: null,
    articleHash: null,
    error: null,
    progress: ''
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
    updateState({
        summary: null,
        articleHash: null,
        error: null
    });
}

export async function generateNewsreelInBackground(
    articles: Article[],
    settings: AppSettings,
    isDailyNewsreel: boolean
): Promise<void> {
    if (articles.length === 0) return;

    // Create article hash
    const articleHash = articles.map(a => a.id).sort().join('|');

    // Check if we already have this cached
    if (currentState.articleHash === articleHash && currentState.summary) {
        console.log('✅ Newsreel already cached');
        return;
    }

    // Check if already generating
    if (currentState.isGenerating) {
        console.log('⏳ Newsreel generation already in progress');
        return;
    }

    updateState({
        isGenerating: true,
        error: null,
        progress: 'Starting newsreel generation...',
        articleHash: articleHash
    });

    try {
        // Build effective settings for newsreel
        const useNewsreelAI = settings.newsreelUseGlobalAI === false;
        const effectiveSettings: AppSettings = useNewsreelAI ? {
            ...settings,
            aiProvider: settings.newsreelAiProvider || 'gemini',
            geminiApiKey: settings.newsreelGeminiApiKey || settings.geminiApiKey,
            geminiModel: settings.newsreelGeminiModel || settings.geminiModel || 'gemini-1.5-flash',
            openaiApiKey: settings.newsreelOpenaiApiKey || settings.openaiApiKey,
            openaiModel: settings.newsreelOpenaiModel || settings.openaiModel || 'gpt-4o-mini',
            claudeApiKey: settings.newsreelClaudeApiKey || settings.claudeApiKey,
            claudeModel: settings.newsreelClaudeModel || settings.claudeModel || 'claude-3-haiku-20240307',
            ollamaUrl: settings.newsreelOllamaUrl || settings.ollamaUrl || 'http://localhost:11434',
            ollamaModel: settings.newsreelOllamaModel || settings.ollamaModel || 'llama3',
        } : {
            ...settings,
            aiProvider: settings.aiProvider === 'ollama' ? 'gemini' : settings.aiProvider,
        };

        updateState({ progress: `Fetching ${articles.length} articles...` });

        // Fetch article contents
        const targetTotalChars = 500000;
        const charsPerArticle = Math.max(2000, Math.floor(targetTotalChars / articles.length));

        const articleContents = await Promise.all(
            articles.map(async (article) => {
                try {
                    let html = '';
                    const ipcRenderer = (window as any).ipcRenderer;

                    if (ipcRenderer) {
                        const result = await ipcRenderer.invoke('fetch-url', article.link);
                        if (result.success) {
                            html = result.content;
                        } else {
                            const response = await fetch(article.link);
                            html = await response.text();
                        }
                    } else {
                        const response = await fetch(article.link);
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

        updateState({ progress: 'Generating AI summary...' });

        const combinedContent = articleContents.map((item, index) => {
            return `Article ${index + 1}: ${item.title}\nURL: ${item.url}\n${item.content}`;
        }).join('\n\n---\n\n');

        const targetLanguage = effectiveSettings.summaryLanguage || 'English';

        const instruction = isDailyNewsreel
            ? `Please create a comprehensive daily news digest from the following ${articles.length} articles in ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
1. LANGUAGE: The ENTIRE output must be in ${targetLanguage}.
2. First, identify common topics/themes across the articles
3. Group related articles together by topic
4. For each topic group:
   - Create a topic heading in ${targetLanguage}
   - Provide a comprehensive summary that synthesizes information from ALL articles in that group
   - Write 2-4 detailed paragraphs covering the key points
   - At the END of the section, create a "Sources" list with markdown links: - [Article Title](URL)
   - After the sources, add: "SEARCH_QUERY: <3-5 word search query for this topic>"
5. Make sure EVERY article is included in at least one topic group
6. If an article doesn't fit any group, create a "Miscellaneous" section`
            : `Please create a news reel summary of the following ${articles.length} articles in ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
1. LANGUAGE: The ENTIRE output must be in ${targetLanguage}.
2. Group articles by common topics/themes
3. For each topic, provide a comprehensive summary
4. Write detailed summaries (2-3 paragraphs per topic group)
5. At the END of each topic section, list the sources as bullet points: - [Article Title](URL)
6. After the sources, add: "SEARCH_QUERY: <3-5 word search query for this topic>"
7. Make sure ALL ${articles.length} articles are included`;

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
            progress: 'Newsreel ready!'
        });

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
