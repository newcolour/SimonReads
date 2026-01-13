
import { useState, useEffect } from 'react';
import { RefreshCw, Upload, Download, Check, AlertCircle, Eye, EyeOff, LogOut, Database, HardDrive } from 'lucide-react';
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

type ProviderType = 'supabase' | 'webdav';

export default function SyncSettings({ settings, feeds, articles, onDataRestored, onSyncStatusChange }: SyncSettingsProps) {
    const [provider, setProvider] = useState<ProviderType>('supabase');

    // Supabase State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); // Also used as encryption key for Supabase
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState('');

    // WebDAV State
    const [webdavUrl, setWebdavUrl] = useState('');
    const [webdavUser, setWebdavUser] = useState('');
    const [webdavPassword, setWebdavPassword] = useState(''); // Auth password
    const [encryptionKey, setEncryptionKey] = useState(''); // Separate encryption key for WebDAV

    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Initial check
    useEffect(() => {
        const loadSettings = async () => {
            // Load Provider preference
            const savedProvider = localStorage.getItem('sync_provider') as ProviderType;
            if (savedProvider) setProvider(savedProvider);

            // Supabase Defaults
            const savedSbUrl = localStorage.getItem('sync_supabase_url');
            const savedSbKey = localStorage.getItem('sync_supabase_key');
            if (savedSbUrl) setSupabaseUrl(savedSbUrl);
            if (savedSbKey) setSupabaseAnonKey(savedSbKey);

            // WebDAV Defaults
            const savedWdUrl = localStorage.getItem('sync_webdav_url');
            const savedWdUser = localStorage.getItem('sync_webdav_user');
            if (savedWdUrl) setWebdavUrl(savedWdUrl);
            if (savedWdUser) setWebdavUser(savedWdUser);

            // Check if service is already initialized
            if (syncService.isInitialized()) {
                const user = await syncService.getUser();
                if (user) {
                    setIsLoggedIn(true);
                    // If service is initialized, align local state provider
                    const currentName = syncService.getProviderName();
                    if (currentName) setProvider(currentName as ProviderType);
                    onSyncStatusChange?.(true);
                } else {
                    onSyncStatusChange?.(false);
                }
            } else {
                onSyncStatusChange?.(false);
            }
        };
        loadSettings();
    }, []);

    const handleLogin = async () => {
        setStatusMsg(null);
        let config: any = { provider };
        let credentials: any = {};

        if (provider === 'supabase') {
            if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
                setStatusMsg({ type: 'error', text: 'Please fill in all fields' });
                return;
            }
            config = {
                ...config,
                encryptionKey: password,
                supabase: { url: supabaseUrl, key: supabaseAnonKey }
            };
            credentials = { email, password };
        } else {
            if (!webdavUrl || !encryptionKey) {
                setStatusMsg({ type: 'error', text: 'URL and Encryption Password are required' });
                return;
            }
            config = {
                ...config,
                encryptionKey: encryptionKey,
                webdav: { url: webdavUrl, username: webdavUser, password: webdavPassword }
            };
            credentials = { url: webdavUrl, username: webdavUser, password: webdavPassword };
        }

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
                localStorage.setItem('sync_provider', provider);
                if (provider === 'supabase') {
                    localStorage.setItem('sync_supabase_url', supabaseUrl);
                    localStorage.setItem('sync_supabase_key', supabaseAnonKey);
                } else {
                    localStorage.setItem('sync_webdav_url', webdavUrl);
                    localStorage.setItem('sync_webdav_user', webdavUser);
                }
            }
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message });
        }
    };

    const handleRegister = async () => {
        if (provider !== 'supabase') return;
        if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
            setStatusMsg({ type: 'error', text: 'Please fill in all fields' });
            return;
        }

        try {
            syncService.initialize({
                provider: 'supabase',
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
                Sync using Supabase or your own NAS (WebDAV). Data is client-side encrypted.
            </p>

            {statusMsg && (
                <div className={`status-msg ${statusMsg.type}`}>
                    {statusMsg.type === 'error' ? <AlertCircle size={14} /> : <Check size={14} />}
                    {statusMsg.text}
                </div>
            )}

            {!isLoggedIn ? (
                <div className="login-form">
                    <div className="provider-selector">
                        <button
                            className={`provider-btn ${provider === 'supabase' ? 'active' : ''}`}
                            onClick={() => setProvider('supabase')}
                        >
                            <Database size={16} /> Supabase
                        </button>
                        <button
                            className={`provider-btn ${provider === 'webdav' ? 'active' : ''}`}
                            onClick={() => setProvider('webdav')}
                        >
                            <HardDrive size={16} /> NAS / WebDAV
                        </button>
                    </div>

                    {provider === 'supabase' && (
                        <>
                            <div className="form-group">
                                <label>Supabase URL</label>
                                <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://xyz.supabase.co" />
                            </div>
                            <div className="form-group">
                                <label>Supabase Key</label>
                                <input type="password" value={supabaseAnonKey} onChange={e => setSupabaseAnonKey(e.target.value)} placeholder="Key" />
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
                        </>
                    )}

                    {provider === 'webdav' && (
                        <>
                            <div className="form-group">
                                <label>WebDAV URL (e.g. NAS)</label>
                                <input type="text" value={webdavUrl} onChange={e => setWebdavUrl(e.target.value)} placeholder="https://nas.local:5006/home" />
                            </div>
                            <div className="form-group">
                                <label>Username (Optional)</label>
                                <input type="text" value={webdavUser} onChange={e => setWebdavUser(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Password (Optional)</label>
                                <input type="password" value={webdavPassword} onChange={e => setWebdavPassword(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Encryption Key (Required for Data Privacy)</label>
                                <div className="password-input">
                                    <input type={showPassword ? "text" : "password"} value={encryptionKey} onChange={e => setEncryptionKey(e.target.value)} placeholder="Secret Passphrase" />
                                    <button className="toggle-pass" onClick={() => setShowPassword(!showPassword)}>
                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="auth-actions">
                                <button className="btn-primary" onClick={handleLogin}>Connect</button>
                            </div>
                        </>
                    )}
                </div>
            ) : (
                <div className="sync-dashboard">
                    <div className="sync-status">
                        <span className="badge success">Connected ({provider})</span>
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
