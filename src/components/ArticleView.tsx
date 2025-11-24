import { useState, useEffect, useRef } from 'react';
import { Loader, LogIn, Newspaper, X, Trash2, Globe, BookOpen, Brain, MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { Article, AppSettings } from '../types';
import { summarizeArticle } from '../summaryService';
import Chat from './Chat';
import PodcastPlayer from './PodcastPlayer';
import './ArticleView.css';

interface ArticleViewProps {
    article: Article | null;
    settings: AppSettings;
    onClose: () => void;
    onDelete: (articleId: string) => void;
}

export default function ArticleView({ article, settings, onClose, onDelete }: ArticleViewProps) {
    const [viewMode, setViewMode] = useState<'reader' | 'browser'>('reader');
    const [summary, setSummary] = useState<string | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [currentArticleId, setCurrentArticleId] = useState<string | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [summaryMode, setSummaryMode] = useState<'popup' | 'inline'>('popup'); // Default to popup
    const [showInlineSummary, setShowInlineSummary] = useState(false);
    const webviewRef = useRef<any>(null);
    const [webviewUrl, setWebviewUrl] = useState<string>('');
    const isNavigatingFromChat = useRef(false);

    // Reset summary when article changes
    useEffect(() => {
        if (article && article.id !== currentArticleId) {
            setSummary(null);
            setSummaryError(null);
            setCurrentArticleId(article.id);
            setWebviewUrl(article.link); // Set webview URL to article link
        }
    }, [article?.id]);

    // Initialize webviewUrl when component mounts with an article
    useEffect(() => {
        if (article && !webviewUrl) {
            setWebviewUrl(article.link);
        }
    }, [article]);


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
                            theme: settings.theme
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
                            theme: settings.theme
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

    const sanitizedContent = article.content
        ? DOMPurify.sanitize(article.content, {
            ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre'],
            ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target'],
        })
        : '';

    return (
        <div className="article-view">
            <div className="article-view-container">
                <div className="article-view-header">
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
                        >
                            {isSummarizing ? <Loader size={18} className="spin" /> : <Brain size={18} />}
                        </button>
                        <button
                            className={`action-btn ${showChat ? 'active' : ''}`}
                            onClick={() => setShowChat(!showChat)}
                            data-tooltip="Chat about article"
                        >
                            <MessageCircle size={18} />
                        </button>
                        {viewMode === 'browser' && (
                            <button
                                className="action-btn"
                                onClick={handleLogin}
                                data-tooltip="Login to this site"
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
                        <div className="reader-view">
                            <h1 className="article-view-title">{article.title}</h1>
                            {article.creator && (
                                <div className="article-view-meta">
                                    <span>By {article.creator}</span>
                                    {article.pubDate && (
                                        <span> • {article.pubDate.toLocaleDateString()}</span>
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

                            {sanitizedContent ? (
                                <div
                                    className="article-content"
                                    dangerouslySetInnerHTML={{ __html: sanitizedContent }}
                                />
                            ) : (
                                <p className="no-content">No content available. Try Web View.</p>
                            )}
                        </div>
                    ) : (
                        <webview
                            key={webviewUrl}
                            ref={webviewRef}
                            src={webviewUrl}
                            className="webview"
                            allowpopups
                            webpreferences="nativeWindowOpen=yes, contextIsolation=no"
                            useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                        />
                    )}
                </div>
            </div>

            {showChat && article && (
                <Chat
                    article={article}
                    settings={settings}
                    onClose={() => setShowChat(false)}
                    onNavigateToUrl={handleNavigateToUrl}
                />
            )}
        </div>
    );
}
