export interface RelatedArticle {
    title: string;
    url: string;
    source: string;
}

export async function fetchRelatedArticles(searchQuery: string): Promise<RelatedArticle[]> {
    const ipcRenderer = (window as any).ipcRenderer;
    if (!ipcRenderer) {
        console.warn('IPC not available, skipping related articles');
        return [];
    }

    try {
        // The IPC now returns a JSON string of results directly from the rendered page
        const resultJson = await ipcRenderer.invoke('perform-search', searchQuery);
        console.log('Received search results:', resultJson);

        // Parse the JSON string
        let rawResults: Array<{ title: string, url: string }> = [];
        try {
            rawResults = typeof resultJson === 'string' ? JSON.parse(resultJson) : resultJson;
        } catch (e) {
            console.error('Failed to parse search results JSON:', e);
            return [];
        }

        // Map to RelatedArticle format with source extraction
        const results: RelatedArticle[] = rawResults.map(r => {
            let source = 'Unknown';
            try {
                const urlObj = new URL(r.url);
                source = urlObj.hostname.replace('www.', '');
            } catch { }
            return {
                title: r.title,
                url: r.url,
                source
            };
        }).filter(r => r.source !== 'Unknown');

        console.log(`Related articles found: ${results.length} for "${searchQuery}"`);
        return results.slice(0, 5);
    } catch (error) {
        console.error('Failed to fetch related articles:', error);
        return [];
    }
}
