import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Loader, LogIn, X, Trash2, Globe, BookOpen, Brain, MessageCircle, Star, Volume2, Play, ArrowUp, Timer, Zap, Share2, Layers, Shield, Mic, Bug } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Article, AppSettings, Feed } from '../types';
import { summarizeArticle } from '../summaryService';
import { findRelatedArticles } from '../personalityUtils';
import { usePersonalityConfig } from '../hooks/usePersonality';
import Chat from './Chat';
import PodcastPlayer from './PodcastPlayer';
import { openExternalUrl, isElectron, isAndroid } from '../utils/platform';
import { getPublicationColors, applyPublicationColors } from '../utils/publicationColors';
import { ReadingPositionService } from '../services/readingPositionService';
import { ReadingStatsService } from '../services/readingStatsService';
import RedditComments from './RedditComments';
import FocusMode from './FocusMode';
import SpeedReader from './SpeedReader';
import ShareCard from './ShareCard';
import StoryComparison from './StoryComparison';
import FactCheck from './FactCheck';
import AIPodcast from './AIPodcast';
import FocusTimerWidget from './FocusTimerWidget';
import './ArticleView.css';

// Helper to strip HTML tags and decode entities from titles
const cleanTitle = (title: string): string => {
    if (!title) return '';
    const temp = document.createElement('div');
    temp.innerHTML = title;
    return temp.textContent || temp.innerText || title;
};

interface ArticleViewProps {
    article: Article | null;
    feed?: Feed;
    feeds?: Feed[];
    settings: AppSettings;
    allArticles?: Article[];
    onClose: () => void;
    onDelete: (articleId: string) => void;
    onToggleSaved?: (articleId: string) => void;
    onSelectArticle?: (article: Article) => void;
}

const getPublicationStyle = (feedTitle: string, theme: string) => {
    const title = feedTitle.toLowerCase();
    let isDark = theme === 'dark' || theme === 'black';
    if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Default styles
    let style: React.CSSProperties = {
        fontFamily: 'var(--font-serif)',
        fontSize: '1.2em',
        fontWeight: 'bold',
        color: 'var(--text-primary)',
        marginRight: 'auto', // Push actions to the right
        opacity: 0.9,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        zIndex: 10
    };

    if (title.includes('new york times') || title.includes('nytimes')) {
        style.fontFamily = '"Chomsky", "Georgia", serif';
        style.letterSpacing = '-0.5px';
    } else if (title.includes('wall street journal') || title.includes('wsj')) {
        style.fontFamily = '"Escrow", "Georgia", serif';
    } else if (title.includes('guardian')) {
        style.fontFamily = '"Guardian Egyptian", "Georgia", serif';
        style.color = isDark ? '#90cfff' : '#052962';
    } else if (title.includes('bbc')) {
        style.fontFamily = '"Reith", "Helvetica", sans-serif';
        style.color = '#BB1919';
    } else if (title.includes('techcrunch')) {
        style.fontFamily = '"Helvetica Neue", sans-serif';
        style.color = '#00D563';
    } else if (title.includes('verge')) {
        style.fontFamily = '"Adelle", "Georgia", serif';
        style.color = '#E10600';
    } else if (title.includes('wired')) {
        style.fontFamily = '"Courier New", monospace';
    }

    return style;
};

