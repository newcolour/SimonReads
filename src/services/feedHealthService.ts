const STORAGE_KEY = 'feed_health';

export interface FeedHealthData {
    feedId: string;
    lastSuccessfulFetch: string | null;
    lastError: string | null;
    lastErrorTime: string | null;
    errorCount: number;
    successCount: number;
    articleCounts: { date: string; count: number }[]; // Last 7 days
}

export type FeedStatus = 'healthy' | 'warning' | 'error' | 'stale';

/**
 * Service for monitoring feed health and status.
 */
export class FeedHealthService {
    private static healthData: Map<string, FeedHealthData> = new Map();
    private static loaded = false;

    /**
     * Load health data from storage
     */
    static load(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const arr: FeedHealthData[] = JSON.parse(stored);
                this.healthData = new Map(arr.map(h => [h.feedId, h]));
            }
            this.loaded = true;
        } catch (e) {
            console.error('Failed to load feed health data:', e);
        }
    }

    /**
     * Save health data to storage
     */
    private static save(): void {
        try {
            const arr = Array.from(this.healthData.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('Failed to save feed health data:', e);
        }
    }

    /**
     * Record a successful fetch
     */
    static recordSuccess(feedId: string, articleCount: number): void {
        if (!this.loaded) this.load();

        const existing = this.healthData.get(feedId) || this.createNew(feedId);
        const today = new Date().toISOString().split('T')[0];

        existing.lastSuccessfulFetch = new Date().toISOString();
        existing.successCount++;

        // Update article counts for today
        const todayEntry = existing.articleCounts.find(c => c.date === today);
        if (todayEntry) {
            todayEntry.count = articleCount;
        } else {
            existing.articleCounts.push({ date: today, count: articleCount });
            // Keep only last 7 days
            existing.articleCounts = existing.articleCounts.slice(-7);
        }

        this.healthData.set(feedId, existing);
        this.save();
    }

    /**
     * Record a fetch error
     */
    static recordError(feedId: string, error: string): void {
        if (!this.loaded) this.load();

        const existing = this.healthData.get(feedId) || this.createNew(feedId);

        existing.lastError = error;
        existing.lastErrorTime = new Date().toISOString();
        existing.errorCount++;

        this.healthData.set(feedId, existing);
        this.save();
    }

    /**
     * Get health data for a feed
     */
    static getFeedHealth(feedId: string): FeedHealthData | null {
        if (!this.loaded) this.load();
        return this.healthData.get(feedId) || null;
    }

    /**
     * Get status for a feed
     */
    static getFeedStatus(feedId: string): FeedStatus {
        if (!this.loaded) this.load();

        const health = this.healthData.get(feedId);
        if (!health) return 'healthy'; // Unknown, assume healthy

        // Error if last 3 fetches failed
        if (health.errorCount > health.successCount && health.errorCount >= 3) {
            return 'error';
        }

        // Warning if recent error
        if (health.lastErrorTime) {
            const lastError = new Date(health.lastErrorTime);
            const hoursSinceError = (Date.now() - lastError.getTime()) / (1000 * 60 * 60);
            if (hoursSinceError < 24) {
                return 'warning';
            }
        }

        // Stale if no fetch in 7+ days
        if (health.lastSuccessfulFetch) {
            const lastFetch = new Date(health.lastSuccessfulFetch);
            const daysSinceFetch = (Date.now() - lastFetch.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceFetch > 7) {
                return 'stale';
            }
        }

        return 'healthy';
    }

    /**
     * Get all health data
     */
    static getAllHealthData(): FeedHealthData[] {
        if (!this.loaded) this.load();
        return Array.from(this.healthData.values());
    }

    /**
     * Get summary counts
     */
    static getSummary(): { healthy: number; warning: number; error: number; stale: number } {
        if (!this.loaded) this.load();

        const summary = { healthy: 0, warning: 0, error: 0, stale: 0 };

        for (const feedId of this.healthData.keys()) {
            const status = this.getFeedStatus(feedId);
            summary[status]++;
        }

        return summary;
    }

    /**
     * Clear error for a feed
     */
    static clearError(feedId: string): void {
        if (!this.loaded) this.load();

        const existing = this.healthData.get(feedId);
        if (existing) {
            existing.lastError = null;
            existing.lastErrorTime = null;
            this.save();
        }
    }

    /**
     * Create new health data entry
     */
    private static createNew(feedId: string): FeedHealthData {
        return {
            feedId,
            lastSuccessfulFetch: null,
            lastError: null,
            lastErrorTime: null,
            errorCount: 0,
            successCount: 0,
            articleCounts: []
        };
    }
}
