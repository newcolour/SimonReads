import { useState, useRef, useEffect } from 'react';
import {
    Rss, Home, Bookmark, List, Settings,
    ChevronRight, ChevronLeft, RefreshCw, Newspaper,
    CheckCheck, Trash2, Search, X, Plus, Sparkles, ArrowLeft,
    ArrowDownAZ, ArrowUpAZ, Clock, Calendar, CheckCircle2
} from 'lucide-react';
import { useMemo } from 'react';
import { Article, Feed, AppSettings } from '../types';
import FeedDiscovery from './FeedDiscovery';
import ArticleView from './ArticleView';
import { isAndroid } from '../utils/platform';
import './ModernLayout.css';

interface ModernLayoutProps {
    feeds: Feed[];
    articles: Article[];
    settings: AppSettings;
    selectedArticle: Article | null;
    onSelectArticle: (article: Article) => void;
    onRefresh: () => void;
    onOpenSettings: () => void;
    onOpenDailyNewsreel: () => void;
    onMarkAllAsRead: () => void;
    onToggleSaved: (article: Article) => void;
    onDeleteArticle: (article: Article) => void;
    onAddFeed: (url: string) => Promise<void>;
    onRemoveFeed: (feedId: string) => void;
    onRefreshFeed: (feedId: string) => Promise<void>;
    onMarkFeedAsRead: (feedId: string) => void;
    isRefreshing: boolean;
    isNewsreelGenerating?: boolean;
    isNewsreelReady?: boolean;
    newsreelProgress?: string;
    newsreelError?: string | null;
}

