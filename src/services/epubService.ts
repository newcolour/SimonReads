import JSZip from 'jszip';
import { Article } from '../types';
import { downloadFile } from '../exportService';

export interface EpubOptions {
    title?: string;
    author?: string;
    description?: string;
    language?: string;
}

function escapeXml(unsafe: string): string {
    return (unsafe || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function sanitizeForXhtml(htmlContent: string): string {
    if (!htmlContent) return '<p>No content available.</p>';

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${htmlContent}</div>`, 'text/html');

        // Remove dangerous or non-book elements
        doc.querySelectorAll('script, style, iframe, video, audio, form, input, button, object, embed').forEach(el => el.remove());

        // Ensure all img tags have alt attributes and self-close properly in XML
        doc.querySelectorAll('img').forEach(img => {
            if (!img.getAttribute('alt')) {
                img.setAttribute('alt', 'Article image');
            }
        });

        // Convert body/div content to valid XML string
        const serializer = new XMLSerializer();
        let xmlStr = serializer.serializeToString(doc.body.firstElementChild || doc.body);
        
        // Remove outer div wrapper if present
        xmlStr = xmlStr.replace(/^<div[^>]*>/i, '').replace(/<\/div>$/i, '');
        return xmlStr || '<p>No content available.</p>';
    } catch {
        // Fallback: simple text paragraph
        return `<p>${escapeXml(htmlContent.replace(/<[^>]+>/g, ' '))}</p>`;
    }
}

/**
 * Generate a standard, clean EPUB 3 document from a list of articles
 */
export async function exportArticlesToEpub(
    articles: Article[],
    options: EpubOptions = {}
): Promise<Blob> {
    if (!articles || articles.length === 0) {
        throw new Error('No articles to export.');
    }

    const zip = new JSZip();

    const title = options.title || `SimonReads Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const author = options.author || 'SimonReads';
    const language = options.language || 'en';
    const uuid = `urn:uuid:${crypto.randomUUID()}`;
    const dateStr = new Date().toISOString().split('T')[0];

    // 1. mimetype (MUST be first, uncompressed)
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

    // 2. META-INF/container.xml
    zip.file(
        'META-INF/container.xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
    );

    // 3. OEBPS/styles.css
    const css = `
body {
    font-family: -apple-system, BlinkMacSystemFont, "Georgia", "Times New Roman", serif;
    line-height: 1.6;
    margin: 5% 8%;
    color: #111;
    background-color: #fff;
}
h1, h2, h3, h4 {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", sans-serif;
    color: #000;
    line-height: 1.25;
    margin-top: 1.2em;
    margin-bottom: 0.5em;
}
h1 { font-size: 1.8em; }
h2 { font-size: 1.4em; }
.article-meta {
    font-size: 0.85em;
    color: #555;
    margin-bottom: 1.5em;
    padding-bottom: 0.75em;
    border-bottom: 1px solid #ddd;
    font-family: sans-serif;
}
.article-link {
    font-size: 0.8em;
    color: #0066cc;
    word-break: break-all;
    margin-top: 2em;
    padding-top: 1em;
    border-top: 1px dashed #ccc;
    font-family: sans-serif;
}
p {
    margin-bottom: 1em;
    text-align: justify;
}
img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1.5em auto;
}
blockquote {
    margin: 1em 0 1em 1.5em;
    padding-left: 1em;
    border-left: 3px solid #888;
    color: #444;
    font-style: italic;
}
code, pre {
    font-family: "Courier New", Courier, monospace;
    font-size: 0.9em;
    background: #f4f4f4;
    padding: 2px 4px;
    border-radius: 3px;
}
pre {
    padding: 10px;
    overflow-x: auto;
}
.cover-page {
    text-align: center;
    padding: 20% 0;
}
.cover-title {
    font-size: 2.2em;
    font-weight: bold;
    margin-bottom: 0.3em;
}
.cover-subtitle {
    font-size: 1.1em;
    color: #666;
    margin-bottom: 2em;
}
.cover-stats {
    font-size: 0.9em;
    color: #888;
}
`;
    zip.file('OEBPS/styles.css', css);

    // 4. Title / Cover Page (OEBPS/title.xhtml)
    const titleHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
    <div class="cover-page">
        <h1 class="cover-title">📖 ${escapeXml(title)}</h1>
        <p class="cover-subtitle">Curated with SimonReads</p>
        <p class="cover-stats">Collection of ${articles.length} articles • Generated ${dateStr}</p>
    </div>
</body>
</html>`;
    zip.file('OEBPS/title.xhtml', titleHtml);

    // 5. Individual Article Chapters
    const manifestItems: string[] = [
        '<item id="styles" href="styles.css" media-type="text/css" />',
        '<item id="title-page" href="title.xhtml" media-type="application/xhtml+xml" />',
        '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />',
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />'
    ];
    const spineItems: string[] = [
        '<itemref idref="title-page" />'
    ];
    const tocEntries: { id: string; title: string; href: string }[] = [];

    articles.forEach((article, index) => {
        const chapterId = `chapter_${index + 1}`;
        const filename = `${chapterId}.xhtml`;
        const articleTitle = article.title || 'Untitled Article';
        const feedSource = article.feedTitle || article.creator || 'RSS Feed';
        const pubDateStr = article.pubDate ? new Date(article.pubDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }) : '';

        const rawContent = article.content || article.contentSnippet || '';
        const bodyContent = sanitizeForXhtml(rawContent);

        const chapterHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
    <title>${escapeXml(articleTitle)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
    <article>
        <h1>${escapeXml(articleTitle)}</h1>
        <div class="article-meta">
            <strong>${escapeXml(feedSource)}</strong> ${pubDateStr ? ` • ${escapeXml(pubDateStr)}` : ''}
        </div>
        <div class="article-content">
            ${bodyContent}
        </div>
        ${article.link ? `<div class="article-link"><a href="${escapeXml(article.link)}">Original Article: ${escapeXml(article.link)}</a></div>` : ''}
    </article>
</body>
</html>`;

        zip.file(`OEBPS/${filename}`, chapterHtml);
        manifestItems.push(`<item id="${chapterId}" href="${filename}" media-type="application/xhtml+xml" />`);
        spineItems.push(`<itemref idref="${chapterId}" />`);
        tocEntries.push({ id: chapterId, title: articleTitle, href: filename });
    });

    // 6. Navigation Document (OEBPS/nav.xhtml - EPUB 3)
    const navHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${language}">
<head>
    <title>Table of Contents</title>
    <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
    <nav epub:type="toc" id="toc">
        <h1>Table of Contents</h1>
        <ol>
            <li><a href="title.xhtml">Cover / Title</a></li>
            ${tocEntries.map(e => `<li><a href="${e.href}">${escapeXml(e.title)}</a></li>`).join('\n            ')}
        </ol>
    </nav>
</body>
</html>`;
    zip.file('OEBPS/nav.xhtml', navHtml);

    // 7. NCX Document (OEBPS/toc.ncx - EPUB 2 backward compatibility)
    const ncxHtml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(title)}</text>
  </docTitle>
  <navMap>
    <navPoint id="navPoint-1" playOrder="1">
      <navLabel><text>Cover</text></navLabel>
      <content src="title.xhtml"/>
    </navPoint>
    ${tocEntries.map((e, idx) => `
    <navPoint id="navPoint-${idx + 2}" playOrder="${idx + 2}">
      <navLabel><text>${escapeXml(e.title)}</text></navLabel>
      <content src="${e.href}"/>
    </navPoint>`).join('')}
  </navMap>
</ncx>`;
    zip.file('OEBPS/toc.ncx', ncxHtml);

    // 8. Package Document (OEBPS/content.opf)
    const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookID" version="3.0" xml:lang="${language}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="BookID">${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${language}</dc:language>
    <dc:date>${dateStr}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
    zip.file('OEBPS/content.opf', opf);

    // Generate EPUB blob
    const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/epub+zip'
    });

    return blob;
}

/**
 * Convenience helper to export articles to EPUB and trigger browser/device download
 */
export async function downloadArticlesAsEpub(
    articles: Article[],
    filenameTitle: string = 'SimonReads_Weekend_Edition'
): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const filename = `${filenameTitle}_${today}.epub`;

    const blob = await exportArticlesToEpub(articles, {
        title: filenameTitle.replace(/_/g, ' ')
    });

    downloadFile(blob, filename, 'application/epub+zip');
}
