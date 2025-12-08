import { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Loader, LogIn, Newspaper, X, Trash2, Globe, BookOpen, Brain, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Article, AppSettings, Feed } from '../types';
import { summarizeArticle } from '../summaryService';
import Chat from './Chat';
import PodcastPlayer from './PodcastPlayer';
import { openExternalUrl, isElectron } from '../utils/platform';
import { getPublicationColors, applyPublicationColors } from '../utils/publicationColors';
import RedditComments from './RedditComments';
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
    settings: AppSettings;
    onClose: () => void;
    onDelete: (articleId: string) => void;
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
        maxWidth: '400px',
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

export default function ArticleView({ article, feed, settings, onClose, onDelete }: ArticleViewProps) {
    const feedTitle = feed?.title || article?.feedTitle;
    console.log('ArticleView render:', {
        articleId: article?.id,
        feedId: article?.feedId,
        feedProp: feed,
        feedTitleProp: feed?.title,
        articleFeedTitle: article?.feedTitle,
        finalFeedTitle: feedTitle
    });

    const [viewMode, setViewMode] = useState<'reader' | 'browser'>('reader');
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [currentArticleId, setCurrentArticleId] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [summaryMode, setSummaryMode] = useState<'popup' | 'inline'>(
        Capacitor.isNativePlatform() ? 'inline' : 'popup' // Inline on mobile, popup on desktop
    );
    const [showInlineSummary, setShowInlineSummary] = useState(false);
    const [fetchedContent, setFetchedContent] = useState<string | null>(null);
    const [isFetchingContent, setIsFetchingContent] = useState(false);
    const webviewRef = useRef<any>(null);
    const [webviewUrl, setWebviewUrl] = useState<string>('');
    const isNavigatingFromChat = useRef(false);

    // Reddit video embed state - store video info for proper rendering
    const [redditVideo, setRedditVideo] = useState<{
        type: 'youtube' | 'reddit';
        videoId?: string;
        videoUrl?: string;
    } | null>(null);



    // Reset summary when article changes
    useEffect(() => {
        if (article && article.id !== currentArticleId) {
            setSummary(null);
            setSummaryError(null);
            setCurrentArticleId(article.id);
            setWebviewUrl(article.link); // Set webview URL to article link
            setFetchedContent(null); // Reset fetched content
            setRedditVideo(null); // Reset Reddit video
        }
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

                console.log('Content analysis:', {
                    contentLength,
                    textLength,
                    paragraphCount,
                    hasTrackingPixel,
                    isNPR,
                    isOMGUbuntu,
                    feedTitle: article.feedTitle,
                    domain: new URL(article.link).hostname
                });

                // Consider it a snippet if:
                // - Text content is less than 300 characters, OR
                // - Has tracking pixel and only 1-2 paragraphs (typical NPR snippet), OR
                // - Is NPR article with less than 3 paragraphs (NPR typically provides snippets), OR
                // - Is OMG! Ubuntu article (they always provide snippets with "You're reading" footer), OR
                // - Content is less than 800 characters total
                isSnippet = textLength < 300 ||
                    (hasTrackingPixel && paragraphCount <= 2) ||
                    (isNPR && paragraphCount <= 3) ||
                    isOMGUbuntu ||
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
                const ipcRenderer = (window as any).ipcRenderer;
                if (!ipcRenderer) {
                    console.warn('IPC not available, cannot fetch content');
                    setIsFetchingContent(false);
                    return;
                }

                const result = await ipcRenderer.invoke('fetch-url', article.link);
                if (result.success) {
                    // Parse HTML and extract readable content
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(result.content, 'text/html');

                    // Remove unwanted elements
                    doc.querySelectorAll('script, style, nav, header, footer, aside, iframe, .ad, .advertisement, .social-share, .newsletter-signup, .related-stories, .ad-wrap, .ad-config-wrap').forEach(el => el.remove());

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
                        // Generic selectors for other sites
                        contentElement =
                            doc.querySelector('.story-body') ||
                            doc.querySelector('article') ||
                            doc.querySelector('[role="main"]') ||
                            doc.querySelector('main') ||
                            doc.querySelector('.article-body') ||
                            doc.querySelector('.post-content') ||
                            doc.querySelector('.entry-content') ||
                            doc.querySelector('.content') ||
                            doc.body;
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

                        // Get HTML content
                        const extractedContent = contentElement.innerHTML;
                        console.log('Successfully extracted content, length:', extractedContent.length);

                        // Debug: Show image-related HTML
                        const imgMatches = extractedContent.match(/<img[^>]*>/g) || [];
                        console.log('[DEBUG] Found images in fetched content:', imgMatches.length);
                        imgMatches.slice(0, 5).forEach((match, i) => {
                            console.log(`[DEBUG] Image ${i}:`, match.substring(0, 200));
                        });

                        setFetchedContent(extractedContent);
                    } else {
                        console.warn('Could not find main content element');
                    }
                } else {
                    console.error('Failed to fetch article content:', result.error);
                    // If it's a 403, it means the site is blocking automated access
                    if (result.error && result.error.includes('403')) {
                        setFetchedContent('<div style="padding: 20px; text-align: center; color: var(--text-muted);"><p style="font-size: 1.1em; margin-bottom: 12px;">⚠️ Unable to load article content</p><p>This publisher blocks automated content fetching. Please switch to <strong>Browser View</strong> to read this article.</p></div>');
                    }
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

        return () => {
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
                    <Newspaper size={48} />
                    <h2>Select an article to read</h2>
                </div>
            </div>
        );
    }

    // Get publication colors if enabled
    const publicationColors = settings.usePublicationColors
        ? getPublicationColors(feedTitle, article.link)
        : null;

    // Check if we're in dark mode
    const isDarkMode = settings.theme === 'dark' || settings.theme === 'black' ||
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

        doc.querySelectorAll('img').forEach(img => {
            const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            const currentSrc = img.getAttribute('src') || '';

            // If there's a data-src and current src looks like a placeholder
            if (dataSrc && (
                currentSrc.includes('placeholder') ||
                currentSrc.includes('image-placeholders') ||
                currentSrc.includes('lazy') ||
                currentSrc.includes('loading') ||
                currentSrc.includes('blank') ||
                currentSrc.length < 10 ||
                !currentSrc
            )) {
                console.log('[processLazyImages] Converting data-src to src:', dataSrc.substring(0, 80));
                img.setAttribute('src', dataSrc);
            }
        });

        // Remove promotional/navigation elements
        // Remove VIDEO banners and related video sections
        doc.querySelectorAll('img').forEach(img => {
            const src = img.getAttribute('src') || '';
            const alt = img.getAttribute('alt') || '';
            // Remove VIDEO overlay icons and promotional banners
            if (src.includes('video-overlay') ||
                src.includes('icon-gn-video') ||
                alt.toUpperCase() === 'VIDEO') {
                // Remove the image and its container
                const parent = img.parentElement;
                if (parent) {
                    parent.remove();
                } else {
                    img.remove();
                }
            }
        });

        // Remove elements by text content (promotional sections)
        // Be very careful - only remove small elements with exact matches
        doc.querySelectorAll('h2, h3, h4, p, span').forEach(el => {
            const text = el.textContent?.trim() || '';
            // Only check small elements (to avoid removing article content)
            if (text.length < 100) {
                // Remove exact matches for promotional text
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
        <div className="article-view">
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
                        {viewMode === 'browser' && (
                            <button
                                className="action-btn"
                                onClick={handleLogin}
                                data-tooltip="Login to this site"
                                data-tooltip-align="right"
                            >
                                <LogIn size={18} />
                            </button>
                        )}
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
                                <PodcastPlayer
                                    url={article.enclosure.url}
                                    type={article.mediaType}
                                    title={article.title}
                                    duration={article.duration}
                                    artwork={article.image}
                                />
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
                                <div
                                    className="article-content"
                                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                                    onClick={(e) => {
                                        // Intercept link clicks in article content
                                        const target = e.target as HTMLElement;
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
                            ) : (
                                <p className="no-content">No content available. Try Web View.</p>
                            )}

                            {/* Reddit Comments Integration */}
                            {viewMode === 'reader' && article && (article.link.includes('reddit.com') || (feed && feed.url.includes('reddit.com'))) && (
                                <RedditComments articleUrl={article.link} />
                            )}
                        </div>
                    ) : isElectron() ? (
                        <webview
                            key={webviewUrl}
                            ref={webviewRef}
                            src={webviewUrl}
                            className="webview"
                            allowpopups
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
        </div >
    );
}
