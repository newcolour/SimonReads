
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import CryptoJS from 'crypto-js';
import { AppSettings, Feed, Article } from '../types';

export interface SyncData {
    feeds: Feed[];
    articles: Article[];
    settings: AppSettings;
    chats: any;
    lastSyncedAt: number;
}

export interface SyncConfig {
    supabaseUrl: string;
    supabaseAnonKey: string;
    encryptionKey: string; // The user's password for E2EE
}

class SyncService {
    private supabase: SupabaseClient | null = null;
    private encryptionKey: string = '';

    constructor() {
        // Singleton initialization if needed, but we'll init with config
    }

    public isInitialized(): boolean {
        return !!this.supabase && !!this.encryptionKey;
    }

    public initialize(config: SyncConfig) {
        if (!config.supabaseUrl || !config.supabaseAnonKey) {
            console.error('[SyncService] Missing Supabase credentials');
            return;
        }

        try {
            this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
            this.encryptionKey = config.encryptionKey;
            console.log('[SyncService] Initialized');
        } catch (e) {
            console.error('[SyncService] Initialization failed:', e);
        }
    }

    public async login(_email: string): Promise<{ error?: string }> {
        if (!this.supabase) return { error: 'Sync service not initialized' };

        // We use Magic Link for simplicity, or Password if user prefers.
        // For this v1 implementation plan, let's assume we used the Supabase "Email/Password" auth.
        // But since we want to keep it simple for the user (just one "Sync Password" for both encryption and auth?)
        // Actually, it's safer to separate them. But for UX, we might use the same.
        // Let's implement standard signInWithPassword.
        // Wait, 'login' takes email and password.
        return { error: 'Login requires password override' };
    }

    // Actual login with password
    public async signIn(email: string, password: string): Promise<{ user?: User; error?: string }> {
        if (!this.supabase) return { error: 'Sync service not initialized' };

        // Update encryption key to matching password (simplification: auth password = e2ee key)
        // In a more advanced setup, the encryption key would be separate or derived.
        // But for "Make it optional" and "Ensure privacy", using the password as the key is a common pattern for simple E2EE.
        this.encryptionKey = password;

        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return { error: error.message };
        }

