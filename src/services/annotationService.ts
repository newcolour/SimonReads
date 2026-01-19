const STORAGE_KEY = 'article_annotations';

export interface Highlight {
    id: string;
    articleId: string;
    text: string;
    color: 'yellow' | 'green' | 'blue' | 'pink' | 'purple';
    note?: string;
    createdAt: string;
    // Position info for rendering
    startOffset?: number;
    endOffset?: number;
}

/**
 * Service for managing article highlights and annotations.
 */
export class AnnotationService {
    private static highlights: Map<string, Highlight[]> = new Map();
    private static loaded = false;

    /**
     * Load highlights from storage
     */
    static load(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const all: Highlight[] = JSON.parse(stored);
                // Group by articleId
                this.highlights.clear();
                for (const h of all) {
                    const existing = this.highlights.get(h.articleId) || [];
                    existing.push(h);
                    this.highlights.set(h.articleId, existing);
                }
            }
            this.loaded = true;
        } catch (e) {
            console.error('Failed to load annotations:', e);
        }
    }

    /**
     * Save all highlights to storage
     */
    private static save(): void {
        try {
            const all = Array.from(this.highlights.values()).flat();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch (e) {
            console.error('Failed to save annotations:', e);
        }
    }

    /**
     * Get highlights for an article
     */
    static getHighlights(articleId: string): Highlight[] {
        if (!this.loaded) {
            this.load();
        }
        return this.highlights.get(articleId) || [];
    }

    /**
     * Add a new highlight
     */
    static addHighlight(
        articleId: string,
        text: string,
        color: Highlight['color'] = 'yellow',
        note?: string
    ): Highlight {
        if (!this.loaded) {
            this.load();
        }

        const highlight: Highlight = {
            id: `hl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            articleId,
            text,
            color,
            note,
            createdAt: new Date().toISOString()
        };

        const existing = this.highlights.get(articleId) || [];

        // Check for duplicate text
        const isDuplicate = existing.some(h => h.text === text);
        if (!isDuplicate) {
            existing.push(highlight);
            this.highlights.set(articleId, existing);
            this.save();
        }

        return highlight;
    }

    /**
     * Update highlight note
     */
    static updateNote(highlightId: string, note: string): void {
        for (const [_articleId, highlights] of this.highlights) {
            const idx = highlights.findIndex(h => h.id === highlightId);
            if (idx !== -1) {
                highlights[idx].note = note;
                this.save();
                return;
            }
        }
    }

    /**
     * Update highlight color
     */
    static updateColor(highlightId: string, color: Highlight['color']): void {
        for (const [_articleId, highlights] of this.highlights) {
            const idx = highlights.findIndex(h => h.id === highlightId);
            if (idx !== -1) {
                highlights[idx].color = color;
                this.save();
                return;
            }
        }
    }

    /**
     * Remove a highlight
     */
    static removeHighlight(highlightId: string): void {
        for (const [articleId, highlights] of this.highlights) {
            const idx = highlights.findIndex(h => h.id === highlightId);
            if (idx !== -1) {
                highlights.splice(idx, 1);
                if (highlights.length === 0) {
                    this.highlights.delete(articleId);
                }
                this.save();
                return;
            }
        }
    }

    /**
     * Get all highlights (for export/sync)
     */
    static getAllHighlights(): Highlight[] {
        if (!this.loaded) {
            this.load();
        }
        return Array.from(this.highlights.values()).flat();
    }

    /**
     * Import highlights (from sync)
     */
    static importHighlights(highlights: Highlight[]): void {
        for (const h of highlights) {
            const existing = this.highlights.get(h.articleId) || [];

            // Check if already exists
            const exists = existing.some(e => e.id === h.id || e.text === h.text);
            if (!exists) {
                existing.push(h);
                this.highlights.set(h.articleId, existing);
            }
        }
        this.save();
    }

    /**
     * Get highlight count for display
     */
    static getHighlightCount(articleId: string): number {
        return this.getHighlights(articleId).length;
    }

    /**
     * Clear all highlights for an article
     */
    static clearArticleHighlights(articleId: string): void {
        this.highlights.delete(articleId);
        this.save();
    }
}
