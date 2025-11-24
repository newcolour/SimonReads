import { Feed } from './types';

export function exportToOPML(feeds: Feed[]): string {
    const head = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>SimonReads Feed Export</title>
        <dateCreated>${new Date().toUTCString()}</dateCreated>
    </head>
    <body>`;

    const body = feeds
        .map(
            (feed) =>
                `        <outline text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" type="rss" xmlUrl="${escapeXml(feed.url)}"/>`
        )
        .join('\n');

    const tail = `
    </body>
</opml>`;

    return head + '\n' + body + tail;
}

export function exportToJSON(feeds: Feed[]): string {
    const exportData = {
        appName: 'SimonReads',
        exportedAt: new Date().toISOString(),
        feeds: feeds.map(f => ({
            title: f.title,
            url: f.url,
            addedAt: f.id // Assuming ID is timestamp, or we could add a dedicated field
        }))
    };
    return JSON.stringify(exportData, null, 2);
}

export function downloadFile(content: string, filename: string, contentType: string) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}
