import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { Headphones, Video, ChevronLeft, Share2, Copy, Trash2, Globe, CheckCircle, Circle, Star, Eye, EyeOff } from 'lucide-react';
import { Article, AppSettings } from '../types';
import { generateHashtags } from '../summaryService';
import { usePersonalityConfig } from '../hooks/usePersonality';
import { generateInlineSummary, calculateImportanceScore, shuffleArray, getPlayfulMicrocopy } from '../personalityUtils';
import { PersonalityConfig } from '../personalityConfig';
import './ArticleList.css';
import '../components/Personality.css';

// Helper to strip HTML tags and decode entities from titles
const cleanTitle = (title: string): string => {
    if (!title) return '';
    // Create temp element to decode HTML entities and strip tags
    const temp = document.createElement('div');
    temp.innerHTML = title;
    return temp.textContent || temp.innerText || title;
};

interface ArticleItemProps {
    article: Article;
    isSelected: boolean;
    isMultiSelected: boolean;
    onSelect: (article: Article, ctrlKey: boolean) => void;
    onContextMenu: (e: React.MouseEvent, article: Article) => void;
    onToggleSaved?: (articleId: string) => void;
    settings: AppSettings;
    personalityConfig: PersonalityConfig;
    allowInlineSummary: boolean;
}

