import { Feed, Article, AppSettings } from './types';

const FEEDS_KEY = 'rss-reader-feeds';
const ARTICLES_KEY = 'rss-reader-articles';
const SETTINGS_KEY = 'rss-reader-settings';

// Safe ipcRenderer access
const ipcRenderer = (window as any).require ? (window as any).require('electron').ipcRenderer : null;

function getItem(key: string): any {
    if (ipcRenderer) {
        const data = ipcRenderer.sendSync('read-data-sync');
        return data[key];
    } else {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
}

function setItem(key: string, value: any): void {
    if (ipcRenderer) {
        ipcRenderer.sendSync('write-data-sync', { key, value });
    } else {
        localStorage.setItem(key, JSON.stringify(value));
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
        // Convert date strings back to Date objects
        return articles.map((a: any) => ({
            ...a,
            pubDate: a.pubDate ? new Date(a.pubDate) : undefined,
        }));
    },

    saveArticles(articles: Article[]): void {
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
                emailTimeHorizon: 12
            };
        }
        return settings;
    },

    saveSettings(settings: AppSettings): void {
        setItem(SETTINGS_KEY, settings);
    },
};
