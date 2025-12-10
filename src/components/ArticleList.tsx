import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { Headphones, Video, ChevronLeft, Share2, Copy, Trash2, Globe, CheckCircle, Circle, Star, Eye, EyeOff } from 'lucide-react';
import { Article, AppSettings } from '../types';
import { generateHashtags } from '../summaryService';
import './ArticleList.css';

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
}

const ArticleItem = memo(({ article, isSelected, isMultiSelected, onSelect, onContextMenu }: ArticleItemProps) => {
    return (
        <div
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
            {article.contentSnippet && (
                <p className="article-snippet">{article.contentSnippet.slice(0, 150)}...</p>
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
}

export default function ArticleList({ articles, selectedArticle, selectedArticleIds, onSelectArticle, onToggleRead, onToggleSaved, onDeleteArticle, title = 'Articles', icon, onBack, settings }: ArticleListProps) {
    const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number; article: Article | null }>({
        show: false,
        x: 0,
        y: 0,
        article: null
    });
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [showUnreadOnly, setShowUnreadOnly] = useState(false);

    const sortedArticles = useMemo(() => {
        return [...articles].sort((a, b) => {
            const dateA = a.pubDate?.getTime() || 0;
            const dateB = b.pubDate?.getTime() || 0;
            return dateB - dateA;
        });
    }, [articles]);

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
            // Save article reference before closing menu
            const article = contextMenu.article;
            closeContextMenu();

            console.log('Share to Mastodon: Starting...', article.title);

            let text = `${article.title}\n${article.link}`;

            const ipcRenderer = (window as any).ipcRenderer;
            console.log('ipcRenderer available:', !!ipcRenderer);

            if (ipcRenderer) {
                // Try to generate hashtags if AI is configured
                if (settings && (settings.geminiApiKey || settings.openaiApiKey || settings.claudeApiKey)) {
                    document.body.style.cursor = 'wait';
                    console.log('Generating hashtags...');

                    try {
                        const content = article.contentSnippet || article.content || article.title;
                        const tags = await generateHashtags(content, settings);
                        console.log('Generated tags:', tags);
                        if (tags.length > 0) {
                            text += `\n\n${tags.join(' ')}`;
                        }
                    } catch (e) {
                        console.error('Failed to generate tags', e);
                    } finally {
                        document.body.style.cursor = 'default';
                    }
                }

                console.log('Invoking share-to-mastodon with text:', text.substring(0, 100));
                try {
                    const result = await ipcRenderer.invoke('share-to-mastodon', { text });
                    console.log('share-to-mastodon result:', result);
                    if (result.action === 'copied') {
                        alert('Text copied to clipboard! Paste it into your Mastodon app.');
                    }
                } catch (error) {
                    console.error('Mastodon share error:', error);
                    navigator.clipboard.writeText(text);
                    alert('Text copied to clipboard! Paste it into your Mastodon app.');
                }
            } else {
                console.log('No ipcRenderer - copying to clipboard');
                navigator.clipboard.writeText(text);
                alert('Text copied to clipboard! Paste it into your Mastodon app.');
            }
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

    return (
        <div className="article-list">
            <div className="article-list-header">
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
