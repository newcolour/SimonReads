import { formatDistanceToNow } from 'date-fns';
import { Headphones, Video } from 'lucide-react';
import { Article } from '../types';
import './ArticleList.css';

interface ArticleListProps {
    articles: Article[];
    selectedArticle: Article | null;
    selectedArticleIds: Set<string>;
    onSelectArticle: (article: Article, ctrlKey: boolean) => void;
    title?: string;
}

export default function ArticleList({ articles, selectedArticle, selectedArticleIds, onSelectArticle, title = 'Articles' }: ArticleListProps) {
    const sortedArticles = [...articles].sort((a, b) => {
        const dateA = a.pubDate?.getTime() || 0;
        const dateB = b.pubDate?.getTime() || 0;
        return dateB - dateA;
    });

    return (
        <div className="article-list">
            <div className="article-list-header">
                <h3>{title}</h3>
                {selectedArticleIds.size > 0 && (
                    <span className="selection-count">{selectedArticleIds.size} selected</span>
                )}
            </div>
            <div className="article-list-content">
                {sortedArticles.length === 0 ? (
                    <div className="empty-state">
                        <p>No articles found.</p>
                        <p className="empty-hint">Try refreshing or adding more feeds.</p>
                    </div>
                ) : (
                    sortedArticles.map((article) => (
                        <div
                            key={article.id}
                            className={`article-item ${selectedArticle?.id === article.id ? 'active' : ''} ${selectedArticleIds.has(article.id) ? 'multi-selected' : ''} ${!article.isRead ? 'unread' : ''}`}
                            onClick={(e) => onSelectArticle(article, e.ctrlKey || e.metaKey)}
                        >
                            {!article.isRead && <div className="unread-marker"></div>}
                            {selectedArticleIds.has(article.id) && <div className="multi-select-marker">✓</div>}
                            <h4 className="article-title">
                                {article.mediaType === 'audio' && (
                                    <span className="media-badge audio" title="Audio Podcast">
                                        <Headphones size={14} />
                                    </span>
                                )}
                                {article.mediaType === 'video' && (
                                    <span className="media-badge video" title="Video Podcast">
                                        <Video size={14} />
                                    </span>
                                )}
                                {article.title}
                            </h4>
                            <div className="article-meta">
                                {article.creator && (
                                    <span className="article-creator">{article.creator}</span>
                                )}
                                {article.duration && (
                                    <span className="article-duration">• {article.duration}</span>
                                )}
                                {article.pubDate && (
                                    <span className="article-date">
                                        {article.duration ? '• ' : ''}{formatDistanceToNow(article.pubDate, { addSuffix: true })}
                                    </span>
                                )}
                            </div>
                            {article.contentSnippet && (
                                <p className="article-snippet">{article.contentSnippet.slice(0, 150)}...</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
