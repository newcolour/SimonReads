
import CryptoJS from 'crypto-js';
import { AppSettings, Feed, Article } from '../types';
import { SyncProvider } from './types';
import { SupabaseProvider } from './providers/supabaseProvider';
import { WebDavProvider } from './providers/webdavProvider';

export interface SyncData {
    feeds: Feed[];
    articles: Article[];
    settings: AppSettings;
    chats: any;
    lastSyncedAt: number;
}

export interface SyncConfig {
    provider: 'supabase' | 'webdav';
    encryptionKey: string;
    supabase?: { url: string; key: string };
    webdav?: { url: string; username?: string; password?: string };
}

class SyncService {
    private provider: SyncProvider | null = null;
    private encryptionKey: string = '';

    constructor() {
        // Singleton initialization
    }

    public isInitialized(): boolean {
        return !!this.provider && !!this.encryptionKey;
    }

    public getProviderName(): string | null {
        return this.provider ? this.provider.name : null;
    }

    public initialize(config: SyncConfig) {
        this.encryptionKey = config.encryptionKey;

        if (config.provider === 'supabase' && config.supabase) {
            this.provider = new SupabaseProvider();
            // Supabase provider might need init call if we were strictly following interface, 
            // but for now we pass credentials at login OR strict init.
            // Our SupabaseProvider interface implementation handles logic inside login/signup mostly,
            // but for re-init (app restart) we need to re-create the client.
            // Let's call a silent login/init if possible or just set it up.
            // The SupabaseProvider 'login' method actually creates the client.
            // We can add an 'init' method to provider or just lazy load.
            // For now, let's assume we re-login or just set up.
            // Modification: SupabaseProvider needs to know keys to be useful even without user session (for anon?)
            // Actually, we need to pass the URL/Key early.
            // Let's adapt SupabaseProvider to store these or pass them.
            // Since we persist the "active" state in UI, we will call login again.
        } else if (config.provider === 'webdav' && config.webdav) {
            this.provider = new WebDavProvider();
        }
    }

    // Wrapper to pass config to provider login
    public async login(credentials: any): Promise<{ user?: any; error?: string }> {
        if (!this.provider) return { error: 'Provider not set' };

        // We update encryption key if password is used.
        // For Supabase: Password = credentials.password (if auth used)
        // For WebDAV: Password = credentials.password
        // BUT we have a separate encryptionKey in config... 
        // SyncSettings logic currently uses password as encryption key.
        if (credentials.password) {
            this.encryptionKey = credentials.password;
        }

        return this.provider.login(credentials);
    }

    public async signUp(credentials: any): Promise<{ user?: any; error?: string }> {
        if (!this.provider) return { error: 'Provider not set' };
        if (this.provider.signUp) {
            // For Supabase
            if (credentials.password) this.encryptionKey = credentials.password;
            return this.provider.signUp(credentials);
        }
        return { error: 'Sign up not supported by this provider' };
    }

    public async logout() {
        if (this.provider) {
            await this.provider.logout();
            this.provider = null;
        }
        this.encryptionKey = '';
    }

    public async getUser(): Promise<any | null> {
        if (!this.provider) return null;
        return this.provider.getUser();
    }

    private encrypt(data: any): string {
        if (!this.encryptionKey) throw new Error('No encryption key set');
        return CryptoJS.AES.encrypt(JSON.stringify(data), this.encryptionKey).toString();
    }

    private decrypt(ciphertext: string): any {
        if (!this.encryptionKey) throw new Error('No encryption key set');
        const bytes = CryptoJS.AES.decrypt(ciphertext, this.encryptionKey);
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (!originalText) throw new Error('Decryption failed (Wrong password?)');
        return JSON.parse(originalText);
    }

    private prepareDataForSync(data: SyncData): SyncData {
        const cleanData = JSON.parse(JSON.stringify(data));
        const sensitiveKeys = [
            'geminiApiKey', 'openaiApiKey', 'claudeApiKey',
            'emailSmtpPassword', 'emailSmtpUser',
        ];

        if (cleanData.settings) {
            sensitiveKeys.forEach(key => {
                if (key in cleanData.settings) {
                    delete cleanData.settings[key];
                }
            });
        }
        return cleanData;
    }

    public async pushData(data: SyncData): Promise<{ success: boolean; error?: string }> {
        if (!this.provider || !this.encryptionKey) return { success: false, error: 'Not initialized' };

        try {
            if (!this.provider.isAuthenticated()) return { success: false, error: 'Not logged in' };

            const preparedData = this.prepareDataForSync(data);
            preparedData.lastSyncedAt = Date.now();

            const encryptedPayload = this.encrypt(preparedData);
            return this.provider.push(encryptedPayload);

        } catch (e: any) {
            console.error('[SyncService] Push failed:', e);
            return { success: false, error: e.message };
        }
    }

    public async pullData(): Promise<{ data?: SyncData; error?: string }> {
        if (!this.provider || !this.encryptionKey) return { error: 'Not initialized' };

        try {
            if (!this.provider.isAuthenticated()) return { error: 'Not logged in' };

            const { data, error } = await this.provider.pull();
            if (error) return { error };
            if (!data) return { data: undefined };

            const decrypted = this.decrypt(data);
            return { data: decrypted };

        } catch (e: any) {
            console.error('[SyncService] Pull failed:', e);
            return { error: e.message };
        }
    }

    public merge(local: SyncData, remote: SyncData): SyncData {
        console.log('[SyncService] Merging data...');

        // 1. Feeds: Union
        const feedMap = new Map<string, Feed>();
        local.feeds.forEach(f => feedMap.set(f.id, f));
        remote.feeds.forEach(f => {
            if (!feedMap.has(f.id)) {
                feedMap.set(f.id, f);
            }
        });
        const mergedFeeds = Array.from(feedMap.values());

        // 2. Articles: Read Status Wins + Union
        const articleMap = new Map<string, Article>();
        local.articles.forEach(a => articleMap.set(a.id, a));

        remote.articles.forEach(remoteArticle => {
            const localArticle = articleMap.get(remoteArticle.id);
            if (localArticle) {
                const isRead = localArticle.isRead || remoteArticle.isRead;
                const isSaved = localArticle.isSaved || remoteArticle.isSaved;
                articleMap.set(remoteArticle.id, {
                    ...localArticle,
                    isRead,
                    isSaved
                });
            } else {
                articleMap.set(remoteArticle.id, remoteArticle);
            }
        });
        const mergedArticles = Array.from(articleMap.values());

        // 3. Settings: Remote wins but preserve local secrets
        const mergedSettings = { ...local.settings, ...remote.settings };
        if (local.settings.geminiApiKey) mergedSettings.geminiApiKey = local.settings.geminiApiKey;
        if (local.settings.openaiApiKey) mergedSettings.openaiApiKey = local.settings.openaiApiKey;
        if (local.settings.claudeApiKey) mergedSettings.claudeApiKey = local.settings.claudeApiKey;
        if (local.settings.emailSmtpPassword) mergedSettings.emailSmtpPassword = local.settings.emailSmtpPassword;

        // 4. Chats: Last Write Wins (Remote overwrites local collision)
        const mergedChats = { ...local.chats };
        if (remote.chats) {
            Object.keys(remote.chats).forEach(articleId => {
                mergedChats[articleId] = remote.chats[articleId];
            });
        }

        return {
            feeds: mergedFeeds,
            articles: mergedArticles,
            settings: mergedSettings,
            chats: mergedChats,
            lastSyncedAt: Date.now()
        };
    }
}

export const syncService = new SyncService();