export default function ArticleView({ article, feed, feeds = [], settings, allArticles = [], onClose, onDelete, onToggleSaved, onSelectArticle }: ArticleViewProps) {
    const feedTitle = feed?.title || article?.feedTitle;
    const personalityConfig = usePersonalityConfig(settings.readingPersonality);



    const [viewMode, setViewMode] = useState<'reader' | 'browser'>('reader');
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [currentArticleId, setCurrentArticleId] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [summaryMode, setSummaryMode] = useState<'popup' | 'inline'>('inline'); // Inline by default
    const [showInlineSummary, setShowInlineSummary] = useState(false);
    const [fetchedContent, setFetchedContent] = useState<string | null>(null);
    const [isFetchingContent, setIsFetchingContent] = useState(false);
    const webviewRef = useRef<any>(null);
    const [webviewUrl, setWebviewUrl] = useState<string>('');
    const isNavigatingFromChat = useRef(false);

    // Related articles state (Deep Diver personality)
    const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);

    // Reddit video embed state - store video info for proper rendering
    const [redditVideo, setRedditVideo] = useState<{
        type: 'youtube' | 'reddit';
        videoId?: string;
        videoUrl?: string;
    } | null>(null);

    // Image viewer state
    const [viewerImage, setViewerImage] = useState<string | null>(null);

    // Focus mode state
    const [showFocusMode, setShowFocusMode] = useState(false);

    // Speed reader state
    const [showSpeedReader, setShowSpeedReader] = useState(false);

    // Share card state
    const [showShareCard, setShowShareCard] = useState(false);

    // Story comparison state
    const [showStoryComparison, setShowStoryComparison] = useState(false);

    // Fact check state
    const [showFactCheck, setShowFactCheck] = useState(false);

    // AI Podcast state
    const [showAIPodcast, setShowAIPodcast] = useState(false);

    // Debounce timer ref for saving position
    const savePositionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset summary when article changes and restore reading position
    useEffect(() => {
        if (article && article.id !== currentArticleId) {
            setSummary(null);
            setSummaryError(null);
            setCurrentArticleId(article.id);

            // Start tracking reading stats
            ReadingStatsService.startReading(article.id);
            setWebviewUrl(article.link); // Set webview URL to article link
            setFetchedContent(null); // Reset fetched content
            setRedditVideo(null); // Reset Reddit video

            // Restore reading position if available
            const contentContainer = document.querySelector('.article-view-content');
            if (contentContainer) {
                // First scroll to top
                contentContainer.scrollTop = 0;

                // Then restore saved position
                ReadingPositionService.getPosition(article.id).then(pos => {
                    if (pos && pos.scrollPercent > 5) {
                        const maxScroll = contentContainer.scrollHeight - contentContainer.clientHeight;
                        const targetScroll = (pos.scrollPercent / 100) * maxScroll;
                        // Small delay to let content render
                        setTimeout(() => {
                            contentContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });
                        }, 100);
                    }
                });
            }
        }
    }, [article?.id, article?.link]);

    // Track scroll position with debounce
    useEffect(() => {
        if (!article) return;

        const contentContainer = document.querySelector('.article-view-content');
        if (!contentContainer) return;

        const handleScroll = () => {
            // Clear existing timer
            if (savePositionTimer.current) {
                clearTimeout(savePositionTimer.current);
            }

            // Debounce save (500ms after scroll stops)
            savePositionTimer.current = setTimeout(() => {
                const scrollTop = contentContainer.scrollTop;
                const scrollHeight = contentContainer.scrollHeight - contentContainer.clientHeight;
                const scrollPercent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;

                ReadingPositionService.savePosition(article.id, scrollPercent);
            }, 500);
        };

        contentContainer.addEventListener('scroll', handleScroll);

        return () => {
            contentContainer.removeEventListener('scroll', handleScroll);
            if (savePositionTimer.current) {
                clearTimeout(savePositionTimer.current);
            }
        };
    }, [article?.id]);

    // Fetch Reddit video/external link info if this is a Reddit article
    useEffect(() => {
        const fetchRedditMedia = async () => {
            if (!article || !article.link.includes('reddit.com')) {
                setRedditVideo(null);
                return;
            }

            try {
                // Construct JSON URL from article link
                let jsonUrl = article.link;
                if (jsonUrl.endsWith('/')) {
                    jsonUrl = jsonUrl.slice(0, -1);
                }
                jsonUrl += '.json';

                console.log('Fetching Reddit media from:', jsonUrl);

                let data: any;
                if ((window as any).ipcRenderer) {
                    const result = await (window as any).ipcRenderer.invoke('fetch-url', jsonUrl);
                    if (result.success === false) throw new Error(result.error);
                    const text = typeof result === 'string' ? result : result.content;
                    data = JSON.parse(text);
                } else {
                    const response = await fetch(jsonUrl);
                    data = await response.json();
                }

                // Reddit JSON returns [post_data, comments_data]
                if (Array.isArray(data) && data[0]?.data?.children?.[0]?.data) {
                    const post = data[0].data.children[0].data;
                    console.log('Reddit post data:', { url: post.url, is_video: post.is_video, media: post.media });

                    // Check for external YouTube/video link
                    if (post.url && (post.url.includes('youtube.com') || post.url.includes('youtu.be'))) {
                        // Extract YouTube video ID
                        let videoId: string | null = null;
                        try {
                            const url = new URL(post.url);
                            if (url.hostname.includes('youtu.be')) {
                                videoId = url.pathname.slice(1);
                            } else if (url.pathname.includes('/embed/')) {
                                videoId = url.pathname.split('/embed/')[1];
                            } else if (url.searchParams.has('v')) {
                                videoId = url.searchParams.get('v');
                            }
                        } catch (e) {
                            const match = post.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
                            if (match) videoId = match[1];
                        }

                        if (videoId) {
                            console.log('Found YouTube video ID:', videoId);
                            setRedditVideo({ type: 'youtube', videoId });
                            return;
                        }
                    }

                    // Check for Reddit-hosted video
                    if (post.is_video && post.media?.reddit_video?.fallback_url) {
                        const videoUrl = post.media.reddit_video.fallback_url;
                        console.log('Found Reddit video:', videoUrl);
                        setRedditVideo({ type: 'reddit', videoUrl });
                        return;
                    }
                }

                setRedditVideo(null);
            } catch (error) {
                console.error('Failed to fetch Reddit media:', error);
                setRedditVideo(null);
            }
        };

        fetchRedditMedia();
    }, [article?.link]);

    // Auto-open browser on native mobile if view mode is 'browser'
    useEffect(() => {
        if (viewMode === 'browser' && Capacitor.isNativePlatform() && webviewUrl) {
            Browser.open({ url: webviewUrl, presentationStyle: 'popover' });
        }
    }, [viewMode, webviewUrl]);

    // Find related articles for Deep Diver personality
    useEffect(() => {
        if (personalityConfig.showRelatedArticles && article && allArticles.length > 0) {
            // Debounce and limit scope to avoid freezing the UI on mount
            const timer = setTimeout(() => {
                // Only search recent articles to improve performance
                const recentArticles = allArticles.slice(0, 500);
                findRelatedArticles(article, recentArticles, 3).then(related => {
                    setRelatedArticles(related);
                });
            }, 1000); // Wait 1s to let initial rendering and fetching complete

            return () => clearTimeout(timer);
        } else {
            setRelatedArticles([]);
        }
    }, [article?.id, personalityConfig.showRelatedArticles, allArticles.length]);

    // Fetch article content if missing or too short
    useEffect(() => {
        const fetchArticleContent = async () => {
            if (!article || viewMode !== 'reader') {
                console.log('Skipping fetch - article:', !!article, 'viewMode:', viewMode);
                return;
            }

            // Check if we need to fetch content
            // Smarter detection: check if content looks like a snippet
            const contentLength = article.content?.length || 0;

            // Check if content is a snippet by looking for indicators:
            // 1. Very short text content (after stripping HTML)
            // 2. Only has tracking pixels (NPR adds these)
            // 3. Single paragraph with no substantial content
            // 4. NPR domain with minimal content
            let isSnippet = false;

            if (article.content) {
                // Strip HTML tags to get text length
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = article.content;
                const textContent = tempDiv.textContent || '';
                const textLength = textContent.trim().length;

                // Count paragraphs
                const paragraphCount = (article.content.match(/<p[^>]*>/gi) || []).length;

                // Check for tracking pixels (NPR uses these)
                const hasTrackingPixel = article.content.includes('tracking/npr-rss-pixel.png');

                // Check if it's an NPR article
                const isNPR = article.link.includes('npr.org') || article.feedTitle?.toLowerCase().includes('npr');

                // Check if it's OMG! Ubuntu (they include "You're reading" footer in RSS)
                const isOMGUbuntu = article.link.includes('omgubuntu.co.uk') ||
                    article.feedTitle?.toLowerCase().includes('omg') ||
                    article.content.includes('You\'re reading');

                // Check for Boing Boing
                const isBoingBoing = article.link.includes('boingboing.net') ||
                    article.feedTitle?.toLowerCase().includes('boing boing');

                // Check for NYT (always provides snippets without images in RSS)
                const isNYT = article.link.includes('nytimes.com') ||
                    article.feedTitle?.toLowerCase().includes('new york times') ||
                    article.feedTitle?.toLowerCase().includes('nyt');

                // Check for generic "truncated feed" footer pattern common in WordPress
                // distinct enough to not trigger false positives
                const hasTruncatedFooter = article.content.includes('appeared first on');

                console.log('Content analysis:', {
                    contentLength,
                    textLength,
                    paragraphCount,
                    hasTrackingPixel,
                    isNPR,
                    isOMGUbuntu,
                    isBoingBoing,
                    isNYT,
                    hasTruncatedFooter,
                    feedTitle: article.feedTitle,
                    domain: new URL(article.link).hostname
                });

                // Consider it a snippet if:
                // - Text content is less than 300 characters, OR
                // - Has tracking pixel and only 1-2 paragraphs (typical NPR snippet), OR
                // - Is NPR article with less than 3 paragraphs (NPR typically provides snippets), OR
                // - Is OMG! Ubuntu article (they always provide snippets with "You're reading" footer), OR
                // - Is Boing Boing (always truncated), OR
                // - Is NYT (RSS only has text description, no images), OR
                // - Has generic truncated footer text, OR
                // - Content is less than 800 characters total
                isSnippet = textLength < 300 ||
                    (hasTrackingPixel && paragraphCount <= 2) ||
                    (isNPR && paragraphCount <= 3) ||
                    isOMGUbuntu ||
                    isBoingBoing ||
                    isNYT ||
                    hasTruncatedFooter ||
                    contentLength < 800;
            } else {
                isSnippet = true; // No content at all
            }

            console.log('Content check:', {
                contentLength,
                isSnippet,
                hasFetchedContent: !!fetchedContent,
                isFetchingContent,
                shouldFetch: isSnippet && !fetchedContent && !isFetchingContent
            });

            if (!isSnippet || fetchedContent || isFetchingContent) return;

            console.log('Article appears to be a snippet, fetching full content from URL:', article.link);
            setIsFetchingContent(true);

            try {
                let htmlContent: string | null = null;

                const ipcRenderer = (window as any).ipcRenderer;
                if (ipcRenderer) {
                    // Electron path
                    const result = await ipcRenderer.invoke('fetch-url', article.link);
                    if (result.success) {
                        htmlContent = result.content;
                    } else {
                        console.error('Electron fetch failed:', result.error);
                    }
                } else if (Capacitor.isNativePlatform()) {
                    // Android/iOS path - use Capacitor HTTP
                    console.log('[Mobile] Fetching article via Capacitor HTTP...');
                    try {
                        // Delay for repubblica.it to allow auth cookies to stream to the native CookieManager
                        if (article.link.includes('repubblica.it')) {
                            console.log('[Mobile] repubblica.it detected: delaying fetch by 2500ms to allow cookies to sync...');
                            await new Promise(resolve => setTimeout(resolve, 2500));
                        }

                        const { CapacitorHttp } = await import('@capacitor/core');
                        let response: any;

                        // For known Cloudflare/bot-protected sites, always skip the direct fetch
                        // and go straight to the AllOrigins proxy. These sites return 200 OK but serve
                        // truncated/paywalled HTML to non-browser clients, so checking for a blocked
                        // status after the fact is not reliable.
                        const isKnownProxySite = article.link.includes('fcinter1908.it') || article.link.includes('gazzanet');

                        if (isKnownProxySite) {
                            console.log('[Mobile] Known proxy-required site detected. Fetching directly via AllOrigins proxy...');
                            try {
                                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(article.link)}`;
                                const proxyResponse = await CapacitorHttp.get({
                                    url: proxyUrl,
                                    headers: { 'Accept': 'application/json' },
                                    readTimeout: 15000,
                                    connectTimeout: 10000,
                                });

                                if (proxyResponse.status >= 200 && proxyResponse.status < 300 && proxyResponse.data) {
                                    // allorigins returns JSON: { contents: "<html>..." }
                                    const data = typeof proxyResponse.data === 'string' ? JSON.parse(proxyResponse.data) : proxyResponse.data;
                                    if (data && data.contents) {
                                        response = {
                                            ...proxyResponse,
                                            data: data.contents,
                                            status: 200
                                        };
                                        console.log('[Mobile] Successfully fetched content via proxy');
                                    } else {
                                        // Proxy returned empty contents — fall back to direct fetch
                                        console.warn('[Mobile] Proxy returned empty contents, falling back to direct fetch');
                                        response = await CapacitorHttp.get({
                                            url: article.link,
                                            headers: {
                                                'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                                'Accept-Language': 'en-US,en;q=0.9',
                                            },
                                            readTimeout: 15000,
                                            connectTimeout: 10000,
                                        });
                                    }
                                } else {
                                    // Proxy request itself failed — fall back to direct fetch
                                    console.warn('[Mobile] Proxy request failed, falling back to direct fetch');
                                    response = await CapacitorHttp.get({
                                        url: article.link,
                                        headers: {
                                            'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                            'Accept-Language': 'en-US,en;q=0.9',
                                        },
                                        readTimeout: 15000,
                                        connectTimeout: 10000,
                                    });
                                }
                            } catch (proxyError) {
                                console.error('[Mobile] Proxy fetch failed, falling back to direct fetch:', proxyError);
                                response = await CapacitorHttp.get({
                                    url: article.link,
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                        'Accept-Language': 'en-US,en;q=0.9',
                                    },
                                    readTimeout: 15000,
                                    connectTimeout: 10000,
                                });
                            }
                        } else {
                            // Standard direct fetch for all other sites
                            response = await CapacitorHttp.get({
                                url: article.link,
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                                    'Accept-Language': 'en-US,en;q=0.9',
                                },
                                readTimeout: 15000,
                                connectTimeout: 10000,
                            });

                            // Secondary fallback: if another site returns a blocked response, try the proxy too
                            const isBlocked = response.status >= 400 || (typeof response.data === 'string' && (response.data.toLowerCase().includes('cloudflare') || response.data.toLowerCase().includes('bot protection')));
                            if (isBlocked) {
                                console.log('[Mobile] Direct fetch was blocked. Retrying with AllOrigins proxy...');
                                try {
                                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(article.link)}`;
                                    const proxyResponse = await CapacitorHttp.get({
                                        url: proxyUrl,
                                        headers: { 'Accept': 'application/json' },
                                        readTimeout: 15000,
                                        connectTimeout: 10000,
                                    });

                                    if (proxyResponse.status >= 200 && proxyResponse.status < 300 && proxyResponse.data) {
                                        const data = typeof proxyResponse.data === 'string' ? JSON.parse(proxyResponse.data) : proxyResponse.data;
                                        if (data && data.contents) {
                                            response = { ...proxyResponse, data: data.contents, status: 200 };
                                            console.log('[Mobile] Successfully fetched content via proxy (blocked fallback)');
                                        }
                                    }
                                } catch (proxyError) {
                                    console.error('[Mobile] Proxy fallback failed:', proxyError);
                                }
                            }
                        }

                        if (response.status >= 200 && response.status < 300) {
                            htmlContent = response.data;
                            console.log('[Mobile] Successfully fetched content, length:', htmlContent?.length);
                        } else {
                            console.error('[Mobile] HTTP error:', response.status);
                            setFetchedContent(`<div class="fetch-error" style="padding: 2.5rem; text-align: center; background: rgba(255,100,0,0.05); border-radius: 12px; border: 1px dashed rgba(255,100,0,0.3); margin: 2rem 0;">
                                <h3 style="color: #f60; margin-bottom: 1rem;">Full Content Blocked (${response.status})</h3>
                                <p style="margin-bottom: 1.5rem; opacity: 0.8;">The publisher is blocking our reader view on mobile. This usually happens on sites like FCInter1908 that use aggressive anti-bot protection.</p>
                                <button onclick="window.dispatchEvent(new CustomEvent('switch-to-browser'))" style="background: #f60; color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer;">View in Browser View</button>
                                <div style="margin-top: 1rem; font-size: 0.8em; opacity: 0.5;">URL: ${article.link}</div>
                            </div>`);
                            setIsFetchingContent(false);
                            return;
                        }
                    } catch (httpError) {
                        console.error('[Mobile] Capacitor HTTP error:', httpError);
                    }
                } else {
                    // Web fallback - try direct fetch (may fail due to CORS)
                    console.log('[Web] Attempting direct fetch...');
                    try {
                        const response = await fetch(article.link, {
                            headers: {
                                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            }
                        });
                        if (response.ok) {
                            htmlContent = await response.text();
                        }
                    } catch (fetchError) {
                        console.warn('[Web] Direct fetch failed (likely CORS):', fetchError);
                    }
                }

                if (htmlContent) {
                    // Parse HTML and extract readable content
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlContent, 'text/html');

                    // Remove unwanted elements
                    doc.querySelectorAll('script, style, nav, header, footer, aside, iframe, .ad, .advertisement, .social-share, .newsletter-signup, .related-stories, .ad-wrap, .ad-config-wrap, .breadcrumbs, .tags, .categories, .kicker, .eyebrow, .bck-gn-media-news, .sticky-video, .bck-adv').forEach(el => el.remove());

                    // Aggressive text-based removal for specific junk
                    doc.querySelectorAll('div, span, p, h6, h5').forEach(el => {
                        const text = el.textContent?.trim().toLowerCase() || '';
                        if (
                            text === 'adv' ||
                            text.startsWith('tempo di lettura') ||
                            text.startsWith('read time') ||
                            text.includes('salvato nella pagina')
                        ) {
                            // Just remove the element itself, don't remove parent containers
                            // (removing .media-frame was too aggressive and removed article content)
                            el.remove();
                        } else if (text.includes('i migliori video scelti dal nostro canale')) {
                            // For video banners, remove the entire media-frame container
                            const mediaFrame = el.parentElement?.closest('.media-frame');
                            if (mediaFrame) {
                                mediaFrame.parentElement?.remove();
                            } else {
                                el.remove();
                            }
                        }
                    });

                    // Remove author images/avatars
                    doc.querySelectorAll('.author-image, .author-avatar, .avatar, img[alt*="Author"], img[alt*="Redatto"], .author-box img').forEach(el => el.remove());


                    // Try to find main content area with site-specific selectors
                    let contentElement;

                    // NPR-specific: Check for transcript first (has full content)
                    const nprTranscript = doc.querySelector('.transcript.storytext');
                    const nprStorytextId = doc.querySelector('#storytext');

                    if (nprTranscript) {
                        // NPR transcript has the full article
                        contentElement = nprTranscript;
                        console.log('Using NPR transcript for content');
                    } else if (nprStorytextId) {
                        // Fallback to #storytext if no transcript
                        contentElement = nprStorytextId;
                        console.log('Using NPR #storytext for content');
                    } else {
                        // Site-specific selectors for various publishers
                        // NYT selectors
                        const nytStory = doc.querySelector('[data-testid="article-body"]') ||
                            doc.querySelector('section[name="articleBody"]') ||
                            doc.querySelector('.StoryBodyCompanionColumn');

                        if (nytStory) {
                            contentElement = nytStory;
                            console.log('Using NYT article body for content');
                        } else {
                            // Generic selectors for other sites
                            contentElement =
                                doc.querySelector('.body-article') || // Gazzetta Network (FCInter1908)
                                doc.querySelector('#story') || // Boing Boing
                                doc.querySelector('.entry-content') || // WordPress
                                doc.querySelector('.post-content') || // WordPress
                                doc.querySelector('.story__text') || // Repubblica.it
                                doc.querySelector('.story-body') ||
                                doc.querySelector('.story') || // Repubblica.it fallback
                                doc.querySelector('article') ||
                                doc.querySelector('[role="main"]') ||
                                doc.querySelector('main') ||
                                doc.querySelector('.article-body') ||
                                doc.querySelector('.content') ||
                                doc.body;
                        }
                    }

                    if (contentElement) {
                        // Remove the title if it appears in the content
                        // Look for h1 elements that match the article title
                        const h1Elements = contentElement.querySelectorAll('h1');
                        h1Elements.forEach(h1 => {
                            const h1Text = h1.textContent?.trim().toLowerCase();
                            const articleTitle = article.title.trim().toLowerCase();
                            // Remove if it's an exact match or very similar
                            if (h1Text === articleTitle ||
                                (h1Text && articleTitle &&
                                    (h1Text.includes(articleTitle) || articleTitle.includes(h1Text)))) {
                                h1.remove();
                            }
                        });

                        // Also remove any header elements that might contain the title
                        const headerElements = contentElement.querySelectorAll('header');
                        headerElements.forEach(header => {
                            const headerText = header.textContent?.trim().toLowerCase();
                            const articleTitle = article.title.trim().toLowerCase();
                            if (headerText && articleTitle && headerText.includes(articleTitle)) {
                                header.remove();
                            }
                        });

                        // Specific removal for journalist image on FCInter1908
                        doc.querySelectorAll('.gzn_author_img, .gzn_author_thumbnail').forEach(el => el.remove());

                        // Get HTML content
                        let extractedContent = contentElement.innerHTML;

                        // Fix double-encoded entities (common in some feeds)
                        // This handles &amp;#8220; -> &#8220; -> “
                        extractedContent = extractedContent.replace(/&amp;#(\d+);/g, (_, code) => {
                            return String.fromCharCode(parseInt(code, 10));
                        });

                        // Also fix common named entities if double encoded
                        extractedContent = extractedContent
                            .replace(/&amp;quot;/g, '"')
                            .replace(/&amp;apos;/g, "'")
                            .replace(/&amp;lt;/g, "<")
                            .replace(/&amp;gt;/g, ">");

                        console.log('Successfully extracted content, length:', extractedContent.length);

                        // Debug: Show image-related HTML
                        const imgMatches = extractedContent.match(/<img[^>]*>/g) || [];
                        console.log('[DEBUG] Found images in fetched content:', imgMatches.length);
                        imgMatches.slice(0, 5).forEach((match, i) => {
                            console.log(`[DEBUG] Image ${i}:`, match.substring(0, 200));
                        });

                        // Proactively proxy NYT images (they block hotlinking)
                        if (article.link.includes('nytimes.com') && ipcRenderer) {
                            console.log('[NYT] Processing images...');
                            const parser = new DOMParser();
                            const tempDoc = parser.parseFromString(extractedContent, 'text/html');

                            // FIRST: Convert <picture> elements to <img> so we can proxy them
                            tempDoc.querySelectorAll('picture').forEach(picture => {
                                const source = picture.querySelector('source[srcset]');
                                const img = picture.querySelector('img');

                                if (source) {
                                    const srcset = source.getAttribute('srcset') || '';
                                    const srcsetParts = srcset.split(',').map(s => s.trim());
                                    let bestUrl = '';
                                    let bestSize = 0;

                                    for (const part of srcsetParts) {
                                        const match = part.match(/^(.+?)\s+(\d+)(w|x)?$/);
                                        if (match) {
                                            const url = match[1];
                                            const size = parseInt(match[2]);
                                            if (size > bestSize || !bestUrl) {
                                                bestSize = size;
                                                bestUrl = url;
                                            }
                                        } else if (!bestUrl) {
                                            bestUrl = part;
                                        }
                                    }

                                    if (bestUrl) {
                                        const newImg = tempDoc.createElement('img');
                                        newImg.setAttribute('src', bestUrl);
                                        if (img) {
                                            newImg.setAttribute('alt', img.getAttribute('alt') || '');
                                        }
                                        picture.replaceWith(newImg);
                                        console.log('[NYT] Converted picture to img:', bestUrl.substring(0, 60));
                                    }
                                }
                            });

                            // SECOND: Proxy all NYT images (now including the converted ones)
                            const imgs = tempDoc.querySelectorAll('img');
                            console.log('[NYT] Found', imgs.length, 'images to proxy');

                            for (const img of Array.from(imgs)) {
                                const src = img.getAttribute('src');
                                if (src && src.includes('nyt.com') && !src.startsWith('data:')) {
                                    try {
                                        console.log('[NYT] Proxying image:', src.substring(0, 80));
                                        const result = await ipcRenderer.invoke('proxy-image', src);
                                        if (result.success && result.dataUrl) {
                                            img.setAttribute('src', result.dataUrl);
                                            console.log('[NYT] Successfully proxied image');
                                        }
                                    } catch (err) {
                                        console.error('[NYT] Failed to proxy image:', err);
                                    }
                                }
                            }

                            // THIRD: Remove "Image" placeholder text elements
                            tempDoc.querySelectorAll('span, div').forEach(el => {
                                const text = el.textContent?.trim() || '';
                                if (text === 'Image' || text === 'image') {
                                    el.remove();
                                }
                            });

                            extractedContent = tempDoc.body.innerHTML;
                        }

                        setFetchedContent(extractedContent);
                    } else {
                        console.warn('Could not find main content element');
                    }
                } else {
                    console.error('Failed to fetch article content - no content received');
                    // Show a helpful message for the user
                    setFetchedContent('<div style="padding: 20px; text-align: center; color: var(--text-muted);"><p style="font-size: 1.1em; margin-bottom: 12px;">⚠️ Unable to load article content</p><p>This publisher may be blocking content fetching. Please switch to <strong>Browser View</strong> to read this article.</p></div>');
                }
            } catch (error) {
                console.error('Error fetching article content:', error);
            } finally {
                setIsFetchingContent(false);
            }
        };

        fetchArticleContent();
    }, [article, viewMode, fetchedContent, isFetchingContent]);

    // Initialize webviewUrl when component mounts with an article
    useEffect(() => {
        if (article && !webviewUrl) {
            setWebviewUrl(article.link);
        }
    }, [article]);

    // Handle broken images by proxying through Electron (for hotlink-protected images)
    useEffect(() => {
        if (!isElectron()) return;

        const handleImageError = async (e: Event) => {
            const img = e.target as HTMLImageElement;
            const originalSrc = img.getAttribute('data-original-src') || img.src;

            // Skip if already processed or if it's a data URL
            if (img.getAttribute('data-proxied') === 'true' || originalSrc.startsWith('data:')) {
                return;
            }

            // Mark as being processed
            img.setAttribute('data-proxied', 'true');
            img.setAttribute('data-original-src', originalSrc);

            try {
                const ipcRenderer = (window as any).ipcRenderer;
                if (ipcRenderer) {
                    console.log('Proxying image:', originalSrc);
                    const result = await ipcRenderer.invoke('proxy-image', originalSrc);
                    if (result.success && result.dataUrl) {
                        img.src = result.dataUrl;
                    }
                }
            } catch (error) {
                console.error('Failed to proxy image:', error);
            }
        };

        // Add error handlers to all images in the article
        const articleEl = document.querySelector('.article-content');
        if (articleEl) {
            const images = articleEl.querySelectorAll('img');
            images.forEach(img => {
                if (!img.getAttribute('data-error-handler')) {
                    img.setAttribute('data-error-handler', 'true');
                    img.addEventListener('error', handleImageError);
                }
            });
        }

        const handleSwitchToBrowserEvent = () => {
            setViewMode('browser');
        };

        window.addEventListener('switch-to-browser', handleSwitchToBrowserEvent);

        return () => {
            window.removeEventListener('switch-to-browser', handleSwitchToBrowserEvent);
            // Cleanup
            const articleEl = document.querySelector('.article-content');
            if (articleEl) {
                const images = articleEl.querySelectorAll('img');
                images.forEach(img => {
                    img.removeEventListener('error', handleImageError);
                });
            }
        };
    }, [fetchedContent, article?.content]);

    const handleDebug = async () => {
        if (!article) return;

        try {
            alert(`Debugging content fetch for:\n${article.link}\n\nPlatform: ${Capacitor.getPlatform()}`);

            // 1. Fetch
            let html = '';
            let status = 0;

            if (Capacitor.isNativePlatform()) {
                const { CapacitorHttp } = await import('@capacitor/core');
                const response = await CapacitorHttp.get({
                    url: article.link,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    }
                });
                status = response.status;
                html = response.data || '';
            } else {
                const response = await fetch(article.link);
                status = response.status;
                html = await response.text();
            }

            alert(`Fetch Status: ${status}\nHTML Length: ${html.length}\nSample: ${html.substring(0, 150)}...`);

            if (html.toLowerCase().includes('cloudflare') || html.toLowerCase().includes('bot protection') || html.toLowerCase().includes('checking your browser')) {
                alert("⚠️ DETECTED BOT PROTECTION: This site is using Cloudflare or similar to block non-browser access.");
            }

            if (html.length < 500) {
                alert(`HTML is suspiciously short! content: ${html.substring(0, 200)}`);
            }

            // 2. Parse
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Check selectors
            const bodyArticle = doc.querySelector('.body-article');
            const contentDiv = doc.querySelector('.content');
            const nyt = doc.querySelector('[data-testid="article-body"]');

            alert(`Selectors found:\n.body-article: ${!!bodyArticle}\n.content: ${!!contentDiv}\n[data-testid="article-body"]: ${!!nyt}`);

            if (bodyArticle) {
                alert(`.body-article length: ${bodyArticle.innerHTML.length}\nFirst 100 chars: ${bodyArticle.textContent?.substring(0, 100)}`);
            } else if (contentDiv) {
                alert(`.content length: ${contentDiv.innerHTML.length}\nFirst 100 chars: ${contentDiv.textContent?.substring(0, 100)}`);
            }

        } catch (e: any) {
            alert(`Debug Error: ${e.message}`);
        }
    };

    const handleSummarize = async (forceRegenerate: boolean = false) => {
        if (!article) return;

        // If summary already exists and not forcing regenerate
        if (summary && !forceRegenerate) {
            if (summaryMode === 'popup') {
                // Open popup window
                const ipcRenderer = (window as any).ipcRenderer;
                console.log('ArticleView: Opening existing summary in popup, ipcRenderer available:', !!ipcRenderer);

                if (ipcRenderer) {
                    try {
                        console.log('ArticleView: Creating summary window with existing summary:', {
                            summaryLength: summary.length,
                            articleTitle: article.title,
                            articleId: article.id,
                            theme: settings.theme
                        });
                        const response = await ipcRenderer.invoke('create-summary-window', {
                            summary,
                            articleTitle: article.title,
                            articleId: article.id,
                            theme: settings.theme,
                            settings
                        });
                        console.log('ArticleView: Summary window creation response:', response);

                        if (!response || !response.success) {
                            alert('Failed to create summary window: ' + (response?.error || 'Unknown error'));
                        }
                    } catch (error: any) {
                        console.error('ArticleView: Error creating summary window:', error);
                        alert('Error creating summary window: ' + error.message);
                    }
                } else {
                    alert('Summary window not available. IPC renderer not found. Try inline mode instead (right-click the summarize button).');
                }
            } else {
                // Toggle inline summary
                setShowInlineSummary(!showInlineSummary);
            }
            return;
        }

        // Generate new summary
        const contentToSummarize = article.content || article.contentSnippet || '';
        if (!contentToSummarize) {
            setSummaryError('No content available to summarize.');
            return;
        }

        setIsSummarizing(true);
        setSummaryError(null);

        try {
            const result = await summarizeArticle(contentToSummarize, settings.geminiApiKey || '', settings);
            setSummary(result);

            if (summaryMode === 'popup') {
                // Open summary window with the new summary
                const ipcRenderer = (window as any).ipcRenderer;
                console.log('ArticleView: Opening new summary in popup, ipcRenderer available:', !!ipcRenderer);

                if (ipcRenderer) {
                    try {
                        console.log('ArticleView: Creating summary window with data:', {
                            summaryLength: result.length,
                            articleTitle: article.title,
                            articleId: article.id,
                            theme: settings.theme
                        });
                        const response = await ipcRenderer.invoke('create-summary-window', {
                            summary: result,
                            articleTitle: article.title,
                            articleId: article.id,
                            theme: settings.theme,
                            settings
                        });
                        console.log('ArticleView: Summary window creation response:', response);

                        if (!response || !response.success) {
                            alert('Failed to create summary window: ' + (response?.error || 'Unknown error'));
                        }
                    } catch (error: any) {
                        console.error('ArticleView: Error creating summary window:', error);
                        alert('Error creating summary window: ' + error.message);
                    }
                } else {
                    alert('Summary window not available. IPC renderer not found. Try inline mode instead (right-click the summarize button).');
                }
            } else {
                // Show inline summary
                setShowInlineSummary(true);
            }
        } catch (error: any) {
            setSummaryError(error.message);
        } finally {
            setIsSummarizing(false);
        }
    };


    const handleLogin = () => {
        if (!article || !webviewRef.current) return;

        // Extract domain from article URL
        try {
            const url = new URL(article.link);
            const loginUrls: { [key: string]: string } = {
                'nytimes.com': 'https://myaccount.nytimes.com/auth/login',
                'wsj.com': 'https://accounts.wsj.com/login',
                'washingtonpost.com': 'https://www.washingtonpost.com/subscribe/signin/',
                'ft.com': 'https://www.ft.com/login',
                'economist.com': 'https://www.economist.com/api/auth/login',
                'bloomberg.com': 'https://www.bloomberg.com/account/signin',
            };

            // Find matching domain
            const domain = Object.keys(loginUrls).find(d => url.hostname.includes(d));
            if (domain) {
                webviewRef.current.src = loginUrls[domain];
            } else {
                // Default: navigate to the site's homepage
                webviewRef.current.src = `${url.protocol}//${url.hostname}`;
            }
        } catch (err) {
            console.error('Failed to parse URL:', err);
        }
    };

    const handleNavigateToUrl = (url: string) => {
        console.log('handleNavigateToUrl called with:', url);
        // Mark that we're navigating from a chat link
        isNavigatingFromChat.current = true;
        // Switch to browser view mode
        setViewMode('browser');
        // Update webviewUrl immediately so the webview renders with the new URL
        setWebviewUrl(url);
    };

    if (!article) {
        return (
            <div className="article-view empty">
                <div className="empty-content">
                    <div className="empty-icon">
                        <BookOpen size={32} strokeWidth={1.5} />
                    </div>
                    <h2>Select an article to read</h2>
                    <p className="empty-subtitle">Choose an article from the list to start reading</p>
                </div>
            </div>
        );
    }

    // Get publication colors if enabled
    const publicationColors = settings.usePublicationColors
        ? getPublicationColors(feedTitle, article.link)
        : null;

    // Check if we're in dark mode (includes all dark-based themes)
    const darkThemes = ['dark', 'black', 'sorcerer', 'nord', 'dracula', 'gruvbox', 'tokyo-night', 'solarized-dark'];
    const isDarkMode = darkThemes.includes(settings.theme) ||
        (settings.theme === 'system' && window.matchMedia &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Apply publication colors as inline styles
    const publicationStyle = publicationColors && settings.usePublicationColors
        ? applyPublicationColors(publicationColors, isDarkMode)
        : {};

    // Use fetched content if available, otherwise fall back to article.content
    const contentToDisplay = fetchedContent || article.content || '';

    // Process lazy-loaded images: convert data-src to src before sanitization
    const processLazyImages = (html: string): string => {
        if (!html) return '';
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Skip picture processing if content already has proxied images (data URLs)
        // This prevents overwriting already-proxied NYT images
        const hasProxiedImages = html.includes('data:image/');

        // 1. Handle <picture> elements: extract best source or img and convert to standalone img
        // Skip if we already have proxied images (NYT processing already done)
        if (!hasProxiedImages) {
            doc.querySelectorAll('picture').forEach(picture => {
                // Get the img inside picture (fallback)
                const img = picture.querySelector('img');
                // Get the first source with srcset
                const source = picture.querySelector('source[srcset]');

                if (source) {
                    const srcset = source.getAttribute('srcset') || '';
                    // Parse srcset and get the largest/best image
                    // Format: "url1 1x, url2 2x" or "url1 100w, url2 200w"
                    const srcsetParts = srcset.split(',').map(s => s.trim());
                    let bestUrl = '';
                    let bestSize = 0;

                    for (const part of srcsetParts) {
                        const match = part.match(/^(.+?)\s+(\d+)(w|x)?$/);
                        if (match) {
                            const url = match[1];
                            const size = parseInt(match[2]);
                            if (size > bestSize || !bestUrl) {
                                bestSize = size;
                                bestUrl = url;
                            }
                        } else if (!bestUrl) {
                            // No size descriptor, just use the URL
                            bestUrl = part;
                        }
                    }

                    if (bestUrl) {
                        // Create a new img element to replace the picture
                        const newImg = doc.createElement('img');
                        newImg.setAttribute('src', bestUrl);
                        if (img) {
                            newImg.setAttribute('alt', img.getAttribute('alt') || '');
                        }
                        picture.replaceWith(newImg);
                        console.log('[processLazyImages] Converted picture to img:', bestUrl.substring(0, 80));
                    }
                } else if (img && img.getAttribute('src')) {
                    // No source, just unwrap the img from picture
                    picture.replaceWith(img);
                }
            });
        } // End hasProxiedImages check

        // 2. Handle images with various data-* lazy loading attributes
        doc.querySelectorAll('img').forEach(img => {
            const currentSrc = img.getAttribute('src') || '';

            // Check various lazy-loading attribute patterns
            const lazySrcAttrs = [
                'data-src', 'data-lazy-src', 'data-original', 'data-image',
                'data-src-medium', 'data-src-large', 'data-full-src',
                'data-hi-res-src', 'data-srcset'
            ];

            let newSrc = '';
            for (const attr of lazySrcAttrs) {
                const value = img.getAttribute(attr);
                if (value && value.startsWith('http')) {
                    newSrc = value;
                    break;
                }
            }

            // Check if current src is a placeholder or missing
            const isPlaceholder = !currentSrc ||
                currentSrc.length < 10 ||
                currentSrc.includes('placeholder') ||
                currentSrc.includes('image-placeholders') ||
                currentSrc.includes('lazy') ||
                currentSrc.includes('loading') ||
                currentSrc.includes('blank') ||
                currentSrc.includes('data:image/gif') ||
                currentSrc.includes('data:image/svg') ||
                currentSrc.includes('1x1') ||
                currentSrc.includes('pixel');

            if (newSrc && isPlaceholder) {
                console.log('[processLazyImages] Converting data-src to src:', newSrc.substring(0, 80));
                img.setAttribute('src', newSrc);
            }

            // Also check srcset if src is missing
            if (isPlaceholder && !newSrc) {
                const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
                if (srcset) {
                    // Parse srcset and get a good image
                    const srcsetParts = srcset.split(',').map(s => s.trim());
                    let bestUrl = '';
                    let bestSize = 0;

                    for (const part of srcsetParts) {
                        const match = part.match(/^(.+?)\s+(\d+)(w|x)?$/);
                        if (match) {
                            const url = match[1];
                            const size = parseInt(match[2]);
                            if (size > bestSize || !bestUrl) {
                                bestSize = size;
                                bestUrl = url;
                            }
                        } else if (!bestUrl) {
                            bestUrl = part;
                        }
                    }

                    if (bestUrl) {
                        console.log('[processLazyImages] Using srcset for src:', bestUrl.substring(0, 80));
                        img.setAttribute('src', bestUrl);
                    }
                }
            }
        });

        // 3. Handle noscript images (many sites put real images in noscript for SEO)
        doc.querySelectorAll('noscript').forEach(noscript => {
            const content = noscript.textContent || '';
            const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
            if (imgMatch) {
                // Check if there's a placeholder img before this noscript
                const prevSibling = noscript.previousElementSibling;
                if (prevSibling?.tagName === 'IMG') {
                    const prevSrc = prevSibling.getAttribute('src') || '';
                    if (prevSrc.includes('placeholder') || prevSrc.includes('data:')) {
                        // Replace placeholder with real image
                        (prevSibling as HTMLImageElement).setAttribute('src', imgMatch[1]);
                        console.log('[processLazyImages] Replaced placeholder from noscript:', imgMatch[1].substring(0, 80));
                        noscript.remove();
                    }
                }
            }
        });

        // 4. Remove promotional/navigation elements (VIDEO banners, etc.)
        doc.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || '';
            const alt = img.getAttribute('alt') || '';
            // Remove VIDEO overlay icons and promotional banners
            if (src.includes('video-overlay') ||
                src.includes('icon-gn-video') ||
                alt.toUpperCase() === 'VIDEO') {
                const parent = img.parentElement;
                if (parent) {
                    parent.remove();
                } else {
                    img.remove();
                }
            }
        });

        // 5. Remove NYT-specific "Image" text labels/placeholders
        // NYT shows "Image" as text when the actual image can't load
        doc.querySelectorAll('span, div, p').forEach(el => {
            const text = el.textContent?.trim() || '';
            // Remove elements that just say "Image" (NYT placeholder)
            if (text === 'Image' || text === 'image') {
                // Check if this is likely an image label, not article content
                // It should be short and possibly inside a figure
                const parent = el.parentElement;
                const isInFigure = parent?.tagName === 'FIGURE' ||
                    parent?.parentElement?.tagName === 'FIGURE' ||
                    parent?.classList.contains('image') ||
                    el.classList.contains('visually-hidden') ||
                    el.getAttribute('role') === 'img';
                if (isInFigure || el.classList.length > 0) {
                    console.log('[processLazyImages] Removing NYT "Image" placeholder');
                    el.remove();
                }
            }
        });

        // 6. Handle NYT figure elements that might have role="img" but no actual img
        doc.querySelectorAll('figure, [role="img"]').forEach(el => {
            // Check if there's an actual img inside
            const hasImg = el.querySelector('img[src]');
            const hasValidImg = hasImg && hasImg.getAttribute('src')?.startsWith('http');

            // If no valid image but has "Image" text, it's a broken placeholder
            if (!hasValidImg) {
                const textContent = el.textContent?.trim() || '';
                if (textContent.startsWith('Image') && textContent.length < 20) {
                    console.log('[processLazyImages] Removing broken NYT figure');
                    el.remove();
                }
            }
        });

        // 7. Remove other promotional elements by text content
        doc.querySelectorAll('h2, h3, h4, p, span').forEach(el => {
            const text = el.textContent?.trim() || '';
            if (text.length < 100) {
                if (text === 'I migliori video scelti dal nostro canale' ||
                    text === 'VIDEO' ||
                    text === 'FC Inter 1908') {
                    el.remove();
                }
            }
        });

        return doc.body.innerHTML;
    };

    const processedContent = processLazyImages(contentToDisplay);

    const sanitizedContent = processedContent
        ? DOMPurify.sanitize(processedContent, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'div', 'span', 'figure', 'figcaption'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'class', 'srcset', 'sizes'],
        })
        : '';

    return (
        <div className={`article-view ${viewMode}-mode`} data-platform={isAndroid() ? 'android' : 'desktop'}>
            <div className="article-view-container">
                <div className="article-view-header" key={feedTitle || 'no-title'}>
                    {feedTitle && (
                        <div className="publication-title" style={getPublicationStyle(feedTitle, settings.theme)}>
                            {feed?.icon && (
                                <img
                                    src={feed.icon}
                                    alt=""
                                    className="publication-icon"
                                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                />
                            )}
                            {feedTitle}
                        </div>
                    )}
                    <FocusTimerWidget onClick={() => setShowFocusMode(true)} />
                    <div className="header-actions">
                        <button className="close-btn" onClick={onClose} data-tooltip="Close">
                            <X size={20} />
                        </button>


                        <button
                            className="action-btn delete-btn"
                            onClick={() => onDelete(article.id)}
                            data-tooltip="Delete Article"
                        >
                            <Trash2 size={18} />
                        </button>
                        {onToggleSaved && (
                            <button
                                className={`action-btn ${article.isSaved ? 'active' : ''}`}
                                onClick={() => onToggleSaved(article.id)}
                                data-tooltip={article.isSaved ? "Remove from Saved" : "Save Article"}
                            >
                                <Star size={18} fill={article.isSaved ? 'currentColor' : 'none'} />
                            </button>
                        )}
                        <button
                            className="action-btn"
                            onClick={() => {
                                const newMode = viewMode === 'reader' ? 'browser' : 'reader';
                                setViewMode(newMode);
                                // Reset to original article URL when switching to browser mode
                                // BUT only if we're not coming from a chat link navigation
                                if (newMode === 'browser' && article && !isNavigatingFromChat.current) {
                                    setWebviewUrl(article.link);
                                }
                                // Clear the flag when switching to reader mode
                                if (newMode === 'reader') {
                                    isNavigatingFromChat.current = false;
                                }
                            }}
                            data-tooltip={viewMode === 'reader' ? "View Original" : "Reader View"}
                        >
                            {viewMode === 'reader' ? <Globe size={18} /> : <BookOpen size={18} />}
                        </button>
                        <button
                            className={`ai-summary-btn icon-only ${isSummarizing ? 'loading' : ''} ${summary ? 'active' : ''}`}
                            onClick={() => handleSummarize(false)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setSummaryMode(summaryMode === 'popup' ? 'inline' : 'popup');
                            }}
                            disabled={isSummarizing}
                            data-tooltip={`Summarize with AI (${summaryMode === 'popup' ? 'Popup' : 'Inline'}) - Right-click to toggle`}
                            data-tooltip-align="right"
                        >
                            {isSummarizing ? <Loader size={18} className="spin" /> : <Brain size={18} />}
                        </button>
                        <button
                            className={`action-btn ${showChat ? 'active' : ''}`}
                            onClick={() => setShowChat(!showChat)}
                            data-tooltip="Chat about article"
                            data-tooltip-align="right"
                        >
                            <MessageCircle size={18} />
                        </button>
                        <button
                            className={`action-btn ${showFocusMode ? 'active' : ''}`}
                            onClick={() => setShowFocusMode(!showFocusMode)}
                            data-tooltip="Focus Mode"
                            data-tooltip-align="right"
                        >
                            <Timer size={18} />
                        </button>
                        <button
                            className="action-btn"
                            onClick={() => setShowSpeedReader(true)}
                            data-tooltip="Speed Read"
                            data-tooltip-align="right"
                        >
                            <Zap size={18} />
                        </button>
                        <button
                            className="action-btn"
                            onClick={() => setShowShareCard(true)}
                            data-tooltip="Share"
                            data-tooltip-align="right"
                        >
                            <Share2 size={18} />
                        </button>
                        <button
                            className="action-btn"
                            onClick={() => setShowStoryComparison(true)}
                            data-tooltip="Compare Sources"
                            data-tooltip-align="right"
                        >
                            <Layers size={18} />
                        </button>
                        <button
                            className="action-btn"
                            onClick={() => setShowFactCheck(true)}
                            data-tooltip="Fact Check"
                            data-tooltip-align="right"
                        >
                            <Shield size={18} />
                        </button>
                        <button
                            className="action-btn"
                            onClick={() => setShowAIPodcast(true)}
                            data-tooltip="AI Podcast"
                            data-tooltip-align="right"
                        >
                            <Mic size={18} />
                        </button>
                        <button
                            className="action-btn"
                            onClick={handleDebug}
                            data-tooltip="Debug Article"
                            data-tooltip-align="right"
                            style={{ display: article?.link.includes('fcinter1908.it') || article?.link.includes('gazzetta.it') ? 'flex' : 'none', color: 'orange' }}
                        >
                            <Bug size={18} />
                        </button>
                        {/* Login button - always rendered for consistent layout, hidden when not in browser mode */}
                        <button
                            className="action-btn"
                            onClick={handleLogin}
                            data-tooltip="Login to this site"
                            data-tooltip-align="right"
                            style={{ visibility: viewMode === 'browser' ? 'visible' : 'hidden' }}
                        >
                            <LogIn size={18} />
                        </button>
                    </div>
                </div>

                {/* Inline summary panel - only shown in inline mode */}
                {summaryMode === 'inline' && summary && showInlineSummary && (
                    <div className="summary-pane inline">
                        <div className="summary-pane-header">
                            <div className="summary-pane-title">
                                <Brain size={18} />
                                <h3>AI Summary</h3>
                            </div>
                            <button
                                className="action-btn"
                                onClick={() => setShowInlineSummary(false)}
                                data-tooltip="Close Summary"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="summary-pane-content">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
                                }}
                            >
                                {summary}
                            </ReactMarkdown>
                        </div>
                    </div>
                )}

                {summaryError && (
                    <div className="summary-pane error">
                        <div className="summary-pane-content">
                            {summaryError}
                        </div>
                    </div>
                )}


                <div className="article-view-content">
                    {viewMode === 'reader' ? (
                        <div className="reader-view" style={publicationStyle}>
                            <h1 className="article-view-title">{cleanTitle(article.title)}</h1>
                            {(article.creator || article.pubDate) && (
                                <div className="article-view-meta">
                                    {article.creator && <span>By {article.creator}</span>}
                                    {article.creator && article.pubDate && <span> • </span>}
                                    {article.pubDate && (
                                        <span>{new Date(article.pubDate).toLocaleString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}</span>
                                    )}
                                </div>
                            )}

                            <div className="title-divider"></div>

                            {/* Podcast Player - show if article has audio/video enclosure */}
                            {article.enclosure && article.mediaType && article.mediaType !== 'article' && (
                                article.enclosure.type === 'text/html' ? (
                                    <div className="podcast-player external-link">
                                        <div className="audio-artwork">
                                            {article.image ? (
                                                <img src={article.image} alt={article.title} />
                                            ) : (
                                                <div className="artwork-placeholder">
                                                    <Volume2 size={48} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="player-controls">
                                            <div className="player-info">
                                                <h4 className="player-title">{article.title}</h4>
                                                <div className="player-time">External Podcast</div>
                                            </div>
                                            <button
                                                className="play-btn"
                                                onClick={() => openExternalUrl(article.enclosure!.url)}
                                                title="Open Podcast Website"
                                                style={{ width: 'auto', padding: '0 20px', borderRadius: '20px', fontSize: '14px' }}
                                            >
                                                <Play size={16} style={{ marginRight: '8px' }} />
                                                Listen on Website
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <PodcastPlayer
                                        url={article.enclosure.url}
                                        type={article.mediaType}
                                        title={article.title}
                                        duration={article.duration}
                                        artwork={article.image}
                                        articleId={article.id}
                                    />
                                )
                            )}

                            {/* Reddit Video Embed - for YouTube links and Reddit-hosted videos */}
                            {redditVideo && redditVideo.type === 'youtube' && redditVideo.videoId && (
                                <div className="reddit-video-embed" style={{ marginBottom: '20px' }}>
                                    {/* Show thumbnail with play button - clicking opens popup/external */}
                                    <div
                                        onClick={() => {
                                            if (isElectron() && (window as any).ipcRenderer) {
                                                // Open in popup window (full browser context)
                                                (window as any).ipcRenderer.invoke('open-youtube-popup', redditVideo.videoId);
                                            } else {
                                                openExternalUrl(`https://www.youtube.com/watch?v=${redditVideo.videoId}`);
                                            }
                                        }}
                                        style={{
                                            position: 'relative',
                                            width: '100%',
                                            aspectRatio: '16/9',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            cursor: 'pointer',
                                            background: '#000'
                                        }}
                                    >
                                        <img
                                            src={`https://img.youtube.com/vi/${redditVideo.videoId}/maxresdefault.jpg`}
                                            alt="Video thumbnail"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${redditVideo.videoId}/hqdefault.jpg`; }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            width: '80px',
                                            height: '56px',
                                            background: 'rgba(255, 0, 0, 0.9)',
                                            borderRadius: '14px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                            transition: 'transform 0.2s'
                                        }}>
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
                                                <path d="M8 5v14l11-7z" />
                                            </svg>
                                        </div>
                                        <div style={{
                                            position: 'absolute',
                                            bottom: '12px',
                                            left: '12px',
                                            background: 'rgba(0,0,0,0.8)',
                                            color: 'white',
                                            padding: '8px 14px',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: 600
                                        }}>
                                            ▶ Click to Play Video
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Reddit-hosted video */}
                            {redditVideo && redditVideo.type === 'reddit' && redditVideo.videoUrl && (
                                <div className="reddit-video-embed" style={{ marginBottom: '20px' }}>
                                    <video
                                        controls
                                        style={{
                                            width: '100%',
                                            maxHeight: '500px',
                                            borderRadius: '12px'
                                        }}
                                    >
                                        <source src={redditVideo.videoUrl} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                </div>
                            )}

                            {isFetchingContent ? (
                                <div className="loading-content">
                                    <Loader className="spin" size={24} />
                                    <p>Loading article content...</p>
                                </div>
                            ) : sanitizedContent ? (
                                <>
                                    {/* Featured image for articles that have media:content but no inline images */}
                                    {article.image &&
                                        article.mediaType !== 'audio' &&
                                        article.mediaType !== 'video' &&
                                        !sanitizedContent.includes('<img') && (
                                            <div className="article-featured-image">
                                                <img
                                                    src={article.image}
                                                    alt={article.title}
                                                    onClick={() => article.image && setViewerImage(article.image)}
                                                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                                    style={{ cursor: 'zoom-in' }}
                                                />
                                            </div>
                                        )}
                                    <div
                                        className="article-content"
                                        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                                        onClick={(e) => {
                                            const target = e.target as HTMLElement;
                                            // Intercept image clicks in article content
                                            if (target.tagName === 'IMG') {
                                                e.preventDefault();
                                                const src = (target as HTMLImageElement).src;
                                                if (src) {
                                                    setViewerImage(src);
                                                }
                                                return;
                                            }
                                            // Intercept link clicks in article content
                                            if (target.tagName === 'A') {
                                                e.preventDefault();
                                                const href = (target as HTMLAnchorElement).href;

                                                // If it's the article's own link or a "read more" link, switch to browser view
                                                if (href && (href === article.link || href.includes(new URL(article.link).hostname))) {
                                                    setViewMode('browser');
                                                    setWebviewUrl(href);
                                                } else {
                                                    // External link - open in system browser
                                                    openExternalUrl(href);
                                                }
                                            }
                                        }}
                                    />
                                </>
                            ) : (
                                <p className="no-content">No content available. Try Web View.</p>
                            )}

                            {/* Related Articles Panel (Deep Diver) */}
                            {personalityConfig.showRelatedArticles && relatedArticles.length > 0 && (
                                <div className="related-articles-panel">
                                    <h4>🔗 Related Articles</h4>
                                    {relatedArticles.map((related, index) => (
                                        <div
                                            key={related.id}
                                            className="related-article-item"
                                            onClick={() => {
                                                // Navigate to the related article
                                                if (onSelectArticle) {
                                                    onSelectArticle(related);
                                                    // Scroll to top
                                                    const contentContainer = document.querySelector('.article-view-content');
                                                    if (contentContainer) {
                                                        contentContainer.scrollTop = 0;
                                                    }
                                                }
                                            }}
                                        >
                                            <span className="related-article-number">{index + 1}</span>
                                            <div className="related-article-content">
                                                <div className="related-article-title">
                                                    {cleanTitle(related.title)}
                                                </div>
                                                {related.contentSnippet && (
                                                    <div className="related-article-snippet">
                                                        {related.contentSnippet.slice(0, 100)}...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Reddit Comments Integration */}
                            {viewMode === 'reader' && article && (article.link.includes('reddit.com') || (feed && feed.url.includes('reddit.com'))) && (
                                <RedditComments articleUrl={article.link} />
                            )}

                            {/* Back to Top Button */}
                            <div className="back-to-top-container" style={{
                                display: 'flex',
                                justifyContent: 'center',
                                padding: '40px 0 20px 0',
                                marginTop: '20px',
                                borderTop: '1px solid var(--border-color)',
                                width: '100%'
                            }}>
                                <button
                                    onClick={() => {
                                        // Try scrolling content container (Sidebar Layout)
                                        const contentContainer = document.querySelector('.article-view-content');
                                        if (contentContainer) {
                                            contentContainer.scrollTo({ top: 0, behavior: 'smooth' });
                                        }

                                        // Try scrolling modern layout container (Modern Layout)
                                        const modernContainer = document.querySelector('.modern-content');
                                        if (modernContainer) {
                                            modernContainer.scrollTo({ top: 0, behavior: 'smooth' });
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '12px 24px',
                                        borderRadius: '24px',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border-color)',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                >
                                    <ArrowUp size={18} />
                                    Back to Top
                                </button>
                            </div>
                        </div>
                    ) : isElectron() ? (
                        // @ts-ignore - Webview tag is not standard React
                        <webview
                            key={webviewUrl}
                            ref={webviewRef}
                            src={webviewUrl}
                            className="webview"
                            allowpopups={true}
                            webpreferences="nativeWindowOpen=yes, contextIsolation=no, nodeIntegration=no, sandbox=no"
                        // useragent is optional, electron uses default if omitted which is usually fine, or we can append
                        // But for safety let's leave it default to match the OS
                        />
                    ) : Capacitor.isNativePlatform() ? (
                        <div className="webview-placeholder" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            gap: '16px',
                            padding: '20px',
                            textAlign: 'center',
                            color: 'var(--text-secondary)'
                        }}>
                            <Globe size={48} style={{ opacity: 0.5 }} />
                            <p>External websites cannot be embedded in this view on mobile to protect your security and ensure compatibility.</p>
                            <button
                                onClick={() => Browser.open({ url: webviewUrl, presentationStyle: 'popover' })}
                                style={{
                                    padding: '10px 20px',
                                    background: 'var(--accent-primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Globe size={16} />
                                Open in Browser
                            </button>
                        </div>
                    ) : (
                        <iframe
                            key={webviewUrl}
                            src={webviewUrl}
                            className="webview"
                            title="Article Content"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        />
                    )}
                </div>
            </div>

            {
                showChat && article && (
                    <Chat
                        article={article}
                        settings={settings}
                        onClose={() => setShowChat(false)}
                        onNavigateToUrl={handleNavigateToUrl}
                    />
                )
            }

            {/* Image Viewer Modal */}
            {viewerImage && (
                <div
                    className="image-viewer-overlay"
                    onClick={() => setViewerImage(null)}
                >
                    <button
                        className="image-viewer-close"
                        onClick={() => setViewerImage(null)}
                        aria-label="Close image viewer"
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={viewerImage}
                        alt="Full size"
                        className="image-viewer-img"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Focus Mode Overlay */}
            {showFocusMode && (
                <FocusMode
                    onClose={() => setShowFocusMode(false)}
                    articleTitle={article?.title}
                />
            )}

            {/* Speed Reader Overlay */}
            {showSpeedReader && (
                <SpeedReader
                    content={fetchedContent || article?.content || article?.contentSnippet || ''}
                    onClose={() => setShowSpeedReader(false)}
                />
            )}

            {/* Share Card Modal */}
            {showShareCard && article && (
                <ShareCard
                    article={article}
                    feedTitle={feedTitle}
                    onClose={() => setShowShareCard(false)}
                />
            )}

            {/* Story Comparison Modal */}
            {showStoryComparison && article && (
                <StoryComparison
                    article={article}
                    allArticles={allArticles}
                    feeds={feeds}
                    onSelectArticle={(a) => {
                        setShowStoryComparison(false);
                        onSelectArticle?.(a);
                    }}
                    onClose={() => setShowStoryComparison(false)}
                />
            )}

            {/* Fact Check Modal */}
            {showFactCheck && article && (
                <FactCheck
                    articleId={article.id}
                    title={article.title}
                    content={fetchedContent || article.content || article.contentSnippet || ''}
                    settings={settings}
                    onClose={() => setShowFactCheck(false)}
                />
            )}

            {/* AI Podcast Modal */}
            {showAIPodcast && article && (
                <AIPodcast
                    articleTitle={article.title}
                    articleContent={fetchedContent || article.content || article.contentSnippet || ''}
                    settings={settings}
                    onClose={() => setShowAIPodcast(false)}
                />
            )}
        </div >
    );
}
