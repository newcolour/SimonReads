import { Settings, RefreshCw, X, Download, Newspaper, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AppSettings, Feed, Article } from '../types';
import { exportToOPML, exportToJSON, downloadFile } from '../exportService';
import './Toolbar.css';
import packageJson from '../../package.json';

interface ToolbarProps {
    onRefresh: () => void;
    isRefreshing: boolean;
    settings: AppSettings;
    onSettingsChange: (settings: AppSettings) => void;
    feeds: Feed[];
    onOpenNewsreel?: () => void;
    onOpenDailyNewsreel?: () => void;
    selectedCount?: number;
    onClearAllData: () => void;
    onImportOPML: (file: File) => void;
    articles: Article[];
}

const FONTS = [
    { value: 'system-ui', label: 'System Default' },
    { value: 'Inter', label: 'Inter (Sans-serif)' },
    { value: 'Merriweather', label: 'Merriweather (Serif)' },
    { value: 'Georgia', label: 'Georgia (Serif)' }
];

const REFRESH_INTERVALS: { value: number; label: string }[] = [
    { value: 0, label: 'Disabled' },
    { value: 1, label: 'Every 1 minute' },
    { value: 5, label: 'Every 5 minutes' },
    { value: 10, label: 'Every 10 minutes' },
    { value: 15, label: 'Every 15 minutes' },
    { value: 30, label: 'Every 30 minutes' },
    { value: 60, label: 'Every hour' },
];

const TIME_HORIZONS: { value: number; label: string }[] = [
    { value: 1, label: 'Last Hour' },
    { value: 4, label: 'Last 4 Hours' },
    { value: 12, label: 'Last 12 Hours' },
    { value: 24, label: 'Today (24 Hours)' },
];

