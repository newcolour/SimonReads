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
        const html = await ipcRenderer.invoke('perform-search', searchQuery);

        // Parse DuckDuckGo HTML results
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const results: RelatedArticle[] = [];

        // DuckDuckGo uses .result class for each result
        const resultElements = doc.querySelectorAll('.result');

        for (let i = 0; i < Math.min(resultElements.length, 5); i++) {
            const result = resultElements[i];
            const linkElement = result.querySelector('.result__a');

            if (linkElement) {
                const title = linkElement.textContent?.trim() || '';
                let url = linkElement.getAttribute('href') || '';

                // Handle DuckDuckGo redirect URLs
                if (url.startsWith('//duckduckgo.com/l/?')) {
                    try {
                        const urlParams = new URLSearchParams(url.split('?')[1]);
                        const uddg = urlParams.get('uddg');
                        if (uddg) {
                            url = decodeURIComponent(uddg);
                        }
                    } catch (e) {
                        console.warn('Failed to parse DDG redirect:', e);
                    }
                }

                // Extract source from URL
                let source = 'Unknown';
                try {
                    // Ensure URL has protocol
                    if (!url.startsWith('http')) {
                        url = 'https:' + url;
                    }
                    const urlObj = new URL(url);
                    source = urlObj.hostname.replace('www.', '');
                } catch (e) {
                    // Try to find source in display element
                    const displayUrl = result.querySelector('.result__url');
                    if (displayUrl) {
                        source = displayUrl.textContent?.trim().split('/')[0] || 'Unknown';
                    }
                }

                if (title && url && source !== 'Unknown') {
                    results.push({ title, url, source });
                }
            }
        }

        return results.slice(0, 5);
    } catch (error) {
        console.error('Failed to fetch related articles:', error);
        return [];
    }
}
