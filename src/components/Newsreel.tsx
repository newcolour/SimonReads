import { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader, X, Volume2, RotateCw, FileDown, Pause, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Article, AppSettings } from '../types';
import { summarizeArticle } from '../summaryService';
import { generateNewspaperPDF } from '../pdfService';
import { fetchRelatedArticles } from '../relatedArticlesService';
import './Newsreel.css';

interface NewsreelProps {
    articles: Article[];
    settings: AppSettings;
    onClose: () => void;
    onArticleClick?: (article: Article) => void;
    isDailyNewsreel?: boolean;
}

export default function Newsreel({ articles, settings, onClose, onArticleClick, isDailyNewsreel = false }: NewsreelProps) {
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isReadingAloud, setIsReadingAloud] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const isReadingAloudRef = useRef(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const articleMapRef = useRef<Map<string, Article>>(new Map());

    // Cache key based on type (daily or custom)
    const CACHE_KEY = `newsreel_cache_${isDailyNewsreel ? 'daily' : 'custom'}`;

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            window.speechSynthesis.cancel();
            setIsReadingAloud(false);
            setIsPaused(false);
        };
    }, []);

    useEffect(() => {
        // Don't regenerate if we're exporting a PDF - prevent race conditions
        if (!isExportingPdf) {
            // Create a hash of article IDs to detect changes
            const articleHash = articles.map(a => a.id).sort().join('|');

            // Try to load from session storage
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
            } else {
                console.log('📰 Articles changed or no cache, generating new newsreel...');
                generateNewsreel(articleHash);
            }
        }
    }, [articles, isExportingPdf, CACHE_KEY]);

    const handleTogglePause = () => {
        if (isPaused) {
            // Resume
            if (audioRef.current) {
                audioRef.current.play();
            } else {
                window.speechSynthesis.resume();
            }
            setIsPaused(false);
        } else {
            // Pause
            if (audioRef.current) {
                audioRef.current.pause();
            } else {
                window.speechSynthesis.pause();
            }
            setIsPaused(true);
        }
    };

    const handleChangeSpeed = () => {
        const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];

        setPlaybackRate(nextRate);

        if (audioRef.current) {
            audioRef.current.playbackRate = nextRate;
        }
        // Note: System voice rate change requires restart usually, so it will apply on next segment
    };

    const generateNewsreel = async (currentArticleHash: string) => {
        if (articles.length === 0) return;

        setIsSummarizing(true);
        setError(null);

        try {
            // Use a more generous limit per article for better quality
            // We'll rely on AI to group by topic and summarize efficiently
            const targetTotalChars = 500000; // Increased to 500k chars (Gemini Flash has large context)
            const charsPerArticle = Math.max(2000, Math.floor(targetTotalChars / articles.length));

            console.log(`Processing ${articles.length} articles with ${charsPerArticle} chars each`);

            // Fetch full content from each article URL
            const articleContents = await Promise.all(
                articles.map(async (article) => {
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
                const article = articles[index];
                articleMapRef.current.set(item.url, article);
                return `Article ${index + 1}: ${item.title}\nURL: ${item.url}\n${item.content}`;
            }).join('\n\n---\n\n');

            console.log(`Total combined content: ${combinedContent.length} characters`);

            const targetLanguage = settings.summaryLanguage || 'English';

            const instruction = isDailyNewsreel
                ? `Please create a comprehensive daily news digest from the following ${articles.length} articles in ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
1. LANGUAGE: The ENTIRE output must be in ${targetLanguage}. Translate all titles, headings, and summaries to ${targetLanguage}.
2. First, identify common topics/themes across the articles
3. Group related articles together by topic
4. For each topic group:
   - Create a topic heading in ${targetLanguage}
   - Provide a comprehensive summary that synthesizes information from ALL articles in that group
   - Write 2-4 detailed paragraphs covering the key points from all articles in the group
   - Do NOT include inline links in the text
   - At the END of the section, create a "Sources" list with markdown links to each article: - [Article Title (Translated)](URL)
   - After the sources, add a specific line exactly like this: "SEARCH_QUERY: <3-5 word search query for this topic>"
5. Make sure EVERY article is included in at least one topic group
6. If an article doesn't fit any group, create a "Miscellaneous" section

This approach allows for more detailed coverage while being efficient with space.`
                : `Please create a news reel summary of the following ${articles.length} articles in ${targetLanguage}.

IMPORTANT INSTRUCTIONS:
1. LANGUAGE: The ENTIRE output must be in ${targetLanguage}. Translate all titles, headings, and summaries to ${targetLanguage}.
2. Group articles by common topics/themes
3. For each topic, provide a comprehensive summary that covers all related articles
4. Write detailed summaries (2-3 paragraphs per topic group)
5. Do NOT include inline links in the text
6. At the END of each topic section, list the sources as bullet points with markdown links: - [Article Title (Translated)](URL)
7. After the sources, add a specific line exactly like this: "SEARCH_QUERY: <3-5 word search query for this topic>"
8. Make sure ALL ${articles.length} articles are included

This topic-based approach allows for richer summaries than individual article summaries.`;

            let result = await summarizeArticle(combinedContent, settings.geminiApiKey || '', settings, instruction);

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
            setIsSummarizing(false);
        }
    };

    const handleRegenerate = () => {
        console.log('🔄 Force regenerating newsreel...');
        sessionStorage.removeItem(CACHE_KEY); // Clear cache
        const articleHash = articles.map(a => a.id).sort().join('|');
        generateNewsreel(articleHash);
    };

    const handleReadAloud = async () => {
        if (!summary) return;

        if (isReadingAloud) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            window.speechSynthesis.cancel();
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            return;
        }

        const plainText = summary.replace(/[#*\[\]()]/g, '').replace(/\n+/g, ' ').trim();
        if (!plainText) return;

        setIsReadingAloud(true);
        isReadingAloudRef.current = true;
        const provider = settings.ttsProvider || 'system';

        try {
            if (provider === 'openai' && settings.openaiApiKey) {
                await readWithOpenAI(plainText);
            } else if (provider === 'free') {
                await readWithCloudTTS(plainText);
            } else {
                readWithSystemVoice(plainText);
            }
        } catch (error) {
            console.error('TTS error:', error);
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            readWithSystemVoice(plainText);
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
                audioRef.current = null;
            };

            audio.onerror = () => {
                URL.revokeObjectURL(url);
                setIsReadingAloud(false);
                isReadingAloudRef.current = false;
                audioRef.current = null;
                readWithSystemVoice(text);
            };

            await audio.play();
        } catch (error) {
            throw error;
        }
    };

    const readWithCloudTTS = async (text: string) => {
        const maxLength = 200;
        const chunks: string[] = [];

        try {
            if (text.length <= maxLength) {
                chunks.push(text);
            } else {
                const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
                let currentChunk = '';

                for (const sentence of sentences) {
                    if ((currentChunk + sentence).length <= maxLength) {
                        currentChunk += sentence;
                    } else {
                        if (currentChunk) chunks.push(currentChunk);
                        currentChunk = sentence;
                    }
                }
                if (currentChunk) chunks.push(currentChunk);
            }
            await playCloudChunks(chunks, 0);
        } catch (e) {
            throw e;
        }
    };

    const playCloudChunks = async (chunks: string[], index: number) => {
        if (index >= chunks.length || !isReadingAloudRef.current) {
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            return;
        }

        const language = settings.readAloudLanguage || 'en';

        try {
            const ipcRenderer = (window as any).ipcRenderer;
            if (!ipcRenderer) {
                setIsReadingAloud(false);
                isReadingAloudRef.current = false;
                return;
            }

            const base64List = await ipcRenderer.invoke('fetch-tts', {
                text: chunks[index],
                lang: language
            });

            const playSegments = async (segmentIndex: number) => {
                if (segmentIndex >= base64List.length || !isReadingAloudRef.current) {
                    playCloudChunks(chunks, index + 1);
                    return;
                }

                const audioSrc = `data:audio/mp3;base64,${base64List[segmentIndex]}`;
                const audio = new Audio();
                audio.playbackRate = playbackRate;
                audioRef.current = audio;

                audio.onended = () => {
                    audioRef.current = null;
                    playSegments(segmentIndex + 1);
                };

                audio.onerror = () => {
                    audioRef.current = null;
                    playSegments(segmentIndex + 1);
                };

                const playPromise = new Promise<void>((resolve, reject) => {
                    audio.oncanplaythrough = () => {
                        audio.play().then(() => resolve()).catch(reject);
                    };
                    audio.src = audioSrc;
                    audio.load();
                });

                await playPromise;
            };

            await playSegments(0);

        } catch (e) {
            console.error('Playback failed:', e);
            audioRef.current = null;
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            readWithSystemVoice(chunks.slice(index).join(' '));
        }
    };

    const readWithSystemVoice = (text: string) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = playbackRate;
        utterance.onend = () => {
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            setIsPaused(false);
        };
        utterance.onerror = () => {
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            setIsPaused(false);
        };
        window.speechSynthesis.speak(utterance);
    };

    const handleExportPdf = async () => {
        if (!summary || !isDailyNewsreel) return;

        setIsExportingPdf(true);

        // Create a stable copy of articles to prevent race conditions
        // if the articles array is modified during export
        const articlesCopy = [...articles];

        try {
            await generateNewspaperPDF(articlesCopy, settings);
        } catch (error) {
            console.error('PDF export failed:', error);
            alert(`Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
        } finally {
            setIsExportingPdf(false);
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

            <div className="newsreel-content">
                {isSummarizing ? (
                    <div className="newsreel-loading">
                        <Loader size={32} className="spin" />
                        <p>Generating newsreel summary...</p>
                    </div>
                ) : error ? (
                    <div className="newsreel-error">
                        <p>{error}</p>
                        <button onClick={() => {
                            const articleHash = articles.map(a => a.id).sort().join('|');
                            generateNewsreel(articleHash);
                        }}>Try Again</button>
                    </div>
                ) : summary ? (
                    <div className="newsreel-summary">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
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
