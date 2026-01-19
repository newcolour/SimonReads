import { useState, useEffect } from 'react';
import { X, Activity, AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { FeedHealthService, FeedHealthData, FeedStatus } from '../services/feedHealthService';
import { Feed } from '../types';
import './FeedHealth.css';

interface FeedHealthProps {
    feeds: Feed[];
    onClose: () => void;
}

const STATUS_CONFIG: Record<FeedStatus, { icon: any; color: string; label: string }> = {
    healthy: { icon: CheckCircle, color: '#22c55e', label: 'Healthy' },
    warning: { icon: AlertTriangle, color: '#f59e0b', label: 'Warning' },
    error: { icon: AlertCircle, color: '#ef4444', label: 'Error' },
    stale: { icon: Clock, color: '#94a3b8', label: 'Stale' }
};

export default function FeedHealth({ feeds, onClose }: FeedHealthProps) {
    const [healthData, setHealthData] = useState<Map<string, FeedHealthData>>(new Map());
    const [filter, setFilter] = useState<FeedStatus | 'all'>('all');

    useEffect(() => {
        const data = new Map<string, FeedHealthData>();
        for (const feed of feeds) {
            const health = FeedHealthService.getFeedHealth(feed.id);
            if (health) {
                data.set(feed.id, health);
            }
        }
        setHealthData(data);
    }, [feeds]);

    const summary = FeedHealthService.getSummary();

    const filteredFeeds = feeds.filter(feed => {
        if (filter === 'all') return true;
        return FeedHealthService.getFeedStatus(feed.id) === filter;
    });

    const formatDate = (isoString: string | null): string => {
        if (!isoString) return 'Never';
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="feed-health-overlay" onClick={onClose}>
            <div className="feed-health-container" onClick={e => e.stopPropagation()}>
                <div className="feed-health-header">
                    <h2><Activity size={24} /> Feed Health</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="health-summary">
                    <div
                        className={`summary-card ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => setFilter('all')}
                    >
                        <span className="summary-count">{feeds.length}</span>
                        <span className="summary-label">Total</span>
                    </div>
                    {(['healthy', 'warning', 'error', 'stale'] as FeedStatus[]).map(status => {
                        const config = STATUS_CONFIG[status];
                        const Icon = config.icon;
                        return (
                            <div
                                key={status}
                                className={`summary-card ${filter === status ? 'active' : ''}`}
                                onClick={() => setFilter(status)}
                                style={{ '--status-color': config.color } as React.CSSProperties}
                            >
                                <Icon size={16} style={{ color: config.color }} />
                                <span className="summary-count">{summary[status]}</span>
                                <span className="summary-label">{config.label}</span>
                            </div>
                        );
                    })}
                </div>

                <div className="feed-health-list">
                    {filteredFeeds.length === 0 ? (
                        <div className="empty-state">
                            <p>No feeds match this filter</p>
                        </div>
                    ) : (
                        filteredFeeds.map(feed => {
                            const health = healthData.get(feed.id);
                            const status = FeedHealthService.getFeedStatus(feed.id);
                            const config = STATUS_CONFIG[status];
                            const Icon = config.icon;

                            return (
                                <div key={feed.id} className="health-item">
                                    <div className="health-status">
                                        <Icon size={18} style={{ color: config.color }} />
                                    </div>
                                    <div className="health-info">
                                        <div className="health-title">{feed.title}</div>
                                        <div className="health-meta">
                                            {health ? (
                                                <>
                                                    <span>Last fetch: {formatDate(health.lastSuccessfulFetch)}</span>
                                                    {health.lastError && (
                                                        <span className="health-error" title={health.lastError}>
                                                            Error: {health.lastError.substring(0, 50)}...
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                <span>No data yet</span>
                                            )}
                                        </div>
                                    </div>
                                    {health && (
                                        <div className="health-stats">
                                            <span className="success-count" title="Successful fetches">
                                                ✓ {health.successCount}
                                            </span>
                                            {health.errorCount > 0 && (
                                                <span className="error-count" title="Failed fetches">
                                                    ✗ {health.errorCount}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