export default function Toolbar({ onRefresh, isRefreshing, settings, onSettingsChange, feeds, onOpenNewsreel, onOpenDailyNewsreel, selectedCount = 0, onClearAllData, onImportOPML, articles }: ToolbarProps) {
    const [showSettings, setShowSettings] = useState(false);
    const [tempSettings, setTempSettings] = useState(settings);
    const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'ai' | 'email' | 'about'>('general');



    const handleTestEmail = async () => {
        const emailSettings = {
            enabled: tempSettings.emailEnabled,
            smtpHost: tempSettings.emailSmtpHost,
            smtpPort: tempSettings.emailSmtpPort,
            smtpSecure: tempSettings.emailSmtpSecure,
            smtpUser: tempSettings.emailSmtpUser,
            smtpPassword: tempSettings.emailSmtpPassword,
            fromEmail: tempSettings.emailFrom,
            toEmail: tempSettings.emailTo,
            sendTime: tempSettings.emailSendTime,
            timeHorizon: tempSettings.emailTimeHorizon
        };

        try {
            console.log('🔍 Testing email connection...');
            console.log('Settings:', emailSettings);

            const ipcRenderer = (window as any).ipcRenderer;
            if (!ipcRenderer) {
                console.error('❌ ipcRenderer not available');
                alert('❌ Electron IPC not available');
                return;
            }

            console.log('📤 Invoking test-email-connection...');
            const result = await ipcRenderer.invoke('test-email-connection', emailSettings);
            console.log('📥 Result received:', result);

            if (result?.success) {
                alert('✅ Email connection successful!');
            } else {
                alert(`❌ Connection failed: ${result?.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('❌ Exception during email test:', error);
            alert(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleSendTestNewsreel = async () => {
        if (!confirm('This will generate and send a newsreel email to your address. Continue?')) return;

        const allArticles = articles.sort((a, b) => {
            return new Date(b.pubDate || '').getTime() - new Date(a.pubDate || '').getTime();
        });

        const emailSettings = {
            enabled: tempSettings.emailEnabled,
            smtpHost: tempSettings.emailSmtpHost,
            smtpPort: tempSettings.emailSmtpPort,
            smtpSecure: tempSettings.emailSmtpSecure,
            smtpUser: tempSettings.emailSmtpUser,
            smtpPassword: tempSettings.emailSmtpPassword,
            fromEmail: tempSettings.emailFrom,
            toEmail: tempSettings.emailTo,
            sendTime: tempSettings.emailSendTime,
            timeHorizon: tempSettings.emailTimeHorizon
        };

        try {
            const result = await (window as any).ipcRenderer?.invoke('send-daily-email', {
                articles: allArticles,
                emailSettings,
                appSettings: tempSettings
            });

            if (result?.success) {
                alert('✅ Test email sent successfully!');
            } else {
                alert(`❌ Failed to send email: ${result?.error || 'Unknown error'}`);
            }
        } catch (error) {
            alert(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    const handleExportOPML = () => {
        const opml = exportToOPML(feeds);
        downloadFile(opml, 'simonreads_feeds.opml', 'text/xml');
    };

    const handleExportJSON = () => {
        const json = exportToJSON(feeds);
        downloadFile(json, 'simonreads_feeds.json', 'application/json');
    };

    const handleImportClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.opml,.xml';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                onImportOPML(file);
                setShowSettings(false);
            }
        };
        input.click();
    };

    const modal = showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="close-btn" onClick={() => setShowSettings(false)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`}
                        onClick={() => setActiveTab('general')}
                    >
                        General
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'appearance' ? 'active' : ''}`}
                        onClick={() => setActiveTab('appearance')}
                    >
                        Appearance
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ai')}
                    >
                        AI
                    </button>
                    {(window as any).ipcRenderer && (
                        <button
                            className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
                            onClick={() => setActiveTab('email')}
                        >
                            Email
                        </button>
                    )}
                    <button
                        className={`tab-btn ${activeTab === 'about' ? 'active' : ''}`}
                        onClick={() => setActiveTab('about')}
                    >
                        About
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'general' && (
                        <>
                            <div className="setting-group">
                                <label>Auto-refresh</label>
                                <select
                                    value={tempSettings.autoRefreshInterval}
                                    onChange={e => setTempSettings({ ...tempSettings, autoRefreshInterval: Number(e.target.value) as any })}
                                >
                                    {REFRESH_INTERVALS.map(interval => (
                                        <option key={interval.value} value={interval.value}>{interval.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="setting-group">
                                <label>Keep read articles for</label>
                                <select
                                    value={tempSettings.retentionPeriod ?? 30}
                                    onChange={e => setTempSettings({ ...tempSettings, retentionPeriod: Number(e.target.value) as any })}
                                >
                                    <option value={7}>1 Week</option>
                                    <option value={14}>2 Weeks</option>
                                    <option value={30}>1 Month</option>
                                    <option value={90}>3 Months</option>
                                    <option value={365}>1 Year</option>
                                    <option value={-1}>Forever</option>
                                </select>
                            </div>

                            <div className="setting-divider"></div>

                            <div className="setting-group">
                                <label>Import / Export</label>
                                <div className="export-buttons">
                                    <button className="btn-secondary" onClick={handleImportClick}>
                                        <Download size={14} style={{ transform: 'rotate(180deg)' }} /> Import OPML
                                    </button>
                                    <button className="btn-secondary" onClick={handleExportOPML}>
                                        <Download size={14} /> Export OPML
                                    </button>
                                    <button className="btn-secondary" onClick={handleExportJSON}>
                                        <Download size={14} /> Export JSON
                                    </button>
                                </div>
                            </div>

                            <div className="setting-divider"></div>

                            <div className="setting-group">
                                <label>Danger Zone</label>
                                <button
                                    className="btn-danger"
                                    onClick={() => {
                                        if (window.confirm('⚠️ WARNING: This will permanently delete ALL feeds, articles, and settings. This action cannot be undone. Are you sure you want to continue?')) {
                                            onClearAllData();
                                            setShowSettings(false);
                                        }
                                    }}
                                >
                                    <Trash2 size={14} />
                                    Clear All Data
                                </button>
                                <p className="setting-hint" style={{ color: '#ef4444' }}>
                                    This will permanently delete all your feeds, articles, and settings.
                                </p>
                            </div>
                        </>
                    )}

                    {activeTab === 'appearance' && (
                        <>
                            <div className="setting-group">
                                <label>Theme</label>
                                <select
                                    value={tempSettings.theme}
                                    onChange={e => setTempSettings({ ...tempSettings, theme: e.target.value as any })}
                                >
                                    <option value="system">System</option>
                                    <option value="dark">Dark</option>
                                    <option value="light">Light</option>
                                    <option value="sepia">Sepia</option>
                                    <option value="black">Black (OLED)</option>
                                </select>
                            </div>
                            <div className="setting-group">
                                <label>Font</label>
                                <select
                                    value={tempSettings.font}
                                    onChange={e => setTempSettings({ ...tempSettings, font: e.target.value })}
                                >
                                    {FONTS.map(font => (
                                        <option key={font.value} value={font.value}>{font.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="setting-group">
                                <label>Font Size</label>
                                <select
                                    value={tempSettings.fontSize || 'medium'}
                                    onChange={e => setTempSettings({ ...tempSettings, fontSize: e.target.value as any })}
                                >
                                    <option value="small">Small</option>
                                    <option value="medium">Medium</option>
                                    <option value="large">Large</option>
                                    <option value="xlarge">Extra Large</option>
                                </select>
                            </div>
                        </>
                    )}

                    {activeTab === 'ai' && (
                        <>
                            <div className="setting-group">
                                <label>AI Provider</label>
                                <select
                                    value={tempSettings.aiProvider || 'gemini'}
                                    onChange={e => setTempSettings({ ...tempSettings, aiProvider: e.target.value as any })}
                                >
                                    <option value="gemini">Google Gemini (Free Tier Available)</option>
                                    <option value="openai">OpenAI (GPT-4o/mini)</option>
                                    <option value="claude">Anthropic Claude</option>
                                </select>
                            </div>

                            {(!tempSettings.aiProvider || tempSettings.aiProvider === 'gemini') && (
                                <>
                                    <div className="setting-group">
                                        <label>Gemini API Key</label>
                                        <input
                                            type="password"
                                            value={tempSettings.geminiApiKey || ''}
                                            onChange={e => setTempSettings({ ...tempSettings, geminiApiKey: e.target.value })}
                                            placeholder="Enter your Gemini API Key"
                                            className="api-key-input"
                                        />
                                        <p className="setting-hint">Required for AI Summaries. <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Get Key</a></p>
                                    </div>
                                    <div className="setting-group">
                                        <label>Gemini Model</label>
                                        <input
                                            type="text"
                                            value={tempSettings.geminiModel || 'gemini-1.5-flash'}
                                            onChange={e => setTempSettings({ ...tempSettings, geminiModel: e.target.value })}
                                            placeholder="e.g. gemini-1.5-flash"
                                            className="api-key-input"
                                        />
                                    </div>
                                </>
                            )}

                            {tempSettings.aiProvider === 'openai' && (
                                <>
                                    <div className="setting-group">
                                        <label>OpenAI API Key</label>
                                        <input
                                            type="password"
                                            value={tempSettings.openaiApiKey || ''}
                                            onChange={e => setTempSettings({ ...tempSettings, openaiApiKey: e.target.value })}
                                            placeholder="sk-..."
                                            className="api-key-input"
                                        />
                                        <p className="setting-hint"><a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Get Key</a></p>
                                    </div>
                                    <div className="setting-group">
                                        <label>OpenAI Model</label>
                                        <input
                                            type="text"
                                            value={tempSettings.openaiModel || 'gpt-4o-mini'}
                                            onChange={e => setTempSettings({ ...tempSettings, openaiModel: e.target.value })}
                                            placeholder="e.g. gpt-4o-mini"
                                            className="api-key-input"
                                        />
                                    </div>
                                </>
                            )}

                            {tempSettings.aiProvider === 'claude' && (
                                <>
                                    <div className="setting-group">
                                        <label>Anthropic API Key</label>
                                        <input
                                            type="password"
                                            value={tempSettings.claudeApiKey || ''}
                                            onChange={e => setTempSettings({ ...tempSettings, claudeApiKey: e.target.value })}
                                            placeholder="sk-ant-..."
                                            className="api-key-input"
                                        />
                                        <p className="setting-hint"><a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Get Key</a></p>
                                    </div>
                                    <div className="setting-group">
                                        <label>Claude Model</label>
                                        <input
                                            type="text"
                                            value={tempSettings.claudeModel || 'claude-3-haiku-20240307'}
                                            onChange={e => setTempSettings({ ...tempSettings, claudeModel: e.target.value })}
                                            placeholder="e.g. claude-3-haiku-20240307"
                                            className="api-key-input"
                                        />
                                    </div>
                                </>
                            )}



                            <div className="setting-divider"></div>
                            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>AI Summary Preferences</h3>

                            <div className="setting-group">
                                <label>Tone</label>
                                <select
                                    value={tempSettings.summaryTone || 'neutral'}
                                    onChange={e => setTempSettings({ ...tempSettings, summaryTone: e.target.value as any })}
                                >
                                    <option value="neutral">Neutral</option>
                                    <option value="formal">Formal</option>
                                    <option value="witty">Witty</option>
                                    <option value="critical">Critical</option>
                                    <option value="eli5">Explain Like I'm 5</option>
                                </select>
                            </div>

                            <div className="setting-group">
                                <label>Language</label>
                                <select
                                    value={tempSettings.summaryLanguage || 'English'}
                                    onChange={e => setTempSettings({ ...tempSettings, summaryLanguage: e.target.value })}
                                >
                                    <option value="English">English</option>
                                    <option value="Italian">Italian</option>
                                    <option value="Spanish">Spanish</option>
                                    <option value="French">French</option>
                                    <option value="German">German</option>
                                    <option value="Portuguese">Portuguese</option>
                                    <option value="Dutch">Dutch</option>
                                    <option value="Russian">Russian</option>
                                    <option value="Chinese">Chinese</option>
                                    <option value="Japanese">Japanese</option>
                                </select>
                            </div>

                            <div className="setting-group">
                                <label>Length</label>
                                <select
                                    value={tempSettings.summaryLength || 'medium'}
                                    onChange={e => setTempSettings({ ...tempSettings, summaryLength: e.target.value as any })}
                                >
                                    <option value="short">Short</option>
                                    <option value="medium">Medium</option>
                                    <option value="long">Long</option>
                                </select>
                            </div>

                            <div className="setting-group">
                                <label>Depth</label>
                                <select
                                    value={tempSettings.summaryDepth || 'detailed'}
                                    onChange={e => setTempSettings({ ...tempSettings, summaryDepth: e.target.value as any })}
                                >
                                    <option value="brief">Brief</option>
                                    <option value="detailed">Detailed</option>
                                    <option value="comprehensive">Comprehensive</option>
                                </select>
                            </div>

                            <div className="setting-group">
                                <label>Custom Instructions</label>
                                <textarea
                                    value={tempSettings.summaryPrompt || ''}
                                    onChange={e => setTempSettings({ ...tempSettings, summaryPrompt: e.target.value })}
                                    placeholder="Any specific instructions..."
                                    className="api-key-input"
                                    style={{ minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                                />
                            </div>

                            <div className="setting-divider"></div>
                            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>Voice & Speech</h3>

                            <div className="setting-group">
                                <label>Voice Engine</label>
                                <select
                                    value={tempSettings.ttsProvider || 'free'}
                                    onChange={e => setTempSettings({ ...tempSettings, ttsProvider: e.target.value as any })}
                                >
                                    <option value="free">Free Cloud (High Quality)</option>
                                    <option value="system">System (Offline)</option>
                                    <option value="openai">OpenAI (Premium)</option>
                                </select>
                                <p className="setting-hint">
                                    {tempSettings.ttsProvider === 'free' && "Uses high-quality free cloud voices."}
                                    {tempSettings.ttsProvider === 'system' && "Uses built-in browser voices (robotic)."}
                                    {tempSettings.ttsProvider === 'openai' && "Requires OpenAI API Key above."}
                                </p>
                            </div>

                            <div className="setting-group">
                                <label>Language</label>
                                <select
                                    value={tempSettings.readAloudLanguage || 'en'}
                                    onChange={e => setTempSettings({ ...tempSettings, readAloudLanguage: e.target.value })}
                                >
                                    <option value="en">English</option>
                                    <option value="it">Italian</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                    <option value="de">German</option>
                                    <option value="pt">Portuguese</option>
                                    <option value="nl">Dutch</option>
                                    <option value="ru">Russian</option>
                                    <option value="zh">Chinese</option>
                                    <option value="ja">Japanese</option>
                                </select>
                                <p className="setting-hint">Language for cloud TTS (when using Free Cloud voice engine)</p>
                            </div>

                            <div className="setting-divider"></div>
                            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>Daily Newsreel</h3>

                            <div className="setting-group">
                                <label>Time Horizon</label>
                                <select
                                    value={tempSettings.dailyNewsreelTimeHorizon || 24}
                                    onChange={e => setTempSettings({ ...tempSettings, dailyNewsreelTimeHorizon: Number(e.target.value) as any })}
                                >
                                    {TIME_HORIZONS.map(horizon => (
                                        <option key={horizon.value} value={horizon.value}>{horizon.label}</option>
                                    ))}
                                </select>
                                <p className="setting-hint">Articles from this time period will be included in the Daily Newsreel</p>
                            </div>
                        </>
                    )}



                    {activeTab === 'email' && (
                        <>
                            <div className="setting-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={tempSettings.emailEnabled}
                                        onChange={(e) => setTempSettings({
                                            ...tempSettings,
                                            emailEnabled: e.target.checked
                                        })}
                                        style={{ marginRight: '8px' }}
                                    />
                                    Enable Daily Email
                                </label>
                            </div>

                            <div className="setting-group">
                                <label>Send Time (24-hour format)</label>
                                <input
                                    type="time"
                                    value={tempSettings.emailSendTime}
                                    onChange={(e) => setTempSettings({
                                        ...tempSettings,
                                        emailSendTime: e.target.value
                                    })}
                                    className="api-key-input"
                                />
                            </div>

                            <div className="setting-group">
                                <label>Time Horizon (hours to look back)</label>
                                <select
                                    value={tempSettings.emailTimeHorizon}
                                    onChange={(e) => setTempSettings({
                                        ...tempSettings,
                                        emailTimeHorizon: parseInt(e.target.value)
                                    })}
                                >
                                    <option value="6">6 hours</option>
                                    <option value="12">12 hours</option>
                                    <option value="24">24 hours</option>
                                </select>
                            </div>

                            <div className="setting-divider"></div>
                            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>SMTP Settings</h3>

                            <div className="setting-group">
                                <label>SMTP Host</label>
                                <input
                                    type="text"
                                    value={tempSettings.emailSmtpHost}
                                    onChange={(e) => setTempSettings({
                                        ...tempSettings,
                                        emailSmtpHost: e.target.value
                                    })}
                                    placeholder="smtp.gmail.com"
                                    className="api-key-input"
                                />
                            </div>

                            <div className="setting-group">
                                <label>SMTP Port</label>
                                <input
                                    type="number"
                                    value={tempSettings.emailSmtpPort}
                                    onChange={(e) => setTempSettings({
                                        ...tempSettings,
                                        emailSmtpPort: parseInt(e.target.value)
                                    })}
                                    placeholder="587"
                                    className="api-key-input"
                                />
                            </div>

                            <div className="setting-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={tempSettings.emailSmtpSecure}
                                        onChange={(e) => setTempSettings({
                                            ...tempSettings,
                                            emailSmtpSecure: e.target.checked
                                        })}
                                        style={{ marginRight: '8px' }}
                                    />
                                    Use SSL/TLS
                                </label>
                            </div>

                            <div className="setting-group">
                                <label>SMTP Username</label>
                                <input
                                    type="text"
                                    value={tempSettings.emailSmtpUser}
                                    onChange={(e) => setTempSettings({
                                        ...tempSettings,
                                        emailSmtpUser: e.target.value
                                    })}
                                    className="api-key-input"
                                />
                            </div>

                            <div className="setting-group">
                                <label>SMTP Password</label>
                                <input
                                    type="password"
                                    value={tempSettings.emailSmtpPassword}
                                    onChange={(e) => setTempSettings({
                                        ...tempSettings,
                                        emailSmtpPassword: e.target.value
                                    })}
                                    className="api-key-input"
                                />
                            </div>

                            <div className="setting-group">
                                <label>From Email</label>
                                <input
                                    type="email"
                                    value={tempSettings.emailFrom}
                                    onChange={(e) => setTempSettings({
                                        ...tempSettings,
                                        emailFrom: e.target.value
                                    })}
                                    className="api-key-input"
                                />
                            </div>

                            <div className="setting-group">
                                <label>To Email</label>
                                <input
                                    type="email"
                                    value={tempSettings.emailTo}
                                    onChange={(e) => setTempSettings({
                                        ...tempSettings,
                                        emailTo: e.target.value
                                    })}
                                    className="api-key-input"
                                />
                            </div>

                            <div className="setting-divider"></div>
                            <div className="setting-group" style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn-secondary" onClick={handleTestEmail}>Test Connection</button>
                                <button className="btn-secondary" onClick={handleSendTestNewsreel}>Send Test Newsreel</button>
                            </div>
                        </>
                    )}

                    {activeTab === 'about' && (
                        <div className="setting-group about">
                            <div style={{ textAlign: 'center', marginTop: '12px', color: 'var(--text-secondary)' }}>
                                © Simone Bianco {new Date().getFullYear()}<br />
                                Version {packageJson.version}
                            </div>
                        </div>
                    )}
                </div>
                {
                    activeTab !== 'about' && (
                        <div className="modal-footer">
                            <button className="btn-primary" onClick={() => {
                                onSettingsChange(tempSettings);
                                setShowSettings(false);
                            }}>
                                Save Changes
                            </button>
                        </div>
                    )
                }
            </div >
        </div >
    );

    return (
        <>
            <div className="toolbar">
                <div className="toolbar-left">
                </div>
                <div className="toolbar-right">
                    {onOpenDailyNewsreel && (
                        <button
                            className="newsreel-btn"
                            onClick={onOpenDailyNewsreel}
                            data-tooltip={`Daily Newsreel (${TIME_HORIZONS.find(h => h.value === settings.dailyNewsreelTimeHorizon)?.label || '24 Hours'})`}
                        >
                            <Newspaper size={18} />
                            <span>Daily Newsreel</span>
                        </button>
                    )}
                    {selectedCount > 0 && onOpenNewsreel && (
                        <button
                            className="newsreel-btn"
                            onClick={onOpenNewsreel}
                            data-tooltip={`Create Newsreel from ${selectedCount} articles`}
                        >
                            <Newspaper size={18} />
                            <span>Newsreel ({selectedCount})</span>
                        </button>
                    )}
                    <button
                        className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        data-tooltip="Refresh Feeds"
                    >
                        <RefreshCw size={18} />
                    </button>
                    <button
                        className="settings-btn"
                        onClick={() => {
                            setTempSettings(settings);
                            setShowSettings(true);
                        }}
                        data-tooltip="Settings"
                    >
                        <Settings size={18} />
                    </button>
                </div>
            </div>
            {createPortal(modal, document.body)}
        </>
    );
}
