
import { useState, useEffect } from 'react';
import { RefreshCw, Upload, Download, Check, AlertCircle, Eye, EyeOff, LogOut, Github } from 'lucide-react';
import { syncService } from '../services/syncService';
import { AppSettings, Feed, Article } from '../types';
import { storage } from '../storage';
import './SyncSettings.css';

interface SyncSettingsProps {
    settings: AppSettings;
    feeds: Feed[];
    articles: Article[];
    onDataRestored: () => void;
    onSyncStatusChange?: (isConnected: boolean) => void;
}

export default function SyncSettings({ settings, feeds, articles, onDataRestored, onSyncStatusChange }: SyncSettingsProps) {
    // Supabase State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); // Also used as encryption key for Supabase
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState('');

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [encryptionKey, setEncryptionKey] = useState(''); // For OAuth users who don't have a password

    // Initial check
    useEffect(() => {
        const loadSettings = async () => {
            // Supabase Defaults
            const savedSbUrl = localStorage.getItem('sync_supabase_url');
            const savedSbKey = localStorage.getItem('sync_supabase_key');
            if (savedSbUrl) setSupabaseUrl(savedSbUrl);
            if (savedSbKey) setSupabaseAnonKey(savedSbKey);

            // Check if service is already initialized
            if (syncService.isInitialized()) {
                const user = await syncService.getUser();
                if (user) {
                    setIsLoggedIn(true);
                    onSyncStatusChange?.(true);
                } else {
                    onSyncStatusChange?.(false);
                }
            } else {
                onSyncStatusChange?.(false);
            }
        };
        loadSettings();

        // Check for OAuth redirect
        const handleOAuthRedirect = async () => {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');

            if (accessToken) {
                // Clear the hash from URL
                window.history.replaceState(null, '', window.location.pathname + window.location.search);

                // User came back from OAuth, check if we have saved config
                const savedUrl = localStorage.getItem('sync_supabase_url');
                const savedKey = localStorage.getItem('sync_supabase_key');
                const savedEncKey = localStorage.getItem('sync_encryption_key');

                if (savedUrl && savedKey && savedEncKey) {
                    try {
                        syncService.initialize({
                            provider: 'supabase' as const,
                            encryptionKey: savedEncKey,
                            supabase: { url: savedUrl, key: savedKey }
                        });

                        const user = await syncService.getUser();
                        if (user) {
                            setIsLoggedIn(true);
                            setStatusMsg({ type: 'success', text: 'Connected with GitHub!' });
                            onSyncStatusChange?.(true);
                        }
                    } catch (e: any) {
                        setStatusMsg({ type: 'error', text: 'OAuth login failed: ' + e.message });
                    }
                }
            }
        };

        handleOAuthRedirect();
    }, []);

    const handleGitHubLogin = async () => {
        setStatusMsg(null);

        if (!supabaseUrl || !supabaseAnonKey) {
            setStatusMsg({ type: 'error', text: 'Please enter Supabase URL and Key first' });
            return;
        }

        if (!encryptionKey) {
            setStatusMsg({ type: 'error', text: 'Please set an encryption key for data privacy' });
            return;
        }

        try {
            // Save config for when we return from OAuth
            localStorage.setItem('sync_supabase_url', supabaseUrl);
            localStorage.setItem('sync_supabase_key', supabaseAnonKey);
            localStorage.setItem('sync_encryption_key', encryptionKey);

            syncService.initialize({
                provider: 'supabase' as const,
                encryptionKey: encryptionKey,
                supabase: { url: supabaseUrl, key: supabaseAnonKey }
            });

            const { error } = await syncService.loginWithGitHub();
            if (error) {
                setStatusMsg({ type: 'error', text: 'GitHub login failed: ' + error });
            }
            // If successful, user will be redirected to GitHub
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message });
        }
    };

    const handleLogin = async () => {
        setStatusMsg(null);

        if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
            setStatusMsg({ type: 'error', text: 'Please fill in all fields' });
            return;
        }

        const config = {
            provider: 'supabase' as const,
            encryptionKey: password,
            supabase: { url: supabaseUrl, key: supabaseAnonKey }
        };
        const credentials = { email, password };

        try {
            syncService.initialize(config);
            const { error } = await syncService.login(credentials);

            if (error) {
                setStatusMsg({ type: 'error', text: 'Connection failed: ' + error });
            } else {
                setIsLoggedIn(true);
                setStatusMsg({ type: 'success', text: 'Connected successfully' });
                onSyncStatusChange?.(true);

                // Save settings
                localStorage.setItem('sync_supabase_url', supabaseUrl);
                localStorage.setItem('sync_supabase_key', supabaseAnonKey);
            }
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message });
        }
    };

    const handleRegister = async () => {
        if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
            setStatusMsg({ type: 'error', text: 'Please fill in all fields' });
            return;
        }

        try {
            syncService.initialize({
                provider: 'supabase' as const,
                encryptionKey: password,
                supabase: { url: supabaseUrl, key: supabaseAnonKey }
            });

            const { error } = await syncService.signUp({ email, password });
            if (error) {
                setStatusMsg({ type: 'error', text: 'Registration failed: ' + error });
            } else {
                setStatusMsg({ type: 'success', text: 'Registered! Check email to confirm.' });
            }
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message });
        }
    };

    const handleLogout = async () => {
        await syncService.logout();
        setIsLoggedIn(false);
        setIsLoggedIn(false);
        setStatusMsg({ type: 'success', text: 'Disconnected' });
        onSyncStatusChange?.(false);
    };

    const handlePush = async () => {
        setIsSyncing(true);
        setStatusMsg(null);
        try {
            const storedChats = localStorage.getItem('chat-history');
            const chats = storedChats ? JSON.parse(storedChats) : {};

            const result = await syncService.pushData({
                feeds,
                articles,
                settings,
                chats,
                lastSyncedAt: Date.now()
            });

            if (result.success) {
                setLastSynced(new Date().toLocaleTimeString());
                setStatusMsg({ type: 'success', text: 'Synced to cloud successfully' });
            } else {
                setStatusMsg({ type: 'error', text: 'Push failed: ' + result.error });
            }
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message });
        } finally {
            setIsSyncing(false);
        }
    };

    const handlePull = async () => {
        setIsSyncing(true);
        setStatusMsg(null);
        try {
            const { data, error } = await syncService.pullData();
            if (error) {
                setStatusMsg({ type: 'error', text: 'Pull failed: ' + error });
                return;
            }
            if (!data) {
                setStatusMsg({ type: 'success', text: 'Remote storage is empty.' });
                return;
            }

            const storedChats = localStorage.getItem('chat-history');
            const localChats = storedChats ? JSON.parse(storedChats) : {};

            const localData = {
                feeds, articles, settings, chats: localChats, lastSyncedAt: 0
            };

            const merged = syncService.merge(localData, data);

            storage.saveFeeds(merged.feeds);
            storage.saveArticles(merged.articles);
            storage.saveSettings(merged.settings);
            localStorage.setItem('chat-history', JSON.stringify(merged.chats));

            onDataRestored();
            setLastSynced(new Date().toLocaleTimeString());
            setStatusMsg({ type: 'success', text: 'Synced from cloud successfully' });

        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message });
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="sync-settings">
            <h3><RefreshCw size={18} /> Cross-Platform Sync</h3>
            <p className="sync-description">
                Sync using Supabase. Data is client-side encrypted.
            </p>

            {statusMsg && (
                <div className={`status-msg ${statusMsg.type}`}>
                    {statusMsg.type === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
                    {statusMsg.text}
                </div>
            )}

            {!isLoggedIn ? (
                <div className="login-form">
                    <div className="form-group">
                        <label>Supabase URL</label>
                        <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://xyz.supabase.co" />
                    </div>
                    <div className="form-group">
                        <label>Supabase Key</label>
                        <input type="password" value={supabaseAnonKey} onChange={e => setSupabaseAnonKey(e.target.value)} placeholder="Key" />
                    </div>

                    <div className="auth-divider">
                        <span>Email/Password Login</span>
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Password (Auth + Encryption)</label>
                        <div className="password-input">
                            <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} />
                            <button className="toggle-pass" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>
                    <div className="auth-actions">
                        <button className="btn-primary" onClick={handleLogin}>Login</button>
                        <button className="btn-secondary" onClick={handleRegister}>Create Account</button>
                    </div>

                    <div className="auth-divider">
                        <span>OR</span>
                    </div>

                    <div className="form-group">
                        <label>Encryption Key (for GitHub OAuth)</label>
                        <div className="password-input">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={encryptionKey}
                                onChange={e => setEncryptionKey(e.target.value)}
                                placeholder="Your secret encryption key"
                            />
                            <button className="toggle-pass" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        <small style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                            Required for data encryption when using OAuth
                        </small>
                    </div>
                    <button className="btn-github" onClick={handleGitHubLogin}>
                        <Github size={16} /> Continue with GitHub
                    </button>
                </div>
            ) : (
                <div className="sync-dashboard">
                    <div className="sync-status">
                        <span className="badge success">Connected (Supabase)</span>
                        {lastSynced && <span className="last-synced">Last: {lastSynced}</span>}
                    </div>

                    <div className="sync-actions">
                        <button className="btn-primary" onClick={handlePush} disabled={isSyncing}>
                            {isSyncing ? <RefreshCw className="spin" size={16} /> : <Upload size={16} />} Push
                        </button>
                        <button className="btn-secondary" onClick={handlePull} disabled={isSyncing}>
                            {isSyncing ? <RefreshCw className="spin" size={16} /> : <Download size={16} />} Pull
                        </button>
                    </div>

                    <button className="btn-danger logout-btn" onClick={handleLogout}>
                        <LogOut size={14} /> Disconnect
                    </button>
                </div>
            )}
        </div>
    );
}
