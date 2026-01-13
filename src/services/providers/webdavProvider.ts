
import { createClient, WebDAVClient } from 'webdav';
import { SyncProvider } from '../types';

export class WebDavProvider implements SyncProvider {
    name = 'webdav';
    private client: WebDAVClient | null = null;
    private config: { url: string; username?: string; password?: string } | null = null;
    private filename = 'simon-reads-backup.json';

    isAuthenticated(): boolean {
        return !!this.client;
    }

    async login(credentials: { url: string; username?: string; password?: string }): Promise<{ user?: any; error?: string }> {
        if (!credentials.url) return { error: 'Missing URL' };

        try {
            this.config = credentials;
            this.client = createClient(credentials.url, {
                username: credentials.username,
                password: credentials.password
            });

            // Verify connection by listing root
            await this.client.getDirectoryContents('/');

            return { user: { username: credentials.username || 'WebDAV User' } };
        } catch (e: any) {
            this.client = null;
            return { error: 'Connection failed: ' + e.message };
        }
    }

    async logout(): Promise<void> {
        this.client = null;
        this.config = null;
    }

    async getUser(): Promise<any | null> {
        if (!this.client) return null;
        return { username: this.config?.username || 'WebDAV User' };
    }

    async push(encryptedData: string): Promise<{ success: boolean; error?: string }> {
        if (!this.client) return { success: false, error: 'Not connected' };

        try {
            await this.client.putFileContents(`/${this.filename}`, encryptedData, { overwrite: true });
            return { success: true };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async pull(): Promise<{ data?: string; error?: string }> {
        if (!this.client) return { error: 'Not connected' };

        try {
            if (await this.client.exists(`/${this.filename}`) === false) {
                return { data: undefined };
            }

            const content = await this.client.getFileContents(`/${this.filename}`, { format: 'text' });
            return { data: content as string };
        } catch (e: any) {
            return { error: e.message };
        }
    }
}
