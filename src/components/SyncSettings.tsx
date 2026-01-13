
import { useState, useEffect } from 'react';
import { RefreshCw, Upload, Download, Check, AlertCircle, Eye, EyeOff, LogOut } from 'lucide-react';
import { syncService } from '../services/syncService';
import { AppSettings, Feed, Article } from '../types';
import { storage } from '../storage';
import './SyncSettings.css';

interface SyncSettingsProps {
    settings: AppSettings;
    // onSettingsChange: (settings: AppSettings) => void;
    feeds: Feed[];
    articles: Article[];
    onDataRestored: () => void;
}

export default function SyncSettings({ settings, feeds, articles, onDataRestored }: SyncSettingsProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState<string | null>(null);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Initial check
    useEffect(() => {
        const checkLogin = async () => {
            if (syncService.isInitialized()) {
                const user = await syncService.getUser();
                if (user) {
                    setIsLoggedIn(true);
                    // Load last synced time from local storage or service?
                    // For now, just show "Ready"
                }
            }
        };
        // Initialize if possible from saved settings (though we don't save password, so auto-login is tricky without password)
        // Wait, we explicitly said we DON'T sync passwords.
        // And we don't save the "Sync Password" in local storage for security? 
        // Or do we? If we don't save it, the user has to login every time they open the app? That's annoying.
        // Most apps save the token (Supabase handles this) AND the encryption key (we must save this locally).
        // Let's save the encryption key in localStorage for convenience, but warn user.
        // Actually, Supabase `createClient` persists the session to localStorage automatically.
        // But `encryptionKey` needs to be persisted manually if we want auto-decryption.

        // For V1, let's load credentials from local storage if valid.
        const savedUrl = localStorage.getItem('sync_supabase_url');
        const savedKey = localStorage.getItem('sync_supabase_key');
        const savedEncKey = localStorage.getItem('sync_enc_key'); // Encryption Key

        if (savedUrl && savedKey) {
            setSupabaseUrl(savedUrl);
            setSupabaseAnonKey(savedKey);

            if (savedEncKey) {
                // Initialize service
                syncService.initialize({
                    supabaseUrl: savedUrl,
                    supabaseAnonKey: savedKey,
                    encryptionKey: savedEncKey
                });

                checkLogin();
            }
        }
    }, []);

    const handleLogin = async () => {
        if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
            setStatusMsg({ type: 'error', text: 'Please fill in all fields' });
            return;
        }

        try {
            // First initialize
            syncService.initialize({
                supabaseUrl,
                supabaseAnonKey,
                encryptionKey: password // Using auth password as encryption key for simplicity in V1
            });

            const { error } = await syncService.signIn(email, password);
            if (error) {
                // Try Sign Up if login fails?
                // For better UX, maybe separate buttons.
                // Or "Login / Register" logic.
                // Let's assume Login first. 
                setStatusMsg({ type: 'error', text: 'Login failed: ' + error });
            } else {
                setIsLoggedIn(true);
                setStatusMsg({ type: 'success', text: 'Logged in successfully' });
                // Save connection config
                localStorage.setItem('sync_supabase_url', supabaseUrl);
                localStorage.setItem('sync_supabase_key', supabaseAnonKey);
                localStorage.setItem('sync_enc_key', password); // Save encryption key locally
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
                supabaseUrl,
                supabaseAnonKey,
                encryptionKey: password
            });

            const { error } = await syncService.signUp(email, password);
            if (error) {
                setStatusMsg({ type: 'error', text: 'Registration failed: ' + error });
            } else {
                setStatusMsg({ type: 'success', text: 'Registered! Please check your email to confirm.' });
            }
        } catch (e: any) {
            setStatusMsg({ type: 'error', text: e.message });
        }
    };

    const handleLogout = async () => {
        await syncService.logout();
        setIsLoggedIn(false);
        // Clear local credentials
        localStorage.removeItem('sync_enc_key');
        // Keep URL/Key for convenience? Yes.
        setStatusMsg({ type: 'success', text: 'Logged out' });
    };

    const handlePush = async () => {
        setIsSyncing(true);
        setStatusMsg(null);
        try {
            // Get Chats from localStorage
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
                setStatusMsg({ type: 'success', text: 'Cloud storage is empty.' });
                return;
            }

            // Merge
            // Get Chats from localStorage
            const storedChats = localStorage.getItem('chat-history');
            const localChats = storedChats ? JSON.parse(storedChats) : {};

            const localData = {
                feeds,
                articles,
                settings,
                chats: localChats,
                lastSyncedAt: 0
            };

            const merged = syncService.merge(localData, data);

            // SAVE MERGED DATA
            storage.saveFeeds(merged.feeds);
            storage.saveArticles(merged.articles);
            storage.saveSettings(merged.settings);

            // Save chats
            localStorage.setItem('chat-history', JSON.stringify(merged.chats));

            // Inform Parent to reload state
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
            <h3><RefreshCw size={18} /> Cross-Platform Sync (Beta)</h3>
            <p className="sync-description">
                Sync your feeds, articles, and chat history across devices using your own Supabase backend.
                Data is encrypted before sending.
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
                        <label>Supabase Project URL</label>
                        <input
                            type="text"
                            placeholder="https://xyz.supabase.co"
                            value={supabaseUrl}
                            onChange={(e) => setSupabaseUrl(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Supabase Anon Key</label>
                        <input
                            type="password"
                            placeholder="eyJ..."
                            value={supabaseAnonKey}
                            onChange={(e) => setSupabaseAnonKey(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Password (also used for encryption)</label>
                        <div className="password-input">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="******"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <button className="toggle-pass" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                    </div>

                    <div className="auth-actions">
                        <button className="btn-primary" onClick={handleLogin}>Login & Enable Sync</button>
                        <button className="btn-secondary" onClick={handleRegister}>Create Account</button>
                    </div>
                    <p className="hint">
                        Note: You must have created valid users in your Supabase Auth dashboard, or use "Create Account" if enabled.
                        API Keys for AI (Gemini, etc.) are NOT synced for security.
                    </p>
                </div>
            ) : (
                <div className="sync-dashboard">
                    <div className="sync-status">
                        <span className="badge success">Connected</span>
                        {lastSynced && <span className="last-synced">Last synced: {lastSynced}</span>}
                    </div>

                    <div className="sync-actions">
                        <button className="btn-primary" onClick={handlePush} disabled={isSyncing}>
                            {isSyncing ? <RefreshCw className="spin" size={16} /> : <Upload size={16} />}
                            Push to Cloud
                        </button>
                        <button className="btn-secondary" onClick={handlePull} disabled={isSyncing}>
                            {isSyncing ? <RefreshCw className="spin" size={16} /> : <Download size={16} />}
                            Pull & Merge
                        </button>
                    </div>

                    <button className="btn-danger logout-btn" onClick={handleLogout}>
                        <LogOut size={14} /> Logout
                    </button>
                </div>
            )}
        </div>
    );
}
