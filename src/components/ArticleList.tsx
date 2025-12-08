import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { Headphones, Video, ChevronLeft, Share2, Copy, Trash2, Globe, CheckCircle, Circle } from 'lucide-react';
import { Article } from '../types';
import './ArticleList.css';

// Helper to strip HTML tags and decode entities from titles
const cleanTitle = (title: string): string => {
    if (!title) return '';
    // Create temp element to decode HTML entities and strip tags
    const temp = document.createElement('div');
    temp.innerHTML = title;
    return temp.textContent || temp.innerText || title;
};

interface ArticleListProps {
    articles: Article[];
    selectedArticle: Article | null;
    selectedArticleIds: Set<string>;
    onSelectArticle: (article: Article, ctrlKey: boolean) => void;
    onToggleRead?: (articleId: string) => void;
    onDeleteArticle?: (articleId: string) => void;
    title?: string;
    icon?: string;
    onBack?: () => void;
}

export default function ArticleList({ articles, selectedArticle, selectedArticleIds, onSelectArticle, onToggleRead, onDeleteArticle, title = 'Articles', icon, onBack }: ArticleListProps) {
    const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number; article: Article | null }>({
        show: false,
        x: 0,
        y: 0,
        article: null
    });
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const sortedArticles = [...articles].sort((a, b) => {
        const dateA = a.pubDate?.getTime() || 0;
        const dateB = b.pubDate?.getTime() || 0;
        return dateB - dateA;
    });

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
                {selectedArticleIds.size > 0 && (
                    <span className="selection-count">{selectedArticleIds.size} selected</span>
                )}
            </div>
            <div className="article-list-content">
                {sortedArticles.length === 0 ? (
                    <div className="empty-state">
                        <p>No articles found.</p>
                        <p className="empty-hint">Try refreshing or adding more feeds.</p>
                    </div>
                ) : (
                    sortedArticles.map((article) => (
                        <div
                            key={article.id}
                            className={`article-item ${selectedArticle?.id === article.id ? 'active' : ''} ${selectedArticleIds.has(article.id) ? 'multi-selected' : ''} ${!article.isRead ? 'unread' : ''}`}
                            onClick={(e) => onSelectArticle(article, e.ctrlKey || e.metaKey)}
                            onContextMenu={(e) => handleContextMenu(e, article)}
                        >
                            {!article.isRead && <div className="unread-marker"></div>}
                            {selectedArticleIds.has(article.id) && <div className="multi-select-marker">✓</div>}
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
                    <div className="context-menu-item" onClick={handleCopyLink}>
                        <Copy size={14} />
                        <span>Copy Link</span>
                    </div>
                    <div className="context-menu-divider"></div>
                    <div className="context-menu-item" onClick={handleToggleRead}>
                        {contextMenu.article.isRead ? <Circle size={14} /> : <CheckCircle size={14} />}
                        <span>{contextMenu.article.isRead ? 'Mark as Unread' : 'Mark as Read'}</span>
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
