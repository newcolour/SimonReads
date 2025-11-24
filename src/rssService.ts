import { Feed, Article } from './types';

export async function fetchFeed(feed: Feed): Promise<Article[]> {
    const { articles } = await fetchFeedDetails(feed.url, feed.id);
    return articles;
}

export async function fetchFeedDetails(url: string, feedId: string): Promise<{ title: string, articles: Article[] }> {
    try {
        const response = await fetch(url);
        const text = await response.text();

        // Try parsing as JSON first
        try {
            const json = JSON.parse(text);
            if (json.version && json.version.startsWith('https://jsonfeed.org/version/')) {
                return {
                    title: json.title || 'Untitled Feed',
                    articles: parseJSONFeed(json, feedId)
                };
            }
        } catch (e) {
            // Not JSON, continue to XML
        }

        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');

        // Check for parsing errors
        const parserError = xml.querySelector('parsererror');
        if (parserError) {
            console.error('XML Parsing Error:', parserError.textContent);
            throw new Error('Invalid feed format (not valid XML)');
        }

        // Check if it's RSS or Atom
        const isRss = xml.querySelector('rss') !== null || xml.querySelector('rdf\\:RDF') !== null || xml.querySelector('channel') !== null;
        const isAtom = xml.querySelector('feed') !== null;

        if (!isRss && !isAtom) {
            throw new Error('Invalid feed format: Not RSS or Atom');
        }

        const title = getFeedTitle(xml);
        let articles: Article[] = [];

        if (isAtom) {
            articles = parseAtomFeed(xml, feedId);
        } else {
            articles = parseRSSFeed(xml, feedId);
        }

        return { title, articles };

    } catch (error) {
        console.error(`Error fetching feed ${url}:`, error);
        throw error;
    }
}

export function getFeedTitle(xml: Document): string {
    // Try RSS first
    const rssTitle = xml.querySelector('channel > title')?.textContent;
    if (rssTitle) return rssTitle;

    // Try Atom
    const atomTitle = xml.querySelector('feed > title')?.textContent;
    if (atomTitle) return atomTitle;

    return 'Untitled Feed';
}

function parseJSONFeed(json: any, feedId: string): Article[] {
    const items = json.items || [];
    return items.map((item: any, index: number) => {
        const title = item.title || 'Untitled';
        const link = item.url || '';
        const content = item.content_html || item.content_text || '';
        const pubDate = item.date_published ? new Date(item.date_published) : undefined;

        const rawId = item.id || `${btoa(encodeURIComponent(link || title)).slice(0, 30)}-${index}`;
        const uniqueId = `${feedId}-${rawId}`;

        return {
            id: uniqueId,
            feedId,
            title,
            link,
            pubDate,
            creator: item.author?.name,
            content,
            contentSnippet: item.content_text?.slice(0, 200) || content.replace(/<[^>]*>/g, '').slice(0, 200),
            guid: rawId,
            isRead: false
        };
    });
}

function parseRSSFeed(xml: Document, feedId: string): Article[] {
    const items = xml.querySelectorAll('item');
    const articles: Article[] = [];

    items.forEach((item, index) => {
        const title = item.querySelector('title')?.textContent || 'Untitled';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent;
        const creator = item.querySelector('creator')?.textContent ||
            item.querySelector('author')?.textContent;
        const description = item.querySelector('description')?.textContent;
        const content = item.querySelector('encoded')?.textContent || description;

        // Use guid if available, otherwise create a unique ID combining feedId, link/title, and index
        const guidContent = item.querySelector('guid')?.textContent;
        const fallbackId = `${feedId}-${btoa(encodeURIComponent(link || title)).slice(0, 30)}-${index}`;
        // Ensure ID is unique per feed by prefixing with feedId if using raw GUID
        const guid = guidContent ? `${feedId}-${guidContent}` : fallbackId;

        articles.push({
            id: guid,
            feedId,
            title,
            link,
            pubDate: pubDate ? new Date(pubDate) : undefined,
            creator,
            content,
            contentSnippet: description?.replace(/<[^>]*>/g, '').slice(0, 200),
            guid: guidContent || fallbackId, // Keep original GUID for reference if needed
            isRead: false,
        });
    });

    return articles;
}

function parseAtomFeed(xml: Document, feedId: string): Article[] {
    const entries = xml.querySelectorAll('entry');
    const articles: Article[] = [];

    entries.forEach((entry, index) => {
        const title = entry.querySelector('title')?.textContent || 'Untitled';
        const link = entry.querySelector('link')?.getAttribute('href') || '';
        const published = entry.querySelector('published')?.textContent ||
            entry.querySelector('updated')?.textContent;
        const author = entry.querySelector('author name')?.textContent;
        const content = entry.querySelector('content')?.textContent ||
            entry.querySelector('summary')?.textContent;

        const idContent = entry.querySelector('id')?.textContent;
        const fallbackId = `${feedId}-${btoa(encodeURIComponent(link || title)).slice(0, 30)}-${index}`;
        // Ensure ID is unique per feed by prefixing with feedId if using raw ID
        const id = idContent ? `${feedId}-${idContent}` : fallbackId;

        articles.push({
            id,
            feedId,
            title,
            link,
            pubDate: published ? new Date(published) : undefined,
            creator: author,
            content,
            contentSnippet: content?.replace(/<[^>]*>/g, '').slice(0, 200),
            guid: idContent || fallbackId,
            isRead: false,
        });
    });

    return articles;
}

export async function fetchFeedIcon(feedUrl: string): Promise<string | undefined> {
    try {
        const url = new URL(feedUrl);
        const baseUrl = `${url.protocol}//${url.host}`;

        // Try to fetch the feed and parse for icon links
        try {
            const response = await fetch(feedUrl);
            const text = await response.text();

            // Try parsing as XML first
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');

            // Check for icon in feed metadata (Atom feeds)
            const atomIcon = xml.querySelector('feed > icon')?.textContent;
            if (atomIcon) {
                return atomIcon.startsWith('http') ? atomIcon : `${baseUrl}${atomIcon}`;
            }

            // Check for logo in feed metadata
            const atomLogo = xml.querySelector('feed > logo')?.textContent;
            if (atomLogo) {
                return atomLogo.startsWith('http') ? atomLogo : `${baseUrl}${atomLogo}`;
            }

            // Check for image in RSS feeds
            const rssImage = xml.querySelector('channel > image > url')?.textContent;
            if (rssImage) {
                return rssImage.startsWith('http') ? rssImage : `${baseUrl}${rssImage}`;
            }
        } catch (e) {
            // Feed parsing failed, continue to other methods
        }

        // Try direct favicon.ico
        try {
            const faviconUrl = `${baseUrl}/favicon.ico`;
            const response = await fetch(faviconUrl, { method: 'HEAD' });
            if (response.ok) {
                return faviconUrl;
            }
        } catch (e) {
            // Ignore
        }

        // Fallback to DuckDuckGo's favicon service (more reliable than Google's)
        return `https://icons.duckduckgo.com/ip3/${url.hostname}.ico`;
    } catch (e) {
        console.error('Error fetching feed icon:', e);
        return undefined;
    }
}
