import { Feed, Article } from './types';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export async function fetchFeed(feed: Feed): Promise<Article[]> {
    const { articles } = await fetchFeedDetails(feed.url, feed.id);
    return articles;
}

export async function fetchFeedDetails(url: string, feedId: string): Promise<{ title: string, articles: Article[] }> {
    try {
        // Auto-fix Reddit URLs
        if (url.includes('reddit.com/r/') && !url.includes('.rss')) {
            try {
                const u = new URL(url.startsWith('http') ? url : `https://${url}`);
                // Remove trailing slash if present to avoid double slashes issues (though /r/sub/.rss works)
                if (u.pathname.endsWith('/')) {
                    u.pathname = u.pathname.slice(0, -1);
                }
                u.pathname += '.rss';
                url = u.toString();
            } catch (e) {
                // Invalid URL, continue as is
            }
        }


        let text = '';

        // Use ipcRenderer if available (in Electron) to bypass CORS
        if ((window as any).ipcRenderer) {
            const result = await (window as any).ipcRenderer.invoke('fetch-url', url);
            if (result.success === false) { // Check for explicit failure
                throw new Error(result.error || 'Failed to fetch feed via IPC');
            }
            // Handle legacy return (string) for backward compat, or new object return
            text = (typeof result === 'string') ? result : result.content;
        } else if (Capacitor.isNativePlatform()) {
            const response = await CapacitorHttp.get({ url: url });
            text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        } else {
            // Fallback for non-Electron env (dev mode in browser?)
            const response = await fetch(url);
            text = await response.text();
        }

        // Try parsing as JSON first
        try {
            const json = JSON.parse(text);
            if (json.version && json.version.startsWith('https://jsonfeed.org/version/')) {
                return {
                    title: json.title || 'Untitled Feed',
                    articles: parseJSONFeed(json, feedId, json.title || 'Untitled Feed')
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
            // If XML parsing failed, it might be HTML. Try content discovery.
            const doc = parser.parseFromString(text, 'text/html');
            const rssLink = doc.querySelector('link[type="application/rss+xml"]')?.getAttribute('href') ||
                doc.querySelector('link[type="application/atom+xml"]')?.getAttribute('href');

            if (rssLink) {
                const resolvedUrl = new URL(rssLink, url).toString();
                return fetchFeedDetails(resolvedUrl, feedId);
            }

            console.error('XML Parsing Error:', parserError.textContent);
            throw new Error('Invalid feed format (not valid XML)');
        }

        // Check if it's RSS or Atom
        const isRss = xml.querySelector('rss') !== null || xml.querySelector('rdf\\:RDF') !== null || xml.querySelector('channel') !== null;
        const isAtom = xml.querySelector('feed') !== null;

        if (!isRss && !isAtom) {
            // Even if valid XML, it might be an HTML page (XHTML). Check discovery again.
            // (Or maybe it parsed as XML but is just HTML)
            const doc = parser.parseFromString(text, 'text/html');
            const rssLink = doc.querySelector('link[type="application/rss+xml"]')?.getAttribute('href') ||
                doc.querySelector('link[type="application/atom+xml"]')?.getAttribute('href');
            if (rssLink) {
                const resolvedUrl = new URL(rssLink, url).toString();
                return fetchFeedDetails(resolvedUrl, feedId);
            }

            throw new Error('Invalid feed format: Not RSS or Atom');
        }

        const title = getFeedTitle(xml);
        let articles: Article[] = [];

        if (isAtom) {
            articles = parseAtomFeed(xml, feedId, title);
        } else {
            articles = parseRSSFeed(xml, feedId, title);
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

function parseJSONFeed(json: any, feedId: string, feedTitle: string): Article[] {
    const items = json.items || [];
    return items.map((item: any) => {
        const title = item.title || 'Untitled';
        const link = item.url || '';
        const content = item.content_html || item.content_text || '';
        const pubDate = item.date_published ? new Date(item.date_published) : undefined;

        // Use item.id if available, otherwise create a stable ID from link/title (no index to avoid position-based changes)
        const rawId = item.id || btoa(encodeURIComponent(link || title)).slice(0, 40);
        const uniqueId = `${feedId}-${rawId}`;

        return {
            id: uniqueId,
            feedId,
            feedTitle,
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

function parseRSSFeed(xml: Document, feedId: string, feedTitle: string): Article[] {
    const items = xml.querySelectorAll('item');
    const articles: Article[] = [];

    items.forEach((item) => {
        const title = item.querySelector('title')?.textContent || 'Untitled';
        const link = item.querySelector('link')?.textContent || '';
        const pubDate = item.querySelector('pubDate')?.textContent;
        const creator = item.querySelector('creator')?.textContent ||
            item.querySelector('author')?.textContent;
        const description = item.querySelector('description')?.textContent;
        let content = item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent ||
            item.querySelector('encoded')?.textContent ||
            description;
        content = cleanArticleHtml(content);

        // Use guid if available, otherwise create a stable ID from feedId + link/title (no index to avoid position-based changes)
        const guidContent = item.querySelector('guid')?.textContent;
        // Increase slice length for better uniqueness; removed index to keep IDs stable across refreshes
        const fallbackId = `${feedId}-${btoa(encodeURIComponent(link || title)).slice(0, 40)}`;
        // Ensure ID is unique per feed by prefixing with feedId if using raw GUID
        const guid = guidContent ? `${feedId}-${guidContent}` : fallbackId;

        // Podcast/Media support: Extract enclosure (audio/video)
        const enclosureElement = item.querySelector('enclosure');
        let enclosure = undefined;
        let mediaType: 'article' | 'audio' | 'video' = 'article';

        if (enclosureElement) {
            const enclosureUrl = enclosureElement.getAttribute('url');
            const enclosureType = enclosureElement.getAttribute('type');
            const enclosureLength = enclosureElement.getAttribute('length');

            if (enclosureUrl && enclosureType) {
                enclosure = {
                    url: enclosureUrl,
                    type: enclosureType,
                    length: enclosureLength ? parseInt(enclosureLength) : undefined
                };

                // Determine media type from MIME type
                if (enclosureType.startsWith('audio/')) {
                    mediaType = 'audio';
                } else if (enclosureType.startsWith('video/')) {
                    mediaType = 'video';
                }
            }
        }

        // Fallback: Check Media RSS (media:content) for audio/video if no standard enclosure found
        if (!enclosure) {
            const mediaContents = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content');
            for (let i = 0; i < mediaContents.length; i++) {
                const mc = mediaContents[i];
                const url = mc.getAttribute('url');
                const type = mc.getAttribute('type');
                const medium = mc.getAttribute('medium');
                const fileSize = mc.getAttribute('fileSize') || mc.getAttribute('length');

                // Check for audio/video
                const isAudio = (type && type.startsWith('audio/')) || medium === 'audio';
                const isVideo = (type && type.startsWith('video/')) || medium === 'video';

                if (url && (isAudio || isVideo)) {
                    enclosure = {
                        url,
                        // If type is missing but medium is known, guess a common mime type or leave generic
                        type: type || (isAudio ? 'audio/mpeg' : 'video/mp4'),
                        length: fileSize ? parseInt(fileSize) : undefined
                    };
                    mediaType = isAudio ? 'audio' : 'video';
                    break; // Use the first valid media found
                }
            }
        }

        // Extract iTunes duration (common in podcasts)
        const duration = item.querySelector('duration')?.textContent ||
            item.getElementsByTagNameNS('http://www.itunes.com/dtds/podcast-1.0.dtd', 'duration')[0]?.textContent;

        // Extract images from multiple sources
        let image: string | undefined = undefined;

        // 1. iTunes image (podcasts)
        const itunesImage = item.getElementsByTagNameNS('http://www.itunes.com/dtds/podcast-1.0.dtd', 'image')[0]?.getAttribute('href');
        if (itunesImage) {
            image = itunesImage;
        }

        // 2. Media RSS namespace (media:content, media:thumbnail)
        if (!image) {
            const mediaContent = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'content')[0];
            const mediaThumbnail = item.getElementsByTagNameNS('http://search.yahoo.com/mrss/', 'thumbnail')[0];

            if (mediaContent) {
                const mediaUrl = mediaContent.getAttribute('url');
                const mediaType = mediaContent.getAttribute('medium') || mediaContent.getAttribute('type');
                // Only use if it's an image
                if (mediaUrl && (!mediaType || mediaType.includes('image'))) {
                    image = mediaUrl;
                }
            }

            if (!image && mediaThumbnail) {
                const thumbUrl = mediaThumbnail.getAttribute('url');
                if (thumbUrl) {
                    image = thumbUrl;
                }
            }
        }

        // 3. Extract from content/description HTML (look for first img tag)
        if (!image && content) {
            const imgMatch = content.match(/\u003cimg[^\u003e]+src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1]) {
                image = imgMatch[1];
            }
        }

        // 4. Enclosure with image type
        if (!image && enclosureElement) {
            const enclosureUrl = enclosureElement.getAttribute('url');
            const enclosureType = enclosureElement.getAttribute('type');
            if (enclosureUrl && enclosureType && enclosureType.startsWith('image/')) {
                image = enclosureUrl;
            }
        }

        // 5. Special handling for "Podcast" items without enclosure (e.g. Six Colors)
        if (!enclosure) {
            const itunesEpisode = item.getElementsByTagNameNS('http://www.itunes.com/dtds/podcast-1.0.dtd', 'episodeType')[0]?.textContent;
            const category = item.querySelector('category')?.textContent;
            const isPodcastType = itunesEpisode === 'full' || category === 'Podcast' || title.includes('(Podcast)');

            if (isPodcastType) {
                // Look for "Go to the podcast page" link or similar
                const linkMatch = content?.match(/<a href="([^"]+)">Go to the podcast page<\/a>/i) ||
                    content?.match(/<a href="([^"]+)">Listen to .*<\/a>/i);

                if (linkMatch && linkMatch[1]) {
                    enclosure = {
                        url: linkMatch[1],
                        type: 'text/html', // Marker for external link
                        length: 0
                    };
                    mediaType = 'audio';
                }
            }
        }

        articles.push({
            id: guid,
            feedId,
            feedTitle,
            title,
            link,
            pubDate: pubDate ? new Date(pubDate) : undefined,
            creator,
            content,
            contentSnippet: description?.replace(/\u003c[^\u003e]*\u003e/g, '').slice(0, 200),
            guid: guidContent || fallbackId, // Keep original GUID for reference if needed
            isRead: false,
            // Podcast fields
            mediaType,
            enclosure,
            duration,
            image
        });
    });

    return articles;
}

// Helper to decode HTML entities (for Atom feeds with type="html")
function decodeHtmlEntities(text: string | null | undefined): string | undefined {
    if (!text) return undefined;
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
}

function parseAtomFeed(xml: Document, feedId: string, feedTitle: string): Article[] {
    const entries = xml.querySelectorAll('entry');
    const articles: Article[] = [];

    entries.forEach((entry) => {
        const title = entry.querySelector('title')?.textContent || 'Untitled';
        const link = entry.querySelector('link')?.getAttribute('href') || '';
        const published = entry.querySelector('published')?.textContent ||
            entry.querySelector('updated')?.textContent;
        const author = entry.querySelector('author name')?.textContent;

        // Get content and check if it needs HTML entity decoding
        const contentEl = entry.querySelector('content');
        const summaryEl = entry.querySelector('summary');
        let rawContent = contentEl?.textContent || summaryEl?.textContent;

        // If content type is "html", the text contains encoded HTML entities that need decoding
        const contentType = contentEl?.getAttribute('type') || '';
        if (contentType === 'html' && rawContent) {
            rawContent = decodeHtmlEntities(rawContent);
        }

        let content = cleanArticleHtml(rawContent);

        const idContent = entry.querySelector('id')?.textContent;
        // Use stable ID without index to prevent read status from being lost when feed order changes
        const fallbackId = `${feedId}-${btoa(encodeURIComponent(link || title)).slice(0, 40)}`;
        // Ensure ID is unique per feed by prefixing with feedId if using raw ID
        const id = idContent ? `${feedId}-${idContent}` : fallbackId;

        articles.push({
            id,
            feedId,
            feedTitle,
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
            let text = '';
            // Use ipcRenderer if available (in Electron) to bypass CORS
            if ((window as any).ipcRenderer) {
                const result = await (window as any).ipcRenderer.invoke('fetch-url', feedUrl);
                text = (typeof result === 'string') ? result : result.content || '';
            } else {
                const response = await fetch(feedUrl);
                text = await response.text();
            }

            // Try parsing as XML first
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');

            // Check for iTunes Podcast Image
            const itunesImage = xml.getElementsByTagNameNS('http://www.itunes.com/dtds/podcast-1.0.dtd', 'image')[0]?.getAttribute('href');
            if (itunesImage) {
                return itunesImage;
            }

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

        // Fallback to Google's favicon service (reliable, supports high-res)
        return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
    } catch (e) {
        console.error('Error fetching feed icon:', e);
        return undefined;
    }
}

function cleanArticleHtml(html: string | null | undefined): string | undefined {
    if (!html) return undefined;

    // Debug: Log when this function is called with content containing YouTube
    if (html.includes('youtu')) {
        console.log('cleanArticleHtml processing content with YouTube link. First 500 chars:', html.slice(0, 500));
    }

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove scripts and styles (usually ads/tracking)
        doc.querySelectorAll('script, style').forEach(el => el.remove());

        // Selectively remove iframes (keep video embeds)
        doc.querySelectorAll('iframe').forEach(el => {
            const src = el.getAttribute('src') || '';
            const isVideo = src.includes('youtube.com') ||
                src.includes('youtu.be') ||
                src.includes('player.vimeo.com') ||
                src.includes('twitch.tv') ||
                src.includes('reddit.com');

            if (!isVideo) {
                el.remove();
            }
        });

        // Handle lazy-loaded images: convert data-src to src
        // Many sites use lazy loading with data-src attribute
        const images = doc.querySelectorAll('img');
        console.log(`[cleanArticleHtml] Found ${images.length} images in content`);

        images.forEach((img, index) => {
            const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
            const currentSrc = img.getAttribute('src') || '';

            console.log(`[cleanArticleHtml] Image ${index}:`, {
                currentSrc: currentSrc.substring(0, 100),
                dataSrc: dataSrc?.substring(0, 100) || null,
                hasDataSrc: !!dataSrc
            });

            // If there's a data-src and the current src looks like a placeholder
            if (dataSrc && (
                currentSrc.includes('placeholder') ||
                currentSrc.includes('lazy') ||
                currentSrc.includes('loading') ||
                currentSrc.includes('blank') ||
                currentSrc.length < 10 ||
                !currentSrc
            )) {
                console.log(`[cleanArticleHtml] Replacing placeholder with data-src for image ${index}`);
                img.setAttribute('src', dataSrc);
            }

            // Also handle data-srcset
            const dataSrcset = img.getAttribute('data-srcset');
            if (dataSrcset) {
                img.setAttribute('srcset', dataSrcset);
            }
        });



        // Convert YouTube links to embeds (common in Reddit RSS which only links to video)
        doc.querySelectorAll('a').forEach(anchor => {
            const href = anchor.getAttribute('href') || '';
            if (!href) return;
            // Debug logging for video detection
            if (href.includes('youtu')) console.log('Checking potential video link:', href);

            let videoId: string | null = null;

            try {
                // Try robust parsing with URL API
                // Handle relative URLs if necessary (though RSS usually valid absolute)
                const url = new URL(href, 'https://example.com');

                if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
                    if (url.hostname.includes('youtu.be')) {
                        videoId = url.pathname.slice(1);
                    } else if (url.pathname.includes('/embed/')) {
                        videoId = url.pathname.split('/embed/')[1];
                    } else if (url.searchParams.has('v')) {
                        videoId = url.searchParams.get('v');
                    }
                }
            } catch (e) {
                // Fallback to regex if URL parsing fails
                const ytMatch = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
                if (ytMatch && ytMatch[1]) videoId = ytMatch[1];
            }

            if (videoId) {
                // Strip timestamps or extra params from ID if simplified parsing
                videoId = videoId.split('&')[0].split('?')[0];

                const iframe = doc.createElement('iframe');
                iframe.src = `https://www.youtube.com/embed/${videoId}`;
                iframe.width = '100%';
                iframe.height = '400'; // Good default height
                iframe.title = 'YouTube video player';
                iframe.setAttribute('frameborder', '0');
                iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                iframe.setAttribute('allowfullscreen', 'true');
                iframe.style.aspectRatio = '16/9';
                iframe.style.marginBottom = '16px';

                // If anchor contains an image (thumbnail), replace the whole anchor
                // If it's just a text link, maybe append? Reddit RSS usually wraps thumb in anchor.
                anchor.replaceWith(iframe);
            }
        });

        // Remove common junk elements often found in RSS feeds (especially Substack)
        const unwantedSelectors = [
            '.share-buttons', '.share-icons', '.social-share',
            '.subscribe-widget', '.subscription-widget',
            '.post-meta', '.article-meta',
            '.voiceover-player', '.audio-player', // Substack audio players
            '.button-wrapper',
            'form', // Subscribe forms
            '[class*="share-"]', '[class*="subscribe-"]',
            '.likes-comments-restacks', // Substack specific
            '.meta-bar',
            '.pencraft' // Substack specific styling wrapper often used for headers
        ];

        unwantedSelectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Reddit-specific cleanup: Remove the metadata table at the start
        // Reddit RSS includes a table with subreddit icon, "submitted by", etc.
        doc.querySelectorAll('table').forEach(table => {
            const tableText = table.textContent || '';
            // Check if this table contains Reddit navigation elements
            if (tableText.includes('submitted by') ||
                tableText.includes('[link]') ||
                tableText.includes('[comments]') ||
                tableText.includes('Go to ') ||
                (tableText.includes('r/') && tableText.includes('Share'))) {
                table.remove();
            }
        });

        // Also remove any links that are just "[link]" or "[comments]"
        doc.querySelectorAll('a').forEach(link => {
            const text = link.textContent?.trim();
            if (text === '[link]' || text === '[comments]') {
                // Remove the link and any surrounding span
                const parent = link.parentElement;
                if (parent?.tagName === 'SPAN') {
                    parent.remove();
                } else {
                    link.remove();
                }
            }
        });

        // Aggressive Text-based removal for "Article voiceover"
        // Find elements containing this exact phrase
        const allElements = doc.querySelectorAll('*');
        allElements.forEach(el => {
            if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) { // Text node only
                const text = el.textContent || '';
                if (text.includes('Article voiceover') || text.trim() === 'Share') {
                    // Remove this element, and potentially its parent if it's a wrapper
                    // Traverse up to remove the container
                    let target = el;
                    let p = el.parentElement;
                    while (p && p !== doc.body && (p.tagName === 'DIV' || p.tagName === 'P' || p.tagName === 'TD' || p.tagName === 'TR')) {
                        // Check if parent looks like a wrapper (e.g. only contains this or few elements)
                        if (p.textContent?.length !== undefined && p.textContent.length < 200) {
                            target = p;
                            p = p.parentElement;
                        } else {
                            break;
                        }
                    }
                    target.remove();
                }
            }
        });

        // Remove tracking pixels and specific junk images
        doc.querySelectorAll('img').forEach(img => {
            if ((img.width === 1 && img.height === 1) ||
                img.src.includes('pixel') ||
                img.src.includes('stat')) {
                img.remove();
            }
        });

        return doc.body.innerHTML;
    } catch (e) {
        return html || undefined;
    }
}
