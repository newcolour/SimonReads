import { useState, useEffect } from 'react';
import { X, Layers, ExternalLink, TrendingUp } from 'lucide-react';
import { Article, Feed } from '../types';
import { StoryClusterService } from '../services/storyClusterService';
import './StoryComparison.css';

interface StoryComparisonProps {
    article: Article;
    allArticles: Article[];
    feeds: Feed[];
    onSelectArticle: (article: Article) => void;
    onClose: () => void;
}

export default function StoryComparison({
    article,
    allArticles,
    feeds,
    onSelectArticle,
    onClose
}: StoryComparisonProps) {
    const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const related = StoryClusterService.findRelatedArticles(article, allArticles, 8);
        setRelatedArticles(related);
        setIsLoading(false);
    }, [article.id, allArticles]);

    const getFeedTitle = (feedId?: string): string => {
        if (!feedId) return 'Unknown Source';
        return feeds.find(f => f.id === feedId)?.title || feedId;
    };

    const formatDate = (date: Date | string | undefined) => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    const uniqueSources = new Set(relatedArticles.map(a => a.feedId)).size;

    return (
        <div className="story-comparison-overlay" onClick={onClose}>
            <div className="story-comparison-container" onClick={e => e.stopPropagation()}>
                <div className="story-comparison-header">
                    <h2><Layers size={22} /> Story Comparison</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="story-comparison-source">
                    <div className="source-badge">Original</div>
                    <h3>{article.title}</h3>
                    <p className="source-meta">
                        {getFeedTitle(article.feedId)} • {formatDate(article.pubDate)}
                    </p>
                </div>

                {isLoading ? (
                    <div className="story-loading">Finding related coverage...</div>
                ) : relatedArticles.length === 0 ? (
                    <div className="story-empty">
                        <Layers size={48} />
                        <p>No related coverage found</p>
                        <small>Try again with articles about major news stories</small>
                    </div>
                ) : (
                    <>
                        <div className="story-stats">
                            <div className="stat">
                                <TrendingUp size={16} />
                                <span>{relatedArticles.length} related articles</span>
                            </div>
                            <div className="stat">
                                <Layers size={16} />
                                <span>{uniqueSources} different sources</span>
                            </div>
                        </div>

                        <div className="story-comparison-list">
                            <h4>How Other Sources Cover This Story</h4>
                            {relatedArticles.map(a => (
                                <div
                                    key={a.id}
                                    className="comparison-item"
                                    onClick={() => onSelectArticle(a)}
                                >
                                    <div className="comparison-source">
                                        {getFeedTitle(a.feedId)}
                                    </div>
                                    <div className="comparison-title">{a.title}</div>
                                    <div className="comparison-meta">
                                        {formatDate(a.pubDate)}
                                        <ExternalLink size={14} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
