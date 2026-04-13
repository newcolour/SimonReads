import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2, Globe, Shield, RefreshCw } from 'lucide-react';
import { Feed } from '../types';
import './FeedSettingsModal.css';

interface FeedSettingsModalProps {
    feed: Feed;
    onClose: () => void;
    onSave: (feedId: string, updates: Partial<Feed>) => void;
}

export default function FeedSettingsModal({ feed, onClose, onSave }: FeedSettingsModalProps) {
    const [title, setTitle] = useState(feed.title);
    const [category, setCategory] = useState(feed.category || '');
    const [useBrowserSession, setUseBrowserSession] = useState(feed.useBrowserSession || false);
    const [cookieSession, setCookieSession] = useState(feed.cookieSession || '');
    
    // Status badges logic
    const isWebSource = feed.type === 'web';
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(feed.id, {
            title: title.trim(),
            category: category.trim() || undefined,
            ...(isWebSource && { 
                useBrowserSession,
                cookieSession: cookieSession.trim() 
            })
        });
        onClose();
    };

    const handleClearCookies = () => {
        setCookieSession('');
    };

    return createPortal(
        <div className="feed-settings-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className="feed-settings-modal">
                <div className="feed-settings-header">
                    <h2>Feed Settings</h2>
                    <button className="feed-settings-close-btn" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="feed-settings-status-bar">
                    {isWebSource ? (
                        <div className="status-badge web-source">
                            <Globe size={14} />
                            <span>Web Source</span>
                        </div>
                    ) : (
                        <div className="status-badge rss-source">
                            <RefreshCw size={14} />
                            <span>RSS Feed</span>
                        </div>
                    )}
                    {feed.paywallMethodSucceeded && (
                        <div className="status-badge paywall-success">
                            <Shield size={14} />
                            <span>Paywall: {feed.paywallMethodSucceeded}</span>
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="feed-settings-content">
                    <div className="settings-section">
                        <h3>General</h3>
                        <div className="setting-row">
                            <label htmlFor="feed-title">Title</label>
                            <input 
                                id="feed-title"
                                type="text" 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)} 
                                required
                            />
                        </div>
                        <div className="setting-row">
                            <label htmlFor="feed-category">Category</label>
                            <input 
                                id="feed-category"
                                type="text" 
                                value={category} 
                                onChange={(e) => setCategory(e.target.value)} 
                                placeholder="Uncategorized"
                            />
                        </div>
                    </div>

                    {isWebSource && (
                        <div className="settings-section">
                            <h3>Web Extraction <span className="beta-badge">Beta</span></h3>
                            
                            <div className="setting-row checkbox-row">
                                <input 
                                    id="use-browser-session"
                                    type="checkbox" 
                                    checked={useBrowserSession} 
                                    onChange={(e) => setUseBrowserSession(e.target.checked)} 
                                />
                                <label htmlFor="use-browser-session">
                                    Use Browser Session
                                    <span className="setting-hint">Uses an invisible Electron window to bypass bot protections. Slower but more reliable.</span>
                                </label>
                            </div>

                            <div className="setting-row header-row">
                                <label htmlFor="cookie-session">Cookie Session payload</label>
                                {cookieSession && (
                                    <button 
                                        type="button" 
                                        onClick={handleClearCookies} 
                                        className="clear-btn"
                                        title="Clear Saved Cookies"
                                    >
                                        <Trash2 size={14} /> Clear
                                    </button>
                                )}
                            </div>
                            <div className="setting-row">
                                <textarea 
                                    id="cookie-session"
                                    value={cookieSession} 
                                    onChange={(e) => setCookieSession(e.target.value)} 
                                    placeholder="Paste Raw Cookie String here..."
                                    rows={3}
                                />
                                <div className="setting-hint">Stored securely using App Settings JSON. Will inject these cookies on fetch requests.</div>
                            </div>
                        </div>
                    )}

                    <div className="feed-settings-actions">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
                        <button type="submit" className="btn-primary">
                            <Save size={16} /> Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
