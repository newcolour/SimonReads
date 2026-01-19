import { Article } from '../types';
import { NotificationService } from './notificationService';

const STORAGE_KEY = 'keyword_alerts';

export interface KeywordAlert {
    keyword: string;
    enabled: boolean;
    caseSensitive: boolean;
    createdAt: string;
}

export interface KeywordMatch {
    article: Article;
    keyword: string;
    matchedIn: 'title' | 'content' | 'both';
}

/**
 * Service for managing keyword-based article alerts.
 * Triggers notifications when new articles contain tracked keywords.
 */
export class KeywordAlertService {
    private static alerts: KeywordAlert[] = [];
    private static notifiedArticleIds: Set<string> = new Set();
    private static readonly NOTIFIED_STORAGE_KEY = 'notified_article_ids';

    /**
     * Load alerts from local storage
     */
    static load(): KeywordAlert[] {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            this.alerts = stored ? JSON.parse(stored) : [];

            const notifiedStored = localStorage.getItem(this.NOTIFIED_STORAGE_KEY);
            this.notifiedArticleIds = new Set(notifiedStored ? JSON.parse(notifiedStored) : []);

            return this.alerts;
        } catch (e) {
            console.error('Failed to load keyword alerts:', e);
            return [];
        }
    }

    /**
     * Save alerts to local storage
     */
    static save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.alerts));
            // Only keep last 1000 notified IDs to prevent unbounded growth
            const notifiedArray = Array.from(this.notifiedArticleIds).slice(-1000);
            localStorage.setItem(this.NOTIFIED_STORAGE_KEY, JSON.stringify(notifiedArray));
        } catch (e) {
            console.error('Failed to save keyword alerts:', e);
        }
    }

    /**
     * Get all keyword alerts
     */
    static getAlerts(): KeywordAlert[] {
        if (this.alerts.length === 0) {
            this.load();
        }
        return this.alerts;
    }

    /**
     * Add a new keyword alert
     */
    static addAlert(keyword: string, caseSensitive: boolean = false): KeywordAlert {
        const alert: KeywordAlert = {
            keyword: keyword.trim(),
            enabled: true,
            caseSensitive,
            createdAt: new Date().toISOString()
        };

        // Check for duplicates
        const exists = this.alerts.some(a =>
            a.keyword.toLowerCase() === alert.keyword.toLowerCase()
        );

        if (!exists) {
            this.alerts.push(alert);
            this.save();
        }

        return alert;
    }

    /**
     * Remove a keyword alert
     */
    static removeAlert(keyword: string): void {
        this.alerts = this.alerts.filter(a => a.keyword !== keyword);
        this.save();
    }

    /**
     * Toggle alert enabled state
     */
    static toggleAlert(keyword: string): void {
        const alert = this.alerts.find(a => a.keyword === keyword);
        if (alert) {
            alert.enabled = !alert.enabled;
            this.save();
        }
    }

    /**
     * Check articles for keyword matches and send notifications
     * @param articles New articles to check
     * @returns Array of matches found
     */
    static async checkArticles(articles: Article[]): Promise<KeywordMatch[]> {
        if (this.alerts.length === 0) {
            this.load();
        }

        const enabledAlerts = this.alerts.filter(a => a.enabled);
        if (enabledAlerts.length === 0) {
            return [];
        }

        const matches: KeywordMatch[] = [];

        for (const article of articles) {
            // Skip already notified articles
            if (this.notifiedArticleIds.has(article.id)) {
                continue;
            }

            for (const alert of enabledAlerts) {
                const keyword = alert.caseSensitive ? alert.keyword : alert.keyword.toLowerCase();
                const title = alert.caseSensitive ? article.title : article.title.toLowerCase();
                const content = alert.caseSensitive
                    ? (article.content || article.contentSnippet || '')
                    : (article.content || article.contentSnippet || '').toLowerCase();

                const inTitle = title.includes(keyword);
                const inContent = content.includes(keyword);

                if (inTitle || inContent) {
                    const matchedIn: 'title' | 'content' | 'both' =
                        inTitle && inContent ? 'both' :
                            inTitle ? 'title' : 'content';

                    matches.push({ article, keyword: alert.keyword, matchedIn });
                    this.notifiedArticleIds.add(article.id);
                }
            }
        }

        // Send notifications for matches
        if (matches.length > 0) {
            await this.sendNotifications(matches);
            this.save();
        }

        return matches;
    }

    /**
     * Send notifications for keyword matches
     */
    private static async sendNotifications(matches: KeywordMatch[]): Promise<void> {
        // Group matches by keyword for cleaner notifications
        const byKeyword = new Map<string, KeywordMatch[]>();

        for (const match of matches) {
            const existing = byKeyword.get(match.keyword) || [];
            existing.push(match);
            byKeyword.set(match.keyword, existing);
        }

        for (const [keyword, keywordMatches] of byKeyword) {
            if (keywordMatches.length === 1) {
                const match = keywordMatches[0];
                await NotificationService.send({
                    title: `🔔 "${keyword}" Alert`,
                    body: match.article.title,
                    extra: { articleId: match.article.id, keyword }
                });
            } else {
                await NotificationService.send({
                    title: `🔔 "${keyword}" Alert`,
                    body: `${keywordMatches.length} new articles match this keyword`,
                    extra: { keyword, count: keywordMatches.length }
                });
            }
        }
    }

    /**
     * Clear notification history (for testing)
     */
    static clearNotificationHistory(): void {
        this.notifiedArticleIds.clear();
        this.save();
    }
}
