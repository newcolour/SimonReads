


export interface SyncProvider {
    name: string;
    isAuthenticated(): boolean;
    login(credentials: any): Promise<{ user?: any; error?: string }>;
    signUp?(credentials: any): Promise<{ user?: any; error?: string }>;
    logout(): Promise<void>;
    push(encryptedData: string): Promise<{ success: boolean; error?: string }>;
    pull(): Promise<{ data?: string; error?: string }>;
    getUser(): Promise<any | null>;
}
