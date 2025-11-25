import { useState, useEffect, useCallback, useMemo } from 'react';
import { Feed, Article, AppSettings } from './types';
import { fetchFeed, fetchFeedIcon, fetchFeedDetails } from './rssService';
import { storage } from './storage';
import Sidebar from './components/Sidebar';
import ArticleList from './components/ArticleList';
import ArticleView from './components/ArticleView';
import Toolbar from './components/Toolbar';
import Newsreel from './components/Newsreel';
import WelcomeTour from './components/WelcomeTour';
import { parseOpml } from './importService';
import './App.css';

function App() {
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [selectedArticleIds, setSelectedArticleIds] = useState<Set<string>>(new Set());
    const [showNewsreel, setShowNewsreel] = useState(false);
    const [showDailyNewsreel, setShowDailyNewsreel] = useState(false);
    const [settings, setSettings] = useState<AppSettings>({
        autoRefreshInterval: 0,
        retentionPeriod: 30,
        theme: 'system',
        font: 'system-ui',
        fontSize: 'medium',
        summaryTone: 'neutral',
        summaryLanguage: 'English',
        summaryLength: 'medium',
        summaryDepth: 'detailed',
        summaryPrompt: '',
        readAloudLanguage: 'en',
        ttsProvider: 'free',
        aiProvider: 'gemini',
        dailyNewsreelTimeHorizon: 24,
        // Email settings
        emailEnabled: false,
        emailSmtpHost: '',
        emailSmtpPort: 587,
        emailSmtpSecure: false,
        emailSmtpUser: '',
        emailSmtpPassword: '',
        emailFrom: '',
        emailTo: '',
        emailSendTime: '08:00',
        emailTimeHorizon: 12
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showWelcomeTour, setShowWelcomeTour] = useState(false);

    // Load data from storage on mount
    useEffect(() => {
        const savedFeeds = storage.getFeeds();
        const savedArticles = storage.getArticles();
        const savedSettings = storage.getSettings();

        setFeeds(savedFeeds);
        setArticles(savedArticles);
        setSettings({
            theme: savedSettings.theme || 'dark',
            font: savedSettings.font || 'system-ui',
            fontSize: savedSettings.fontSize || 'medium',
            autoRefreshInterval: savedSettings.autoRefreshInterval || 0,
            retentionPeriod: savedSettings.retentionPeriod ?? 30,
            geminiApiKey: savedSettings.geminiApiKey || '',
            geminiModel: savedSettings.geminiModel || 'gemini-flash-latest',
            openaiApiKey: savedSettings.openaiApiKey || '',
            summaryTone: savedSettings.summaryTone ?? 'neutral',
            summaryLanguage: savedSettings.summaryLanguage ?? 'English',
            summaryLength: savedSettings.summaryLength ?? 'medium',
            summaryDepth: savedSettings.summaryDepth ?? 'detailed',
            summaryPrompt: savedSettings.summaryPrompt ?? '',
            readAloudLanguage: savedSettings.readAloudLanguage ?? 'en',
            ttsProvider: savedSettings.ttsProvider ?? 'free',
            aiProvider: savedSettings.aiProvider || 'gemini',
            dailyNewsreelTimeHorizon: savedSettings.dailyNewsreelTimeHorizon ?? 24,
            // Email settings
            emailEnabled: savedSettings.emailEnabled ?? false,
            emailSmtpHost: savedSettings.emailSmtpHost ?? '',
            emailSmtpPort: savedSettings.emailSmtpPort ?? 587,
            emailSmtpSecure: savedSettings.emailSmtpSecure ?? false,
            emailSmtpUser: savedSettings.emailSmtpUser ?? '',
            emailSmtpPassword: savedSettings.emailSmtpPassword ?? '',
            emailFrom: savedSettings.emailFrom ?? '',
            emailTo: savedSettings.emailTo ?? '',
            emailSendTime: savedSettings.emailSendTime ?? '08:00',
            emailTimeHorizon: savedSettings.emailTimeHorizon ?? 12
        });

        // Check if this is the first time the app is opened
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        if (!hasSeenWelcome) {
            setShowWelcomeTour(true);
        }
    }, []);

    // Disabled automatic cleanup of read articles – user now retains all read items.
    // Previously, a useEffect removed read articles older than the retention period.
    // This behavior has been removed to keep read articles indefinitely.


    // Apply theme and font settings
    useEffect(() => {
        console.log('Theme useEffect triggered. Current theme setting:', settings.theme);

        // Determine the actual theme to apply
        let actualTheme = settings.theme;

        if (settings.theme === 'system') {
            const ipcRenderer = (window as any).ipcRenderer;

            if (ipcRenderer) {
                // Use Electron's nativeTheme API
                console.log('Using Electron nativeTheme API');

                // Get initial theme
                ipcRenderer.invoke('get-system-theme').then((theme: string) => {
                    console.log('Initial system theme:', theme);
                    document.documentElement.setAttribute('data-theme', theme);
                }).catch((err: any) => console.error('Failed to get system theme:', err));

                // Listen for system theme changes
                const handleSystemThemeChange = (_event: any, theme: string) => {
                    console.log('System theme changed:', theme);
                    document.documentElement.setAttribute('data-theme', theme);
                };

                ipcRenderer.on('system-theme-changed', handleSystemThemeChange);

                // Cleanup
                return () => {
                    ipcRenderer.removeListener('system-theme-changed', handleSystemThemeChange);
                };
            } else {
                // Fallback to CSS media query
                console.log('Using CSS media query fallback');
                const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
                actualTheme = darkModeQuery.matches ? 'dark' : 'light';

                console.log('  - Dark mode?', darkModeQuery.matches, '→', actualTheme);

                const handleThemeChange = (e: MediaQueryListEvent) => {
                    const newTheme = e.matches ? 'dark' : 'light';
                    console.log('CSS theme changed:', newTheme);
                    document.documentElement.setAttribute('data-theme', newTheme);
                };

                darkModeQuery.addEventListener('change', handleThemeChange);

                return () => {
                    darkModeQuery.removeEventListener('change', handleThemeChange);
                };
            }
        }

        console.log('Setting theme to:', actualTheme);
        document.documentElement.setAttribute('data-theme', actualTheme);
        document.documentElement.style.setProperty('--app-font', settings.font);

        const fontSizes = {
            small: '13px',
            medium: '14px',
            large: '16px',
            xlarge: '18px'
        };
        document.documentElement.style.setProperty('--app-font-size', fontSizes[settings.fontSize] || '14px');
    }, [settings.theme, settings.font, settings.fontSize]);

    // Auto-refresh logic
    useEffect(() => {
        if (settings.autoRefreshInterval > 0) {
            const intervalMs = settings.autoRefreshInterval * 60 * 1000;
            const intervalId = setInterval(() => {
                handleRefresh();
            }, intervalMs);

            return () => clearInterval(intervalId);
        }
    }, [settings.autoRefreshInterval, feeds]);

    // Data Integrity Check: Duplicate Feed IDs
    useEffect(() => {
        const seenIds = new Set<string>();
        let hasDuplicates = false;
        const newFeeds = [...feeds];

        for (let i = 0; i < newFeeds.length; i++) {
            if (seenIds.has(newFeeds[i].id)) {
                console.warn(`Found duplicate feed ID: ${newFeeds[i].id}. Regenerating...`);
                newFeeds[i] = { ...newFeeds[i], id: crypto.randomUUID() };
                hasDuplicates = true;
            } else {
                seenIds.add(newFeeds[i].id);
            }
        }

        if (hasDuplicates) {
            setFeeds(newFeeds);
            storage.saveFeeds(newFeeds);
            // Trigger refresh to populate new IDs
            setTimeout(() => handleRefresh(), 100);
        }
    }, []); // Run once on mount

    // Data Integrity Check: Orphan Articles
    useEffect(() => {
        // Only run if we have feeds loaded
        if (feeds.length === 0 && articles.length === 0) return;

        const feedIds = new Set(feeds.map(f => f.id));
        const validArticles = articles.filter(a => feedIds.has(a.feedId));

        if (validArticles.length !== articles.length) {
            console.log(`Removing ${articles.length - validArticles.length} orphan articles`);
            setArticles(validArticles);
            storage.saveArticles(validArticles);
        }
    }, [feeds, articles.length]); // Run when feeds or article count changes

    // Email Scheduler (Electron only)
    useEffect(() => {
        const ipcRenderer = (window as any).ipcRenderer;
        if (!ipcRenderer) return;

        // Update schedule when settings change
        ipcRenderer.send('update-email-schedule', settings.emailEnabled, settings.emailSendTime);

        // Listen for trigger
        const handleTriggerEmail = async () => {
            console.log('Triggering daily email...');
            // Filter articles based on time horizon
            const timeHorizonHours = settings.emailTimeHorizon || 12;
            const cutoffTime = new Date(Date.now() - timeHorizonHours * 60 * 60 * 1000);

            const recentArticles = articles.filter(a => {
                const pubDate = a.pubDate ? new Date(a.pubDate) : new Date();
                return pubDate >= cutoffTime;
            });

            if (recentArticles.length === 0) {
                console.log('No recent articles to send.');
                return;
            }

            const emailSettings = {
                enabled: settings.emailEnabled,
                smtpHost: settings.emailSmtpHost,
                smtpPort: settings.emailSmtpPort,
                smtpSecure: settings.emailSmtpSecure,
                smtpUser: settings.emailSmtpUser,
                smtpPassword: settings.emailSmtpPassword,
                fromEmail: settings.emailFrom,
                toEmail: settings.emailTo,
                sendTime: settings.emailSendTime,
                timeHorizon: settings.emailTimeHorizon
            };

            try {
                await ipcRenderer.invoke('send-daily-email', {
                    articles: recentArticles,
                    emailSettings,
                    appSettings: settings
                });
                console.log('Daily email sent successfully.');
            } catch (error) {
                console.error('Failed to send daily email:', error);
            }
        };

        ipcRenderer.on('trigger-daily-email', handleTriggerEmail);

        return () => {
            ipcRenderer.removeListener('trigger-daily-email', handleTriggerEmail);
        };
    }, [settings.emailEnabled, settings.emailSendTime, settings.emailTimeHorizon, articles, settings]);

    const handleRefresh = useCallback(async () => {
        if (feeds.length === 0 || isRefreshing) return;

        setIsRefreshing(true);
        const fetchedArticles: Article[] = [];
        const updatedFeeds = [...feeds];

        for (let i = 0; i < feeds.length; i++) {
            try {
                const feedArticles = await fetchFeed(feeds[i]);
                fetchedArticles.push(...feedArticles);
                updatedFeeds[i] = { ...feeds[i], lastFetched: new Date() };
            } catch (error) {
                console.error(`Failed to refresh feed: ${feeds[i].title}`);
            }
        }

        // Create a map of existing articles for quick lookup
        const existingArticlesMap = new Map(articles.map(a => [a.id, a]));

        // Process fetched articles
        const mergedArticles: Article[] = fetchedArticles.map(newArticle => {
            const existing = existingArticlesMap.get(newArticle.id);
            if (existing) {
                // Remove from map to track what's left (articles no longer in feed)
                existingArticlesMap.delete(newArticle.id);
                // Update content but preserve local state (isRead)
                return { ...newArticle, isRead: existing.isRead };
            }
            return newArticle;
        });

        // Add remaining existing articles (those that fell off the RSS feed)
        // This ensures we don't delete articles just because they are old
        mergedArticles.push(...Array.from(existingArticlesMap.values()));

        // Sort by date descending
        mergedArticles.sort((a, b) => {
            const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
            const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
            return dateB - dateA;
        });

        setArticles(mergedArticles);
        setFeeds(updatedFeeds);
        storage.saveArticles(mergedArticles);
        storage.saveFeeds(updatedFeeds);
        setIsRefreshing(false);
    }, [feeds, articles, isRefreshing]);

    const handleAddFeed = async (url: string) => {
        try {
            const tempFeed: Feed = {
                id: crypto.randomUUID(),
                title: 'Loading...',
                url,
            };

            // Fetch feed to get title and articles
            const response = await fetch(url);
            const text = await response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');

            // Get feed title from XML
            const rssTitle = xml.querySelector('channel > title')?.textContent;
            const atomTitle = xml.querySelector('feed > title')?.textContent;
            const feedTitle = rssTitle || atomTitle || url;

            // Parse articles
            const feedArticles = await fetchFeed(tempFeed);

            // Try to get favicon
            const icon = await fetchFeedIcon(url);

            const newFeed: Feed = {
                ...tempFeed,
                title: feedTitle,
                icon,
                lastFetched: new Date(),
            };

            const updatedFeeds = [...feeds, newFeed];
            const updatedArticles = [...articles, ...feedArticles];

            setFeeds(updatedFeeds);
            setArticles(updatedArticles);
            storage.saveFeeds(updatedFeeds);
            storage.saveArticles(updatedArticles);
        } catch (error) {
            alert('Failed to add feed. Please check the URL and try again.');
            console.error('Error adding feed:', error);
        }
    };

    const handleRemoveFeed = (feedId: string) => {
        const updatedFeeds = feeds.filter(f => f.id !== feedId);

        // Keep only articles that belong to the remaining feeds
        const remainingFeedIds = new Set(updatedFeeds.map(f => f.id));
        const updatedArticles = articles.filter(a => remainingFeedIds.has(a.feedId));

        setFeeds(updatedFeeds);
        setArticles(updatedArticles);
        storage.saveFeeds(updatedFeeds);
        storage.saveArticles(updatedArticles);

        if (selectedFeedId === feedId) {
            setSelectedFeedId(null);
            setSelectedArticle(null);
        }
    };

    const handleRenameFeed = (feedId: string, newTitle: string) => {
        const updatedFeeds = feeds.map(f =>
            f.id === feedId ? { ...f, title: newTitle } : f
        );
        setFeeds(updatedFeeds);
        storage.saveFeeds(updatedFeeds);
    };

    const handleSelectFeed = (feedId: string | null) => {
        setSelectedFeedId(feedId);
        setSelectedArticle(null);
        setSelectedArticleIds(new Set());
        setShowNewsreel(false);
    };

    const handleSettingsChange = (newSettings: AppSettings) => {
        setSettings(newSettings);
        storage.saveSettings(newSettings);
    };

    const handleSelectArticle = (article: Article, isMultiSelect: boolean = false) => {
        if (isMultiSelect) {
            // Multi-select mode
            const newSelection = new Set(selectedArticleIds);
            if (newSelection.has(article.id)) {
                newSelection.delete(article.id);
            } else {
                newSelection.add(article.id);
            }
            setSelectedArticleIds(newSelection);

            // If no articles selected, clear single selection
            if (newSelection.size === 0) {
                setSelectedArticle(null);
            }
        } else {
            // Single select mode
            setSelectedArticle(article);
            setSelectedArticleIds(new Set()); // Clear multi-selection
            setShowNewsreel(false); // Close newsreel when selecting single article

            // Mark as read
            if (!article.isRead) {
                const updatedArticles = articles.map(a =>
                    a.id === article.id ? { ...a, isRead: true } : a
                );
                setArticles(updatedArticles);
                storage.saveArticles(updatedArticles);
            }
        }
    };

    const handleOpenNewsreel = () => {
        if (selectedArticleIds.size > 0) {
            setShowNewsreel(true);
            setSelectedArticle(null); // Clear single article view
        }
    };

    const handleDeleteArticle = (articleId: string) => {
        if (confirm('Are you sure you want to delete this article?')) {
            const updatedArticles = articles.filter(a => a.id !== articleId);
            setArticles(updatedArticles);
            storage.saveArticles(updatedArticles);

            if (selectedArticle?.id === articleId) {
                setSelectedArticle(null);
            }
            if (selectedArticleIds.has(articleId)) {
                const newSelection = new Set(selectedArticleIds);
                newSelection.delete(articleId);
                setSelectedArticleIds(newSelection);
            }
        }
    };

    const handleClearAllData = () => {
        // Clear storage first
        storage.saveFeeds([]);
        storage.saveArticles([]);

        // Force reload to ensure all state and running processes are cleared
        window.location.reload();
    };

    const [searchQuery, setSearchQuery] = useState('');

    // Force clear selection when feed changes to prevent stuck articles
    useEffect(() => {
        setSelectedArticle(null);
        setSelectedArticleIds(new Set());
        setShowNewsreel(false);
    }, [selectedFeedId]);

    const filteredArticles = useMemo(() => {
        let filtered = articles;

        // Feed/category filtering
        if (selectedFeedId === 'read') {
            // Show only read articles in the "Read Articles" view
            filtered = filtered.filter(a => a.isRead);
        } else {
            // Show all articles (including read) in normal views
            if (selectedFeedId) {
                filtered = filtered.filter(a => a.feedId === selectedFeedId);
            }
        }

        // Search query filtering
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(a =>
                a.title.toLowerCase().includes(query) ||
                a.contentSnippet?.toLowerCase().includes(query) ||
                a.creator?.toLowerCase().includes(query)
            );
        }

        return filtered;
    }, [articles, selectedFeedId, searchQuery, selectedArticle]);

    const [sidebarWidth, setSidebarWidth] = useState(250);
    const [articleListWidth, setArticleListWidth] = useState(350);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const [isResizingArticleList, setIsResizingArticleList] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingSidebar) {
                const newWidth = Math.max(200, Math.min(400, e.clientX));
                setSidebarWidth(newWidth);
            }
            if (isResizingArticleList) {
                // Calculate width based on sidebar width
                const newWidth = Math.max(300, Math.min(600, e.clientX - sidebarWidth));
                setArticleListWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizingSidebar(false);
            setIsResizingArticleList(false);
            document.body.style.cursor = 'default';
        };

        if (isResizingSidebar || isResizingArticleList) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };
    }, [isResizingSidebar, isResizingArticleList, sidebarWidth]);

    const handleImportOPML = async (file: File) => {
        try {
            const urls = await parseOpml(file);
            if (urls.length === 0) {
                alert('No feed URLs found in the OPML file.');
                return;
            }

            setIsRefreshing(true); // Show loading state

            const newFeeds: Feed[] = [];
            const newArticles: Article[] = [];
            let addedCount = 0;

            // Get current feeds from state to check for duplicates
            // We use a Set of URLs for faster lookup
            const existingUrls = new Set(feeds.map(f => f.url));

            for (const url of urls) {
                if (existingUrls.has(url)) continue;

                try {
                    // Create temp feed ID
                    const tempId = crypto.randomUUID();

                    // Fetch feed content using unified service (supports XML and JSON)
                    const { title, articles: fetchedArticles } = await fetchFeedDetails(url, tempId);

                    const newFeed: Feed = {
                        id: tempId,
                        url: url,
                        title: title || url,
                        lastFetched: new Date()
                    };

                    // Try to fetch icon in background
                    fetchFeedIcon(url).then(icon => {
                        if (icon) {
                            setFeeds(current =>
                                current.map(f => f.id === tempId ? { ...f, icon } : f)
                            );
                        }
                    });

                    newFeeds.push(newFeed);
                    newArticles.push(...fetchedArticles);
                    addedCount++;

                } catch (error) {
                    console.error(`Failed to import feed ${url}:`, error);
                }
            }

            if (addedCount > 0) {
                const updatedFeeds = [...feeds, ...newFeeds];
                const updatedArticles = [...articles, ...newArticles];

                setFeeds(updatedFeeds);
                setArticles(updatedArticles);
                storage.saveFeeds(updatedFeeds);
                storage.saveArticles(updatedArticles);
                alert(`Successfully imported ${addedCount} feeds.`);
            } else {
                alert('No new feeds were imported (they might already exist or failed to load).');
            }

            setIsRefreshing(false);
        } catch (error) {
            console.error('Import failed:', error);
            alert('Failed to parse OPML file.');
            setIsRefreshing(false);
        }
    };

    const handleOpenDailyNewsreel = () => {
        setShowDailyNewsreel(true);
        setShowNewsreel(false);
    };

    const handleArticleClick = (article: Article) => {
        setShowDailyNewsreel(false);
        setShowNewsreel(false);
        setSelectedArticle(article);
    };

    const handleWelcomeTourComplete = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        setShowWelcomeTour(false);
    };

    return (
        <div className="app">
            <Toolbar
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                settings={settings}
                onSettingsChange={handleSettingsChange}
                feeds={feeds}
                onOpenNewsreel={handleOpenNewsreel}
                onOpenDailyNewsreel={handleOpenDailyNewsreel}
                selectedCount={selectedArticleIds.size}
                onClearAllData={handleClearAllData}
                onImportOPML={handleImportOPML}
                articles={articles}
            />
            <div className="app-content">
                <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex' }}>
                    <Sidebar
                        feeds={feeds}
                        selectedFeedId={selectedFeedId}
                        onSelectFeed={handleSelectFeed}
                        onAddFeed={handleAddFeed}
                        onRemoveFeed={handleRemoveFeed}
                        onRenameFeed={handleRenameFeed}
                        articles={articles}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                    />
                </div>
                <div
                    className="resize-handle"
                    onMouseDown={() => setIsResizingSidebar(true)}
                />
                <div className="article-list-container" style={{ width: articleListWidth }}>
                    <ArticleList
                        key={selectedFeedId || 'all'}
                        articles={filteredArticles}
                        selectedArticle={selectedArticle}
                        selectedArticleIds={selectedArticleIds}
                        onSelectArticle={handleSelectArticle}
                        title={!selectedFeedId ? 'All Articles' : selectedFeedId === 'read' ? 'Read Articles' : feeds.find(f => f.id === selectedFeedId)?.title || 'Articles'}
                    />
                </div>

                <div
                    className="resize-handle"
                    onMouseDown={() => setIsResizingArticleList(true)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    {showDailyNewsreel ? (
                        <Newsreel
                            articles={articles.filter(a => {
                                // Exclude podcasts (audio/video) from newsreel
                                if (a.mediaType === 'audio' || a.mediaType === 'video') return false;

                                if (!a.pubDate) return false;
                                const hoursAgo = (Date.now() - new Date(a.pubDate).getTime()) / (1000 * 60 * 60);
                                return hoursAgo <= settings.dailyNewsreelTimeHorizon;
                            })}
                            settings={settings}
                            onClose={() => setShowDailyNewsreel(false)}
                            onArticleClick={handleArticleClick}
                            isDailyNewsreel={true}
                        />
                    ) : showNewsreel ? (
                        <Newsreel
                            articles={articles.filter(a => selectedArticleIds.has(a.id))}
                            settings={settings}
                            onClose={() => setShowNewsreel(false)}
                            onArticleClick={handleArticleClick}
                        />
                    ) : (
                        <ArticleView
                            article={selectedArticle}
                            settings={settings}
                            onClose={() => setSelectedArticle(null)}
                            onDelete={handleDeleteArticle}
                        />
                    )}
                </div>
            </div>
            {showWelcomeTour && <WelcomeTour onComplete={handleWelcomeTourComplete} />}
        </div>
    );
}

export default App;
