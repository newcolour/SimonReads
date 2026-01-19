import { useState, useEffect } from 'react';
import { X, BookOpen, Clock, Flame, TrendingUp, BarChart3 } from 'lucide-react';
import { ReadingStatsService, ReadingStats } from '../services/readingStatsService';
import './ReadingStats.css';

interface ReadingStatsProps {
    onClose: () => void;
    feedTitles?: Record<string, string>; // Map of feedId to title
}

export default function ReadingStatsView({ onClose, feedTitles = {} }: ReadingStatsProps) {
    const [stats, setStats] = useState<ReadingStats | null>(null);
    const [weeklyActivity, setWeeklyActivity] = useState<{ day: string; count: number }[]>([]);

    useEffect(() => {
        setStats(ReadingStatsService.getStats());
        setWeeklyActivity(ReadingStatsService.getWeeklyActivity());
    }, []);

    if (!stats) return null;

    const maxDailyCount = Math.max(...weeklyActivity.map(d => d.count), 1);
    const topFeeds = ReadingStatsService.getTopFeeds(5);

    return (
        <div className="reading-stats-overlay" onClick={onClose}>
            <div className="reading-stats-container" onClick={e => e.stopPropagation()}>
                <div className="reading-stats-header">
                    <h2><BarChart3 size={24} /> Reading Stats</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon"><BookOpen size={24} /></div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.articlesRead}</div>
                            <div className="stat-label">Articles Read</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon"><Clock size={24} /></div>
                        <div className="stat-content">
                            <div className="stat-value">{ReadingStatsService.getFormattedReadingTime()}</div>
                            <div className="stat-label">Time Reading</div>
                        </div>
                    </div>

                    <div className="stat-card streak">
                        <div className="stat-icon"><Flame size={24} /></div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.currentStreak}</div>
                            <div className="stat-label">Day Streak</div>
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="stat-icon"><TrendingUp size={24} /></div>
                        <div className="stat-content">
                            <div className="stat-value">{stats.longestStreak}</div>
                            <div className="stat-label">Best Streak</div>
                        </div>
                    </div>
                </div>

                <div className="stats-section">
                    <h3>This Week</h3>
                    <div className="weekly-chart">
                        {weeklyActivity.map((day, i) => (
                            <div key={i} className="chart-bar-container">
                                <div
                                    className="chart-bar"
                                    style={{
                                        height: `${(day.count / maxDailyCount) * 100}%`,
                                        minHeight: day.count > 0 ? '10%' : '0'
                                    }}
                                >
                                    {day.count > 0 && (
                                        <span className="bar-value">{day.count}</span>
                                    )}
                                </div>
                                <div className="chart-label">{day.day}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {topFeeds.length > 0 && (
                    <div className="stats-section">
                        <h3>Top Sources</h3>
                        <div className="top-feeds-list">
                            {topFeeds.map((feed, i) => (
                                <div key={feed.feedId} className="top-feed-item">
                                    <span className="feed-rank">#{i + 1}</span>
                                    <span className="feed-name">
                                        {feedTitles[feed.feedId] || feed.feedId}
                                    </span>
                                    <span className="feed-count">{feed.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="stats-footer">
                    <p>Keep reading to build your streak! 📚</p>
                </div>
            </div>
        </div>
    );
}
