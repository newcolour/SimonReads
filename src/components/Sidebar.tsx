import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Rss, CheckCircle, Search, X, Check, Edit2, ArrowDownAZ, ArrowUpAZ, Clock, CheckCheck, Sparkles, Copy, Share2, RefreshCw, Folder, Star, Settings, Newspaper } from 'lucide-react';
import { Feed, Article, AppSettings } from '../types';
import FeedDiscovery from './FeedDiscovery';
import './Sidebar.css';

interface SidebarProps {
    feeds: Feed[];
    selectedFeedId: string | null;
    onSelectFeed: (feedId: string | null) => void;
    onAddFeed: (url: string) => Promise<void>;
    onRemoveFeed: (feedId: string) => void;
    onRenameFeed: (feedId: string, newTitle: string) => void;
    onUpdateFeed: (feedId: string, updates: Partial<Feed>) => void;
    articles: Article[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onMarkAllAsRead?: () => void;
    onMarkFeedAsRead?: (feedId: string) => void;
    onRefreshFeed?: (feedId: string) => void;
    settings: AppSettings;
    // Toolbar-related props
    onRefresh?: () => void;
    isRefreshing?: boolean;
    onOpenSettings?: () => void;
    onOpenDailyNewsreel?: () => void;
}

type SortOption = 'updated' | 'alpha-asc' | 'alpha-desc';

interface ContextMenuState {
    show: boolean;
    x: number;
    y: number;
    feed: Feed | null;
}

export default function Sidebar({
    feeds,
    selectedFeedId,
    onSelectFeed,
    onAddFeed,
    onRemoveFeed,
    onRenameFeed,
    onUpdateFeed,
    articles,
    searchQuery,
    onSearchChange,
    onMarkAllAsRead,
    onMarkFeedAsRead,
    onRefreshFeed,
    settings,
    onRefresh,
    isRefreshing,
    onOpenSettings,
    onOpenDailyNewsreel
}: SidebarProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [showDiscovery, setShowDiscovery] = useState(false);
    const [newFeedUrl, setNewFeedUrl] = useState('');
    const [renamingFeedId, setRenamingFeedId] = useState<string | null>(null);
    const [newFeedTitle, setNewFeedTitle] = useState('');
    const [categorizingFeedId, setCategorizingFeedId] = useState<string | null>(null);
    const [newCategory, setNewCategory] = useState('');
    const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('updated');
    const [showSortMenu, setShowSortMenu] = useState(false);
    const [sortMenuPos, setSortMenuPos] = useState({ x: 0, y: 0 });
    const sortButtonRef = useRef<HTMLButtonElement>(null);
    const sortMenuRef = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ show: false, x: 0, y: 0, feed: null });
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const sortedFeeds = useMemo(() => {
        const sorted = [...feeds].sort((a, b) => {
            switch (sortOption) {
                case 'alpha-asc':
                    return a.title.localeCompare(b.title);
                case 'alpha-desc':
                    return b.title.localeCompare(a.title);
                case 'updated':
                default:
                    // Sort by most recent article date, fallback to lastFetched
                    const lastArticleA = articles
                        .filter(art => art.feedId === a.id)
                        .sort((x, y) => new Date(y.pubDate || 0).getTime() - new Date(x.pubDate || 0).getTime())[0];
                    const lastArticleB = articles
                        .filter(art => art.feedId === b.id)
                        .sort((x, y) => new Date(y.pubDate || 0).getTime() - new Date(x.pubDate || 0).getTime())[0];

                    const dateA = lastArticleA?.pubDate ? new Date(lastArticleA.pubDate).getTime() : new Date(a.lastFetched || 0).getTime();
                    const dateB = lastArticleB?.pubDate ? new Date(lastArticleB.pubDate).getTime() : new Date(b.lastFetched || 0).getTime();

                    return dateB - dateA;
            }
        });

        // Group by category
        const grouped: Feed[] = [];
        const categories = new Set(sorted.map(f => f.category || 'Uncategorized'));
        const sortedCategories = Array.from(categories).sort();

        sortedCategories.forEach(category => {
            grouped.push(...sorted.filter(f => (f.category || 'Uncategorized') === category));
        });

        return grouped;
    }, [feeds, sortOption, articles]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newFeedUrl.trim()) {
            try {
                // Import podcast service dynamically
                const { convertPodcastUrlToRss, isPodcastPlatformUrl } = await import('../podcastService');

                let feedUrl = newFeedUrl.trim();

                // Check if it's a podcast platform URL and convert it
                if (isPodcastPlatformUrl(feedUrl)) {
                    try {
                        feedUrl = await convertPodcastUrlToRss(feedUrl);
                        console.log('Converted podcast URL to RSS:', feedUrl);
                    } catch (conversionError) {
                        console.error('Podcast conversion error:', conversionError);
                        alert(conversionError instanceof Error ? conversionError.message : 'Failed to convert podcast URL');
                        return;
                    }
                }

                await onAddFeed(feedUrl);
                setNewFeedUrl('');
                setIsAdding(false);
            } catch (error) {
                console.error('Failed to add feed:', error);
                alert('Failed to add feed. Please check the URL and try again.');
            }
        }
    };

    const handleRename = (feedId: string) => {
        if (newFeedTitle.trim()) {
            onRenameFeed(feedId, newFeedTitle.trim());
            setRenamingFeedId(null);
            setNewFeedTitle('');
        }
    };

    const startRenaming = (feed: Feed, e: React.MouseEvent) => {
        e.stopPropagation();
        setRenamingFeedId(feed.id);
        setNewFeedTitle(feed.title);
    };

    const getUnreadCount = (feedId: string | null) => {
        if (feedId === null) {
            return articles.filter(a => !a.isRead).length;
        }
        if (feedId === 'read') {
            return 0;
        }
        return articles.filter(a => a.feedId === feedId && !a.isRead).length;
    };

    const getSortLabel = () => {
        switch (sortOption) {
            case 'updated':
                return 'Last Updated';
            case 'alpha-asc':
                return 'Name (A-Z)';
            case 'alpha-desc':
                return 'Name (Z-A)';
            default:
                return 'Sort';
        }
    };

    // Context menu handlers
    const handleContextMenu = (e: React.MouseEvent, feed: Feed) => {
        e.preventDefault();
        e.stopPropagation();

        // Context menu dimensions (based on actual menu with 6 items + 3 dividers)
        // Each item is ~40px tall, dividers are ~9px
        const menuWidth = 220;
        const menuHeight = 280; // 6 items * 40px + 3 dividers * 9px + padding

        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Start with click position
        let x = e.clientX;
        let y = e.clientY;

        // Adjust horizontal position if menu would go off right edge
        if (x + menuWidth > viewportWidth) {
            x = Math.max(10, viewportWidth - menuWidth - 10);
        }

        // Adjust vertical position if menu would go off bottom edge
        if (y + menuHeight > viewportHeight) {
            y = Math.max(10, viewportHeight - menuHeight - 10);
        }

        // Ensure minimum distance from edges
        x = Math.max(10, Math.min(x, viewportWidth - menuWidth - 10));
        y = Math.max(10, Math.min(y, viewportHeight - menuHeight - 10));

        setContextMenu({
            show: true,
            x,
            y,
            feed
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ show: false, x: 0, y: 0, feed: null });
    };

    const handleCopyFeedLink = () => {
        if (contextMenu.feed) {
            navigator.clipboard.writeText(contextMenu.feed.url);
            closeContextMenu();
        }
    };

    const handleShareFeed = async () => {
        if (contextMenu.feed) {
            try {
                const ipcRenderer = (window as any).ipcRenderer;

                if (ipcRenderer) {
                    // Use Electron's native share dialog
                    const result = await ipcRenderer.invoke('share-feed', {
                        title: contextMenu.feed.title,
                        url: contextMenu.feed.url
                    });

                    if (result.action === 'copied') {
                        // Show a brief notification that link was copied
                        alert('Feed link copied to clipboard!');
                    }
                } else {
                    // Fallback for web/mobile - use Web Share API or clipboard
                    const shareData = {
                        title: contextMenu.feed.title,
                        text: `Check out this RSS feed: ${contextMenu.feed.title}`,
                        url: contextMenu.feed.url
                    };

                    if (navigator.share) {
                        await navigator.share(shareData);
                    } else {
                        // Fallback: copy to clipboard
                        await navigator.clipboard.writeText(`${contextMenu.feed.title}\n${contextMenu.feed.url}`);
                        alert('Feed details copied to clipboard!');
                    }
                }
            } catch (error) {
                console.error('Error sharing:', error);
            }
            closeContextMenu();
        }
    };

    const handleMarkFeedAsRead = () => {
        if (contextMenu.feed && onMarkFeedAsRead) {
            // Mark all articles from this feed as read
            const feedArticles = articles.filter(a => a.feedId === contextMenu.feed!.id && !a.isRead);
            if (feedArticles.length > 0) {
                if (confirm(`Mark all ${feedArticles.length} articles from "${contextMenu.feed.title}" as read?`)) {
                    onMarkFeedAsRead(contextMenu.feed.id);
                }
            }
            closeContextMenu();
        }
    };

    const handleContextRename = () => {
        if (contextMenu.feed) {
            setRenamingFeedId(contextMenu.feed.id);
            setNewFeedTitle(contextMenu.feed.title);
            closeContextMenu();
        }
    };

    const handleContextRemove = () => {
        if (contextMenu.feed) {
            if (confirm(`Are you sure you want to remove "${contextMenu.feed.title}"?`)) {
                onRemoveFeed(contextMenu.feed.id);
            }
            closeContextMenu();
        }
    };

    const handleSetCategory = () => {
        if (contextMenu.feed) {
            setCategorizingFeedId(contextMenu.feed.id);
            setNewCategory(contextMenu.feed.category || '');
            closeContextMenu();
        }
    };

    const handleCategorySubmit = (feedId: string) => {
        const feed = feeds.find(f => f.id === feedId);
        if (feed) {
            onUpdateFeed(feedId, { ...feed, category: newCategory || undefined });
        }
        setCategorizingFeedId(null);
        setNewCategory('');
    };

    // Get list of existing categories for autocomplete
    const existingCategories = useMemo(() => {
        const cats = new Set(feeds.map(f => f.category).filter(Boolean) as string[]);
        return Array.from(cats).sort();
    }, [feeds]);

    // Handler to rename a category (updates all feeds with that category)
    const handleRenameCategory = (oldCategory: string, newName: string) => {
        const trimmedName = newName.trim();
        // Update all feeds that have this category
        feeds.forEach(feed => {
            if ((feed.category || 'Uncategorized') === oldCategory) {
                const newCat = trimmedName === '' || trimmedName === 'Uncategorized' ? undefined : trimmedName;
                onUpdateFeed(feed.id, { ...feed, category: newCat });
            }
        });
        setRenamingCategory(null);
        setNewCategoryName('');
    };

    const startRenamingCategory = (category: string) => {
        if (category === 'Uncategorized') return; // Can't rename Uncategorized
        setRenamingCategory(category);
        setNewCategoryName(category);
    };

    const handleContextRefresh = () => {
        if (contextMenu.feed && onRefreshFeed) {
            onRefreshFeed(contextMenu.feed.id);
            closeContextMenu();
        }
    };

    // Close context menu and sort menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                closeContextMenu();
            }
            if (showSortMenu && sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node) &&
                sortButtonRef.current && !sortButtonRef.current.contains(e.target as Node)) {
                setShowSortMenu(false);
            }
        };

        if (contextMenu.show || showSortMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [contextMenu.show, showSortMenu]);

    const toggleSortMenu = () => {
        if (showSortMenu) {
            setShowSortMenu(false);
        } else if (sortButtonRef.current) {
            const rect = sortButtonRef.current.getBoundingClientRect();
            // Align right edge of menu with right edge of button
            // But since we use left/top for fixed positioning usually:
            // Let's use right alignment style if possible, or calculate x
            // A simple way is to pass styling to the portal div.
            setSortMenuPos({
                x: rect.left,
                y: rect.bottom + 4
            });
            setShowSortMenu(true);
        }
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h2>Feeds</h2>
                <div className="sidebar-actions">
                    {onOpenDailyNewsreel && (
                        <button
                            className="icon-btn"
                            onClick={onOpenDailyNewsreel}
                            data-tooltip="Daily Newsreel"
                        >
                            <Newspaper size={18} />
                        </button>
                    )}
                    {onRefresh && (
                        <button
                            className={`icon-btn ${isRefreshing ? 'spinning' : ''}`}
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            data-tooltip="Refresh Feeds"
                        >
                            <RefreshCw size={18} />
                        </button>
                    )}
                    {onOpenSettings && (
                        <button
                            className="icon-btn"
                            onClick={onOpenSettings}
                            data-tooltip="Settings"
                        >
                            <Settings size={18} />
                        </button>
                    )}
                    <div className="sidebar-actions-divider" />
                    <div className="sort-dropdown-container">
                        <button
                            ref={sortButtonRef}
                            className="icon-btn"
                            onClick={toggleSortMenu}
                            data-tooltip={getSortLabel()}
                        >
                            {sortOption === 'updated' && <Clock size={18} />}
                            {sortOption === 'alpha-asc' && <ArrowDownAZ size={18} />}
                            {sortOption === 'alpha-desc' && <ArrowUpAZ size={18} />}
                        </button>
                    </div>
                    {onMarkAllAsRead && (
                        <button
                            className="icon-btn"
                            onClick={() => {
                                if (confirm('Mark all articles as read?')) {
                                    onMarkAllAsRead();
                                }
                            }}
                            data-tooltip="Mark All as Read"
                        >
                            <CheckCheck size={18} />
                        </button>
                    )}
                    <button
                        className="icon-btn"
                        onClick={() => setShowDiscovery(true)}
                        data-tooltip="Discover Feeds"
                    >
                        <Sparkles size={18} className="text-accent" />
                    </button>
                    <button
                        className="add-feed-btn"
                        onClick={() => setIsAdding(!isAdding)}
                        data-tooltip="Add Feed"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div >

            <div className="search-container">
                <div className="search-input-wrapper">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search articles..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {
                isAdding && (
                    <form onSubmit={handleSubmit} className="add-feed-form">
                        <input
                            type="url"
                            placeholder="RSS URL or Apple/Spotify Podcast link..."
                            value={newFeedUrl}
                            onChange={(e) => setNewFeedUrl(e.target.value)}
                            autoFocus
                        />
                        <div className="add-feed-actions">
                            <button type="button" onClick={() => setIsAdding(false)}>
                                <X size={16} />
                                <span>Cancel</span>
                            </button>
                            <button type="submit">
                                <Check size={16} />
                                <span>Add Feed</span>
                            </button>
                        </div>
                    </form>
                )
            }

            <div className="feed-list">
                <div
                    className={`feed-item ${selectedFeedId === null ? 'active' : ''}`}
                    onClick={() => onSelectFeed(null)}
                >
                    <Rss size={16} />
                    <span className="feed-title">All Feeds</span>
                    {getUnreadCount(null) > 0 && (
                        <span className="unread-count">{getUnreadCount(null)}</span>
                    )}
                </div>

                <div
                    className={`feed-item ${selectedFeedId === 'read' ? 'active' : ''}`}
                    onClick={() => onSelectFeed('read')}
                >
                    <CheckCircle size={16} />
                    <span className="feed-title">Read Articles</span>
                </div>

                <div
                    className={`feed-item ${selectedFeedId === 'saved' ? 'active' : ''}`}
                    onClick={() => onSelectFeed('saved')}
                >
                    <Star size={16} />
                    <span className="feed-title">Saved Articles</span>
                    {articles.filter(a => a.isSaved).length > 0 && (
                        <span className="unread-count saved-count">{articles.filter(a => a.isSaved).length}</span>
                    )}
                </div>

                {sortedFeeds.map((feed, index) => {
                    const currentCategory = feed.category || 'Uncategorized';
                    const previousCategory = index > 0 ? (sortedFeeds[index - 1].category || 'Uncategorized') : null;
                    const showCategoryHeader = currentCategory !== previousCategory;

                    return (
                        <div key={feed.id}>
                            {showCategoryHeader && (
                                <div
                                    className="category-header"
                                    onDoubleClick={() => startRenamingCategory(currentCategory)}
                                    title={currentCategory !== 'Uncategorized' ? 'Double-click to rename' : undefined}
                                >
                                    <Folder size={14} />
                                    {renamingCategory === currentCategory ? (
                                        <input
                                            type="text"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleRenameCategory(currentCategory, newCategoryName);
                                                } else if (e.key === 'Escape') {
                                                    setRenamingCategory(null);
                                                    setNewCategoryName('');
                                                }
                                            }}
                                            onBlur={() => handleRenameCategory(currentCategory, newCategoryName)}
                                            className="category-rename-input"
                                            autoFocus
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span>{currentCategory}</span>
                                    )}
                                </div>
                            )}
                            <div
                                className={`feed-item has-actions ${selectedFeedId === feed.id ? 'active' : ''} ${renamingFeedId === feed.id ? 'renaming' : ''}`}
                                onClick={() => {
                                    if (renamingFeedId !== feed.id) {
                                        onSelectFeed(feed.id);
                                    }
                                }}
                                onContextMenu={(e) => handleContextMenu(e, feed)}
                            >
                                {feed.icon ? (
                                    <img
                                        src={feed.icon}
                                        alt=""
                                        className="feed-icon"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                ) : null}
                                <Rss size={16} className={feed.icon ? 'hidden' : ''} />
                                {renamingFeedId === feed.id ? (
                                    <input
                                        type="text"
                                        value={newFeedTitle}
                                        onChange={(e) => setNewFeedTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleRename(feed.id);
                                            } else if (e.key === 'Escape') {
                                                setRenamingFeedId(null);
                                                setNewFeedTitle('');
                                            }
                                        }}
                                        onBlur={() => handleRename(feed.id)}
                                        className="rename-input"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : categorizingFeedId === feed.id ? (
                                    <div className="category-input-container" onClick={(e) => e.stopPropagation()}>
                                        <span className="feed-title" title={feed.title}>{feed.title}</span>
                                        <input
                                            type="text"
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    handleCategorySubmit(feed.id);
                                                } else if (e.key === 'Escape') {
                                                    setCategorizingFeedId(null);
                                                    setNewCategory('');
                                                }
                                            }}
                                            onBlur={() => handleCategorySubmit(feed.id)}
                                            className="category-input"
                                            placeholder="Enter category (or leave empty)"
                                            autoFocus
                                            list={`categories-${feed.id}`}
                                        />
                                        <datalist id={`categories-${feed.id}`}>
                                            {existingCategories.map(cat => (
                                                <option key={cat} value={cat} />
                                            ))}
                                        </datalist>
                                    </div>
                                ) : (
                                    <span className="feed-title" title={feed.title}>{feed.title}</span>
                                )}
                                {getUnreadCount(feed.id) > 0 && (
                                    <span className="unread-count">{getUnreadCount(feed.id)}</span>
                                )}
                                <div className="feed-actions">
                                    <button
                                        className="edit-feed-btn"
                                        onClick={(e) => startRenaming(feed, e)}
                                        data-tooltip="Rename feed"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        className="remove-feed-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Are you sure you want to remove this feed?')) {
                                                onRemoveFeed(feed.id);
                                            }
                                        }}
                                        data-tooltip="Remove feed"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            {
                showDiscovery && (
                    <FeedDiscovery
                        currentFeeds={feeds}
                        settings={settings}
                        onClose={() => setShowDiscovery(false)}
                        onAddFeed={onAddFeed}
                    />
                )
            }
            {
                showSortMenu && createPortal(
                    <div
                        ref={sortMenuRef}
                        className="sort-menu"
                        style={{
                            position: 'fixed',
                            top: `${sortMenuPos.y}px`,
                            left: `${sortMenuPos.x}px`,
                            right: 'auto',
                            zIndex: 1000,
                            marginTop: 0 // Override existing CSS margin
                        }}
                    >
                        <div
                            className={`sort-option ${sortOption === 'updated' ? 'active' : ''}`}
                            onClick={() => { setSortOption('updated'); setShowSortMenu(false); }}
                        >
                            <Clock size={14} /> Last Updated
                        </div>
                        <div
                            className={`sort-option ${sortOption === 'alpha-asc' ? 'active' : ''}`}
                            onClick={() => { setSortOption('alpha-asc'); setShowSortMenu(false); }}
                        >
                            <ArrowDownAZ size={14} /> Name (A-Z)
                        </div>
                        <div
                            className={`sort-option ${sortOption === 'alpha-desc' ? 'active' : ''}`}
                            onClick={() => { setSortOption('alpha-desc'); setShowSortMenu(false); }}
                        >
                            <ArrowUpAZ size={14} /> Name (Z-A)
                        </div>
                    </div>,
                    document.body
                )
            }
            {
                contextMenu.show && contextMenu.feed && createPortal(
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
                        <div className="context-menu-item" onClick={handleContextRefresh}>
                            <RefreshCw size={14} />
                            <span>Refresh Feed</span>
                        </div>
                        <div className="context-menu-divider"></div>
                        <div className="context-menu-item" onClick={handleCopyFeedLink}>
                            <Copy size={14} />
                            <span>Copy Feed Link</span>
                        </div>
                        <div className="context-menu-item" onClick={handleShareFeed}>
                            <Share2 size={14} />
                            <span>Share Feed</span>
                        </div>
                        <div className="context-menu-divider"></div>
                        <div className="context-menu-item" onClick={handleMarkFeedAsRead}>
                            <CheckCheck size={14} />
                            <span>Mark All as Read</span>
                        </div>
                        <div className="context-menu-divider"></div>
                        <div className="context-menu-item" onClick={handleContextRename}>
                            <Edit2 size={14} />
                            <span>Rename Feed</span>
                        </div>
                        <div className="context-menu-item" onClick={handleSetCategory}>
                            <Folder size={14} />
                            <span>Set Category</span>
                        </div>
                        <div className="context-menu-item context-menu-item-danger" onClick={handleContextRemove}>
                            <Trash2 size={14} />
                            <span>Remove Feed</span>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div >
    );
}
