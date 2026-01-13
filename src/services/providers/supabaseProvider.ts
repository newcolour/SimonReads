
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SyncProvider } from '../types';

export class SupabaseProvider implements SyncProvider {
    name = 'supabase';
    private supabase: SupabaseClient | null = null;

    isAuthenticated(): boolean {
        return !!this.supabase && !!this.supabase.auth.getUser();
        // Note: auth.getUser() is async, but we can check if client exists.
        // Better check might be needed, but for now checking client existence + session might be enough?
        // Actually, let's rely on the service to track state, or check session synchronously if possible.
        // Supabase client maintains session in local storage.
    }

    async login(credentials: { url: string; key: string; email?: string; password?: string }): Promise<{ user?: any; error?: string }> {
        if (!credentials.url || !credentials.key) {
            return { error: 'Missing URL or Key' };
        }

        try {
            this.supabase = createClient(credentials.url, credentials.key);

            if (credentials.email && credentials.password) {
                const { data, error } = await this.supabase.auth.signInWithPassword({
                    email: credentials.email,
                    password: credentials.password
                });
                if (error) return { error: error.message };
                return { user: data.user };
            }
            // Just init if no auth provided (unusual for login, but maybe for check)
            return { user: null };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    async signUp(credentials: { url: string; key: string; email: string; password?: string }): Promise<{ user?: any; error?: string }> {
        if (!credentials.url || !credentials.key || !credentials.email || !credentials.password) {
            return { error: 'Missing credentials' };
        }
        try {
            this.supabase = createClient(credentials.url, credentials.key);
            const { data, error } = await this.supabase.auth.signUp({
                email: credentials.email,
                password: credentials.password,
            });
            if (error) return { error: error.message };
            return { user: data.user || undefined };
        } catch (e: any) {
            return { error: e.message };
        }
    }

    async logout(): Promise<void> {
        if (this.supabase) {
            await this.supabase.auth.signOut();
            this.supabase = null;
        }
    }

    async getUser(): Promise<any | null> {
        if (!this.supabase) return null;
        const { data } = await this.supabase.auth.getUser();
        return data.user;
    }

    async push(encryptedData: string): Promise<{ success: boolean; error?: string }> {
        if (!this.supabase) return { success: false, error: 'Not initialized' };
        const user = await this.getUser();
        if (!user) return { success: false, error: 'Not logged in' };

        const { error } = await this.supabase
            .from('user_data')
            .upsert({
                user_id: user.id,
                key: 'main_backup',
                value: { data: encryptedData },
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, key' });

        if (error) return { success: false, error: error.message };
        return { success: true };
    }

    async pull(): Promise<{ data?: string; error?: string }> {
        if (!this.supabase) return { error: 'Not initialized' };
        const user = await this.getUser();
        if (!user) return { error: 'Not logged in' };

        const { data, error } = await this.supabase
            .from('user_data')
            .select('value')
            .eq('user_id', user.id)
            .eq('key', 'main_backup')
            .single();

        if (error) {
            if (error.code === 'PGRST116') return { data: undefined };
            return { error: error.message };
        }

        if (!data || !data.value || !data.value.data) return { data: undefined };
        return { data: data.value.data };
    }
}
