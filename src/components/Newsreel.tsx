import { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, Loader, X, Volume2, RotateCw, FileDown, Pause, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Article, AppSettings } from '../types';
import { summarizeArticle } from '../summaryService';
import { generateNewsreelPDF } from '../pdfService';
import { fetchRelatedArticles } from '../relatedArticlesService';
import { TTSService, TTSController } from '../services/ttsService';
import { getNewsreelState, subscribeToNewsreel, generateNewsreelInBackground, clearNewsreelCache } from '../services/newsreelService';
import { scoreAndSortArticles, buildNewsreelScoringPrompt } from '../services/newsreelRankingService';
import './Newsreel.css';

interface NewsreelProps {
    articles: Article[];
    settings: AppSettings;
    onClose: () => void;
    onArticleClick?: (article: Article) => void;
    isDailyNewsreel?: boolean;
}

function extractCategoriesFromSummary(markdown: string): { title: string; id: string }[] {
    const cats: { title: string; id: string }[] = [];
    const seen = new Set<string>();
    const lines = markdown.split('\n');
    for (const line of lines) {
        if (line.startsWith('# ') && !line.startsWith('## ')) {
            const rawTitle = line.replace(/^#\s+/, '').trim();
            if (rawTitle) {
                const id = 'section-' + rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
                if (!seen.has(id)) {
                    seen.add(id);
                    cats.push({ title: rawTitle, id });
                }
            }
        }
    }
    return cats;
}

export default function Newsreel({ articles, settings, onClose, onArticleClick, isDailyNewsreel = false }: NewsreelProps) {
    const [summary, setSummary] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isReadingAloud, setIsReadingAloud] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const isReadingAloudRef = useRef(false);
    const isGeneratingRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ttsControllerRef = useRef<TTSController | null>(null);
    const articleMapRef = useRef<Map<string, Article>>(new Map());
    const contentRef = useRef<HTMLDivElement | null>(null);
    const categoryBarRef = useRef<HTMLDivElement | null>(null);
    const isManualScrollRef = useRef(false);
    const manualScrollTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Cache key based on type (daily or custom)
    const CACHE_KEY = `newsreel_cache_${isDailyNewsreel ? 'daily' : 'custom'}`;

    useEffect(() => {
        return () => {
            // Clean up TTS on unmount
            if (ttsControllerRef.current) {
                ttsControllerRef.current.stop();
                ttsControllerRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            if (manualScrollTimerRef.current) {
                clearTimeout(manualScrollTimerRef.current);
            }
            TTSService.stopCurrent();
            setIsReadingAloud(false);
            setIsPaused(false);
        };
    }, []);

    // Subscribe to background newsreel service for daily newsreel
    useEffect(() => {
        if (isDailyNewsreel) {
            // Check if we have a cached result from background generation
            const state = getNewsreelState();
            if (state.summary) {
                setSummary(state.summary);
                setIsSummarizing(false);
                setError(null);
            } else if (state.isGenerating) {
                setIsSummarizing(true);
            }

            // Subscribe to updates
            const unsubscribe = subscribeToNewsreel((newState) => {
                if (newState.summary) {
                    setSummary(newState.summary);
                    setIsSummarizing(false);
                    setError(null);
                }
                if (newState.error) {
                    setError(newState.error);
                    setIsSummarizing(false);
                }
                if (newState.isGenerating) {
                    setIsSummarizing(true);
                }
            });

            return unsubscribe;
        }
    }, [isDailyNewsreel]);

    useEffect(() => {
        // Don't regenerate if we're exporting a PDF - prevent race conditions
        if (isExportingPdf) return;

        // For daily newsreel, check global service first
        if (isDailyNewsreel) {
            const state = getNewsreelState();

            // 1. If we already have a generated summary from background service, use it and NEVER auto-regenerate
            if (state.summary) {
                if (summary !== state.summary) {
                    console.log('✅ Using cached newsreel from background service');
                    setSummary(state.summary);
                }
                setIsSummarizing(false);
                return;
            }

            // 2. If component already has summary in local state, do not regenerate
            if (summary) {
                return;
            }

            // 3. If background is currently generating, wait for it
            if (state.isGenerating) {
                console.log('⏳ Background generation in progress...');
                setIsSummarizing(true);
                return;
            }

            // 4. Otherwise start initial background generation (first time only)
            console.log('📰 Starting initial background newsreel generation...');
            generateNewsreelInBackground(articles, settings, true, false);
            setIsSummarizing(true);
            return;
        }

        // For custom newsreel (selected articles):
        // 1. If summary is already generated, do NOT regenerate when new articles arrive
        if (summary) {
            return;
        }

        // 2. If currently generating, do NOT restart generation when new articles arrive
        if (isSummarizing || isGeneratingRef.current) {
            return;
        }

        const articleHash = articles.map(a => a.id).sort().join('|');

        // 3. Try to load from session storage
        let cachedData = null;
        try {
            const stored = sessionStorage.getItem(CACHE_KEY);
            if (stored) {
                cachedData = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to parse newsreel cache', e);
        }

        // Check if we have a valid cache match
        if (cachedData && cachedData.hash === articleHash && cachedData.summary) {
            console.log('✅ Using cached newsreel from session storage');
            setSummary(cachedData.summary);
            return;
        }

        // 4. Initial generation for this custom selection
        console.log('📰 Generating newsreel for selected articles...');
        generateNewsreel(articleHash, false);
    }, [articles, isExportingPdf, CACHE_KEY, isDailyNewsreel]);

    const handleTogglePause = () => {
        if (isPaused) {
            // Resume
            if (ttsControllerRef.current) {
                ttsControllerRef.current.resume();
            } else if (audioRef.current) {
                audioRef.current.play();
            }
            setIsPaused(false);
        } else {
            // Pause
            if (ttsControllerRef.current) {
                ttsControllerRef.current.pause();
            } else if (audioRef.current) {
                audioRef.current.pause();
            }
            setIsPaused(true);
        }
    };

    const handleChangeSpeed = () => {
        const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];

        setPlaybackRate(nextRate);

        if (ttsControllerRef.current) {
            ttsControllerRef.current.setRate(nextRate);
        } else if (audioRef.current) {
            audioRef.current.playbackRate = nextRate;
        }
    };

    const generateNewsreel = async (currentArticleHash: string, force = false) => {
        if (articles.length === 0) return;

        if (isGeneratingRef.current) {
            console.log('⏳ Local newsreel generation already in progress, skipping');
            return;
        }

        if (summary && !force) {
            console.log('✅ Local newsreel summary already generated, skipping');
            return;
        }

        isGeneratingRef.current = true;
        setIsSummarizing(true);
        setError(null);

        try {
            // Build effective settings for newsreel
            // Newsreel works best with cloud models (Gemini), so use newsreel-specific settings
            // or default to Gemini if no newsreel-specific AI is configured
            const useNewsreelAI = settings.newsreelUseGlobalAI === false;
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
                // Use global AI settings as-is (including Ollama)
                ...settings,
            };

            // Determine model name for logging
            let modelName = effectiveSettings.geminiModel || 'gemini-2.5-flash';
            if (effectiveSettings.aiProvider === 'openai') modelName = effectiveSettings.openaiModel || 'gpt-4o-mini';
            else if (effectiveSettings.aiProvider === 'claude') modelName = effectiveSettings.claudeModel || 'claude-3-haiku';
            else if (effectiveSettings.aiProvider === 'ollama') modelName = effectiveSettings.ollamaModel || 'llama3';

            console.log(`🤖 Newsreel AI: ${effectiveSettings.aiProvider} - ${modelName}`);

            // Pre-rank candidate articles by heuristic importance
            const rankedArticles = scoreAndSortArticles(articles);

            // Use a more generous limit per article for better quality
            const targetTotalChars = 500000;
            const charsPerArticle = Math.max(2000, Math.floor(targetTotalChars / rankedArticles.length));

            console.log(`Processing ${rankedArticles.length} articles with ${charsPerArticle} chars each`);

            // Fetch full content from each article URL
            const articleContents = await Promise.all(
                rankedArticles.map(async (article) => {
                    try {
                        let html = '';
                        const ipcRenderer = (window as any).ipcRenderer;

                        if (ipcRenderer) {
                            // Use IPC to fetch content (bypasses CORS and 403s)
                            const result = await ipcRenderer.invoke('fetch-url', article.link);
                            if (result.success) {
                                html = result.content;
                            } else {
                                console.warn(`IPC fetch failed for ${article.link}: ${result.error}, falling back to direct fetch`);
                                const response = await fetch(article.link);
                                html = await response.text();
                            }
                        } else {
                            // Fallback for web mode
                            const response = await fetch(article.link);
                            html = await response.text();
                        }

                        // Extract text content from HTML (remove scripts, styles, etc.)
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');

                        // Remove script and style elements
                        doc.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());

                        // Get text content
                        const textContent = doc.body.textContent || '';

                        // Clean up whitespace and limit length dynamically
                        const cleanedContent = textContent
                            .replace(/\s+/g, ' ')
                            .trim()
                            .slice(0, charsPerArticle);

                        return {
                            title: article.title,
                            content: cleanedContent,
                            url: article.link
                        };
                    } catch (err) {
                        console.error(`Failed to fetch ${article.link}:`, err);
                        // Fallback to RSS content if fetch fails
                        return {
                            title: article.title,
                            content: (article.content || article.contentSnippet || '').slice(0, charsPerArticle),
                            url: article.link
                        };
                    }
                })
            );

            // Combine all article content and create article map
            articleMapRef.current.clear();
            const combinedContent = articleContents.map((item, index) => {
                const article = rankedArticles[index];
                articleMapRef.current.set(item.url, article);
                return `Article ${index + 1}: ${item.title}\nURL: ${item.url}\n${item.content}`;
            }).join('\n\n---\n\n');

            console.log(`Total combined content: ${combinedContent.length} characters`);

            const targetLanguage = effectiveSettings.summaryLanguage || 'English';
            const instruction = buildNewsreelScoringPrompt(rankedArticles.length, targetLanguage);

            let result = await summarizeArticle(combinedContent, effectiveSettings.geminiApiKey || '', effectiveSettings, instruction);

            // Post-process to add "To know more" sections
            const queryRegex = /SEARCH_QUERY: (.*)/g;
            let match;
            const replacements = [];

            // Find all search queries
            while ((match = queryRegex.exec(result)) !== null) {
                const fullMatch = match[0];
                const query = match[1].trim();
                replacements.push({ fullMatch, query });
            }

            // Fetch related articles for each query
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
                    console.error(`Failed to fetch related articles for query "${query}":`, e);
                    result = result.replace(fullMatch, '');
                }
            }

            setSummary(result);

            // Save to session storage
            if (currentArticleHash) {
                try {
                    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
                        hash: currentArticleHash,
                        summary: result
                    }));
                } catch (e) {
                    console.error('Failed to save newsreel cache', e);
                }
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            isGeneratingRef.current = false;
            setIsSummarizing(false);
        }
    };

    const handleRegenerate = () => {
        console.log('🔄 Force regenerating newsreel on user request...');
        sessionStorage.removeItem(CACHE_KEY); // Clear local cache

        if (isDailyNewsreel) {
            // Clear global service cache and start fresh background generation
            clearNewsreelCache();
            setSummary(null);
            setError(null);
            setIsSummarizing(true);
            generateNewsreelInBackground(articles, settings, true, true);
        } else {
            // For custom newsreel, use local generation with force = true
            const articleHash = articles.map(a => a.id).sort().join('|');
            setSummary(null);
            setError(null);
            generateNewsreel(articleHash, true);
        }
    };

    const handleReadAloud = async () => {
        if (!summary) return;

        if (isReadingAloud) {
            // Stop reading
            if (ttsControllerRef.current) {
                ttsControllerRef.current.stop();
                ttsControllerRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            await TTSService.stopCurrent();
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            setIsPaused(false);
            return;
        }

        const plainText = summary.replace(/[#*\[\]()]/g, '').replace(/\n+/g, ' ').trim();
        if (!plainText) return;

        setIsReadingAloud(true);
        isReadingAloudRef.current = true;
        const provider = settings.ttsProvider || 'free';
        const language = settings.readAloudLanguage || 'en';

        try {
            if (provider === 'openai' && settings.openaiApiKey) {
                // OpenAI TTS - uses direct API call, works on all platforms
                await readWithOpenAI(plainText);
            } else {
                // Use cross-platform TTS service for 'free' and 'system' providers
                // On Android/iOS: uses native TTS
                // On Electron: uses google-tts-api via IPC
                // On Web: uses browser speechSynthesis
                const controller = await TTSService.speak({
                    text: plainText,
                    language,
                    playbackRate,
                    onEnd: () => {
                        setIsReadingAloud(false);
                        isReadingAloudRef.current = false;
                        setIsPaused(false);
                        ttsControllerRef.current = null;
                    },
                    onError: (error) => {
                        console.error('TTS error:', error);
                        setIsReadingAloud(false);
                        isReadingAloudRef.current = false;
                        setIsPaused(false);
                        ttsControllerRef.current = null;
                    }
                });
                ttsControllerRef.current = controller;
            }
        } catch (error) {
            console.error('TTS error:', error);
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            setIsPaused(false);
        }
    };

    const readWithOpenAI = async (text: string) => {
        try {
            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    input: text,
                    voice: 'nova'
                })
            });

            if (!response.ok) throw new Error('OpenAI TTS failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.playbackRate = playbackRate;
            audioRef.current = audio;

            audio.onended = () => {
                URL.revokeObjectURL(url);
                setIsReadingAloud(false);
                isReadingAloudRef.current = false;
                setIsPaused(false);
                audioRef.current = null;
            };

            audio.onerror = () => {
                URL.revokeObjectURL(url);
                setIsReadingAloud(false);
                isReadingAloudRef.current = false;
                setIsPaused(false);
                audioRef.current = null;
            };

            await audio.play();
        } catch (error) {
            throw error;
        }
    };

    const handleExportPdf = async () => {
        if (!summary || !isDailyNewsreel) return;

        setIsExportingPdf(true);

        // Create a stable copy of articles to prevent race conditions
        // if the articles array is modified during export
        const articlesCopy = [...articles];

        try {
            await generateNewsreelPDF(summary, articlesCopy, settings);
        } catch (error) {
            console.error('PDF export failed:', error);
            alert(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
        } finally {
            setIsExportingPdf(false);
        }
    };

    const categories = useMemo(() => {
        return summary ? extractCategoriesFromSummary(summary) : [];
    }, [summary]);

    // Scroll spy: update active category pill as user scrolls through sections
    useEffect(() => {
        const contentEl = contentRef.current;
        if (!contentEl || categories.length === 0) return;

        let ticking = false;

        const handleScroll = () => {
            if (isManualScrollRef.current) return;

            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (!contentEl) {
                        ticking = false;
                        return;
                    }

                    const containerTop = contentEl.getBoundingClientRect().top;
                    const scrollTop = contentEl.scrollTop;

                    // Scrolled near top -> activate "All Sections"
                    if (scrollTop < 50) {
                        setActiveCategory('all');
                        ticking = false;
                        return;
                    }

                    // Scrolled near bottom -> activate last section
                    const isAtBottom = contentEl.scrollHeight - scrollTop - contentEl.clientHeight < 50;
                    if (isAtBottom && categories.length > 0) {
                        setActiveCategory(categories[categories.length - 1].id);
                        ticking = false;
                        return;
                    }

                    // Determine which section heading is currently at or above the viewing line
                    let currentCatId = 'all';
                    for (const cat of categories) {
                        const el = document.getElementById(cat.id);
                        if (el) {
                            const rect = el.getBoundingClientRect();
                            // If heading has reached or passed within 90px of top of scroll container
                            if (rect.top <= containerTop + 90) {
                                currentCatId = cat.id;
                            } else {
                                break;
                            }
                        }
                    }

                    setActiveCategory(currentCatId);
                    ticking = false;
                });
                ticking = true;
            }
        };

        const handleUserScrollInteraction = () => {
            if (isManualScrollRef.current) {
                isManualScrollRef.current = false;
                if (manualScrollTimerRef.current) {
                    clearTimeout(manualScrollTimerRef.current);
                }
            }
        };

        contentEl.addEventListener('scroll', handleScroll, { passive: true });
        contentEl.addEventListener('wheel', handleUserScrollInteraction, { passive: true });
        contentEl.addEventListener('touchmove', handleUserScrollInteraction, { passive: true });

        return () => {
            contentEl.removeEventListener('scroll', handleScroll);
            contentEl.removeEventListener('wheel', handleUserScrollInteraction);
            contentEl.removeEventListener('touchmove', handleUserScrollInteraction);
        };
    }, [categories]);

    // Keep active category pill in view within the horizontal category bar
    useEffect(() => {
        if (!categoryBarRef.current) return;
        const activePill = categoryBarRef.current.querySelector<HTMLElement>('.category-pill.active');
        if (activePill) {
            activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
    }, [activeCategory]);

    const scrollToCategory = (catId: string) => {
        setActiveCategory(catId);
        isManualScrollRef.current = true;
        if (manualScrollTimerRef.current) {
            clearTimeout(manualScrollTimerRef.current);
        }
        manualScrollTimerRef.current = setTimeout(() => {
            isManualScrollRef.current = false;
        }, 800);

        if (catId === 'all') {
            contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            const target = document.getElementById(catId);
            if (target && contentRef.current) {
                const containerRect = contentRef.current.getBoundingClientRect();
                const targetRect = target.getBoundingClientRect();
                const scrollOffset = targetRect.top - containerRect.top + contentRef.current.scrollTop - 10;
                contentRef.current.scrollTo({ top: Math.max(0, scrollOffset), behavior: 'smooth' });
            }
        }
    };

    return (
        <div className="newsreel">
            <div className="newsreel-header">
                <div className="newsreel-title">
                    <Sparkles size={18} className="sparkles-icon" />
                    <h2>{isDailyNewsreel ? 'Daily Newsreel' : 'Newsreel Summary'}</h2>
                    <span className="article-count">{articles.length} articles</span>
                </div>
                <div className="newsreel-actions">
                    {isReadingAloud && (
                        <>
                            <button
                                className="icon-btn"
                                onClick={handleChangeSpeed}
                                title={`Speed: ${playbackRate}x`}
                                style={{ width: 'auto', padding: '0 8px', fontSize: '12px', fontWeight: 'bold' }}
                            >
                                {playbackRate}x
                            </button>
                            <button
                                className="icon-btn"
                                onClick={handleTogglePause}
                                title={isPaused ? "Resume" : "Pause"}
                            >
                                {isPaused ? <Play size={18} /> : <Pause size={18} />}
                            </button>
                        </>
                    )}
                    <button
                        className={`icon-btn ${isReadingAloud ? 'active' : ''}`}
                        onClick={handleReadAloud}
                        title={isReadingAloud ? "Stop Reading" : "Read Aloud"}
                    >
                        {isReadingAloud ? <X size={18} /> : <Volume2 size={18} />}
                    </button>
                    <button
                        className="action-btn"
                        onClick={handleRegenerate}
                        disabled={isSummarizing}
                        title="Regenerate Summary"
                    >
                        {isSummarizing ? <Loader size={20} className="spin" /> : <RotateCw size={20} />}
                    </button>
                    {isDailyNewsreel && (
                        <button
                            className="icon-btn"
                            onClick={handleExportPdf}
                            disabled={isExportingPdf || !summary}
                            title="Export as PDF"
                        >
                            {isExportingPdf ? <Loader className="spin" size={18} /> : <FileDown size={18} />}
                        </button>
                    )}
                    <button className="close-btn" onClick={onClose} title="Close Newsreel">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {categories.length > 0 && !isSummarizing && (
                <div className="newsreel-category-bar" ref={categoryBarRef}>
                    <button
                        className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
                        onClick={() => scrollToCategory('all')}
                    >
                        📰 All Sections
                    </button>
                    {categories.map((cat) => (
                        <button
                            key={cat.id}
                            className={`category-pill ${activeCategory === cat.id ? 'active' : ''}`}
                            onClick={() => scrollToCategory(cat.id)}
                        >
                            {cat.title}
                        </button>
                    ))}
                </div>
            )}

            <div className="newsreel-content" ref={contentRef}>
                {isSummarizing ? (
                    <div className="newsreel-loading">
                        <Loader size={32} className="spin" />
                        <p>Generating newsreel summary...</p>
                    </div>
                ) : error ? (
                    <div className="newsreel-error">
                        <p>{error}</p>
                        <button onClick={handleRegenerate}>Try Again</button>
                    </div>
                ) : summary ? (
                    <div className="newsreel-summary">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h1: ({ children, ...props }) => {
                                    const text = String(children);
                                    const id = 'section-' + text.toLowerCase().replace(/[^a-z0-9]/g, '-');
                                    return (
                                        <h1 id={id} className="newsreel-category-heading" {...props}>
                                            {children}
                                        </h1>
                                    );
                                },
                                h2: ({ children, ...props }) => {
                                    return (
                                        <h2 className="newsreel-story-heading" {...props}>
                                            {children}
                                        </h2>
                                    );
                                },
                                a: ({ node, href, children, ...props }) => {
                                    // Check if this is an article link
                                    const article = href ? articleMapRef.current.get(href) : null;
                                    if (article && onArticleClick) {
                                        return (
                                            <a
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    onArticleClick(article);
                                                    onClose(); // Close newsreel when article is clicked
                                                }}
                                                style={{ cursor: 'pointer' }}
                                                {...props}
                                            >
                                                {children}
                                            </a>
                                        );
                                    }
                                    // Regular external link - treat as an article to open in app
                                    return (
                                        <a
                                            href="#"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (href) {
                                                    // Create a temporary article object for the external link
                                                    const tempArticle: Article = {
                                                        id: href,
                                                        feedId: 'external',
                                                        title: String(children),
                                                        link: href,
                                                        pubDate: new Date(),
                                                        content: '',
                                                        contentSnippet: '',
                                                        isRead: false
                                                    };

                                                    if (onArticleClick) {
                                                        onArticleClick(tempArticle);
                                                        onClose();
                                                    } else {
                                                        // Fallback
                                                        const ipcRenderer = (window as any).ipcRenderer;
                                                        if (ipcRenderer) {
                                                            ipcRenderer.invoke('open-external', href);
                                                        } else {
                                                            window.open(href, '_blank');
                                                        }
                                                    }
                                                }
                                            }}
                                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                            {...props}
                                        >
                                            {children}
                                        </a>
                                    );
                                }
                            }}
                        >
                            {summary}
                        </ReactMarkdown>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
