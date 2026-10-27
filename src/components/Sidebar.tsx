import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, Rss, CheckCircle, Search, X, Check, Edit2, ArrowDownAZ, ArrowUpAZ, Clock, CheckCheck, Sparkles, Copy, Share2, RefreshCw, Folder, Star, Settings, Newspaper, ChevronDown, ChevronRight, FoldVertical, UnfoldVertical, Globe, Gauge, Compass, GripVertical } from 'lucide-react';
import { Feed, Article, AppSettings } from '../types';
import { usePersonalityConfig } from '../hooks/usePersonality';
import { isAndroid } from '../utils/platform';
import { storage } from '../storage';
import FeedDiscovery from './FeedDiscovery';
import FeedSettingsModal from './FeedSettingsModal';
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
    onOpenAskLibrary?: () => void;
    onOpenDriveMode?: () => void;
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
    onOpenDailyNewsreel,
    onOpenAskLibrary,
    onOpenDriveMode
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
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ show: false, x: 0, y: 0, feed: null });
    const [settingsFeed, setSettingsFeed] = useState<Feed | null>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Personality-aware features
    const personalityConfig = usePersonalityConfig(settings.readingPersonality);
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    // Section ordering state persisted in storage
    const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
        return storage.getSectionOrder();
    });

    // Section drag & drop state
    const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
    const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
    const [feedDropCategory, setFeedDropCategory] = useState<string | null>(null);
    const touchDragRef = useRef<{
        sectionId: string;
        startY: number;
        currentY: number;
    } | null>(null);

    // Filter feeds by search query
    const filteredFeeds = useMemo(() => {
        if (!searchQuery.trim()) return feeds;
        const query = searchQuery.toLowerCase().trim();
        return feeds.filter(feed =>
            feed.title.toLowerCase().includes(query) ||
            (feed.category && feed.category.toLowerCase().includes(query)) ||
            feed.url.toLowerCase().includes(query)
        );
    }, [feeds, searchQuery]);

    // Unique categories from current feeds
    const uniqueCategories = useMemo(() => {
        const cats = new Set(filteredFeeds.map(f => f.category || 'Uncategorized'));
        return Array.from(cats).sort();
    }, [filteredFeeds]);

    // Ordered list of section IDs ('__smart__' + categories)
    const orderedSectionIds = useMemo(() => {
        const available = ['__smart__', ...uniqueCategories];
        const result: string[] = [];

        // First add stored order items that are available
        for (const id of sectionOrder) {
            if (available.includes(id) && !result.includes(id)) {
                result.push(id);
            }
        }

        // Then append any newly discovered categories or '__smart__'
        for (const id of available) {
            if (!result.includes(id)) {
                result.push(id);
            }
        }

        return result;
    }, [sectionOrder, uniqueCategories]);

    // Group and sort feeds for each category
    const feedsByCategory = useMemo(() => {
        const map = new Map<string, Feed[]>();
        for (const cat of uniqueCategories) {
            const catFeeds = filteredFeeds.filter(f => (f.category || 'Uncategorized') === cat);
            const sorted = [...catFeeds].sort((a, b) => {
                switch (sortOption) {
                    case 'alpha-asc':
                        return a.title.localeCompare(b.title);
                    case 'alpha-desc':
                        return b.title.localeCompare(a.title);
                    case 'updated':
                    default: {
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
                }
            });
            map.set(cat, sorted);
        }
        return map;
    }, [uniqueCategories, filteredFeeds, sortOption, articles]);

    // Section drag event handlers
    const handleSectionDragStart = (e: React.DragEvent, sectionId: string) => {
        if (renamingCategory || renamingFeedId || categorizingFeedId) {
            e.preventDefault();
            return;
        }
        e.stopPropagation();
        e.dataTransfer.setData('application/x-rss-section', sectionId);
        e.dataTransfer.setData('text/plain', sectionId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedSectionId(sectionId);
    };

    const handleSectionDragOver = (e: React.DragEvent, sectionId: string) => {
        // If a feed is dragged over category header
        if (draggedFeedId) {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            if (feedDropCategory !== sectionId) {
                setFeedDropCategory(sectionId);
            }
            return;
        }

        if (!draggedSectionId || draggedSectionId === sectionId) return;

        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const position = e.clientY < midY ? 'before' : 'after';

        if (dropTarget?.id !== sectionId || dropTarget?.position !== position) {
            setDropTarget({ id: sectionId, position });
        }
    };

    const handleSectionDragLeave = (e: React.DragEvent, sectionId: string) => {
        e.stopPropagation();
        const related = e.relatedTarget as HTMLElement | null;
        if (related && e.currentTarget.contains(related)) {
            return;
        }
        if (dropTarget?.id === sectionId) {
            setDropTarget(null);
        }
        if (feedDropCategory === sectionId) {
            setFeedDropCategory(null);
        }
    };

    const handleSectionDrop = (e: React.DragEvent, targetSectionId: string) => {
        e.preventDefault();
        e.stopPropagation();

        // Feed dropped on a category
        const feedId = e.dataTransfer.getData('application/x-rss-feed') || draggedFeedId;
        if (feedId) {
            const targetCat = targetSectionId === '__smart__' || targetSectionId === 'Uncategorized' ? undefined : targetSectionId;
            const targetFeed = feeds.find(f => f.id === feedId);
            if (targetFeed) {
                onUpdateFeed(feedId, { ...targetFeed, category: targetCat });
            }
            setDraggedFeedId(null);
            setFeedDropCategory(null);
            return;
        }

        // Section reorder drop
        const sourceSectionId = draggedSectionId || e.dataTransfer.getData('application/x-rss-section');
        if (sourceSectionId && targetSectionId && sourceSectionId !== targetSectionId) {
            const rect = e.currentTarget.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            const position = e.clientY < midY ? 'before' : 'after';

            setSectionOrder(() => {
                const currentList = [...orderedSectionIds];
                const withoutSource = currentList.filter(id => id !== sourceSectionId);
                const targetIdx = withoutSource.indexOf(targetSectionId);

                if (targetIdx === -1) {
                    withoutSource.push(sourceSectionId);
                } else {
                    const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
                    withoutSource.splice(insertIdx, 0, sourceSectionId);
                }

                storage.saveSectionOrder(withoutSource);
                return withoutSource;
            });
        }

        setDraggedSectionId(null);
        setDropTarget(null);
    };

    const handleSectionDragEnd = () => {
        setDraggedSectionId(null);
        setDropTarget(null);
        setDraggedFeedId(null);
        setFeedDropCategory(null);
    };

    // Feed drag handlers
    const handleFeedDragStart = (e: React.DragEvent, feedId: string) => {
        e.stopPropagation();
        e.dataTransfer.setData('application/x-rss-feed', feedId);
        e.dataTransfer.setData('text/plain', feedId);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedFeedId(feedId);
    };

    const handleFeedDragEnd = () => {
        setDraggedFeedId(null);
        setFeedDropCategory(null);
    };

    // Touch reordering handlers for mobile/tablets
    const handleTouchStart = (e: React.TouchEvent, sectionId: string) => {
        const touch = e.touches[0];
        touchDragRef.current = {
            sectionId,
            startY: touch.clientY,
            currentY: touch.clientY
        };
        setDraggedSectionId(sectionId);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!touchDragRef.current) return;
        const touch = e.touches[0];
        touchDragRef.current.currentY = touch.clientY;

        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const sectionEl = el?.closest('[data-section-id]') as HTMLElement | null;
        if (sectionEl) {
            const targetId = sectionEl.getAttribute('data-section-id');
            if (targetId && targetId !== touchDragRef.current.sectionId) {
                const rect = sectionEl.getBoundingClientRect();
                const position = touch.clientY < (rect.top + rect.height / 2) ? 'before' : 'after';
                setDropTarget({ id: targetId, position });
            }
        }
    };

    const handleTouchEnd = () => {
        if (touchDragRef.current && dropTarget) {
            const sourceSectionId = touchDragRef.current.sectionId;
            const targetSectionId = dropTarget.id;
            const position = dropTarget.position;

            if (sourceSectionId !== targetSectionId) {
                setSectionOrder(() => {
                    const currentList = [...orderedSectionIds];
                    const withoutSource = currentList.filter(id => id !== sourceSectionId);
                    const targetIdx = withoutSource.indexOf(targetSectionId);

                    if (targetIdx !== -1) {
                        const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
                        withoutSource.splice(insertIdx, 0, sourceSectionId);
                        storage.saveSectionOrder(withoutSource);
                        return withoutSource;
                    }
                    return currentList;
                });
            }
        }
        touchDragRef.current = null;
        setDraggedSectionId(null);
        setDropTarget(null);
    };

    // Initialize collapsed categories based on personality
    useEffect(() => {
        if (personalityConfig.collapseFeedsByDefault) {
            const allCats = new Set(['__smart__', ...feeds.map(f => f.category || 'Uncategorized')]);
            setCollapsedCategories(allCats);
        } else {
            setCollapsedCategories(new Set());
        }
    }, [personalityConfig.collapseFeedsByDefault, feeds.length]);

    // Toggle a category's collapsed state
    const toggleCategory = (category: string) => {
        setCollapsedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    // Toggle all categories expanded/collapsed
    const allCategories = useMemo(() => {
        return new Set(['__smart__', ...feeds.map(f => f.category || 'Uncategorized')]);
    }, [feeds]);

    const areAllCollapsed = collapsedCategories.size >= allCategories.size;

    const toggleAllCategories = () => {
        if (areAllCollapsed) {
            setCollapsedCategories(new Set());
        } else {
            setCollapsedCategories(new Set(allCategories));
        }
    };

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

    const handleOpenSettings = () => {
        if (contextMenu.feed) {
            setSettingsFeed(contextMenu.feed);
            closeContextMenu();
        }
    };

    // Get list of existing categories for autocomplete
    const existingCategories = useMemo(() => {
        const cats = new Set(feeds.map(f => f.category).filter(Boolean) as string[]);
        return Array.from(cats).sort();
    }, [feeds]);

    // Handler to rename a category (updates all feeds with that category)
    const handleRenameCategory = (oldCategory: string, newName: string) => {
        const trimmedName = newName.trim();
        const newCat = trimmedName === '' || trimmedName === 'Uncategorized' ? undefined : trimmedName;
        // Update all feeds that have this category
        feeds.forEach(feed => {
            if ((feed.category || 'Uncategorized') === oldCategory) {
                onUpdateFeed(feed.id, { ...feed, category: newCat });
            }
        });
        // Update sectionOrder so position is maintained
        if (newCat && newCat !== oldCategory) {
            setSectionOrder(prev => {
                const updated = prev.map(id => id === oldCategory ? newCat : id);
                storage.saveSectionOrder(updated);
                return updated;
            });
        }
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

    // Tooltip state
    const [tooltip, setTooltip] = useState<{ text: string, x: number, y: number, align: 'center' | 'left' } | null>(null);

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, text: string) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;


        // Simple heuristic: if the center is within 60px of the left edge, align left.
        // Otherwise align center. 
        if (centerX < 60) {
            setTooltip({
                text,
                x: rect.left, // Start at the button's left edge
                y: rect.bottom + 5,
                align: 'left'
            });
        } else {
            setTooltip({
                text,
                x: centerX,
                y: rect.bottom + 5,
                align: 'center'
            });
        }
    };

    const handleMouseLeave = () => {
        setTooltip(null);
    };

    const androidMode = isAndroid();

    return (
        <div className={`sidebar ${androidMode ? 'android' : ''}`}>
            <div className="sidebar-toolbar">
                {onOpenSettings && (
                    <button
                        className="toolbar-icon-btn"
                        onClick={() => { setTooltip(null); onOpenSettings(); }}
                        onMouseEnter={(e) => handleMouseEnter(e, "Settings")}
                        onMouseLeave={handleMouseLeave}
                    >
                        <Settings size={15} />
                    </button>
                )}
                {onRefresh && (
                    <button
                        className={`toolbar-icon-btn ${isRefreshing ? 'spinning' : ''}`}
                        onClick={() => { setTooltip(null); onRefresh(); }}
                        onMouseEnter={(e) => handleMouseEnter(e, isRefreshing ? "Stop Refresh" : "Refresh Feeds")}
                        onMouseLeave={handleMouseLeave}
                    >
                        <RefreshCw size={15} />
                    </button>
                )}
                <button
                    className={`toolbar-icon-btn ${sortOption !== 'updated' ? 'active' : ''}`}
                    onClick={() => {
                        setTooltip(null);
                        // Cycle through sort options
                        if (sortOption === 'updated') setSortOption('alpha-asc');
                        else if (sortOption === 'alpha-asc') setSortOption('alpha-desc');
                        else setSortOption('updated');
                    }}
                    onMouseEnter={(e) => handleMouseEnter(e, sortOption === 'updated' ? 'Sort: Last Updated' : sortOption === 'alpha-asc' ? 'Sort: A-Z' : 'Sort: Z-A')}
                    onMouseLeave={handleMouseLeave}
                >
                    {sortOption === 'updated' && <Clock size={15} />}
                    {sortOption === 'alpha-asc' && <ArrowDownAZ size={15} />}
                    {sortOption === 'alpha-desc' && <ArrowUpAZ size={15} />}
                </button>
                {onOpenDailyNewsreel && (
                    <button
                        className="toolbar-icon-btn"
                        onClick={() => { setTooltip(null); onOpenDailyNewsreel(); }}
                        onMouseEnter={(e) => handleMouseEnter(e, "Daily Newsreel")}
                        onMouseLeave={handleMouseLeave}
                    >
                        <Newspaper size={15} />
                    </button>
                )}
                {onMarkAllAsRead && (
                    <button
                        className="toolbar-icon-btn"
                        onClick={() => {
                            setTooltip(null);
                            if (confirm('Mark all articles as read?')) {
                                onMarkAllAsRead();
                            }
                        }}
                        onMouseEnter={(e) => handleMouseEnter(e, "Mark All as Read")}
                        onMouseLeave={handleMouseLeave}
                    >
                        <CheckCheck size={15} />
                    </button>
                )}
                <button
                    className="toolbar-icon-btn"
                    onClick={() => { setTooltip(null); toggleAllCategories(); }}
                    onMouseEnter={(e) => handleMouseEnter(e, areAllCollapsed ? "Expand All Categories" : "Collapse All Categories")}
                    onMouseLeave={handleMouseLeave}
                >
                    {areAllCollapsed ? <UnfoldVertical size={15} /> : <FoldVertical size={15} />}
                </button>
                {onOpenAskLibrary && (
                    <button
                        className="toolbar-icon-btn ask-ai-toolbar-btn"
                        onClick={() => { setTooltip(null); onOpenAskLibrary(); }}
                        onMouseEnter={(e) => handleMouseEnter(e, "Ask My Library (Cmd+Shift+K)")}
                        onMouseLeave={handleMouseLeave}
                        style={{ color: '#a855f7' }}
                    >
                        <Sparkles size={15} />
                    </button>
                )}
                {onOpenDriveMode && (
                    <button
                        className="toolbar-icon-btn drive-toolbar-btn"
                        onClick={() => { setTooltip(null); onOpenDriveMode(); }}
                        onMouseEnter={(e) => handleMouseEnter(e, "Drive Time Audio Player")}
                        onMouseLeave={handleMouseLeave}
                        style={{ color: '#38bdf8' }}
                    >
                        <Gauge size={15} />
                    </button>
                )}
                <button
                    className="toolbar-icon-btn"
                    onClick={() => { setTooltip(null); setShowDiscovery(true); }}
                    onMouseEnter={(e) => handleMouseEnter(e, "Discover Feeds")}
                    onMouseLeave={handleMouseLeave}
                >
                    <Compass size={15} />
                </button>
                <button
                    className="toolbar-icon-btn"
                    onClick={() => { setTooltip(null); setIsAdding(!isAdding); }}
                    onMouseEnter={(e) => handleMouseEnter(e, "Add Feed")}
                    onMouseLeave={handleMouseLeave}
                >
                    <Plus size={15} />
                </button>
            </div>

            {tooltip && createPortal(
                <div
                    className="portal-tooltip"
                    style={{
                        position: 'fixed',
                        top: tooltip.y,
                        left: tooltip.x,
                        transform: tooltip.align === 'left' ? 'none' : 'translateX(-50%)',
                        zIndex: 9999
                    }}
                >
                    {tooltip.text}
                </div>,
                document.body
            )}

            <div className="search-container">
                <div className="search-input-wrapper">
                    <span className="sidebar-search-icon-wrapper">
                        <Search size={14} className="search-icon" />
                    </span>
                    <input
                        type="text"
                        placeholder="Search feeds and articles..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="search-input"
                    />
                    {searchQuery && (
                        <button
                            className="search-clear-btn"
                            onClick={() => onSearchChange('')}
                            aria-label="Clear search"
                        >
                            <X size={14} />
                        </button>
                    )}
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

            <div className="feed-list" onDragOver={(e) => e.preventDefault()} onDragEnd={handleSectionDragEnd}>
                {orderedSectionIds.map(sectionId => {
                    const isSmartSection = sectionId === '__smart__';
                    const isDraggingThis = draggedSectionId === sectionId;
                    const isDropTargetThis = dropTarget?.id === sectionId;
                    const dropPositionClass = isDropTargetThis ? `drop-target-${dropTarget.position}` : '';
                    const isCollapsed = collapsedCategories.has(sectionId);

                    if (isSmartSection) {
                        return (
                            <div
                                key="__smart__"
                                className={`sidebar-section smart-section ${isDraggingThis ? 'dragging' : ''} ${dropPositionClass}`}
                                data-section-id="__smart__"
                                onDragOver={(e) => handleSectionDragOver(e, '__smart__')}
                                onDragLeave={(e) => handleSectionDragLeave(e, '__smart__')}
                                onDrop={(e) => handleSectionDrop(e, '__smart__')}
                            >
                                <div
                                    className={`category-header smart-category-header ${isCollapsed ? 'collapsed' : ''} ${feedDropCategory === '__smart__' ? 'category-feed-drop-active' : ''}`}
                                    onClick={() => toggleCategory('__smart__')}
                                    draggable={!isAdding && renamingCategory === null}
                                    onDragStart={(e) => handleSectionDragStart(e, '__smart__')}
                                    onDragEnd={handleSectionDragEnd}
                                    title="Click to expand/collapse, drag to reorder section"
                                >
                                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    <Sparkles size={14} />
                                    <span>Smart Feeds</span>
                                    {isCollapsed && getUnreadCount(null) > 0 && (
                                        <span className="unread-count category-unread-count">{getUnreadCount(null)}</span>
                                    )}
                                    <span
                                        className="section-drag-handle"
                                        title="Drag to reorder section"
                                        onTouchStart={(e) => handleTouchStart(e, '__smart__')}
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <GripVertical size={14} />
                                    </span>
                                </div>

                                {!isCollapsed && (
                                    <div className="section-content">
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
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // Category Section
                    const categoryName = sectionId;
                    const catFeeds = feedsByCategory.get(categoryName) || [];
                    if (catFeeds.length === 0 && searchQuery.trim()) {
                        return null; // hide empty categories during search
                    }

                    const categoryUnreadCount = catFeeds.reduce((sum, f) => sum + getUnreadCount(f.id), 0);

                    return (
                        <div
                            key={categoryName}
                            className={`sidebar-section category-section ${isDraggingThis ? 'dragging' : ''} ${dropPositionClass}`}
                            data-section-id={categoryName}
                            onDragOver={(e) => handleSectionDragOver(e, categoryName)}
                            onDragLeave={(e) => handleSectionDragLeave(e, categoryName)}
                            onDrop={(e) => handleSectionDrop(e, categoryName)}
                        >
                            <div
                                className={`category-header ${isCollapsed ? 'collapsed' : ''} ${feedDropCategory === categoryName ? 'category-feed-drop-active' : ''}`}
                                onClick={() => toggleCategory(categoryName)}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    startRenamingCategory(categoryName);
                                }}
                                draggable={!isAdding && renamingCategory === null && renamingFeedId === null}
                                onDragStart={(e) => handleSectionDragStart(e, categoryName)}
                                onDragEnd={handleSectionDragEnd}
                                title={categoryName !== 'Uncategorized' ? 'Click to expand/collapse, double-click to rename, drag to reorder' : 'Click to expand/collapse, drag to reorder'}
                            >
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                <Folder size={14} />
                                {renamingCategory === categoryName ? (
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleRenameCategory(categoryName, newCategoryName);
                                            } else if (e.key === 'Escape') {
                                                setRenamingCategory(null);
                                                setNewCategoryName('');
                                            }
                                        }}
                                        onBlur={() => handleRenameCategory(categoryName, newCategoryName)}
                                        className="category-rename-input"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span>{categoryName}</span>
                                )}
                                {isCollapsed && categoryUnreadCount > 0 && (
                                    <span className="unread-count category-unread-count">{categoryUnreadCount}</span>
                                )}
                                <span
                                    className="section-drag-handle"
                                    title="Drag to reorder section"
                                    onTouchStart={(e) => handleTouchStart(e, categoryName)}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <GripVertical size={14} />
                                </span>
                            </div>

                            {!isCollapsed && (
                                <div className="section-content">
                                    {catFeeds.map(feed => (
                                        <div
                                            key={feed.id}
                                            className={`feed-item has-actions ${selectedFeedId === feed.id ? 'active' : ''} ${renamingFeedId === feed.id ? 'renaming' : ''} ${draggedFeedId === feed.id ? 'feed-dragging' : ''}`}
                                            onClick={() => {
                                                if (renamingFeedId !== feed.id) {
                                                    onSelectFeed(feed.id);
                                                }
                                            }}
                                            onContextMenu={(e) => handleContextMenu(e, feed)}
                                            draggable={renamingFeedId !== feed.id && categorizingFeedId !== feed.id}
                                            onDragStart={(e) => handleFeedDragStart(e, feed.id)}
                                            onDragEnd={handleFeedDragEnd}
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
                                            {feed.type === 'web' ? (
                                                <Globe size={16} className={feed.icon ? 'hidden' : ''} />
                                            ) : (
                                                <Rss size={16} className={feed.icon ? 'hidden' : ''} />
                                            )}
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
                                    ))}
                                </div>
                            )}
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
                        <div className="context-menu-divider"></div>
                        <div className="context-menu-item" onClick={handleOpenSettings}>
                            <Settings size={14} />
                            <span>Settings</span>
                        </div>
                    </div>,
                    document.body
                )
            }
            {
                settingsFeed && (
                    <FeedSettingsModal
                        feed={settingsFeed}
                        onClose={() => setSettingsFeed(null)}
                        onSave={onUpdateFeed}
                    />
                )
            }
        </div >
    );
}