const ArticleItem = memo(({ article, isSelected, isMultiSelected, onSelect, onContextMenu, onToggleSaved, settings, personalityConfig, allowInlineSummary }: ArticleItemProps) => {
    const [inlineSummary, setInlineSummary] = useState<string>('');
    const [importanceScore, setImportanceScore] = useState<number>(50);
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);

    // Intersection Observer to detect visibility
    useEffect(() => {
        // Only setup observer if we actually need to generate a summary
        if (!personalityConfig.showInlineSummary || !allowInlineSummary || inlineSummary) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect(); // Once visible, we trigger load and stop observing
                }
            },
            { rootMargin: '50px' } // Load slightly before it comes into view
        );

        if (itemRef.current) {
            observer.observe(itemRef.current);
        }

        return () => observer.disconnect();
    }, [personalityConfig.showInlineSummary, allowInlineSummary, inlineSummary]);

    // Generate inline summary for Conversational Curator
    useEffect(() => {
        if (personalityConfig.showInlineSummary && allowInlineSummary && isVisible && !inlineSummary) {
            // Check if API key is configured
            const hasApiKey = settings.geminiApiKey || settings.openaiApiKey || settings.claudeApiKey;
            if (!hasApiKey) {
                console.warn('Inline summaries require an AI API key to be configured in Settings → AI');
                return;
            }

            setLoadingSummary(true);
            generateInlineSummary(article, settings, personalityConfig.maxSummaryLines || 3)
                .then(summary => {
                    setInlineSummary(summary);
                    setLoadingSummary(false);
                })
                .catch((error) => {
                    console.error('Failed to generate inline summary:', error);
                    setLoadingSummary(false);
                    // Fallback to snippet
                    if (article.contentSnippet) {
                        setInlineSummary(article.contentSnippet.slice(0, 240) + '...');
                    }
                });
        }
    }, [article.id, personalityConfig.showInlineSummary, allowInlineSummary, isVisible, settings.geminiApiKey, settings.openaiApiKey, settings.claudeApiKey, inlineSummary, article.contentSnippet]);

    // Calculate importance score for Daily Brief
    useEffect(() => {
        if (personalityConfig.showImportanceScore) {
            calculateImportanceScore(article).then(setImportanceScore);
        }
    }, [article.id, personalityConfig.showImportanceScore, article]);

    const getImportanceLevel = (score: number): 'high' | 'medium' | 'low' => {
        if (score > 70) return 'high';
        if (score > 40) return 'medium';
        return 'low';
    };

    const getImportanceIcon = (level: string): string => {
        switch (level) {
            case 'high': return '🔥';
            case 'medium': return '⭐';
            default: return '📄';
        }
    };

    return (
        <div
            ref={itemRef}
            className={`article-item ${isSelected ? 'active' : ''} ${isMultiSelected ? 'multi-selected' : ''} ${!article.isRead ? 'unread' : ''}`}
            onClick={(e) => onSelect(article, e.ctrlKey || e.metaKey)}
            onContextMenu={(e) => onContextMenu(e, article)}
        >
            {!article.isRead && <div className="unread-marker"></div>}
            {isMultiSelected && <div className="multi-select-marker">✓</div>}

            <h4 className="article-title">
                {article.mediaType === 'audio' && (
                    <span className="media-badge audio" title="Audio Podcast">
                        <Headphones size={14} />
                    </span>
                )}
                {article.mediaType === 'video' && (
                    <span className="media-badge video" title="Video Podcast">
                        <Video size={14} />
                    </span>
                )}
                {article.isSaved && (
                    <span className="saved-badge" title="Saved">
                        <Star size={14} fill="currentColor" />
                    </span>
                )}
                {cleanTitle(article.title)}

                {/* Importance Badge (Daily Brief) */}
                {personalityConfig.showImportanceScore && (
                    <span className={`article-importance-badge ${getImportanceLevel(importanceScore)}`}>
                        {getImportanceIcon(getImportanceLevel(importanceScore))} {Math.round(importanceScore)}
                    </span>
                )}
            </h4>

            <div className="article-meta">
                {article.creator && (
                    <span className="article-creator">{article.creator}</span>
                )}
                {article.duration && (
                    <span className="article-duration">• {article.duration}</span>
                )}
                {article.pubDate && (
                    <span className="article-date">
                        {article.duration ? '• ' : ''}{formatDistanceToNow(article.pubDate, { addSuffix: true })}
                    </span>
                )}
            </div>


            {/* Show either inline summary OR regular snippet, not both */}
            {personalityConfig.showInlineSummary && (inlineSummary || loadingSummary) ? (
                <div className="article-inline-summary">
                    {loadingSummary ? 'Generating friendly summary...' : inlineSummary}
                </div>
            ) : (
                article.contentSnippet && (
                    <p className="article-snippet">{article.contentSnippet.slice(0, 150)}...</p>
                )
            )}


            {/* Quick Actions (Conversational Curator) */}
            {personalityConfig.showQuickActions && (
                <div className="article-quick-actions">
                    <button
                        className="article-quick-action"
                        onClick={async (e) => {
                            e.stopPropagation();
                            // Share logic
                            const shareData = {
                                title: article.title,
                                text: article.contentSnippet?.slice(0, 100) || '',
                                url: article.link
                            };
                            try {
                                if (navigator.share) {
                                    await navigator.share(shareData);
                                } else {
                                    await navigator.clipboard.writeText(article.link);
                                    alert('Link copied to clipboard!');
                                }
                            } catch (err) {
                                console.error('Share failed:', err);
                            }
                        }}
                    >
                        <Share2 size={14} /> Share
                    </button>
                    <button
                        className={`article-quick-action ${article.isSaved ? 'saved' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleSaved) {
                                onToggleSaved(article.id);
                            }
                        }}
                    >
                        <Star size={14} fill={article.isSaved ? 'currentColor' : 'none'} /> {article.isSaved ? 'Saved' : 'Save'}
                    </button>
                </div>
            )}
        </div>
    );
});

interface ArticleListProps {
    articles: Article[];
    selectedArticle: Article | null;
    selectedArticleIds: Set<string>;
    onSelectArticle: (article: Article, ctrlKey: boolean) => void;
    onToggleRead?: (articleId: string) => void;
    onToggleSaved?: (articleId: string) => void;
    onDeleteArticle?: (articleId: string) => void;
    title?: string;
    icon?: string;
    onBack?: () => void;
    settings: AppSettings;
    isFeedSelected?: boolean;
}

export default function ArticleList({ articles, selectedArticle, selectedArticleIds, onSelectArticle, onToggleRead, onToggleSaved, onDeleteArticle, title = 'Articles', icon, onBack, settings, isFeedSelected = false }: ArticleListProps) {
    // Get personality configuration
    const personalityConfig = usePersonalityConfig(settings.readingPersonality);

    const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number; article: Article | null }>({
        show: false,
        x: 0,
        y: 0,
        article: null
    });
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);
    const [playfulMessage, setPlayfulMessage] = useState<string>('');

    // Get playful microcopy for Serendipity Explorer
    useEffect(() => {
        if (personalityConfig.showPlayfulMicrocopy) {
            const messages = getPlayfulMicrocopy();
            setPlayfulMessage(messages[Math.floor(Math.random() * messages.length)]);
        }
    }, [personalityConfig.showPlayfulMicrocopy]);

    // Pre-calculate importance scores for Daily Brief sorting
    const [importanceScores, setImportanceScores] = useState<Map<string, number>>(new Map());

    useEffect(() => {
        if (personalityConfig.sortPreference === 'importance') {
            // Calculate scores for all articles
            const calculateScores = async () => {
                const scores = new Map<string, number>();
                await Promise.all(
                    articles.map(async (article) => {
                        const score = await calculateImportanceScore(article);
                        scores.set(article.id, score);
                    })
                );
                setImportanceScores(scores);
            };
            calculateScores();
        }
    }, [articles, personalityConfig.sortPreference]);

    const sortedArticles = useMemo(() => {
        let sorted = [...articles];

        // Apply shuffle for Serendipity Explorer
        if (personalityConfig.enableShuffleMode) {
            sorted = shuffleArray(sorted);
        } else if (personalityConfig.sortPreference === 'importance' && importanceScores.size > 0) {
            // Sort by importance score descending
            sorted.sort((a, b) => {
                const scoreA = importanceScores.get(a.id) || 50;
                const scoreB = importanceScores.get(b.id) || 50;
                return scoreB - scoreA; // Higher score first
            });
        } else {
            // Default: sort by date descending
            sorted.sort((a, b) => {
                const dateA = a.pubDate?.getTime() || 0;
                const dateB = b.pubDate?.getTime() || 0;
                return dateB - dateA;
            });
        }

        return sorted;
    }, [articles, personalityConfig.enableShuffleMode, personalityConfig.sortPreference, importanceScores]);

    const filteredArticles = useMemo(() => {
        if (showUnreadOnly) {
            return sortedArticles.filter(article => !article.isRead);
        }
        return sortedArticles;
    }, [sortedArticles, showUnreadOnly]);

    const unreadCount = useMemo(() => {
        return articles.filter(article => !article.isRead).length;
    }, [articles]);

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, article: Article) => {
        e.preventDefault();
        e.stopPropagation();

        const menuWidth = 220;
        const menuHeight = 240;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > viewportWidth) {
            x = Math.max(10, viewportWidth - menuWidth - 10);
        }

        if (y + menuHeight > viewportHeight) {
            y = Math.max(10, viewportHeight - menuHeight - 10);
        }

        x = Math.max(10, Math.min(x, viewportWidth - menuWidth - 10));
        y = Math.max(10, Math.min(y, viewportHeight - menuHeight - 10));

        setContextMenu({
            show: true,
            x,
            y,
            article
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ show: false, x: 0, y: 0, article: null });
    };

    const handleShareArticle = async () => {
        if (contextMenu.article) {
            try {
                const ipcRenderer = (window as any).ipcRenderer;

                if (ipcRenderer) {
                    const result = await ipcRenderer.invoke('share-feed', {
                        title: contextMenu.article.title,
                        url: contextMenu.article.link
                    });

                    if (result.action === 'copied') {
                        alert('Article link copied to clipboard!');
                    }
                } else {
                    const shareData = {
                        title: contextMenu.article.title,
                        text: contextMenu.article.contentSnippet || '',
                        url: contextMenu.article.link
                    };

                    if (navigator.share) {
                        await navigator.share(shareData);
                    } else {
                        await navigator.clipboard.writeText(`${contextMenu.article.title}\n${contextMenu.article.link}`);
                        alert('Article link copied to clipboard!');
                    }
                }
            } catch (error) {
                console.error('Error sharing:', error);
            }
            closeContextMenu();
        }
    };


    const handleShareToMastodon = async () => {
        if (contextMenu.article) {
            const article = contextMenu.article;
            closeContextMenu();

            let text = `${article.title}\n${article.link}`;

            // Generate hashtags if AI is configured
            if (settings && (settings.geminiApiKey || settings.openaiApiKey || settings.claudeApiKey)) {
                document.body.style.cursor = 'wait';
                try {
                    const content = article.contentSnippet || article.content || article.title;
                    const tags = await generateHashtags(content, settings);
                    if (tags.length > 0) {
                        text += `\n\n${tags.join(' ')}`;
                    }
                } catch (e) {
                    console.error('Failed to generate tags', e);
                } finally {
                    document.body.style.cursor = 'default';
                }
            }

            // Copy to clipboard
            await navigator.clipboard.writeText(text);
            alert('Copied to clipboard with AI hashtags! Paste into your Mastodon app.');
        }
    };

    const handleCopyLink = async () => {
        if (contextMenu.article) {
            try {
                await navigator.clipboard.writeText(contextMenu.article.link);
                alert('Link copied to clipboard!');
            } catch (error) {
                console.error('Error copying link:', error);
            }
            closeContextMenu();
        }
    };

    const handleToggleRead = () => {
        if (contextMenu.article && onToggleRead) {
            onToggleRead(contextMenu.article.id);
            closeContextMenu();
        }
    };

    const handleToggleSaved = () => {
        if (contextMenu.article && onToggleSaved) {
            onToggleSaved(contextMenu.article.id);
            closeContextMenu();
        }
    };

    const handleDelete = () => {
        if (contextMenu.article && onDeleteArticle) {
            if (confirm(`Delete "${contextMenu.article.title}"?`)) {
                onDeleteArticle(contextMenu.article.id);
            }
            closeContextMenu();
        }
    };

    const handleOpenInBrowser = () => {
        if (contextMenu.article) {
            const ipcRenderer = (window as any).ipcRenderer;
            if (ipcRenderer) {
                ipcRenderer.invoke('open-external', contextMenu.article.link);
            } else {
                window.open(contextMenu.article.link, '_blank');
            }
            closeContextMenu();
        }
    };

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                closeContextMenu();
            }
        };

        if (contextMenu.show) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [contextMenu.show]);


    // Generate personality CSS classes
    const personalityClasses = [
        `personality-layout-${personalityConfig.layoutMode}`,
        `personality-metadata-${personalityConfig.showMetadata}`,
        `personality-font-${personalityConfig.fontSize}`,
        personalityConfig.highContrast ? 'personality-high-contrast' : '',
        personalityConfig.keyboardFirst ? 'personality-keyboard-first' : '',
        `personality-${settings.readingPersonality}` // Specific personality class
    ].filter(Boolean).join(' ');

    return (
        <div className={`article-list ${personalityClasses}`}>
            <div className="article-list-header">
                <div className="article-list-header-row">
                    {onBack && (
                        <button className="mobile-back-btn" onClick={onBack}>
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <div className="article-list-title-section">
                        <h3>
                            {icon && (
                                <img
                                    src={icon}
                                    alt=""
                                    className="feed-icon-header"
                                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                                />
                            )}
                            {title}
                        </h3>
                        <button
                            className={`unread-filter-btn ${showUnreadOnly ? 'active' : ''}`}
                            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                            title={showUnreadOnly ? 'Show all articles' : 'Show unread only'}
                        >
                            {showUnreadOnly ? <EyeOff size={16} /> : <Eye size={16} />}
                            <span className="unread-filter-label">
                                {showUnreadOnly ? 'Unread' : 'All'}
                            </span>
                            {unreadCount > 0 && (
                                <span className="unread-filter-count">{unreadCount}</span>
                            )}
                        </button>
                    </div>

                    {selectedArticleIds.size > 0 && (
                        <span className="selection-count">{selectedArticleIds.size} selected</span>
                    )}
                </div>

                {/* Playful Microcopy (Serendipity Explorer) - Shows on its own row */}
                {personalityConfig.showPlayfulMicrocopy && playfulMessage && (
                    <div className="playful-header">{playfulMessage}</div>
                )}
            </div>
            <div className="article-list-content">
                {filteredArticles.length === 0 ? (
                    <div className="empty-state">
                        <p>{showUnreadOnly ? 'No unread articles.' : 'No articles found.'}</p>
                        <p className="empty-hint">
                            {showUnreadOnly ? 'All caught up! Click the filter to show all articles.' : 'Try refreshing or adding more feeds.'}
                        </p>
                    </div>
                ) : (
                    filteredArticles.map((article) => (
                        <ArticleItem
                            key={article.id}
                            article={article}
                            isSelected={selectedArticle?.id === article.id}
                            isMultiSelected={selectedArticleIds.has(article.id)}
                            onSelect={onSelectArticle}
                            onContextMenu={handleContextMenu}
                            onToggleSaved={onToggleSaved}
                            settings={settings}
                            personalityConfig={personalityConfig}
                            allowInlineSummary={isFeedSelected}
                        />
                    ))
                )}
            </div>

            {/* Context Menu */}
            {contextMenu.show && contextMenu.article && createPortal(
                <div
                    ref={contextMenuRef}
                    className="context-menu"
                    style={{
                        position: 'fixed',
                        top: `${contextMenu.y}px`,
                        left: `${contextMenu.x}px`,
                        zIndex: 1000
                    }}
                >
                    <div className="context-menu-item" onClick={handleShareArticle}>
                        <Share2 size={14} />
                        <span>Share Article</span>
                    </div>
                    <div className="context-menu-item" onClick={handleShareToMastodon}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21.327 8.566c0-4.339-2.843-5.61-2.843-5.61-1.433-.658-3.894-.935-6.451-.956h-.063c-2.557.021-5.016.298-6.45.956 0 0-2.843 1.272-2.843 5.61 0 .993-.019 2.181.012 3.441.103 4.243.778 8.425 4.701 9.463 1.809.479 3.362.579 4.612.51 2.268-.126 3.541-.809 3.541-.809l-.075-1.646s-1.621.511-3.441.449c-1.804-.062-3.707-.194-3.999-2.409a4.523 4.523 0 0 1-.04-.621s1.77.432 4.014.535c1.372.063 2.658-.08 3.965-.236 2.506-.299 4.688-1.843 4.962-3.254.434-2.223.398-5.424.398-5.424zm-3.353 5.59h-2.081V9.057c0-1.075-.452-1.62-1.357-1.62-1 0-1.501.647-1.501 1.927v2.791h-2.069V9.364c0-1.28-.501-1.927-1.502-1.927-.905 0-1.357.546-1.357 1.62v5.099H6.026V8.903c0-1.074.273-1.927.823-2.558.566-.631 1.307-.955 2.228-.955 1.065 0 1.872.41 2.405 1.228l.518.869.519-.869c.533-.818 1.34-1.228 2.405-1.228.92 0 1.662.324 2.228.955.549.631.822 1.484.822 2.558v5.253z" />
                        </svg>
                        <span>Share to Mastodon</span>
                    </div>
                    <div className="context-menu-item" onClick={handleCopyLink}>
                        <Copy size={14} />
                        <span>Copy Link</span>
                    </div>
                    <div className="context-menu-divider"></div>
                    <div className="context-menu-item" onClick={handleToggleRead}>
                        {contextMenu.article.isRead ? <Circle size={14} /> : <CheckCircle size={14} />}
                        <span>{contextMenu.article.isRead ? 'Mark as Unread' : 'Mark as Read'}</span>
                    </div>
                    <div className="context-menu-item" onClick={handleToggleSaved}>
                        <Star size={14} fill={contextMenu.article.isSaved ? 'currentColor' : 'none'} />
                        <span>{contextMenu.article.isSaved ? 'Remove from Saved' : 'Save Article'}</span>
                    </div>
                    <div className="context-menu-divider"></div>
                    <div className="context-menu-item" onClick={handleOpenInBrowser}>
                        <Globe size={14} />
                        <span>Open in Browser</span>
                    </div>
                    <div className="context-menu-item context-menu-item-danger" onClick={handleDelete}>
                        <Trash2 size={14} />
                        <span>Delete Article</span>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
