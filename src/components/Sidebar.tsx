import { useState } from 'react';
import { Plus, Trash2, Rss, CheckCircle, Search, X, Check, Edit2 } from 'lucide-react';
import { Feed, Article } from '../types';
import './Sidebar.css';

interface SidebarProps {
    feeds: Feed[];
    selectedFeedId: string | null;
    onSelectFeed: (feedId: string | null) => void;
    onAddFeed: (url: string) => void;
    onRemoveFeed: (feedId: string) => void;
    onRenameFeed: (feedId: string, newTitle: string) => void;
    articles: Article[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
}

export default function Sidebar({
    feeds,
    selectedFeedId,
    onSelectFeed,
    onAddFeed,
    onRemoveFeed,
    onRenameFeed,
    articles,
    searchQuery,
    onSearchChange
}: SidebarProps) {
    const [isAdding, setIsAdding] = useState(false);
    const [newFeedUrl, setNewFeedUrl] = useState('');
    const [renamingFeedId, setRenamingFeedId] = useState<string | null>(null);
    const [newFeedTitle, setNewFeedTitle] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFeedUrl.trim()) {
            onAddFeed(newFeedUrl.trim());
            setNewFeedUrl('');
            setIsAdding(false);
        }
    };

    const handleRename = (feedId: string) => {
        if (newFeedTitle.trim()) {
            onRenameFeed(feedId, newFeedTitle.trim());
            setRenamingFeedId(null);
            setNewFeedTitle('');
        }
    };

    const startRenaming = (feed: Feed, e: React.MouseEvent) => {
        e.stopPropagation();
        setRenamingFeedId(feed.id);
        setNewFeedTitle(feed.title);
    };

    const getUnreadCount = (feedId: string | null) => {
        if (feedId === null) {
            return articles.filter(a => !a.isRead).length;
        }
        if (feedId === 'read') {
            return 0;
        }
        return articles.filter(a => a.feedId === feedId && !a.isRead).length;
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <h2>Feeds</h2>
                <button
                    className="add-feed-btn"
                    onClick={() => setIsAdding(!isAdding)}
                    data-tooltip="Add Feed"
                >
                    <Plus size={18} />
                </button>
            </div>

            <div className="search-container">
                <div className="search-input-wrapper">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search articles..."
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="add-feed-form">
                    <input
                        type="url"
                        placeholder="Enter RSS URL..."
                        value={newFeedUrl}
                        onChange={(e) => setNewFeedUrl(e.target.value)}
                        autoFocus
                    />
                    <div className="add-feed-actions">
                        <button type="button" onClick={() => setIsAdding(false)}>
                            <X size={16} />
                            <span>Cancel</span>
                        </button>
                        <button type="submit">
                            <Check size={16} />
                            <span>Add Feed</span>
                        </button>
                    </div>
                </form>
            )}

            <div className="feed-list">
                <div
                    className={`feed-item ${selectedFeedId === null ? 'active' : ''}`}
                    onClick={() => onSelectFeed(null)}
                >
                    <Rss size={16} />
                    <span className="feed-title">All Feeds</span>
                    {getUnreadCount(null) > 0 && (
                        <span className="unread-count">{getUnreadCount(null)}</span>
                    )}
                </div>

                <div
                    className={`feed-item ${selectedFeedId === 'read' ? 'active' : ''}`}
                    onClick={() => onSelectFeed('read')}
                >
                    <CheckCircle size={16} />
                    <span className="feed-title">Read Articles</span>
                </div>

                {feeds.map(feed => (
                    <div
                        key={feed.id}
                        className={`feed-item ${selectedFeedId === feed.id ? 'active' : ''} ${renamingFeedId === feed.id ? 'renaming' : ''}`}
                        onClick={() => {
                            if (renamingFeedId !== feed.id) {
                                onSelectFeed(feed.id);
                            }
                        }}
                    >
                        {feed.icon ? (
                            <img
                                src={feed.icon}
                                alt=""
                                className="feed-icon"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                }}
                            />
                        ) : null}
                        <Rss size={16} className={feed.icon ? 'hidden' : ''} />
                        {renamingFeedId === feed.id ? (
                            <input
                                type="text"
                                value={newFeedTitle}
                                onChange={(e) => setNewFeedTitle(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleRename(feed.id);
                                    } else if (e.key === 'Escape') {
                                        setRenamingFeedId(null);
                                        setNewFeedTitle('');
                                    }
                                }}
                                onBlur={() => handleRename(feed.id)}
                                className="rename-input"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="feed-title" title={feed.title}>{feed.title}</span>
                        )}
                        {getUnreadCount(feed.id) > 0 && (
                            <span className="unread-count">{getUnreadCount(feed.id)}</span>
                        )}
                        <div className="feed-actions">
                            <button
                                className="edit-feed-btn"
                                onClick={(e) => startRenaming(feed, e)}
                                data-tooltip="Rename feed"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                className="remove-feed-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Are you sure you want to remove this feed?')) {
                                        onRemoveFeed(feed.id);
                                    }
                                }}
                                data-tooltip="Remove feed"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
