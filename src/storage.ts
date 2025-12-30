import { Capacitor } from '@capacitor/core';
import { Feed, Article, AppSettings } from './types';

const FEEDS_KEY = 'rss-reader-feeds';
const ARTICLES_KEY = 'rss-reader-articles';
const SETTINGS_KEY = 'rss-reader-settings';

// Safe ipcRenderer access - use lazy getter to ensure preload has run
function getIpcRenderer() {
    // Force null on mobile to avoid any accidental IPC calls
    if (Capacitor.isNativePlatform()) return null;
    const ipc = (window as any).ipcRenderer || null;
    return ipc;
}

function getItem(key: string): any {
    const ipc = getIpcRenderer();
    if (ipc) {
        console.log(`[Storage] Using IPC to read: ${key}`);
        try {
            const data = ipc.sendSync('read-data-sync');
            return data[key];
        } catch (e) {
            console.error('[Storage] IPC read failed, falling back to localStorage', e);
        }
    }

    // Web / Mobile fallback
    console.log(`[Storage] Using localStorage to read: ${key}`);
    const data = localStorage.getItem(key);
    try {
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error(`[Storage] Failed to parse localStorage key ${key}:`, e);
        return null;
    }
}

function setItem(key: string, value: any): void {
    const ipc = getIpcRenderer();
    if (ipc) {
        console.log(`[Storage] Using IPC to write: ${key}`);
        try {
            ipc.sendSync('write-data-sync', { key, value });
            return;
        } catch (e) {
            console.error('[Storage] IPC write failed, falling back to localStorage', e);
        }
    }

    // Web / Mobile fallback
    console.log(`[Storage] Using localStorage to write: ${key}`);
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error(`[Storage] Failed to write to localStorage for key ${key}:`, e);
    }
}

export const storage = {
    getFeeds(): Feed[] {
        const feeds = getItem(FEEDS_KEY);
        if (!feeds) return [];
        // Convert date strings back to Date objects
        return feeds.map((f: any) => ({
            ...f,
            lastFetched: f.lastFetched ? new Date(f.lastFetched) : undefined,
        }));
    },

    saveFeeds(feeds: Feed[]): void {
        setItem(FEEDS_KEY, feeds);
    },

    getArticles(): Article[] {
        const articles = getItem(ARTICLES_KEY);
        if (!articles) return [];
        // Debug: log article counts
        const readCount = articles.filter((a: any) => a.isRead).length;
        const unreadCount = articles.filter((a: any) => !a.isRead).length;
        console.log(`[Storage] getArticles: ${articles.length} total, ${readCount} read, ${unreadCount} unread`);
        // Convert date strings back to Date objects
        return articles.map((a: any) => ({
            ...a,
            pubDate: a.pubDate ? new Date(a.pubDate) : undefined,
        }));
    },

    saveArticles(articles: Article[]): void {
        // Debug: log article counts before saving
        const readCount = articles.filter((a: any) => a.isRead).length;
        const unreadCount = articles.filter((a: any) => !a.isRead).length;
        console.log(`[Storage] saveArticles: ${articles.length} total, ${readCount} read, ${unreadCount} unread`);
        setItem(ARTICLES_KEY, articles);
    },

    getSettings(): AppSettings {
        const settings = getItem(SETTINGS_KEY);
        if (!settings) {
            return {
                autoRefreshInterval: 0,
                retentionPeriod: 30,
                theme: 'dark',
                font: 'system-ui',
                fontSize: 'medium',
                geminiApiKey: '',
                geminiModel: 'gemini-flash-latest',
                openaiApiKey: '',
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
            };
        }
        return settings;
    },

    saveSettings(settings: AppSettings): void {
        setItem(SETTINGS_KEY, settings);
    },

    async loadAllDataAsync(): Promise<{ feeds: Feed[], articles: Article[], settings: AppSettings } | null> {
        const ipc = getIpcRenderer();
        if (ipc) {
            try {
                const data = await ipc.invoke('read-data');

                // Parse feeds
                const feeds = (data[FEEDS_KEY] || []).map((f: any) => ({
                    ...f,
                    lastFetched: f.lastFetched ? new Date(f.lastFetched) : undefined,
                }));

                // Parse articles
                const articles = (data[ARTICLES_KEY] || []).map((a: any) => ({
                    ...a,
                    pubDate: a.pubDate ? new Date(a.pubDate) : undefined,
                }));

                // Parse settings
                const settings = data[SETTINGS_KEY];

                return { feeds, articles, settings };
            } catch (error) {
                console.error("Failed to load data async:", error);
                return null;
            }
        }
        return null; // Fallback to normal sync loading if not in electron or error
    }
};
