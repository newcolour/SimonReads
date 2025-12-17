import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { NavigationBar } from '@hugotomazi/capacitor-navigation-bar';
import { Badge } from '@capawesome/capacitor-badge';
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
import { NotificationService } from './services/notificationService';
import { usePersonalityAutoSwitch } from './hooks/usePersonality';
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
        usePublicationColors: true,
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
        emailTimeHorizon: 12,
        // Reading Personality defaults
        readingPersonality: 'conversational-curator',
        autoSwitchEnabled: false,
        autoSwitchTrigger: 'manual',
        personalitySchedule: {
            enabled: false,
            morning: 'daily-brief',
            afternoon: 'conversational-curator',
            evening: 'deep-diver',
            night: 'focused-minimalist'
        }
    });
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showWelcomeTour, setShowWelcomeTour] = useState(false);
    // Mobile view state: 'feeds' | 'articles' | 'article'
    const [mobileView, setMobileView] = useState<'feeds' | 'articles' | 'article'>('feeds');
    // Ref to hold the openSettings function from Toolbar
    const openSettingsRef = useRef<(() => void) | null>(null);

    // Ref to track latest articles state for async callbacks (prevents stale closure issues)
    const articlesRef = useRef<Article[]>(articles);
    useEffect(() => {
        articlesRef.current = articles;
    }, [articles]);

    // Load data from storage on mount
    // Load data from storage on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                // Try async loading first (Electron)
                const asyncData = await storage.loadAllDataAsync();

                if (asyncData) {
                    setFeeds(asyncData.feeds);
                    setArticles(asyncData.articles);

                    // Merge saved settings with defaults
                    const s = asyncData.settings || {};
                    setSettings(prev => ({
                        ...prev, // Keep initial state defaults
                        ...s,    // Override with saved
                        // Ensure critical fields are valid
                        theme: s.theme || 'dark',
                        font: s.font || 'system-ui',
                        fontSize: s.fontSize || 'medium',
                        retentionPeriod: s.retentionPeriod ?? 30,
                    }));
                } else {
                    // Fallback to sync (Web / Error)
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
                        usePublicationColors: savedSettings.usePublicationColors ?? true,
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
                        emailTimeHorizon: savedSettings.emailTimeHorizon ?? 12,
                        // Reading Personality settings
                        readingPersonality: savedSettings.readingPersonality ?? 'conversational-curator',
                        autoSwitchEnabled: savedSettings.autoSwitchEnabled ?? false,
                        autoSwitchTrigger: savedSettings.autoSwitchTrigger ?? 'manual',
                        personalitySchedule: savedSettings.personalitySchedule ?? {
                            enabled: false,
                            morning: 'daily-brief',
                            afternoon: 'conversational-curator',
                            evening: 'deep-diver',
                            night: 'focused-minimalist'
                        }
                    });
                }
            } catch (e) {
                console.error("Failed to load data:", e);
            }
        };

        loadData();

        // Check if this is the first time the app is opened
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        if (!hasSeenWelcome) {
            setShowWelcomeTour(true);
        }
    }, []);

    // Fix icons for existing feeds (Migration to Google Favicon Service)
    useEffect(() => {
        if (feeds.length === 0) return;

        let changed = false;
        const updatedFeeds = feeds.map(feed => {
            // If icon is missing or not using Google service (and not a custom data URI), update it
            if (!feed.icon || (!feed.icon.includes('google.com/s2/favicons') && !feed.icon.startsWith('data:'))) {
                try {
                    const url = new URL(feed.url);
                    const newIcon = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
                    if (feed.icon !== newIcon) {
                        changed = true;
                        return { ...feed, icon: newIcon };
                    }
                } catch (e) {
                    // Invalid URL, ignore
                }
            }
            return feed;
        });

        if (changed) {
            console.log('Migrating feed icons to Google Favicon service...');
            setFeeds(updatedFeeds);
            storage.saveFeeds(updatedFeeds);
        }
    }, [feeds]);

    // Update App Badge (Unread Count)
    useEffect(() => {
        const updateBadge = async () => {
            if (!Capacitor.isNativePlatform()) return;

            try {
                const unreadCount = articles.filter(a => !a.isRead).length;

                // Check and request permissions if needed
                const permissions = await Badge.checkPermissions();
                if (permissions.display !== 'granted') {
                    const requested = await Badge.requestPermissions();
                    if (requested.display !== 'granted') return;
                }

                if (unreadCount > 0) {
                    await Badge.set({ count: unreadCount });
                } else {
                    await Badge.clear();
                }
            } catch (error) {
                console.warn('Badge update failed:', error);
            }
        };

        updateBadge();
    }, [articles]);

    // Handle Android back button
    useEffect(() => {
        let backButtonListener: any;

        const setupBackButton = async () => {
            try {
                const { App } = await import('@capacitor/app');
                backButtonListener = await App.addListener('backButton', () => {
                    if (mobileView === 'article') {
                        // Go back to articles view
                        setSelectedArticle(null);
                        setMobileView('articles');
                    } else if (mobileView === 'articles') {
                        // Go back to feeds view
                        setMobileView('feeds');
                    } else {
                        // On feeds view, exit app
                        App.exitApp();
                    }
                });
            } catch (error) {
                // Not on mobile, ignore
            }
        };

        setupBackButton();

        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, [mobileView]);

    // Disabled automatic cleanup of read articles – user now retains all read items.
    // Previously, a useEffect removed read articles older than the retention period.
    // This behavior has been removed to keep read articles indefinitely.


    // Detect platform and apply appropriate class for platform-specific CSS
    useEffect(() => {
        const ipcRenderer = (window as any).ipcRenderer;

        if (ipcRenderer) {
            // In Electron, we can get the actual platform from process.platform
            // The preload script should expose this, but we can also detect via navigator
            const userAgent = navigator.userAgent.toLowerCase();
            if (userAgent.includes('mac os x') || userAgent.includes('macintosh')) {
                document.documentElement.classList.add('platform-darwin');
            } else if (userAgent.includes('linux')) {
                document.documentElement.classList.add('platform-linux');
            } else if (userAgent.includes('windows')) {
                document.documentElement.classList.add('platform-win32');
            }
        } else {
            // Web browser - detect from navigator
            const userAgent = navigator.userAgent.toLowerCase();
            if (userAgent.includes('mac os x')) {
                document.documentElement.classList.add('platform-darwin');
            }
        }
    }, []);

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

        // Font mappings with proper fallback chains (especially for Linux)
        const fontFamilies: Record<string, string> = {
            'system-ui': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
            'Inter': '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, sans-serif',
            'Arial': 'Arial, "Liberation Sans", "Noto Sans", sans-serif',
            'Georgia': 'Georgia, "Noto Serif", "Liberation Serif", serif',
            'Merriweather': '"Merriweather", Georgia, "Noto Serif", "Liberation Serif", serif',
            'Roboto': '"Roboto", "Noto Sans", system-ui, -apple-system, sans-serif',
            'Open Sans': '"Open Sans", "Noto Sans", system-ui, sans-serif',
            'Lato': '"Lato", "Noto Sans", system-ui, sans-serif',
            'Source Sans Pro': '"Source Sans 3", "Source Sans Pro", "Noto Sans", system-ui, sans-serif',
            'Fira Sans': '"Fira Sans", "Noto Sans", system-ui, sans-serif',
            'PT Sans': '"PT Sans", "Noto Sans", system-ui, sans-serif',
            'Ubuntu': '"Ubuntu", "Noto Sans", system-ui, sans-serif',
            'Nunito': '"Nunito", "Noto Sans", system-ui, sans-serif',
        };

        const fontFamily = fontFamilies[settings.font] || fontFamilies['system-ui'];
        document.documentElement.style.setProperty('--app-font', fontFamily);

        const fontSizes = {
            small: '13px',
            medium: '14px',
            large: '16px',
            xlarge: '18px'
        };
        document.documentElement.style.setProperty('--app-font-size', fontSizes[settings.fontSize] || '14px');

        // Update native status bar for Android/iOS
        const updateNativeBars = async (theme: string) => {
            if (!Capacitor.isNativePlatform()) return;

            try {
                // Determine if theme is dark
                const isDark = !['light', 'sepia'].includes(theme);

                // Map theme to solid background color (StatusBar doesn't like transparency)
                const themeColors: Record<string, string> = {
                    'dark': '#1c1c1e',
                    'light': '#ffffff',
                    'sepia': '#f4ecd8',
                    'black': '#000000',
                    'nord': '#2e3440',
                    'solarized-dark': '#002b36',
                    'dracula': '#282a36',
                    'gruvbox': '#282828',
                    'tokyo-night': '#1a1b26',
                    'sorcerer': '#1e0c32'
                };

                const bgColor = themeColors[theme] || (isDark ? '#000000' : '#ffffff');

                await StatusBar.setStyle({
                    style: isDark ? Style.Dark : Style.Light
                });

                if (Capacitor.getPlatform() === 'android') {
                    await StatusBar.setBackgroundColor({
                        color: bgColor
                    });

                    // Update Navigation Bar (bottom bar)
                    try {
                        await NavigationBar.setColor({
                            color: bgColor,
                            darkButtons: !isDark // Light theme needs dark buttons, dark theme needs light buttons
                        });
                    } catch (navError) {
                        console.warn('NavigationBar plugin error:', navError);
                    }
                }
            } catch (error) {
                console.warn('Failed to update native bars:', error);
            }
        };

        updateNativeBars(actualTheme);
    }, [settings.theme, settings.font, settings.fontSize]);

    // Auto-refresh logic (interval-based)
    useEffect(() => {
        if (settings.autoRefreshInterval > 0) {
            const intervalMs = settings.autoRefreshInterval * 60 * 1000;
            const intervalId = setInterval(() => {
                handleRefresh();
            }, intervalMs);

            return () => clearInterval(intervalId);
        }
    }, [settings.autoRefreshInterval, feeds]);

    // Auto-refresh on app launch
    const hasRefreshedOnLaunch = useRef(false);
    useEffect(() => {
        if (feeds.length > 0 && !hasRefreshedOnLaunch.current) {
            hasRefreshedOnLaunch.current = true;
            // Small delay to let the UI settle first
            setTimeout(() => {
                console.log('Auto-refreshing feeds on app launch...');
                handleRefresh();
            }, 1000);
        }
    }, [feeds.length]);

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
        // Keep articles that either belong to an existing feed OR are saved
        const validArticles = articles.filter(a => feedIds.has(a.feedId) || a.isSaved);

        if (validArticles.length !== articles.length) {
            console.log(`Removing ${articles.length - validArticles.length} orphan articles (preserved saved articles)`);
            setArticles(validArticles);
            storage.saveArticles(validArticles);
        }
    }, [feeds, articles.length]); // Run when feeds or article count changes

    // Data Integrity Check: Backfill feedTitle
    useEffect(() => {
        if (feeds.length === 0 || articles.length === 0) return;

        let hasChanges = false;
        const feedMap = new Map(feeds.map(f => [f.id, f.title]));

        const updatedArticles = articles.map(a => {
            if (!a.feedTitle && feedMap.has(a.feedId)) {
                hasChanges = true;
                return { ...a, feedTitle: feedMap.get(a.feedId) };
            }
            return a;
        });

        if (hasChanges) {
            console.log('Backfilling feed titles for existing articles');
            setArticles(updatedArticles);
            storage.saveArticles(updatedArticles);
        }
    }, [feeds, articles.length]);

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

        console.log('=== REFRESH STARTED ===');
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

        // IMPORTANT: Read the LATEST articles from STORAGE, not from React state.
        // This ensures we get the most up-to-date read/saved states, even if the user
        // marked articles as read while the refresh fetch was in progress.
        // This follows RavenReader's pattern of using storage as the single source of truth.
        const storedArticles = storage.getArticles();
        const existingArticlesMap = new Map(storedArticles.map(a => [a.id, a]));

        // Secondary Map for matching by Link (fallback if ID changes)
        const existingArticlesLinkMap = new Map<string, Article>();
        storedArticles.forEach(a => {
            if (a.link) existingArticlesLinkMap.set(a.link, a);
        });

        console.log('=== REFRESH: Storage State ===');
        console.log('[Refresh] Stored articles:', storedArticles.length,
            'Read:', storedArticles.filter(a => a.isRead).length,
            'Unread:', storedArticles.filter(a => !a.isRead).length);
        console.log('[Refresh] Fetched articles:', fetchedArticles.length);

        // Process fetched articles
        let newCount = 0;
        let matchedCount = 0;
        let linkMatchedCount = 0;

        const mergedArticles: Article[] = fetchedArticles.map(newArticle => {
            let existing = existingArticlesMap.get(newArticle.id);
            let matchedByLink = false;

            // Fallback: Match by Link if ID match fails
            if (!existing && newArticle.link) {
                const linkMatch = existingArticlesLinkMap.get(newArticle.link);
                // Verify the link match wasn't already consumed (removed from ID map)
                if (linkMatch && existingArticlesMap.has(linkMatch.id)) {
                    existing = linkMatch;
                    matchedByLink = true;
                }
            }

            if (existing) {
                matchedCount++;
                if (matchedByLink) linkMatchedCount++;

                // Remove from map to track what's left (articles no longer in feed)
                existingArticlesMap.delete(existing.id);
                // Update content but preserve local state (isRead, isSaved)
                return { ...newArticle, isRead: existing.isRead, isSaved: existing.isSaved };
            }
            newCount++;
            return newArticle;
        });

        console.log('[Refresh] Matched:', matchedCount, `(by Link: ${linkMatchedCount})`, 'New:', newCount,
            'Remaining in storage (old):', existingArticlesMap.size);

        if (newCount > 0) {
            NotificationService.send({
                title: 'New Articles',
                body: `You have ${newCount} new article${newCount > 1 ? 's' : ''}.`
            });
        }

        // Add remaining existing articles (those that fell off the RSS feed)
        // This ensures we don't delete articles just because they are old
        mergedArticles.push(...Array.from(existingArticlesMap.values()));

        // CRITICAL: Re-read the latest isRead/isSaved states from storage RIGHT NOW,
        // BEFORE the retention policy runs. This catches any mark-as-read operations
        // that happened while we were fetching feeds.
        // Without this, the retention policy would use stale isRead states and might
        // incorrectly delete articles that the user just marked as read.
        const latestStoredArticles = storage.getArticles();
        const latestStatesMap = new Map(latestStoredArticles.map(a => [a.id, { isRead: a.isRead, isSaved: a.isSaved }]));

        // Also build a link map for specific latest state lookup
        const latestStatesLinkMap = new Map<string, { isRead: boolean, isSaved: boolean }>();
        latestStoredArticles.forEach(a => {
            if (a.link) latestStatesLinkMap.set(a.link, { isRead: a.isRead || false, isSaved: a.isSaved || false });
        });

        // Apply the latest read/saved states to our mergedArticles
        const articlesWithLatestStates = mergedArticles.map(article => {
            // Try matching by ID first
            let latestState = latestStatesMap.get(article.id);

            // Fallback to link match if not found directly
            if (!latestState && article.link) {
                latestState = latestStatesLinkMap.get(article.link);
            }

            if (latestState) {
                // If the article exists in the latest storage, use the MOST READ state
                // (if either our merge or the latest storage says it's read, keep it read)
                return {
                    ...article,
                    isRead: article.isRead || latestState.isRead,
                    isSaved: article.isSaved || latestState.isSaved
                };
            }
            return article;
        });

        console.log('[Refresh] After applying latest states:',
            'Read:', articlesWithLatestStates.filter(a => a.isRead).length,
            'Unread:', articlesWithLatestStates.filter(a => !a.isRead).length);

        // Apply retention policy (cleanup old read articles that have FALLEN OFF the RSS feed)
        // We only delete articles that are:
        // 1. Read (user has processed them)
        // 2. Older than retention period
        // 3. NOT in the current feed fetch (they've "fallen off" the RSS)
        // If an article is still being served by the RSS, we keep it - otherwise it would
        // just come back as "new unread" on the next refresh!
        const retentionDays = settings.retentionPeriod;
        let finalArticles = articlesWithLatestStates;

        if (retentionDays && retentionDays > 0) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

            // Create a set of article IDs that are currently in the RSS feed
            const currentFeedArticleIds = new Set(fetchedArticles.map(a => a.id));

            finalArticles = articlesWithLatestStates.filter(article => {
                // ALWAYS keep saved articles
                if (article.isSaved) return true;

                // Keep unread articles (user hasn't processed them yet)
                if (!article.isRead) return true;

                // Keep articles that are still in the current RSS feed
                // (even if they're old and read - deleting them would just bring them back)
                if (currentFeedArticleIds.has(article.id)) return true;

                // For read articles that have fallen off the RSS feed,
                // check if they are within retention period
                const pubDate = article.pubDate ? new Date(article.pubDate) : new Date();
                return pubDate >= cutoffDate;
            });

            if (articlesWithLatestStates.length !== finalArticles.length) {
                console.log(`Cleaned up ${articlesWithLatestStates.length - finalArticles.length} old articles that fell off feeds.`);
            }
        }

        // Sort by date descending
        finalArticles.sort((a, b) => {
            const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
            const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
            return dateB - dateA;
        });

        console.log('=== REFRESH: Saving Final State ===');
        console.log('[Refresh] Final articles:', finalArticles.length,
            'Read:', finalArticles.filter(a => a.isRead).length,
            'Unread:', finalArticles.filter(a => !a.isRead).length);

        setArticles(finalArticles);
        setFeeds(updatedFeeds);
        storage.saveArticles(finalArticles);
        storage.saveFeeds(updatedFeeds);
        setIsRefreshing(false);
        console.log('=== REFRESH COMPLETED ===');
    }, [feeds, articles, isRefreshing, settings.retentionPeriod]);

    const handleRefreshSingleFeed = useCallback(async (feedId: string) => {
        if (isRefreshing) return;

        const feed = feeds.find(f => f.id === feedId);
        if (!feed) return;

        setIsRefreshing(true);
        try {
            const feedArticles = await fetchFeed(feed);
            const updatedFeed = { ...feed, lastFetched: new Date() };

            // IMPORTANT: Read the LATEST articles from STORAGE, not from React state.
            // This ensures we get the most up-to-date read/saved states, even if the user
            // marked articles as read while the refresh fetch was in progress.
            const storedArticles = storage.getArticles();
            const existingArticlesMap = new Map(storedArticles.map(a => [a.id, a]));

            // Link fallback map
            const existingArticlesLinkMap = new Map<string, Article>();
            storedArticles.forEach(a => {
                if (a.link) existingArticlesLinkMap.set(a.link, a);
            });

            // Process fetched articles
            const mergedNewArticles: Article[] = feedArticles.map(newArticle => {
                let existing = existingArticlesMap.get(newArticle.id);

                // Fallback: Match by Link
                if (!existing && newArticle.link) {
                    existing = existingArticlesLinkMap.get(newArticle.link);
                }
                if (existing) {
                    // Update content but preserve local state (isRead, isSaved)
                    return { ...newArticle, isRead: existing.isRead, isSaved: existing.isSaved };
                }
                return newArticle;
            });

            // Remove old articles from this feed and add the new/updated ones
            // Use storedArticles (from storage) for filtering
            const otherArticles = storedArticles.filter(a => a.feedId !== feedId);
            const allArticles = [...otherArticles, ...mergedNewArticles];

            // Sort by date descending
            allArticles.sort((a, b) => {
                const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
                const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
                return dateB - dateA;
            });

            // Update feeds array
            const updatedFeeds = feeds.map(f => f.id === feedId ? updatedFeed : f);

            // CRITICAL: Re-read the latest isRead/isSaved states from storage RIGHT BEFORE saving.
            // This catches any mark-as-read operations that happened while we were fetching.
            const latestStoredArticles = storage.getArticles();
            const latestStatesMap = new Map(latestStoredArticles.map(a => [a.id, { isRead: a.isRead || false, isSaved: a.isSaved || false }]));

            // Link fallback map for latest states
            const latestStatesLinkMap = new Map<string, { isRead: boolean, isSaved: boolean }>();
            latestStoredArticles.forEach(a => {
                if (a.link) latestStatesLinkMap.set(a.link, { isRead: a.isRead || false, isSaved: a.isSaved || false });
            });

            const articlesToSave = allArticles.map(article => {
                let latestState = latestStatesMap.get(article.id);

                if (!latestState && article.link) {
                    latestState = latestStatesLinkMap.get(article.link);
                }

                if (latestState) {
                    return {
                        ...article,
                        isRead: article.isRead || latestState.isRead,
                        isSaved: article.isSaved || latestState.isSaved
                    };
                }
                return article;
            });

            setArticles(articlesToSave);
            setFeeds(updatedFeeds);
            storage.saveArticles(articlesToSave);
            storage.saveFeeds(updatedFeeds);
        } catch (error) {
            console.error(`Failed to refresh feed: ${feed.title}`, error);
            alert(`Failed to refresh "${feed.title}". Please try again.`);
        } finally {
            setIsRefreshing(false);
        }
    }, [feeds, articles, isRefreshing]);

    const handleAddFeed = async (url: string) => {
        try {
            // Use rssService to fetch and validate feed details
            const { title, articles: feedArticles } = await fetchFeedDetails(url, crypto.randomUUID());

            const newFeed: Feed = {
                id: crypto.randomUUID(),
                title: title || 'Untitled Feed',
                url,
                icon: await fetchFeedIcon(url)
            };

            setFeeds(prev => [...prev, newFeed]);
            setArticles(prev => [...prev, ...feedArticles]);
            storage.saveFeeds([...feeds, newFeed]);
            storage.saveArticles([...articles, ...feedArticles]);

            return; // Success
        } catch (error) {
            console.error('Error adding feed:', error);
            throw error; // Re-throw for caller to handle
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

    const handleUpdateFeed = (feedId: string, updates: Partial<Feed>) => {
        const updatedFeeds = feeds.map(f =>
            f.id === feedId ? { ...f, ...updates } : f
        );
        setFeeds(updatedFeeds);
        storage.saveFeeds(updatedFeeds);
    };

    const handleSelectFeed = (feedId: string | null) => {
        setSelectedFeedId(feedId);
        setSelectedArticle(null);
        setSelectedArticleIds(new Set());
        setShowNewsreel(false);
        // On mobile, switch to articles view when a feed is selected
        setMobileView('articles');
    };

    const handleSettingsChange = (newSettings: AppSettings) => {
        setSettings(newSettings);
        storage.saveSettings(newSettings);
    };

    // Personality auto-switching
    usePersonalityAutoSwitch(settings, handleSettingsChange);

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
            setShowDailyNewsreel(false); // Close daily newsreel when selecting single article
            // On mobile, switch to article view
            setMobileView('article');

            // Mark as read
            if (!article.isRead) {
                // Use articlesRef.current to get the LATEST articles, avoiding stale closure issues
                const currentArticles = articlesRef.current;
                const updatedArticles = currentArticles.map(a =>
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

    const handleToggleRead = (articleId: string) => {
        // Use articlesRef.current to get the LATEST articles, avoiding stale closure issues
        const currentArticles = articlesRef.current;
        const updatedArticles = currentArticles.map(a =>
            a.id === articleId ? { ...a, isRead: !a.isRead } : a
        );
        setArticles(updatedArticles);
        storage.saveArticles(updatedArticles);
    };

    const handleToggleSaved = (articleId: string) => {
        // Use articlesRef.current to get the LATEST articles, avoiding stale closure issues
        const currentArticles = articlesRef.current;
        const updatedArticles = currentArticles.map(a =>
            a.id === articleId ? { ...a, isSaved: !a.isSaved } : a
        );
        setArticles(updatedArticles);
        storage.saveArticles(updatedArticles);
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
        } else if (selectedFeedId === 'saved') {
            // Show only saved articles in the "Saved Articles" view
            filtered = filtered.filter(a => a.isSaved);
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
        setMobileView('article'); // Show newsreel in article view on mobile
    };

    const handleArticleClick = (article: Article) => {
        setShowDailyNewsreel(false);
        setShowNewsreel(false);
        setSelectedArticle(article);
    };

    const handleWelcomeTourComplete = (showAgain: boolean) => {
        // If user unchecked "show again", mark as seen. Otherwise, don't set it so it shows next time
        if (!showAgain) {
            localStorage.setItem('hasSeenWelcome', 'true');
        } else {
            localStorage.removeItem('hasSeenWelcome');
        }
        setShowWelcomeTour(false);
    };

    const handleSelectFirstArticleForTour = () => {
        // Select the first article if available
        if (filteredArticles.length > 0 && !selectedArticle) {
            handleSelectArticle(filteredArticles[0], false);
        }
    };
    const handleShowTutorial = () => {
        setShowWelcomeTour(true);
    };

    const handleMarkAllAsRead = () => {
        // Use articlesRef.current to get the LATEST articles, avoiding stale closure issues
        const currentArticles = articlesRef.current;
        console.log('[MarkAllAsRead] Starting with', currentArticles.length, 'articles,',
            currentArticles.filter(a => a.isRead).length, 'read,',
            currentArticles.filter(a => !a.isRead).length, 'unread');

        const updatedArticles = currentArticles.map(article => ({
            ...article,
            isRead: true
        }));

        console.log('[MarkAllAsRead] After marking:', updatedArticles.length, 'articles,',
            updatedArticles.filter(a => a.isRead).length, 'read,',
            updatedArticles.filter(a => !a.isRead).length, 'unread');

        setArticles(updatedArticles);
        storage.saveArticles(updatedArticles);
    };

    const handleMarkFeedAsRead = (feedId: string) => {
        // Use articlesRef.current to get the LATEST articles, avoiding stale closure issues
        const currentArticles = articlesRef.current;
        console.log('[MarkFeedAsRead] Feed:', feedId, 'Starting with',
            currentArticles.filter(a => a.feedId === feedId && !a.isRead).length, 'unread in feed');

        const updatedArticles = currentArticles.map(article =>
            article.feedId === feedId ? { ...article, isRead: true } : article
        );

        console.log('[MarkFeedAsRead] After marking:',
            updatedArticles.filter(a => a.feedId === feedId && !a.isRead).length, 'unread in feed');

        setArticles(updatedArticles);
        storage.saveArticles(updatedArticles);
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
                onShowTutorial={handleShowTutorial}
                hideButtons={true}
                setOpenSettingsRef={(fn) => { openSettingsRef.current = fn; }}
            />
            <div className="app-content" data-mobile-view={mobileView}>
                <div style={{ width: sidebarWidth, flexShrink: 0, display: 'flex' }}>
                    <Sidebar
                        feeds={feeds}
                        selectedFeedId={selectedFeedId}
                        onSelectFeed={handleSelectFeed}
                        onAddFeed={handleAddFeed}
                        onRemoveFeed={handleRemoveFeed}
                        onRenameFeed={handleRenameFeed}
                        onUpdateFeed={handleUpdateFeed}
                        articles={articles}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onMarkAllAsRead={handleMarkAllAsRead}
                        onMarkFeedAsRead={handleMarkFeedAsRead}
                        onRefreshFeed={handleRefreshSingleFeed}
                        settings={settings}
                        onRefresh={handleRefresh}
                        isRefreshing={isRefreshing}
                        onOpenSettings={() => openSettingsRef.current?.()}
                        onOpenDailyNewsreel={handleOpenDailyNewsreel}
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
                        onToggleRead={handleToggleRead}
                        onToggleSaved={handleToggleSaved}
                        onDeleteArticle={handleDeleteArticle}
                        title={!selectedFeedId ? 'All Articles' : selectedFeedId === 'read' ? 'Read Articles' : selectedFeedId === 'saved' ? 'Saved Articles' : feeds.find(f => f.id === selectedFeedId)?.title || 'Articles'}
                        icon={!selectedFeedId ? undefined : selectedFeedId === 'read' || selectedFeedId === 'saved' ? undefined : feeds.find(f => f.id === selectedFeedId)?.icon}
                        onBack={() => setMobileView('feeds')}
                        settings={settings}
                        isFeedSelected={!!selectedFeedId && selectedFeedId !== 'read' && selectedFeedId !== 'saved'}
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
                            onClose={() => {
                                setShowDailyNewsreel(false);
                                setMobileView('articles');
                            }}
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
                            feed={feeds.find(f => f.id === selectedArticle?.feedId)}
                            settings={settings}
                            allArticles={articles}
                            onClose={() => {
                                setSelectedArticle(null);
                                setMobileView('articles');
                            }}
                            onDelete={handleDeleteArticle}
                            onToggleSaved={handleToggleSaved}
                            onSelectArticle={(article) => handleArticleClick(article)}
                        />
                    )}
                </div>
            </div>
            {showWelcomeTour && <WelcomeTour onComplete={handleWelcomeTourComplete} onSelectFirstArticle={handleSelectFirstArticleForTour} />}
        </div >
    );
}

export default App;
