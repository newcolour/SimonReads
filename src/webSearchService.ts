// DuckDuckGo search service for privacy-focused web searches

interface SearchResult {
    title: string;
    snippet: string;
    url: string;
}

export async function searchDuckDuckGo(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
        // Use IPC to fetch search results from main process to avoid CORS/User-Agent issues
        const ipcRenderer = (window as any).ipcRenderer;

        if (ipcRenderer) {
            const resultStr = await ipcRenderer.invoke('perform-search', query);
            try {
                const parsed = typeof resultStr === 'string' ? JSON.parse(resultStr) : resultStr;
                return Array.isArray(parsed) ? parsed.slice(0, maxResults) : [];
            } catch (e) {
                console.error('Failed to parse IPC search results:', e);
                return [];
            }
        } else {
            // Fallback for dev/browser environment (might fail due to CORS)
            const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error('Search failed');
            }
            const html = await response.text();

            // Parse HTML to extract search results
            const results: SearchResult[] = [];
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // DuckDuckGo result structure
            const resultElements = doc.querySelectorAll('.result');

            for (let i = 0; i < Math.min(resultElements.length, maxResults); i++) {
                const element = resultElements[i];
                const titleElement = element.querySelector('.result__a');
                const snippetElement = element.querySelector('.result__snippet');
                const urlElement = element.querySelector('.result__url');

                if (titleElement && snippetElement) {
                    results.push({
                        title: titleElement.textContent?.trim() || '',
                        snippet: snippetElement.textContent?.trim() || '',
                        url: titleElement.getAttribute('href') || urlElement?.textContent?.trim() || ''
                    });
                }
            }
            return results;
        }
    } catch (error) {
        console.error('DuckDuckGo search error:', error);
        return [];
    }
}

export async function searchAndSummarize(query: string): Promise<string> {
    const results = await searchDuckDuckGo(query, 5);

    if (results.length === 0) {
        return 'No search results found.';
    }

    // Format results for AI consumption with markdown links
    let summary = `Search results for "${query}":\n\n`;
    results.forEach((result, index) => {
        summary += `${index + 1}. **${result.title}**\n`;
        summary += `   ${result.snippet}\n`;
        summary += `   Source: [${result.url}](${result.url})\n\n`;
    });

    return summary;
}