        return { user: data.user, error: undefined };
    }

    public async signUp(email: string, password: string): Promise<{ user?: User; error?: string }> {
        if (!this.supabase) return { error: 'Sync service not initialized' };

        this.encryptionKey = password;

        const { data, error } = await this.supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            return { error: error.message };
        }

        return { user: data.user || undefined, error: undefined };
    }

    public async logout() {
        if (this.supabase) {
            await this.supabase.auth.signOut();
        }
        this.encryptionKey = ''; // Clear key from memory
    }

    public async getUser(): Promise<User | null> {
        if (!this.supabase) return null;
        const { data } = await this.supabase.auth.getUser();
        return data.user;
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
        // Deep clone to avoid mutating original
        const cleanData = JSON.parse(JSON.stringify(data));

        // STRIP SENSITIVE KEYS
        const sensitiveKeys = [
            'geminiApiKey', 'openaiApiKey', 'claudeApiKey',
            'emailSmtpPassword', 'emailSmtpUser', // Maybe user too?
        ];

        // Sanitize settings
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
        if (!this.supabase || !this.encryptionKey) return { success: false, error: 'Not logged in' };

        try {
            const user = await this.getUser();
            if (!user) return { success: false, error: 'Not logged in' };

            const preparedData = this.prepareDataForSync(data);
            preparedData.lastSyncedAt = Date.now();

            const encryptedPayload = this.encrypt(preparedData);

            // Upsert into user_data table
            // We store everything in a single row with key 'main_backup' for V1 simplicity
            // or we could split it. 'main_backup' is easiest for full sync.
            const { error } = await this.supabase
                .from('user_data')
                .upsert({
                    user_id: user.id,
                    key: 'main_backup', // Fixed key for now
                    value: { data: encryptedPayload },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, key' });

            if (error) throw error;

            return { success: true };
        } catch (e: any) {
            console.error('[SyncService] Push failed:', e);
            return { success: false, error: e.message };
        }
    }

    public async pullData(): Promise<{ data?: SyncData; error?: string }> {
        if (!this.supabase || !this.encryptionKey) return { error: 'Not logged in' };

        try {
            const user = await this.getUser();
            if (!user) return { error: 'Not logged in' };

            const { data, error } = await this.supabase
                .from('user_data')
                .select('value')
                .eq('user_id', user.id)
                .eq('key', 'main_backup')
                .single();

            if (error) {
                // If row not found, it's not an error, just empty
                if (error.code === 'PGRST116') return { data: undefined };
                throw error;
            }

            if (!data || !data.value || !data.value.data) return { data: undefined };

            const decrypted = this.decrypt(data.value.data);
            return { data: decrypted };

        } catch (e: any) {
            console.error('[SyncService] Pull failed:', e);
            return { error: e.message };
        }
    }

    // Merge Logic
    public merge(local: SyncData, remote: SyncData): SyncData {
        console.log('[SyncService] Merging data...');

        // 1. Feeds: Union based on ID
        const feedMap = new Map<string, Feed>();
        local.feeds.forEach(f => feedMap.set(f.id, f));
        remote.feeds.forEach(f => {
            if (!feedMap.has(f.id)) {
                feedMap.set(f.id, f);
            } else {
                // Determine which feed object to keep? Maybe the one with latest lastFetched?
                // Just keep local for now, unless remote has something better.
            }
        });
        const mergedFeeds = Array.from(feedMap.values());

        // 2. Articles: Read Status Wins + Union
        const articleMap = new Map<string, Article>();
        local.articles.forEach(a => articleMap.set(a.id, a));

        remote.articles.forEach(remoteArticle => {
            const localArticle = articleMap.get(remoteArticle.id);
            if (localArticle) {
                // Merge logic: Read wins
                const isRead = localArticle.isRead || remoteArticle.isRead;
                const isSaved = localArticle.isSaved || remoteArticle.isSaved; // Saved wins too

                articleMap.set(remoteArticle.id, {
                    ...localArticle, // Keep local content potentially
                    isRead,
                    isSaved
                });
            } else {
                // New article from remote
                articleMap.set(remoteArticle.id, remoteArticle);
            }
        });
        const mergedArticles = Array.from(articleMap.values());

        // 3. Settings: Remote wins (Last Write Wins usually means Remote is newer if we just pulled)
        // But we must PRESERVE local API keys if remote doesn't have them (which it shouldn't)
        const mergedSettings = { ...local.settings, ...remote.settings };

        // Restore local secrets if they are missing in merged (remote would have them undefined)
        if (local.settings.geminiApiKey) mergedSettings.geminiApiKey = local.settings.geminiApiKey;
        if (local.settings.openaiApiKey) mergedSettings.openaiApiKey = local.settings.openaiApiKey;
        if (local.settings.claudeApiKey) mergedSettings.claudeApiKey = local.settings.claudeApiKey;
        if (local.settings.emailSmtpPassword) mergedSettings.emailSmtpPassword = local.settings.emailSmtpPassword;

        // 4. Chats: Last Write Wins per Article
        // Union of keys
        const mergedChats = { ...local.chats };
        if (remote.chats) {
            Object.keys(remote.chats).forEach(articleId => {
                // Simple overwrite for now. Improvements: Check timestamps of last message?
                // Since we don't track "updatedAt" for chat loosely, we assume the remote (if newer sync) is better?
                // Actually, if we just pulled, remote might be old.
                // Let's rely on the fact that we push after local changes.
                // If we pull, we assume we want to sync UP to remote.
                // But if local has changed since last sync... 
                // For V1: Remote Overwrites Local if collision.
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
