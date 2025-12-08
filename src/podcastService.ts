/**
 * Service for converting Apple Podcasts and Spotify podcast URLs to RSS feeds
 */

/**
 * Extracts the podcast ID from an Apple Podcasts URL
 * Examples:
 * - https://podcasts.apple.com/us/podcast/podcast-name/id123456789
 * - https://podcasts.apple.com/podcast/id123456789
 */
function extractApplePodcastId(url: string): string | null {
    const match = url.match(/id(\d+)/);
    return match ? match[1] : null;
}

/**
 * Extracts the show ID from a Spotify podcast URL
 * Examples:
 * - https://open.spotify.com/show/1234567890abcdefghij
 * - https://open.spotify.com/show/1234567890abcdefghij?si=...
 */
function extractSpotifyShowId(url: string): string | null {
    const match = url.match(/show\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
}

/**
 * Fetches the RSS feed URL for an Apple Podcast
 */
async function getApplePodcastRssFeed(podcastId: string): Promise<string> {
    try {
        // Use Apple's iTunes API to get podcast info
        const response = await fetch(`https://itunes.apple.com/lookup?id=${podcastId}&entity=podcast`);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            const feedUrl = data.results[0].feedUrl;
            if (feedUrl) {
                return feedUrl;
            }
        }
        throw new Error('Could not find RSS feed for this Apple Podcast');
    } catch (error) {
        console.error('Error fetching Apple Podcast RSS:', error);
        throw new Error('Failed to fetch Apple Podcast RSS feed');
    }
}

/**
 * Fetches the RSS feed URL for a Spotify podcast
 * Note: Spotify doesn't provide direct RSS feeds, but we can try to find them
 * through third-party services or by scraping the podcast page
 */
async function getSpotifyPodcastRssFeed(showId: string): Promise<string> {
    try {
        // Try to fetch the Spotify show page and extract RSS feed
        // Note: This is a workaround since Spotify doesn't provide a direct API for RSS
        const ipcRenderer = (window as any).ipcRenderer;

        if (ipcRenderer) {
            // Use Electron's fetch to avoid CORS
            const result = await ipcRenderer.invoke('fetch-url', `https://open.spotify.com/show/${showId}`);

            if (result.success && result.content) {
                // Try to find RSS feed link in the page
                const rssMatch = result.content.match(/<link[^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i) ||
                    result.content.match(/href=["']([^"']+)["'][^>]*type=["']application\/rss\+xml["']/i);

                if (rssMatch && rssMatch[1]) {
                    return rssMatch[1];
                }

                // Alternative: Look for feed URL in meta tags or JSON-LD
                const metaMatch = result.content.match(/<meta[^>]*property=["']og:audio["'][^>]*content=["']([^"']+\.rss)["']/i);
                if (metaMatch && metaMatch[1]) {
                    return metaMatch[1];
                }
            }
        }

        // If we can't find the RSS feed, suggest using a third-party service
        throw new Error('Spotify podcasts may not have public RSS feeds. Try using the podcast\'s original RSS feed URL if available, or check if the podcast is available on Apple Podcasts.');
    } catch (error) {
        console.error('Error fetching Spotify Podcast RSS:', error);
        throw error;
    }
}

/**
 * Detects if a URL is from Apple Podcasts or Spotify and converts it to RSS
 */
export async function convertPodcastUrlToRss(url: string): Promise<string> {
    const trimmedUrl = url.trim();

    // Check if it's an Apple Podcasts URL
    if (trimmedUrl.includes('podcasts.apple.com')) {
        const podcastId = extractApplePodcastId(trimmedUrl);
        if (podcastId) {
            return await getApplePodcastRssFeed(podcastId);
        }
        throw new Error('Invalid Apple Podcasts URL. Please make sure the URL contains a podcast ID.');
    }

    // Check if it's a Spotify URL
    if (trimmedUrl.includes('open.spotify.com/show')) {
        const showId = extractSpotifyShowId(trimmedUrl);
        if (showId) {
            return await getSpotifyPodcastRssFeed(showId);
        }
        throw new Error('Invalid Spotify podcast URL. Please make sure the URL is a show link.');
    }

    // If it's not a podcast platform URL, return as-is (assume it's already an RSS feed)
    return trimmedUrl;
}

/**
 * Checks if a URL is from a supported podcast platform
 */
export function isPodcastPlatformUrl(url: string): boolean {
    return url.includes('podcasts.apple.com') || url.includes('open.spotify.com/show');
}
