
import { Capacitor, CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';

export async function safeFetch(url: string, options: any = {}): Promise<Response> {
    // For Electron, we rely on the IPC proxy handled elsewhere or direct fetch if CORS allows
    if ((window as any).ipcRenderer) {
        return fetch(url, options);
    }

    // For Native (iOS/Android), use CapacitorHttp to bypass CORS
    if (Capacitor.isNativePlatform()) {
        const capOptions: HttpOptions = {
            url: url,
            method: options.method || 'GET',
            headers: options.headers || {},
            data: options.body ? JSON.parse(options.body) : undefined,
        };

        try {
            const response: HttpResponse = await CapacitorHttp.request(capOptions);

            // Create a Response-like object to maintain compatibility with existing fetch usage
            return {
                ok: response.status >= 200 && response.status < 300,
                status: response.status,
                statusText: response.status.toString(),
                json: async () => response.data,
                text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
                headers: new Headers(response.headers as any),
            } as Response;
        } catch (error) {
            console.error('CapacitorHttp error:', error);
            throw error;
        }
    }

    // Fallback to standard fetch
    return fetch(url, options);
}
