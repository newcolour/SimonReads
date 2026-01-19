import { useState, useEffect } from 'react';
import { Bell, Plus, X, Trash2 } from 'lucide-react';
import { KeywordAlertService, KeywordAlert } from '../services/keywordAlertService';
import './KeywordAlerts.css';

interface KeywordAlertsProps {
    compact?: boolean;
}

export default function KeywordAlerts({ compact = false }: KeywordAlertsProps) {
    const [alerts, setAlerts] = useState<KeywordAlert[]>([]);
    const [newKeyword, setNewKeyword] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        setAlerts(KeywordAlertService.getAlerts());
    }, []);

    const handleAddKeyword = () => {
        if (!newKeyword.trim()) return;

        KeywordAlertService.addAlert(newKeyword.trim(), caseSensitive);
        setAlerts(KeywordAlertService.getAlerts());
        setNewKeyword('');
        setCaseSensitive(false);
    };

    const handleRemoveKeyword = (keyword: string) => {
        KeywordAlertService.removeAlert(keyword);
        setAlerts(KeywordAlertService.getAlerts());
    };

    const handleToggleKeyword = (keyword: string) => {
        KeywordAlertService.toggleAlert(keyword);
        setAlerts(KeywordAlertService.getAlerts());
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddKeyword();
        }
    };

    if (compact) {
        return (
            <div className="keyword-alerts-compact">
                <button
                    className="keyword-alerts-toggle"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <Bell size={16} />
                    <span>Keyword Alerts ({alerts.filter(a => a.enabled).length} active)</span>
                </button>

                {isExpanded && (
                    <div className="keyword-alerts-dropdown">
                        <div className="keyword-input-row">
                            <input
                                type="text"
                                value={newKeyword}
                                onChange={e => setNewKeyword(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Add keyword..."
                                className="keyword-input"
                            />
                            <button
                                className="keyword-add-btn"
                                onClick={handleAddKeyword}
                                disabled={!newKeyword.trim()}
                            >
                                <Plus size={16} />
                            </button>
                        </div>

                        <div className="keyword-list">
                            {alerts.map(alert => (
                                <div
                                    key={alert.keyword}
                                    className={`keyword-item ${alert.enabled ? 'enabled' : 'disabled'}`}
                                >
                                    <label className="keyword-label">
                                        <input
                                            type="checkbox"
                                            checked={alert.enabled}
                                            onChange={() => handleToggleKeyword(alert.keyword)}
                                        />
                                        <span>{alert.keyword}</span>
                                    </label>
                                    <button
                                        className="keyword-remove-btn"
                                        onClick={() => handleRemoveKeyword(alert.keyword)}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {alerts.length === 0 && (
                                <p className="keyword-empty">No keywords tracked</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="keyword-alerts">
            <div className="keyword-header">
                <Bell size={18} />
                <h4>Keyword Alerts</h4>
            </div>

            <p className="keyword-description">
                Get notified when new articles contain these keywords
            </p>

            <div className="keyword-input-row">
                <input
                    type="text"
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter keyword to track..."
                    className="keyword-input"
                />
                <button
                    className="keyword-add-btn"
                    onClick={handleAddKeyword}
                    disabled={!newKeyword.trim()}
                >
                    <Plus size={16} /> Add
                </button>
            </div>

            <label className="keyword-case-sensitive">
                <input
                    type="checkbox"
                    checked={caseSensitive}
                    onChange={e => setCaseSensitive(e.target.checked)}
                />
                Case sensitive
            </label>

            <div className="keyword-list">
                {alerts.map(alert => (
                    <div
                        key={alert.keyword}
                        className={`keyword-item ${alert.enabled ? 'enabled' : 'disabled'}`}
                    >
                        <label className="keyword-label">
                            <input
                                type="checkbox"
                                checked={alert.enabled}
                                onChange={() => handleToggleKeyword(alert.keyword)}
                            />
                            <span className="keyword-text">{alert.keyword}</span>
                            {alert.caseSensitive && (
                                <span className="keyword-badge">Aa</span>
                            )}
                        </label>
                        <button
                            className="keyword-remove-btn"
                            onClick={() => handleRemoveKeyword(alert.keyword)}
                            title="Remove keyword"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                {alerts.length === 0 && (
                    <p className="keyword-empty">
                        No keywords added yet. Add keywords to get notified when they appear in new articles.
                    </p>
                )}
            </div>
        </div>
    );
}
