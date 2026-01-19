const STORAGE_KEY = 'reading_stats';

export interface ReadingStats {
    articlesRead: number;
    totalReadingTime: number; // in seconds
    currentStreak: number;
    longestStreak: number;
    lastReadDate: string | null;
    articlesPerFeed: Record<string, number>;
    dailyActivity: Record<string, number>; // date -> articles read
    weeklyActivity: Record<string, number>; // week key -> minutes
}

const DEFAULT_STATS: ReadingStats = {
    articlesRead: 0,
    totalReadingTime: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastReadDate: null,
    articlesPerFeed: {},
    dailyActivity: {},
    weeklyActivity: {}
};

/**
 * Service for tracking reading statistics and gamification.
 */
export class ReadingStatsService {
    private static stats: ReadingStats = { ...DEFAULT_STATS };
    private static loaded = false;
    private static readingStartTime: number | null = null;
    private static currentArticleId: string | null = null;

    /**
     * Load stats from storage
     */
    static load(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.stats = { ...DEFAULT_STATS, ...JSON.parse(stored) };
            }
            this.loaded = true;
        } catch (e) {
            console.error('Failed to load reading stats:', e);
        }
    }

    /**
     * Save stats to storage
     */
    private static save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
        } catch (e) {
            console.error('Failed to save reading stats:', e);
        }
    }

    /**
     * Get all stats
     */
    static getStats(): ReadingStats {
        if (!this.loaded) {
            this.load();
        }
        return { ...this.stats };
    }

    /**
     * Record starting to read an article
     */
    static startReading(articleId: string): void {
        if (!this.loaded) this.load();

        this.readingStartTime = Date.now();
        this.currentArticleId = articleId;
    }

    /**
     * Record finishing reading an article
     */
    static finishReading(articleId: string, feedId?: string): void {
        if (!this.loaded) this.load();

        // Calculate reading time
        if (this.readingStartTime && this.currentArticleId === articleId) {
            const duration = Math.floor((Date.now() - this.readingStartTime) / 1000);

            // Only count if read for more than 10 seconds
            if (duration > 10) {
                this.stats.totalReadingTime += duration;
            }
        }

        this.stats.articlesRead++;

        // Track per-feed stats
        if (feedId) {
            this.stats.articlesPerFeed[feedId] = (this.stats.articlesPerFeed[feedId] || 0) + 1;
        }

        // Update daily activity
        const today = new Date().toISOString().split('T')[0];
        this.stats.dailyActivity[today] = (this.stats.dailyActivity[today] || 0) + 1;

        // Update streak
        this.updateStreak();

        // Clear tracking
        this.readingStartTime = null;
        this.currentArticleId = null;

        this.save();
    }

    /**
     * Update reading streak
     */
    private static updateStreak(): void {
        const today = new Date().toISOString().split('T')[0];
        const lastRead = this.stats.lastReadDate;

        if (!lastRead) {
            // First time reading
            this.stats.currentStreak = 1;
        } else if (lastRead === today) {
            // Already read today, streak continues
        } else {
            const lastDate = new Date(lastRead);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                // Consecutive day, increment streak
                this.stats.currentStreak++;
            } else {
                // Streak broken
                this.stats.currentStreak = 1;
            }
        }

        // Update longest streak
        if (this.stats.currentStreak > this.stats.longestStreak) {
            this.stats.longestStreak = this.stats.currentStreak;
        }

        this.stats.lastReadDate = today;
    }

    /**
     * Get weekly activity for chart display
     */
    static getWeeklyActivity(): { day: string; count: number }[] {
        if (!this.loaded) this.load();

        const result: { day: string; count: number }[] = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

            result.push({
                day: dayName,
                count: this.stats.dailyActivity[dateKey] || 0
            });
        }

        return result;
    }

    /**
     * Get top feeds by articles read
     */
    static getTopFeeds(limit: number = 5): { feedId: string; count: number }[] {
        if (!this.loaded) this.load();

        return Object.entries(this.stats.articlesPerFeed)
            .map(([feedId, count]) => ({ feedId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, limit);
    }

    /**
     * Get formatted reading time
     */
    static getFormattedReadingTime(): string {
        if (!this.loaded) this.load();

        const seconds = this.stats.totalReadingTime;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    /**
     * Clear all stats (for testing)
     */
    static clearStats(): void {
        this.stats = { ...DEFAULT_STATS };
        this.save();
    }

    /**
     * Cleanup old activity data (keep last 90 days)
     */
    static cleanup(): void {
        if (!this.loaded) this.load();

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const cutoffKey = cutoff.toISOString().split('T')[0];

        for (const dateKey of Object.keys(this.stats.dailyActivity)) {
            if (dateKey < cutoffKey) {
                delete this.stats.dailyActivity[dateKey];
            }
        }

        this.save();
    }
}
