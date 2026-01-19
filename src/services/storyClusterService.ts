import { Article } from '../types';

export interface StoryCluster {
    id: string;
    topic: string;
    articles: Article[];
    perspectives: Map<string, string>; // feedId -> perspective summary
    createdAt: string;
}

/**
 * Service for clustering related stories and comparing perspectives.
 * Groups articles about the same topic from different sources.
 */
export class StoryClusterService {
    /**
     * Find articles related to a given article
     * Uses keyword matching and title similarity
     */
    static findRelatedArticles(article: Article, allArticles: Article[], limit: number = 5): Article[] {
        if (!allArticles || allArticles.length === 0) return [];

        // Extract keywords from title
        const titleWords = this.extractKeywords(article.title);

        // Score all other articles
        const scored = allArticles
            .filter(a => a.id !== article.id)
            .map(a => ({
                article: a,
                score: this.calculateSimilarity(titleWords, this.extractKeywords(a.title))
            }))
            .filter(s => s.score > 0.2) // Minimum 20% similarity
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return scored.map(s => s.article);
    }

    /**
     * Cluster articles by topic
     * Groups articles that cover the same story
     */
    static clusterByTopic(articles: Article[], minClusterSize: number = 2): StoryCluster[] {
        if (!articles || articles.length === 0) return [];

        const clusters: StoryCluster[] = [];
        const used = new Set<string>();

        // Sort by date to start with recent articles
        const sorted = [...articles].sort((a, b) => {
            const dateA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
            const dateB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
            return dateB - dateA;
        });

        for (const article of sorted) {
            if (used.has(article.id)) continue;

            // Find related articles not yet used
            const related = this.findRelatedArticles(
                article,
                sorted.filter(a => !used.has(a.id)),
                10
            );

            if (related.length >= minClusterSize - 1) {
                // Create cluster
                const clusterArticles = [article, ...related];
                clusterArticles.forEach(a => used.add(a.id));

                clusters.push({
                    id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    topic: this.generateTopicTitle(clusterArticles),
                    articles: clusterArticles,
                    perspectives: this.extractPerspectives(clusterArticles),
                    createdAt: new Date().toISOString()
                });
            }
        }

        return clusters;
    }

    /**
     * Extract keywords from text
     */
    private static extractKeywords(text: string): Set<string> {
        if (!text) return new Set();

        // Common stop words to filter out
        const stopWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
            'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
            'he', 'she', 'him', 'her', 'his', 'we', 'us', 'our', 'you', 'your',
            'who', 'what', 'when', 'where', 'why', 'how', 'which', 'there',
            'here', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
            'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too',
            'very', 'just', 'also', 'now', 'new', 'says', 'said', 'after', 'before'
        ]);

        return new Set(
            text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 2 && !stopWords.has(word))
        );
    }

    /**
     * Calculate Jaccard similarity between two keyword sets
     */
    private static calculateSimilarity(set1: Set<string>, set2: Set<string>): number {
        if (set1.size === 0 || set2.size === 0) return 0;

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    /**
     * Generate a topic title from clustered articles
     */
    private static generateTopicTitle(articles: Article[]): string {
        // Find common keywords across all titles
        const keywordCounts = new Map<string, number>();

        for (const article of articles) {
            const keywords = this.extractKeywords(article.title);
            for (const keyword of keywords) {
                keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
            }
        }

        // Get keywords that appear in most articles
        const commonKeywords = [...keywordCounts.entries()]
            .filter(([_, count]) => count >= Math.ceil(articles.length / 2))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([word]) => word);

        if (commonKeywords.length === 0) {
            return articles[0]?.title || 'Related Stories';
        }

        // Capitalize first letter of each word
        return commonKeywords
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
    }

    /**
     * Extract different perspectives from sources
     */
    private static extractPerspectives(articles: Article[]): Map<string, string> {
        const perspectives = new Map<string, string>();

        for (const article of articles) {
            const feedId = article.feedId || 'unknown';
            if (!perspectives.has(feedId)) {
                // Use the first article's title as the perspective indicator
                perspectives.set(feedId, article.title);
            }
        }

        return perspectives;
    }

    /**
     * Get diversity score for a cluster (0-1)
     * Higher = more diverse perspectives
     */
    static getDiversityScore(cluster: StoryCluster): number {
        const uniqueFeeds = new Set(cluster.articles.map(a => a.feedId));
        // Assume max 10 feeds for normalization
        return Math.min(uniqueFeeds.size / 10, 1);
    }
}