export default function ModernLayout({
    feeds,
    articles,
    settings,
    selectedArticle,
    onSelectArticle,
    onRefresh,
    onOpenSettings,
    onOpenDailyNewsreel,
    onMarkAllAsRead,
    onMarkFeedAsRead,
    onToggleSaved,
    onDeleteArticle,
    onAddFeed,
    onRemoveFeed,
    onRefreshFeed,
    isRefreshing,
    isNewsreelGenerating,
    isNewsreelReady,
    newsreelProgress,
    newsreelError
}: ModernLayoutProps) {
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const [activeSection, setActiveSection] = useState<'home' | 'saved' | 'read' | 'feeds'>('home');
    const [activeFeedId, setActiveFeedId] = useState<string | null>(null);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Add Feed & Discovery state
    const [showDiscovery, setShowDiscovery] = useState(false);
    const [isAddingFeed, setIsAddingFeed] = useState(false);
    const [newFeedUrl, setNewFeedUrl] = useState('');

    const sidebarRef = useRef<HTMLDivElement>(null);
    const carouselRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const carouselSectionRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>();

    const [feedSort, setFeedSort] = useState<'alpha-asc' | 'alpha-desc' | 'newest' | 'oldest'>('newest');

    const sortedFeeds = useMemo(() => {
        return [...feeds].sort((a, b) => {
            if (feedSort === 'alpha-asc') {
                return a.title.localeCompare(b.title);
            }
            if (feedSort === 'alpha-desc') {
                return b.title.localeCompare(a.title);
            }

            // Helper to get latest article timestamp for a feed
            const getLastDate = (feedId: string) => {
                const feedArticles = articles.filter(art => art.feedId === feedId);
                if (feedArticles.length === 0) return 0;
                // Assuming articles are reasonably sorted, but lets maximize
                return Math.max(...feedArticles.map(art => new Date(art.pubDate || 0).getTime()));
            };

            const dateA = getLastDate(a.id);
            const dateB = getLastDate(b.id);

            if (feedSort === 'newest') return dateB - dateA;
            if (feedSort === 'oldest') return dateA - dateB;
            return 0;
        });
    }, [feeds, articles, feedSort]);

    // Memoized sorted articles (prevents mutation and ensures consistent order)
    const sortedArticles = useMemo(() => {
        return [...articles].sort((a, b) => {
            const dateA = new Date(a.pubDate || 0).getTime();
            const dateB = new Date(b.pubDate || 0).getTime();
            // Default to newest first
            return dateB - dateA;
        });
    }, [articles]);

    // Apply the collapse effect to carousel and header
    const applyCollapseEffect = (percent: number) => {
        if (!carouselSectionRef.current) return;

        // Smoother cubic easing
        const eased = percent < 0.5
            ? 4 * percent * percent * percent
            : 1 - Math.pow(-2 * percent + 2, 3) / 2;

        // Visual fade out only - NO LAYOUT CHANGES
        const opacity = Math.max(0, 1 - eased * 1.5); // Fade out slightly faster

        // Apply visual styles only
        carouselSectionRef.current.style.opacity = `${opacity}`;
        carouselSectionRef.current.style.filter = `blur(${eased * 2}px)`;

        // Gentle parallax/scale effect (keeps element in place but moves content slightly)
        // We do NOT change height or margin to avoid flutter/layout thrashing
        const scale = 1 - (eased * 0.05);
        carouselSectionRef.current.style.transform = `scale(${scale})`;
        carouselSectionRef.current.style.transformOrigin = 'center center';

        // Header (Search Bar) visual effects
        if (headerRef.current) {
            headerRef.current.style.opacity = `${opacity}`;
            headerRef.current.style.transform = `scale(${scale})`;
            headerRef.current.style.transformOrigin = 'center center';
        }

        // Disable pointer events when invisible to prevent accidental clicks
        const hidden = opacity < 0.1;
        carouselSectionRef.current.style.pointerEvents = hidden ? 'none' : 'auto';
        if (headerRef.current) {
            headerRef.current.style.pointerEvents = hidden ? 'none' : 'auto';
        }
    };

    const handleScroll = () => {
        if (!contentRef.current || !carouselSectionRef.current) return;

        // Cancel previous frame to prevent stacking
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }

        // Schedule visual update
        rafRef.current = requestAnimationFrame(() => {
            if (!contentRef.current) return;
            const scrollTop = contentRef.current.scrollTop;
            const maxDist = 180;
            const percent = Math.min(scrollTop / maxDist, 1);
            applyCollapseEffect(percent);
        });
    };

    const handleAddFeedSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newFeedUrl.trim()) {
            try {
                // Import podcast service dynamically
                const { convertPodcastUrlToRss, isPodcastPlatformUrl } = await import('../podcastService');
                let feedUrl = newFeedUrl.trim();
                if (isPodcastPlatformUrl(feedUrl)) {
                    feedUrl = await convertPodcastUrlToRss(feedUrl);
                }
                await onAddFeed(feedUrl);
                setNewFeedUrl('');
                setIsAddingFeed(false);
            } catch (error) {
                console.error('Failed to add feed:', error);
                alert('Failed to add feed. Please check the URL.');
            }
        }
    };

    // Filter articles based on section and search
    const filteredArticles = sortedArticles.filter(article => {
        // Apply search filter first - when searching, show results across all feeds
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSearch = (
                article.title.toLowerCase().includes(query) ||
                article.feedTitle?.toLowerCase().includes(query) ||
                article.contentSnippet?.toLowerCase().includes(query)
            );

            if (!matchesSearch) return false;

            // When searching, still respect special section filters
            if (activeSection === 'saved') {
                return article.isSaved;
            }
            if (activeSection === 'read') {
                return article.isRead;
            }
            // But ignore feed selection when searching
            return true;
        }

        // No search query - use normal section/feed filtering
        if (activeSection === 'saved') {
            return article.isSaved;
        }

        if (activeSection === 'read') {
            return article.isRead;
        }

        // Apply feed filter
        if (activeSection === 'feeds' && activeFeedId) {
            return article.feedId === activeFeedId;
        }

        return true;
    });

    // Reset carousel when section changes
    useEffect(() => {
        setCarouselIndex(0);
        if (carouselRef.current) {
            carouselRef.current.scrollTo({ left: 0, behavior: 'instant' });
        }
    }, [activeSection, activeFeedId]);

    // Get articles for carousel
    // For Home: Show unread only (Dashboard style)
    // For Feeds/Saved: Show all matching articles
    const carouselArticles = activeSection === 'home'
        ? filteredArticles.filter(a => !a.isRead).slice(0, 15)
        : filteredArticles.slice(0, 50);

    // Get featured article (first in list or selected)
    const featuredArticle = selectedArticle || filteredArticles[0];

    // Handle clicking outside sidebar to close it
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setSidebarExpanded(false);
            }
        };

        if (sidebarExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [sidebarExpanded]);

    const scrollCarousel = (direction: 'left' | 'right') => {
        const cardWidth = 220;
        const newIndex = direction === 'left'
            ? Math.max(0, carouselIndex - 1)
            : Math.min(carouselArticles.length - 4, carouselIndex + 1);
        setCarouselIndex(newIndex);

        if (carouselRef.current) {
            carouselRef.current.scrollTo({
                left: newIndex * cardWidth,
                behavior: 'smooth'
            });
        }
    };

    const getArticleImage = (article: Article): string | null => {
        // Try to extract image from content
        if (article.content) {
            const imgMatch = article.content.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (imgMatch) return imgMatch[1];
        }
        // Try enclosure
        if (article.enclosure?.url && article.enclosure.type?.startsWith('image/')) {
            return article.enclosure.url;
        }
        return null;
    };

    const getFeedIcon = (article: Article): string => {
        const feed = feeds.find(f => f.id === article.feedId);
        return feed?.icon || `https://www.google.com/s2/favicons?domain=${new URL(article.link).hostname}&sz=64`;
    };

    const androidMode = isAndroid();

    return (
        <div className={`modern-layout ${androidMode ? 'android' : ''}`} data-theme={settings.theme}>
            {/* Android Top Bar */}
            {androidMode && (
                <div className="android-topbar">
                    <div className="android-topbar-icons">
                        <button
                            className={`android-icon ${activeSection === 'home' ? 'active' : ''}`}
                            onClick={() => setActiveSection('home')}
                        >
                            <Home size={28} />
                        </button>

                        <button
                            className={`android-icon ${activeSection === 'saved' ? 'active' : ''}`}
                            onClick={() => setActiveSection('saved')}
                        >
                            <Bookmark size={28} />
                        </button>

                        <button
                            className={`android-icon ${activeSection === 'feeds' && !activeFeedId ? 'active' : ''}`}
                            onClick={() => { setActiveSection('feeds'); setActiveFeedId(null); }}
                        >
                            <List size={28} />
                        </button>

                        <button
                            className={`android-icon ${activeSection === 'read' ? 'active' : ''}`}
                            onClick={() => setActiveSection('read')}
                        >
                            <CheckCircle2 size={28} />
                        </button>

                        <button
                            className="android-icon"
                            onClick={() => setIsAddingFeed(true)}
                        >
                            <Plus size={28} />
                        </button>

                        <button
                            className="android-icon"
                            onClick={() => setShowDiscovery(true)}
                        >
                            <Sparkles size={28} />
                        </button>

                        <button
                            className="android-icon"
                            onClick={onOpenDailyNewsreel}
                        >
                            {isNewsreelGenerating ? (
                                <RefreshCw size={28} className="spinning" />
                            ) : (
                                <div style={{ position: 'relative', display: 'flex' }}>
                                    <Newspaper size={28} />
                                    {isNewsreelReady && <div className="notification-dot" />}
                                </div>
                            )}
                        </button>

                        <button
                            className="android-icon"
                            onClick={onRefresh}
                        >
                            <RefreshCw size={28} className={isRefreshing ? 'spinning' : ''} />
                        </button>

                        <button
                            className="android-icon"
                            onClick={onMarkAllAsRead}
                        >
                            <CheckCheck size={28} />
                        </button>

                        <button
                            className="android-icon"
                            onClick={onOpenSettings}
                        >
                            <Settings size={28} />
                        </button>
                    </div>
                </div>
            )}

            {/* Slim Icon Sidebar - Desktop/Web only */}
            {!androidMode && (
                <div
                    ref={sidebarRef}
                    className={`modern-sidebar ${sidebarExpanded ? 'expanded' : ''}`}
                    onMouseEnter={() => setSidebarExpanded(true)}
                    onMouseLeave={() => setSidebarExpanded(false)}
                >
                    <div className="sidebar-top">
                        {/* App Logo */}
                        <div className="sidebar-logo" onClick={() => setSidebarExpanded(!sidebarExpanded)}>
                            <Rss size={24} />
                            {sidebarExpanded && <span>SimonReads</span>}
                        </div>

                        {/* Navigation Icons */}
                        <button
                            className={`sidebar-icon ${activeSection === 'home' ? 'active' : ''}`}
                            onClick={() => setActiveSection('home')}
                            title="Home"
                        >
                            <Home size={22} />
                            {sidebarExpanded && <span>Home</span>}
                        </button>

                        <button
                            className={`sidebar-icon ${activeSection === 'saved' ? 'active' : ''}`}
                            onClick={() => setActiveSection('saved')}
                            title="Saved Articles"
                        >
                            <Bookmark size={22} />
                            {sidebarExpanded && <span>Saved</span>}
                        </button>

                        <button
                            className={`sidebar-icon ${activeSection === 'feeds' && !activeFeedId ? 'active' : ''}`}
                            onClick={() => { setActiveSection('feeds'); setActiveFeedId(null); }}
                            title="Manage Feeds"
                        >
                            <List size={22} />
                            {sidebarExpanded && <span>Feeds</span>}
                        </button>

                        <button
                            className={`sidebar-icon ${activeSection === 'read' ? 'active' : ''}`}
                            onClick={() => setActiveSection('read')}
                            title="Read Articles"
                        >
                            <CheckCircle2 size={22} />
                            {sidebarExpanded && <span>Read</span>}
                        </button>

                        <button
                            className="sidebar-icon"
                            onClick={() => setIsAddingFeed(true)}
                            title="Add Feed"
                        >
                            <Plus size={22} />
                            {sidebarExpanded && <span>Add Feed</span>}
                        </button>

                        <button
                            className="sidebar-icon"
                            onClick={() => setShowDiscovery(true)}
                            title="Discover Feeds"
                        >
                            <Sparkles size={22} />
                            {sidebarExpanded && <span>Discover</span>}
                        </button>

                        <button
                            className="sidebar-icon"
                            onClick={onOpenDailyNewsreel}
                            title={isNewsreelGenerating ? (newsreelProgress || "Generating...") : isNewsreelReady ? "Newsreel Ready! Click to open." : "Daily Newsreel"}
                        >
                            {isNewsreelGenerating ? (
                                <RefreshCw size={22} className="spinning" />
                            ) : (
                                <div style={{ position: 'relative', display: 'flex' }}>
                                    <Newspaper size={22} />
                                    {isNewsreelReady && <div className="notification-dot" />}
                                </div>
                            )}
                            {sidebarExpanded && (
                                <span style={{ fontSize: isNewsreelGenerating ? '11px' : '14px' }}>
                                    {isNewsreelGenerating ? (newsreelProgress || 'Generating...') : isNewsreelReady ? '✓ Ready!' : 'Newsreel'}
                                </span>
                            )}
                        </button>

                        <button
                            className="sidebar-icon"
                            onClick={onRefresh}
                            title={isRefreshing ? "Stop Refresh" : "Refresh Feeds"}
                        >
                            <RefreshCw size={22} className={isRefreshing ? 'spinning' : ''} />
                            {sidebarExpanded && <span>{isRefreshing ? 'Stop' : 'Refresh'}</span>}
                        </button>

                        <button
                            className="sidebar-icon"
                            onClick={onMarkAllAsRead}
                            title="Mark All as Read"
                        >
                            <CheckCheck size={22} />
                            {sidebarExpanded && <span>Mark Read</span>}
                        </button>
                    </div>

                    <div className="sidebar-bottom">
                        <button
                            className="sidebar-icon"
                            onClick={onOpenSettings}
                            title="Settings"
                        >
                            <Settings size={22} />
                            {sidebarExpanded && <span>Settings</span>}
                        </button>
                    </div>
                </div>
            )}

            <div
                className="modern-content"
                ref={contentRef}
                onScroll={handleScroll}
            >
                {/* Newsreel Error Banner */}
                {newsreelError && (
                    <div className="newsreel-error-banner" style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        color: 'var(--text-primary)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                background: '#ef4444',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: 'bold'
                            }}>!</div>
                            <div>
                                <div style={{ fontWeight: 600 }}>Newsreel Generation Failed</div>
                                <div style={{ fontSize: '13px', opacity: 0.8 }}>
                                    {newsreelError === 'QUOTA_EXCEEDED'
                                        ? 'All fallback models are also out of quota. Please try a different service or wait.'
                                        : newsreelError || 'The AI model could not generate the newsreel.'}
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={onOpenSettings}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                Open Settings
                            </button>
                        </div>
                    </div>
                )}

                {/* Search Bar */}
                <div className="modern-header" ref={headerRef}>
                    <div className="modern-search-container">
                        {showSearch ? (
                            <div className="modern-search-input-wrapper">
                                <Search size={18} />
                                <input
                                    type="text"
                                    placeholder="Search articles..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                                    <X size={18} />
                                </button>
                            </div>
                        ) : (
                            <button className="modern-search-toggle" onClick={() => setShowSearch(true)}>
                                <Search size={20} />
                            </button>
                        )}
                    </div>
                    <div className="modern-header-stats">
                        <span>{filteredArticles.filter(a => !a.isRead).length} unread</span>
                    </div>
                </div>

                {/* Article Carousel */}
                {activeSection === 'feeds' && !activeFeedId ? (
                    <div className="feeds-section">
                        <div className="feeds-header">
                            <div className="feeds-header-left">
                                <h2>Your Feeds</h2>
                                <span className="modern-feed-count">{feeds.length} feeds</span>
                            </div>
                            <div className="feeds-sort-actions">
                                <button
                                    className={`sort-action ${feedSort === 'alpha-asc' || feedSort === 'alpha-desc' ? 'active' : ''}`}
                                    onClick={() => setFeedSort(feedSort === 'alpha-asc' ? 'alpha-desc' : 'alpha-asc')}
                                    title={feedSort === 'alpha-asc' ? 'Click for Z-A' : feedSort === 'alpha-desc' ? 'Click for A-Z' : 'Sort Alphabetically'}
                                >
                                    {feedSort === 'alpha-desc' ? <ArrowUpAZ size={16} /> : <ArrowDownAZ size={16} />}
                                    <span>{feedSort === 'alpha-desc' ? 'Z-A' : 'A-Z'}</span>
                                </button>
                                <button
                                    className={`sort-action ${feedSort === 'newest' ? 'active' : ''}`}
                                    onClick={() => setFeedSort('newest')}
                                    title="Sort by Newest Articles First"
                                >
                                    <Clock size={16} />
                                    <span>Newest</span>
                                </button>
                                <button
                                    className={`sort-action ${feedSort === 'oldest' ? 'active' : ''}`}
                                    onClick={() => setFeedSort('oldest')}
                                    title="Sort by Oldest Articles First"
                                >
                                    <Calendar size={16} />
                                    <span>Oldest</span>
                                </button>
                            </div>
                        </div>
                        <div className="feeds-grid">
                            {sortedFeeds.map(feed => {
                                const unreadCount = articles.filter(a => a.feedId === feed.id && !a.isRead).length;
                                return (
                                    <div
                                        key={feed.id}
                                        className="modern-feed-card"
                                        onClick={() => setActiveFeedId(feed.id)}
                                        style={{ cursor: 'pointer' }}
                                    >

                                        <div className="modern-feed-icon">
                                            {feed.icon ? (
                                                <img
                                                    src={feed.icon}
                                                    alt=""
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        const svg = e.currentTarget.parentElement?.querySelector('svg');
                                                        if (svg) svg.style.display = 'block';
                                                    }}
                                                />
                                            ) : null}
                                            <Newspaper size={24} style={{ display: feed.icon ? 'none' : 'block' }} />
                                        </div>
                                        <div className="modern-feed-details">
                                            <h3>{feed.title}</h3>
                                            <p>
                                                {unreadCount > 0 ? (
                                                    <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
                                                        {unreadCount} unread
                                                    </span>
                                                ) : 'All read'}
                                            </p>
                                        </div>
                                        <div className="modern-feed-actions">
                                            {unreadCount > 0 && (
                                                <button
                                                    className="modern-feed-action-btn"
                                                    title="Mark All Read"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onMarkFeedAsRead(feed.id);
                                                    }}
                                                >
                                                    <CheckCheck size={16} />
                                                </button>
                                            )}
                                            <button
                                                className="modern-feed-action-btn"
                                                title="Refresh Feed"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRefreshFeed(feed.id);
                                                }}
                                            >
                                                <RefreshCw size={16} />
                                            </button>
                                            <button
                                                className="modern-feed-action-btn delete"
                                                title="Unsubscribe"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm(`Are you sure you want to unsubscribe from ${feed.title}?`)) {
                                                        onRemoveFeed(feed.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="carousel-section" ref={carouselSectionRef}>
                            <div className="carousel-header">
                                <h2>
                                    {activeSection === 'home' && 'Latest Articles'}
                                    {activeSection === 'saved' && 'Saved Articles'}
                                    {activeSection === 'read' && 'Read Articles'}
                                    {activeSection === 'feeds' && activeFeedId ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <button
                                                onClick={() => setActiveFeedId(null)}
                                                style={{
                                                    background: 'var(--bg-secondary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    padding: '6px',
                                                    color: 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s ease'
                                                }}
                                                title="Back to feeds"
                                            >
                                                <ArrowLeft size={18} />
                                            </button>
                                            <span>{feeds.find(f => f.id === activeFeedId)?.title || 'Feed Articles'}</span>
                                        </div>
                                    ) : null}
                                </h2>
                                <div className="carousel-nav">
                                    <button
                                        onClick={() => scrollCarousel('left')}
                                        disabled={carouselIndex === 0}
                                    >
                                        <ChevronLeft size={20} />
                                    </button>
                                    <button
                                        onClick={() => scrollCarousel('right')}
                                        disabled={carouselIndex >= carouselArticles.length - 4}
                                    >
                                        <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="carousel-container" ref={carouselRef}>
                                {carouselArticles.map((article) => {
                                    const image = getArticleImage(article);
                                    return (
                                        <div
                                            key={article.id}
                                            className={`carousel-card ${selectedArticle?.id === article.id ? 'selected' : ''} ${!article.isRead ? 'unread' : ''}`}
                                            onClick={() => onSelectArticle(article)}
                                        >
                                            <div className="card-image">
                                                {image ? (
                                                    <img src={image} alt="" loading="lazy" />
                                                ) : (
                                                    <div className="card-image-placeholder">
                                                        <img src={getFeedIcon(article)} alt="" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="card-content">
                                                <h3>{article.title}</h3>
                                                <p>{article.feedTitle || 'Unknown Source'}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {featuredArticle && (
                            <div
                                className="embedded-article-view"
                                style={{ minHeight: '100vh' }}
                            >
                                <ArticleView
                                    key={featuredArticle.id}
                                    article={featuredArticle}
                                    feed={feeds.find(f => f.id === featuredArticle.feedId)}
                                    settings={settings}
                                    allArticles={articles}
                                    onClose={() => { }}
                                    onDelete={(id) => {
                                        const article = articles.find(a => a.id === id);
                                        if (article) onDeleteArticle(article);
                                    }}
                                    onToggleSaved={(id) => {
                                        const article = articles.find(a => a.id === id);
                                        if (article) onToggleSaved(article);
                                    }}
                                    onSelectArticle={onSelectArticle}
                                />
                            </div>
                        )}
                    </>
                )}
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
                isAddingFeed && (
                    <div className="modal-overlay" onClick={() => setIsAddingFeed(false)}>
                        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '500px' }}>
                            <div className="modal-header">
                                <h2>Add Feed</h2>
                                <button className="close-btn" onClick={() => setIsAddingFeed(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleAddFeedSubmit} style={{ padding: '20px' }}>
                                <input
                                    type="url"
                                    placeholder="RSS URL or Apple/Spotify Podcast link..."
                                    value={newFeedUrl}
                                    onChange={(e) => setNewFeedUrl(e.target.value)}
                                    autoFocus
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        marginBottom: '16px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '16px'
                                    }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingFeed(false)}
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            background: 'transparent',
                                            color: 'var(--text-primary)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            background: 'var(--accent-color)',
                                            color: 'white',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <Plus size={16} />
                                        Add Feed
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
