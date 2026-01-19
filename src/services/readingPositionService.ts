const STORAGE_KEY = 'reading_positions';

export interface ReadingPosition {
    articleId: string;
    scrollPercent: number;
    timestamp: string;
}

/**
 * Service for tracking and syncing reading positions across devices.
 */
export class ReadingPositionService {
    private static positions: Map<string, ReadingPosition> = new Map();
    private static loaded = false;

    /**
     * Load positions from storage
     */
    static async load(): Promise<void> {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const arr: ReadingPosition[] = JSON.parse(stored);
                this.positions = new Map(arr.map(p => [p.articleId, p]));
            }
            this.loaded = true;
        } catch (e) {
            console.error('Failed to load reading positions:', e);
        }
    }

    /**
     * Save positions to storage
     */
    private static save(): void {
        try {
            const arr = Array.from(this.positions.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('Failed to save reading positions:', e);
        }
    }

    /**
     * Get reading position for an article
     */
    static async getPosition(articleId: string): Promise<ReadingPosition | null> {
        if (!this.loaded) {
            await this.load();
        }
        return this.positions.get(articleId) || null;
    }

    /**
     * Save reading position for an article
     */
    static savePosition(articleId: string, scrollPercent: number): void {
        // Only save significant positions (>5% scroll)
        if (scrollPercent < 5) {
            return;
        }

        const position: ReadingPosition = {
            articleId,
            scrollPercent,
            timestamp: new Date().toISOString()
        };

        this.positions.set(articleId, position);
        this.save();
    }

    /**
     * Remove reading position when article is finished
     */
    static clearPosition(articleId: string): void {
        this.positions.delete(articleId);
        this.save();
    }

    /**
     * Get all positions (for sync)
     */
    static async getAllPositions(): Promise<ReadingPosition[]> {
        if (!this.loaded) {
            await this.load();
        }
        return Array.from(this.positions.values());
    }

    /**
     * Import positions (from sync)
     */
    static importPositions(positions: ReadingPosition[]): void {
        for (const pos of positions) {
            const existing = this.positions.get(pos.articleId);

            // Keep the more recent position
            if (!existing || new Date(pos.timestamp) > new Date(existing.timestamp)) {
                this.positions.set(pos.articleId, pos);
            }
        }
        this.save();
    }

    /**
     * Cleanup old positions (articles older than 30 days)
     */
    static cleanup(): void {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);

        for (const [articleId, pos] of this.positions) {
            if (new Date(pos.timestamp) < cutoff) {
                this.positions.delete(articleId);
            }
        }
        this.save();
    }
}
