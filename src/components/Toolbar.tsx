import { Settings, RefreshCw, X, Download, Newspaper, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AppSettings, Feed, Article } from '../types';
import { exportToOPML, exportToJSON, downloadFile } from '../exportService';
import PersonalitySelector from './PersonalitySelector';
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
    onShowTutorial?: () => void;
    hideButtons?: boolean;
    setOpenSettingsRef?: (fn: () => void) => void;
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

export default function Toolbar({ onRefresh, isRefreshing, settings, onSettingsChange, feeds, onOpenNewsreel, onOpenDailyNewsreel, selectedCount = 0, onClearAllData, onImportOPML, articles, onShowTutorial, hideButtons, setOpenSettingsRef }: ToolbarProps) {
    const [showSettings, setShowSettings] = useState(false);
    const [tempSettings, setTempSettings] = useState(settings);
    const [activeTab, setActiveTab] = useState<'general' | 'appearance' | 'personality' | 'ai' | 'email' | 'about'>('general');
    const [geminiModels, setGeminiModels] = useState<string[]>([]);
    const [openaiModels, setOpenaiModels] = useState<string[]>([]);
    const [claudeModels, setClaudeModels] = useState<string[]>([]);
    const [ollamaModels, setOllamaModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    // Newsreel-specific model lists
    const [newsreelGeminiModels, setNewsreelGeminiModels] = useState<string[]>([]);
    const [newsreelOpenaiModels, setNewsreelOpenaiModels] = useState<string[]>([]);
    const [newsreelClaudeModels, setNewsreelClaudeModels] = useState<string[]>([]);
    const [newsreelOllamaModels, setNewsreelOllamaModels] = useState<string[]>([]);
    const [isLoadingNewsreelModels, setIsLoadingNewsreelModels] = useState(false);

    // Expose the openSettings function to parent
    const openSettings = () => {
        setTempSettings(settings);
        setShowSettings(true);
    };

    const handleCloseSettings = () => {
        // Restore theme to original settings (undo preview)
        let originalTheme = settings.theme;
        if (settings.theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            originalTheme = isDark ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', originalTheme);
        setShowSettings(false);
    };

    // Call setOpenSettingsRef once on mount to pass the function up
    if (setOpenSettingsRef) {
        setOpenSettingsRef(openSettings);
    }

    const fetchModels = async (provider: 'gemini' | 'openai' | 'claude' | 'ollama') => {
        setIsLoadingModels(true);
        const ipcRenderer = (window as any).ipcRenderer;

        try {
            let models: string[] = [];

            if (provider === 'gemini' && tempSettings.geminiApiKey) {
                if (ipcRenderer) {
                    models = await ipcRenderer.invoke('fetch-gemini-models', tempSettings.geminiApiKey);
                } else {
                    // Direct fetch for Android/mobile
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${tempSettings.geminiApiKey}`);
                    if (!response.ok) throw new Error('Failed to fetch Gemini models');
                    const data = await response.json();
                    models = data.models
                        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                        .map((m: any) => m.name.replace('models/', ''));
                }
                setGeminiModels(models);
                if (models.length > 0 && (!tempSettings.geminiModel || !models.includes(tempSettings.geminiModel))) {
                    setTempSettings(prev => ({ ...prev, geminiModel: models[0] }));
                }
            } else if (provider === 'openai' && tempSettings.openaiApiKey) {
                if (ipcRenderer) {
                    models = await ipcRenderer.invoke('fetch-openai-models', tempSettings.openaiApiKey);
                } else {
                    // Direct fetch for Android/mobile
                    const response = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${tempSettings.openaiApiKey}` }
                    });
                    if (!response.ok) throw new Error('Failed to fetch OpenAI models');
                    const data = await response.json();
                    models = data.data
                        .filter((m: any) => m.id.includes('gpt'))
                        .map((m: any) => m.id)
                        .sort();
                }
                setOpenaiModels(models);
                if (models.length > 0 && (!tempSettings.openaiModel || !models.includes(tempSettings.openaiModel))) {
                    setTempSettings(prev => ({ ...prev, openaiModel: models[0] }));
                }
            } else if (provider === 'claude' && tempSettings.claudeApiKey) {
                if (ipcRenderer) {
                    models = await ipcRenderer.invoke('fetch-claude-models', tempSettings.claudeApiKey);
                } else {
                    // Anthropic's API may have CORS issues from browser, provide static list
                    // The API endpoint doesn't support browser CORS
                    models = [
                        'claude-3-5-sonnet-20241022',
                        'claude-3-5-haiku-20241022',
                        'claude-3-opus-20240229',
                        'claude-3-sonnet-20240229',
                        'claude-3-haiku-20240307'
                    ];
                }
                setClaudeModels(models);
                if (models.length > 0 && (!tempSettings.claudeModel || !models.includes(tempSettings.claudeModel))) {
                    setTempSettings(prev => ({ ...prev, claudeModel: models[0] }));
                }
            } else if (provider === 'ollama') {
                // Fetch from local Ollama instance
                const baseUrl = tempSettings.ollamaUrl || 'http://localhost:11434';
                const cleanUrl = baseUrl.replace(/\/$/, '');
                try {
                    const response = await fetch(`${cleanUrl}/api/tags`);
                    if (!response.ok) throw new Error('Failed to fetch Ollama models');
                    const data = await response.json();
                    // Data format: { models: [ { name: "llama3:latest", ... } ] }
                    models = data.models.map((m: any) => m.name);
                    setOllamaModels(models);
                    if (models.length > 0 && (!tempSettings.ollamaModel || !models.includes(tempSettings.ollamaModel))) {
                        setTempSettings(prev => ({ ...prev, ollamaModel: models[0] }));
                    }
                } catch (e) {
                    console.error('Ollama fetch error:', e);
                    throw new Error('Failed to connect to Ollama. Make sure it is running and accessible (check CORS settings if needed).');
                }
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            alert('Failed to fetch models. Please check your API key.');
        } finally {
            setIsLoadingModels(false);
        }
    };

    // Fetch models for newsreel-specific AI settings
    const fetchNewsreelModels = async (provider: 'gemini' | 'openai' | 'claude' | 'ollama') => {
        setIsLoadingNewsreelModels(true);
        const ipcRenderer = (window as any).ipcRenderer;

        try {
            let models: string[] = [];
            const apiKey = provider === 'gemini' ? (tempSettings.newsreelGeminiApiKey || tempSettings.geminiApiKey)
                : provider === 'openai' ? (tempSettings.newsreelOpenaiApiKey || tempSettings.openaiApiKey)
                    : provider === 'claude' ? (tempSettings.newsreelClaudeApiKey || tempSettings.claudeApiKey)
                        : '';

            if (provider === 'gemini' && apiKey) {
                if (ipcRenderer) {
                    models = await ipcRenderer.invoke('fetch-gemini-models', apiKey);
                } else {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                    if (!response.ok) throw new Error('Failed to fetch Gemini models');
                    const data = await response.json();
                    models = data.models
                        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                        .map((m: any) => m.name.replace('models/', ''));
                }
                setNewsreelGeminiModels(models);
                if (models.length > 0 && !tempSettings.newsreelGeminiModel) {
                    setTempSettings(prev => ({ ...prev, newsreelGeminiModel: models[0] }));
                }
            } else if (provider === 'openai' && apiKey) {
                if (ipcRenderer) {
                    models = await ipcRenderer.invoke('fetch-openai-models', apiKey);
                } else {
                    const response = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                    });
                    if (!response.ok) throw new Error('Failed to fetch OpenAI models');
                    const data = await response.json();
                    models = data.data
                        .filter((m: any) => m.id.includes('gpt'))
                        .map((m: any) => m.id)
                        .sort();
                }
                setNewsreelOpenaiModels(models);
                if (models.length > 0 && !tempSettings.newsreelOpenaiModel) {
                    setTempSettings(prev => ({ ...prev, newsreelOpenaiModel: models[0] }));
                }
            } else if (provider === 'claude') {
                // Static list for Claude (CORS issues)
                models = [
                    'claude-3-5-sonnet-20241022',
                    'claude-3-5-haiku-20241022',
                    'claude-3-opus-20240229',
                    'claude-3-sonnet-20240229',
                    'claude-3-haiku-20240307'
                ];
                setNewsreelClaudeModels(models);
                if (models.length > 0 && !tempSettings.newsreelClaudeModel) {
                    setTempSettings(prev => ({ ...prev, newsreelClaudeModel: models[0] }));
                }
            } else if (provider === 'ollama') {
                const baseUrl = tempSettings.newsreelOllamaUrl || tempSettings.ollamaUrl || 'http://localhost:11434';
                const cleanUrl = baseUrl.replace(/\/$/, '');
                const response = await fetch(`${cleanUrl}/api/tags`);
                if (!response.ok) throw new Error('Failed to fetch Ollama models');
                const data = await response.json();
                models = data.models.map((m: any) => m.name);
                setNewsreelOllamaModels(models);
                if (models.length > 0 && !tempSettings.newsreelOllamaModel) {
                    setTempSettings(prev => ({ ...prev, newsreelOllamaModel: models[0] }));
                }
            }
        } catch (error) {
            console.error('Failed to fetch newsreel models:', error);
            alert('Failed to fetch models. Please check your API key or Ollama connection.');
        } finally {
            setIsLoadingNewsreelModels(false);
        }
    };

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

        // Validate required fields
        if (!emailSettings.smtpHost) {
            alert('❌ Please enter SMTP Host\n\nFor Gmail: smtp.gmail.com\nFor Outlook: smtp-mail.outlook.com');
            return;
        }
        if (!emailSettings.smtpUser) {
            alert('❌ Please enter SMTP Username (your email address)');
            return;
        }
        if (!emailSettings.smtpPassword) {
            alert('❌ Please enter SMTP Password (or App Password for Gmail)');
            return;
        }

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
            console.log('📥 Result received:', JSON.stringify(result, null, 2));
            console.log('Result type:', typeof result);
            console.log('Result.success:', result?.success);
            console.log('Result.error:', result?.error);
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
        <div className="modal-overlay" onClick={handleCloseSettings}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="close-btn" onClick={handleCloseSettings}>
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
                        className={`tab-btn ${activeTab === 'personality' ? 'active' : ''}`}
                        onClick={() => setActiveTab('personality')}
                    >
                        Personality
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ai')}
                    >
                        AI
                    </button>
                    {/* Email tab hidden - feature temporarily disabled */}
                    {false && (window as any).ipcRenderer && (
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
                                    onChange={e => {
                                        const val = e.target.value as any;
                                        setTempSettings({ ...tempSettings, theme: val });
                                        // Live preview
                                        let previewTheme = val;
                                        if (val === 'system') {
                                            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                            previewTheme = isDark ? 'dark' : 'light';
                                        }
                                        document.documentElement.setAttribute('data-theme', previewTheme);
                                    }}
                                >
                                    <option value="system">System</option>
                                    <option value="dark">Dark</option>
                                    <option value="light">Light</option>
                                    <option value="sepia">Sepia</option>
                                    <option value="black">Black (OLED)</option>
                                    <option value="nord">Nord</option>
                                    <option value="solarized-dark">Solarized Dark</option>
                                    <option value="dracula">Dracula</option>
                                    <option value="gruvbox">Gruvbox</option>
                                    <option value="tokyo-night">Tokyo Night</option>
                                    <option value="sorcerer">✨ Sorcerer</option>
                                    <option value="warm">☀️ Warm</option>
                                </select>
                            </div>
                            <div className="setting-group">
                                <label>Layout</label>
                                <select
                                    value={tempSettings.layout || 'classic'}
                                    onChange={e => setTempSettings({ ...tempSettings, layout: e.target.value as any })}
                                >
                                    <option value="classic">Classic (3-Column)</option>
                                    <option value="modern">Modern (Card-Based)</option>
                                </select>
                                <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Modern layout features a carousel view with featured articles
                                </small>
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
                            <div className="setting-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={tempSettings.usePublicationColors ?? true}
                                        onChange={e => setTempSettings({ ...tempSettings, usePublicationColors: e.target.checked })}
                                    />
                                    Use Publication Colors
                                </label>
                                <p className="setting-hint">Apply subtle brand colors from the original publication to the article view</p>
                            </div>
                        </>
                    )}

                    {activeTab === 'personality' && (
                        <PersonalitySelector
                            currentPersonality={tempSettings.readingPersonality}
                            autoSwitchEnabled={tempSettings.autoSwitchEnabled}
                            autoSwitchTrigger={tempSettings.autoSwitchTrigger}
                            personalitySchedule={tempSettings.personalitySchedule}
                            onPersonalityChange={(personality) => {
                                setTempSettings({ ...tempSettings, readingPersonality: personality });
                            }}
                            onAutoSwitchChange={(enabled, trigger) => {
                                setTempSettings({
                                    ...tempSettings,
                                    autoSwitchEnabled: enabled,
                                    autoSwitchTrigger: trigger
                                });
                            }}
                            onScheduleChange={(schedule) => {
                                setTempSettings({
                                    ...tempSettings,
                                    personalitySchedule: schedule
                                });
                            }}
                        />
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
                                    <option value="ollama">Ollama (Local LLM)</option>
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
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {geminiModels.length > 0 ? (
                                                <select
                                                    value={tempSettings.geminiModel || 'gemini-1.5-flash'}
                                                    onChange={e => setTempSettings({ ...tempSettings, geminiModel: e.target.value })}
                                                    className="api-key-input"
                                                    style={{ flex: 1 }}
                                                >
                                                    {geminiModels.map(model => (
                                                        <option key={model} value={model}>{model}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={tempSettings.geminiModel || 'gemini-1.5-flash'}
                                                    onChange={e => setTempSettings({ ...tempSettings, geminiModel: e.target.value })}
                                                    placeholder="e.g. gemini-1.5-flash"
                                                    className="api-key-input"
                                                    style={{ flex: 1 }}
                                                />
                                            )}
                                            <button
                                                className="icon-btn"
                                                onClick={() => fetchModels('gemini')}
                                                disabled={isLoadingModels || !tempSettings.geminiApiKey}
                                                title="Fetch available models"
                                                style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <RefreshCw size={16} className={isLoadingModels ? 'spin' : ''} />
                                            </button>
                                        </div>
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
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {openaiModels.length > 0 ? (
                                                <select
                                                    value={tempSettings.openaiModel || 'gpt-4o-mini'}
                                                    onChange={e => setTempSettings({ ...tempSettings, openaiModel: e.target.value })}
                                                    className="api-key-input"
                                                    style={{ flex: 1 }}
                                                >
                                                    {openaiModels.map(model => (
                                                        <option key={model} value={model}>{model}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={tempSettings.openaiModel || 'gpt-4o-mini'}
                                                    onChange={e => setTempSettings({ ...tempSettings, openaiModel: e.target.value })}
                                                    placeholder="e.g. gpt-4o-mini"
                                                    className="api-key-input"
                                                    style={{ flex: 1 }}
                                                />
                                            )}
                                            <button
                                                className="icon-btn"
                                                onClick={() => fetchModels('openai')}
                                                disabled={isLoadingModels || !tempSettings.openaiApiKey}
                                                title="Fetch available models"
                                                style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <RefreshCw size={16} className={isLoadingModels ? 'spin' : ''} />
                                            </button>
                                        </div>
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
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {claudeModels.length > 0 ? (
                                                <select
                                                    value={tempSettings.claudeModel || 'claude-3-haiku-20240307'}
                                                    onChange={e => setTempSettings({ ...tempSettings, claudeModel: e.target.value })}
                                                    className="api-key-input"
                                                    style={{ flex: 1 }}
                                                >
                                                    {claudeModels.map(model => (
                                                        <option key={model} value={model}>{model}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={tempSettings.claudeModel || 'claude-3-haiku-20240307'}
                                                    onChange={e => setTempSettings({ ...tempSettings, claudeModel: e.target.value })}
                                                    placeholder="e.g. claude-3-haiku-20240307"
                                                    className="api-key-input"
                                                    style={{ flex: 1 }}
                                                />
                                            )}
                                            <button
                                                className="icon-btn"
                                                onClick={() => fetchModels('claude')}
                                                disabled={isLoadingModels || !tempSettings.claudeApiKey}
                                                title="Fetch available models"
                                                style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <RefreshCw size={16} className={isLoadingModels ? 'spin' : ''} />
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}

                            {tempSettings.aiProvider === 'ollama' && (
                                <>
                                    <div className="setting-group">
                                        <label>Ollama Server URL</label>
                                        <input
                                            type="text"
                                            value={tempSettings.ollamaUrl || 'http://localhost:11434'}
                                            onChange={e => setTempSettings({ ...tempSettings, ollamaUrl: e.target.value })}
                                            placeholder="http://localhost:11434"
                                            className="api-key-input"
                                        />
                                        <p className="setting-hint">Default is http://localhost:11434</p>
                                    </div>
                                    <div className="setting-group">
                                        <label>Ollama Model</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {ollamaModels.length > 0 ? (
                                                <select
                                                    value={tempSettings.ollamaModel || 'llama3'}
                                                    onChange={e => setTempSettings({ ...tempSettings, ollamaModel: e.target.value })}
                                                    className="api-key-input"
                                                    style={{ flex: 1 }}
                                                >
                                                    {ollamaModels.map(model => (
                                                        <option key={model} value={model}>{model}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={tempSettings.ollamaModel || 'llama3'}
                                                    onChange={e => setTempSettings({ ...tempSettings, ollamaModel: e.target.value })}
                                                    placeholder="e.g. llama3"
                                                    className="api-key-input"
                                                    style={{ flex: 1 }}
                                                />
                                            )}
                                            <button
                                                className="icon-btn"
                                                onClick={() => fetchModels('ollama')}
                                                disabled={isLoadingModels}
                                                title="Fetch available models"
                                                style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <RefreshCw size={16} className={isLoadingModels ? 'spin' : ''} />
                                            </button>
                                        </div>
                                        <p className="setting-hint">Make sure you have pulled this model (e.g. `ollama pull llama3`)</p>
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
                            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>PDF Newsreel Preferences</h3>

                            <div className="setting-group">
                                <label>Summary Length</label>
                                <select
                                    value={tempSettings.pdfSummaryLength || 'medium'}
                                    onChange={e => setTempSettings({ ...tempSettings, pdfSummaryLength: e.target.value as any })}
                                >
                                    <option value="short">Short</option>
                                    <option value="medium">Medium</option>
                                    <option value="long">Long</option>
                                </select>
                            </div>

                            <div className="setting-group">
                                <label>Summary Depth</label>
                                <select
                                    value={tempSettings.pdfSummaryDepth || 'detailed'}
                                    onChange={e => setTempSettings({ ...tempSettings, pdfSummaryDepth: e.target.value as any })}
                                >
                                    <option value="brief">Brief</option>
                                    <option value="detailed">Detailed</option>
                                    <option value="comprehensive">Comprehensive</option>
                                </select>
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

                            <div className="setting-divider"></div>
                            <h3 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--text-primary)' }}>Newsreel AI Model</h3>

                            <div className="setting-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="newsreelAiMode"
                                        checked={tempSettings.newsreelUseGlobalAI !== false}
                                        onChange={() => setTempSettings({ ...tempSettings, newsreelUseGlobalAI: true })}
                                    />
                                    Use Global AI Settings
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '8px' }}>
                                    <input
                                        type="radio"
                                        name="newsreelAiMode"
                                        checked={tempSettings.newsreelUseGlobalAI === false}
                                        onChange={() => setTempSettings({ ...tempSettings, newsreelUseGlobalAI: false })}
                                    />
                                    Use Separate Model for Newsreel
                                </label>
                                <p className="setting-hint">Choose a different AI model optimized for newsreel generation</p>
                            </div>

                            {tempSettings.newsreelUseGlobalAI === false && (
                                <>
                                    <div className="setting-group">
                                        <label>Newsreel AI Provider</label>
                                        <select
                                            value={tempSettings.newsreelAiProvider || 'gemini'}
                                            onChange={e => setTempSettings({ ...tempSettings, newsreelAiProvider: e.target.value as any })}
                                        >
                                            <option value="gemini">Google Gemini</option>
                                            <option value="openai">OpenAI</option>
                                            <option value="claude">Anthropic Claude</option>
                                            <option value="ollama">Ollama (Local)</option>
                                        </select>
                                    </div>

                                    {(!tempSettings.newsreelAiProvider || tempSettings.newsreelAiProvider === 'gemini') && (
                                        <>
                                            <div className="setting-group">
                                                <label>Gemini API Key</label>
                                                <input
                                                    type="password"
                                                    value={tempSettings.newsreelGeminiApiKey || tempSettings.geminiApiKey || ''}
                                                    onChange={e => setTempSettings({ ...tempSettings, newsreelGeminiApiKey: e.target.value })}
                                                    placeholder="Use global key or enter new"
                                                    className="api-key-input"
                                                />
                                            </div>
                                            <div className="setting-group">
                                                <label>Gemini Model</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {newsreelGeminiModels.length > 0 ? (
                                                        <select
                                                            value={tempSettings.newsreelGeminiModel || 'gemini-1.5-flash'}
                                                            onChange={e => setTempSettings({ ...tempSettings, newsreelGeminiModel: e.target.value })}
                                                            className="api-key-input"
                                                            style={{ flex: 1 }}
                                                        >
                                                            {newsreelGeminiModels.map(model => (
                                                                <option key={model} value={model}>{model}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={tempSettings.newsreelGeminiModel || 'gemini-1.5-flash'}
                                                            onChange={e => setTempSettings({ ...tempSettings, newsreelGeminiModel: e.target.value })}
                                                            placeholder="e.g. gemini-1.5-flash"
                                                            className="api-key-input"
                                                            style={{ flex: 1 }}
                                                        />
                                                    )}
                                                    <button
                                                        className="icon-btn"
                                                        onClick={() => fetchNewsreelModels('gemini')}
                                                        disabled={isLoadingNewsreelModels || !(tempSettings.newsreelGeminiApiKey || tempSettings.geminiApiKey)}
                                                        title="Fetch available models"
                                                        style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <RefreshCw size={16} className={isLoadingNewsreelModels ? 'spin' : ''} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {tempSettings.newsreelAiProvider === 'openai' && (
                                        <>
                                            <div className="setting-group">
                                                <label>OpenAI API Key</label>
                                                <input
                                                    type="password"
                                                    value={tempSettings.newsreelOpenaiApiKey || tempSettings.openaiApiKey || ''}
                                                    onChange={e => setTempSettings({ ...tempSettings, newsreelOpenaiApiKey: e.target.value })}
                                                    placeholder="Use global key or enter new"
                                                    className="api-key-input"
                                                />
                                            </div>
                                            <div className="setting-group">
                                                <label>OpenAI Model</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {newsreelOpenaiModels.length > 0 ? (
                                                        <select
                                                            value={tempSettings.newsreelOpenaiModel || 'gpt-4o-mini'}
                                                            onChange={e => setTempSettings({ ...tempSettings, newsreelOpenaiModel: e.target.value })}
                                                            className="api-key-input"
                                                            style={{ flex: 1 }}
                                                        >
                                                            {newsreelOpenaiModels.map(model => (
                                                                <option key={model} value={model}>{model}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={tempSettings.newsreelOpenaiModel || 'gpt-4o-mini'}
                                                            onChange={e => setTempSettings({ ...tempSettings, newsreelOpenaiModel: e.target.value })}
                                                            placeholder="e.g. gpt-4o-mini"
                                                            className="api-key-input"
                                                            style={{ flex: 1 }}
                                                        />
                                                    )}
                                                    <button
                                                        className="icon-btn"
                                                        onClick={() => fetchNewsreelModels('openai')}
                                                        disabled={isLoadingNewsreelModels || !(tempSettings.newsreelOpenaiApiKey || tempSettings.openaiApiKey)}
                                                        title="Fetch available models"
                                                        style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <RefreshCw size={16} className={isLoadingNewsreelModels ? 'spin' : ''} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {tempSettings.newsreelAiProvider === 'claude' && (
                                        <>
                                            <div className="setting-group">
                                                <label>Claude API Key</label>
                                                <input
                                                    type="password"
                                                    value={tempSettings.newsreelClaudeApiKey || tempSettings.claudeApiKey || ''}
                                                    onChange={e => setTempSettings({ ...tempSettings, newsreelClaudeApiKey: e.target.value })}
                                                    placeholder="Use global key or enter new"
                                                    className="api-key-input"
                                                />
                                            </div>
                                            <div className="setting-group">
                                                <label>Claude Model</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {newsreelClaudeModels.length > 0 ? (
                                                        <select
                                                            value={tempSettings.newsreelClaudeModel || 'claude-3-haiku-20240307'}
                                                            onChange={e => setTempSettings({ ...tempSettings, newsreelClaudeModel: e.target.value })}
                                                            className="api-key-input"
                                                            style={{ flex: 1 }}
                                                        >
                                                            {newsreelClaudeModels.map(model => (
                                                                <option key={model} value={model}>{model}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={tempSettings.newsreelClaudeModel || 'claude-3-haiku-20240307'}
                                                            onChange={e => setTempSettings({ ...tempSettings, newsreelClaudeModel: e.target.value })}
                                                            placeholder="e.g. claude-3-haiku-20240307"
                                                            className="api-key-input"
                                                            style={{ flex: 1 }}
                                                        />
                                                    )}
                                                    <button
                                                        className="icon-btn"
                                                        onClick={() => fetchNewsreelModels('claude')}
                                                        disabled={isLoadingNewsreelModels}
                                                        title="Fetch available models"
                                                        style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <RefreshCw size={16} className={isLoadingNewsreelModels ? 'spin' : ''} />
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {tempSettings.newsreelAiProvider === 'ollama' && (
                                        <>
                                            <div className="setting-group">
                                                <label>Ollama Server URL</label>
                                                <input
                                                    type="text"
                                                    value={tempSettings.newsreelOllamaUrl || tempSettings.ollamaUrl || 'http://localhost:11434'}
                                                    onChange={e => setTempSettings({ ...tempSettings, newsreelOllamaUrl: e.target.value })}
                                                    placeholder="http://localhost:11434"
                                                    className="api-key-input"
                                                />
                                            </div>
                                            <div className="setting-group">
                                                <label>Ollama Model</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    {newsreelOllamaModels.length > 0 ? (
                                                        <select
                                                            value={tempSettings.newsreelOllamaModel || 'llama3'}
                                                            onChange={e => setTempSettings({ ...tempSettings, newsreelOllamaModel: e.target.value })}
                                                            className="api-key-input"
                                                            style={{ flex: 1 }}
                                                        >
                                                            {newsreelOllamaModels.map(model => (
                                                                <option key={model} value={model}>{model}</option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={tempSettings.newsreelOllamaModel || 'llama3'}
                                                            onChange={e => setTempSettings({ ...tempSettings, newsreelOllamaModel: e.target.value })}
                                                            placeholder="e.g. llama3.1:8b"
                                                            className="api-key-input"
                                                            style={{ flex: 1 }}
                                                        />
                                                    )}
                                                    <button
                                                        className="icon-btn"
                                                        onClick={() => fetchNewsreelModels('ollama')}
                                                        disabled={isLoadingNewsreelModels}
                                                        title="Fetch available models"
                                                        style={{ height: '38px', width: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <RefreshCw size={16} className={isLoadingNewsreelModels ? 'spin' : ''} />
                                                    </button>
                                                </div>
                                                <p className="setting-hint">Recommended: llama3.1:8b, mistral:7b for best results</p>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
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
                                            emailSmtpSecure: e.target.checked,
                                            // Auto-switch port: 465 for SSL, 587 for STARTTLS
                                            emailSmtpPort: e.target.checked ? 465 : 587
                                        })}
                                        style={{ marginRight: '8px' }}
                                    />
                                    Use SSL/TLS (Direct SSL)
                                </label>
                                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px', marginLeft: '24px' }}>
                                    {tempSettings.emailSmtpSecure
                                        ? '✓ Port 465 (Direct SSL)'
                                        : '✓ Port 587 (STARTTLS)'}
                                </div>
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
                            {onShowTutorial && (
                                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                                    <button
                                        className="btn-primary"
                                        onClick={() => {
                                            setShowSettings(false);
                                            onShowTutorial();
                                        }}
                                        style={{ padding: '10px 20px' }}
                                    >
                                        Show Tutorial
                                    </button>
                                </div>
                            )}
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
            <div className={`toolbar ${hideButtons ? 'toolbar-minimal' : ''}`}>
                <div className="toolbar-left">
                </div>
                {!hideButtons && (
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
                            onClick={openSettings}
                            data-tooltip="Settings"
                        >
                            <Settings size={18} />
                        </button>
                    </div>
                )}
            </div>
            {createPortal(modal, document.body)}
        </>
    );
}
