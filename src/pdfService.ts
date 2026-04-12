import jsPDF from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Article, AppSettings, ArticleRanking } from './types';

interface RankedArticle {
    article: Article;
    importance: number;
    summary: string;
    translatedTitle?: string;
    imageUrl?: string;
    language?: string;
    searchQuery?: string;
}

export async function generateNewspaperPDF(
    articles: Article[],
    settings: AppSettings,
    cachedRankings?: ArticleRanking[]
): Promise<void> {
    try {
        // Validate inputs
        if (!articles || articles.length === 0) {
            throw new Error('No articles provided for PDF generation');
        }

        console.log(`Starting PDF generation for ${articles.length} articles`);

        // Step 1: Rank articles by importance (using cache if available)
        const rankedArticles = await rankArticlesByImportance(articles, settings, cachedRankings);
        console.log(`Ranked ${rankedArticles.length} articles`);

        if (rankedArticles.length === 0) {
            throw new Error('No articles could be ranked');
        }

        // Step 2: Extract images from articles
        await extractArticleImages(rankedArticles);
        console.log('Images extracted');

        // Step 3: Small delay to ensure images are fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));

        // Step 4: Generate PDF
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);

        // Add newspaper header
        addNewspaperHeader(pdf, pageWidth);

        // Add date and edition info
        const today = new Date();
        const dateStr = today.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(dateStr, pageWidth / 2, 35, { align: 'center' });
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(margin, 38, pageWidth - margin, 38);

        let yPosition = 45;

        // Layout articles in newspaper style (NYT-inspired)
        const targetLanguage = settings.summaryLanguage || 'English';
        console.log('Starting layout generation...');
        yPosition = await layoutNewspaperArticles(pdf, rankedArticles, margin, contentWidth, yPosition, pageHeight, targetLanguage);
        console.log('Layout complete');

        // Save the PDF
        const filename = `SimonDailyNews_${today.toISOString().split('T')[0]}.pdf`;
        console.log(`Saving PDF as ${filename} `);
        if (Capacitor.isNativePlatform()) {
            try {
                const base64data = pdf.output('datauristring').split(',')[1];
                await Filesystem.writeFile({
                    path: filename,
                    data: base64data,
                    directory: Directory.Documents
                });
                console.log(`PDF saved to Documents folder as ${filename}`);
                alert(`PDF saved to Documents folder as ${filename}`);
            } catch (err) {
                console.error('Failed to save PDF on device:', err);
                throw new Error('Failed to save PDF to Documents folder. Ensure permissions are granted.');
            }
        } else {
            pdf.save(filename);
        }
        console.log('PDF generation complete');
    } catch (error) {
        console.error('PDF generation failed:', error);
        // Provide more specific error message
        if (error instanceof Error) {
            throw new Error(`PDF generation failed: ${error.message} `);
        } else {
            throw new Error('PDF generation failed due to an unknown error');
        }
    }
}

function addNewspaperHeader(pdf: jsPDF, pageWidth: number): void {
    // Main masthead
    pdf.setFont('times', 'bold');
    pdf.setFontSize(36);
    pdf.setTextColor(0, 0, 0);
    pdf.text('SimonDailyNews', pageWidth / 2, 20, { align: 'center' });

    // Tagline
    pdf.setFontSize(10);
    pdf.setFont('times', 'italic');
    pdf.setTextColor(80, 80, 80);
    pdf.text('All the News That\'s Fit to Read', pageWidth / 2, 27, { align: 'center' });
}

async function layoutNewspaperArticles(
    pdf: jsPDF,
    rankedArticles: RankedArticle[],
    margin: number,
    contentWidth: number,
    startY: number,
    pageHeight: number,
    targetLanguage: string
): Promise<number> {
    let yPosition = startY;
    let rowMaxY = yPosition;

    for (let index = 0; index < rankedArticles.length; index++) {
        const ranked = rankedArticles[index];
        const isTopStory = index === 0;
        const columnWidth = (contentWidth - 5) / 2;

        if (isTopStory) {
            // Check if we need a new page
            if (yPosition > pageHeight - 120) {
                pdf.addPage();
                yPosition = 20;
            }
            // Top story: full width with image
            yPosition = await addTopStory(pdf, ranked, margin, contentWidth, yPosition, targetLanguage, pageHeight);
            rowMaxY = yPosition;
        } else {
            // Regular articles: two-column layout
            const column = (index - 1) % 2;
            const xPosition = margin + (column * (columnWidth + 5));

            // If starting a new row (column 0), check for page break
            if (column === 0) {
                // Ensure we have enough space for a decent article (approx 100mm)
                if (yPosition > pageHeight - 100) {
                    pdf.addPage();
                    yPosition = 20;
                    rowMaxY = 20;
                }
            }

            const articleHeight = await addRegularArticle(
                pdf,
                ranked,
                xPosition,
                yPosition,
                columnWidth,
                targetLanguage,
                pageHeight
            );

            // If article doesn't fit (returns -1), start a new page and try again
            if (articleHeight === -1) {
                pdf.addPage();
                yPosition = 20;
                rowMaxY = 20;

                // Re-render the article on the new page
                const newXPosition = margin + (column * (columnWidth + 5));
                const newArticleHeight = await addRegularArticle(
                    pdf,
                    ranked,
                    newXPosition,
                    yPosition,
                    columnWidth,
                    targetLanguage,
                    pageHeight
                );

                const articleBottom = yPosition + newArticleHeight;
                if (articleBottom > rowMaxY) {
                    rowMaxY = articleBottom;
                }
            } else {
                // Track the tallest article in this row
                const articleBottom = yPosition + articleHeight;
                if (articleBottom > rowMaxY) {
                    rowMaxY = articleBottom;
                }
            }

            // If this is the last column or last article, advance yPosition
            if (column === 1 || index === rankedArticles.length - 1) {
                yPosition = rowMaxY + 10; // Add spacing between rows
            }
        }
    }

    return yPosition;
}

async function addTopStory(
    pdf: jsPDF,
    ranked: RankedArticle,
    margin: number,
    contentWidth: number,
    yPosition: number,
    targetLanguage: string,
    pageHeight: number
): Promise<number> {
    const article = ranked.article;

    // Validate that article exists
    if (!article) {
        console.error('Article is undefined in ranked data, skipping');
        return yPosition;
    }

    let currentY = yPosition;

    // Check if we need a new page before starting
    if (currentY > pageHeight - 100) {
        pdf.addPage();
        currentY = 20;
    }

    // Title (use translated title if available, otherwise original)
    pdf.setFont('times', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(0, 0, 0);

    const displayTitle = ranked.translatedTitle || article.title;
    const titleLines = pdf.splitTextToSize(displayTitle, contentWidth);

    // Make title clickable
    const titleHeight = titleLines.length * 9;
    pdf.textWithLink(titleLines.join('\n'), margin, currentY, {
        url: article.link
    });
    currentY += titleHeight + 3;

    // Language indicator (if different from target)
    if (ranked.language && ranked.language.toLowerCase() !== targetLanguage.toLowerCase()) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`(Translated from ${ranked.language})`, margin, currentY);
        currentY += 5;
    }

    // Embed actual image if available
    if (ranked.imageUrl) {
        try {
            let imgWidth = 0;
            let imgHeight = 0;

            try {
                const props = pdf.getImageProperties(ranked.imageUrl);
                imgWidth = props.width;
                imgHeight = props.height;
            } catch (e) {
                // If it fails, image data might be invalid
            }

            if (imgWidth > 0 && imgHeight > 0) {
                const maxWidth = contentWidth;
                const maxHeight = 70;
                const aspectRatio = imgWidth / imgHeight;

                let displayWidth = maxWidth;
                let displayHeight = maxWidth / aspectRatio;

                if (displayHeight > maxHeight) {
                    displayHeight = maxHeight;
                    displayWidth = maxHeight * aspectRatio;
                }

                // Check if image fits on current page
                if (currentY + displayHeight + 10 > pageHeight - 20) {
                    pdf.addPage();
                    currentY = 20;
                }

                const xOffset = margin + (maxWidth - displayWidth) / 2;

                try {
                    pdf.addImage(ranked.imageUrl, 'JPEG', xOffset, currentY, displayWidth, displayHeight);
                    currentY += displayHeight + 5;

                    // Image caption
                    pdf.setFont('helvetica', 'italic');
                    pdf.setFontSize(8);
                    pdf.setTextColor(120, 120, 120);
                    const caption = `Source: ${new URL(article.link).hostname} `;
                    pdf.text(caption, margin, currentY);
                    currentY += 5;
                } catch (pdfError) {
                    console.error('Failed to add image to PDF:', pdfError);
                }
            }
        } catch (error) {
            console.error('Failed to process image:', error);
        }
    }

    // Summary - render complete summary with proper page breaks
    pdf.setFont('times', 'normal');
    const fontSize = 11;
    pdf.setFontSize(fontSize);
    pdf.setTextColor(30, 30, 30);

    const paragraphs = ranked.summary.split('\n\n');
    const lineHeight = fontSize * 0.3527;
    const lineSpacing = 1.4;

    for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
            const paragraphLines = pdf.splitTextToSize(paragraph.trim(), contentWidth);

            // Render each line, adding pages as needed
            for (let i = 0; i < paragraphLines.length; i++) {
                // Check if we need a new page
                if (currentY + (lineHeight * lineSpacing) > pageHeight - 20) {
                    pdf.addPage();
                    currentY = 20;
                }

                pdf.text(paragraphLines[i], margin, currentY);
                currentY += lineHeight * lineSpacing;
            }
            currentY += 3; // Extra space between paragraphs
        }
    }

    currentY += 5;

    // Separator line
    if (currentY + 10 < pageHeight - 20) {
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.2);
        pdf.line(margin, currentY, margin + contentWidth, currentY);
        currentY += 10;
    }

    return currentY;
}

async function addRegularArticle(
    pdf: jsPDF,
    ranked: RankedArticle,
    xPosition: number,
    yPosition: number,
    columnWidth: number,
    targetLanguage: string,
    pageHeight: number
): Promise<number> {
    const article = ranked.article;

    // Validate that article exists
    if (!article) {
        console.error('Article is undefined in ranked data, skipping');
        return 0;
    }

    const bottomMargin = 20;
    const fontSize = 10;
    const lineHeight = fontSize * 0.3527;
    const lineSpacing = 1.4;

    // Calculate total height needed for this article
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    const displayTitle = ranked.translatedTitle || article.title;
    const titleLines = pdf.splitTextToSize(displayTitle, columnWidth);
    let estimatedHeight = titleLines.length * 6 + 2; // Title height

    // Language indicator height
    if (ranked.language && ranked.language.toLowerCase() !== targetLanguage.toLowerCase()) {
        estimatedHeight += 3;
    }

    // Image height (if available)
    if (ranked.imageUrl) {
        estimatedHeight += 43; // Max image height + spacing
    }

    // Summary height
    pdf.setFont('times', 'normal');
    pdf.setFontSize(fontSize);
    const paragraphs = ranked.summary.split('\n\n');
    for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
            const paragraphLines = pdf.splitTextToSize(paragraph.trim(), columnWidth);
            estimatedHeight += paragraphLines.length * (lineHeight * lineSpacing) + 2;
        }
    }
    estimatedHeight += 3; // Final spacing

    // Check if article fits on current page
    // If not, we need to signal that this article should start on a new page
    // We return a special value to indicate this
    if (yPosition + estimatedHeight > pageHeight - bottomMargin) {
        // Article doesn't fit, return negative height to signal "needs new page"
        return -1;
    }

    // Article fits, render it normally
    let localY = yPosition;

    // Title
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    const titleHeight = titleLines.length * 6;

    pdf.textWithLink(titleLines.join('\n'), xPosition, localY, {
        url: article.link
    });
    localY += titleHeight + 2;

    // Language indicator
    if (ranked.language && ranked.language.toLowerCase() !== targetLanguage.toLowerCase()) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`(Translated from ${ranked.language})`, xPosition, localY);
        localY += 3;
    }

    // Embed image if available
    if (ranked.imageUrl) {
        try {
            let imgWidth = 0;
            let imgHeight = 0;

            try {
                const props = pdf.getImageProperties(ranked.imageUrl);
                imgWidth = props.width;
                imgHeight = props.height;
            } catch (e) {
                // If it fails, image data might be invalid
            }

            if (imgWidth > 0 && imgHeight > 0) {
                const maxWidth = columnWidth;
                const maxHeight = 40;
                const aspectRatio = imgWidth / imgHeight;

                let displayWidth = maxWidth;
                let displayHeight = maxWidth / aspectRatio;

                if (displayHeight > maxHeight) {
                    displayHeight = maxHeight;
                    displayWidth = maxHeight * aspectRatio;
                }

                const xOffset = xPosition + (maxWidth - displayWidth) / 2;

                try {
                    pdf.addImage(ranked.imageUrl, 'JPEG', xOffset, localY, displayWidth, displayHeight);
                    localY += displayHeight + 3;
                } catch (pdfError) {
                    console.error('Failed to add column image to PDF:', pdfError);
                }
            }
        } catch (error) {
            console.error('Failed to process column image:', error);
        }
    }

    // Summary - render all content since we know it fits
    pdf.setFont('times', 'normal');
    pdf.setFontSize(fontSize);
    pdf.setTextColor(40, 40, 40);

    for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
            const paragraphLines = pdf.splitTextToSize(paragraph.trim(), columnWidth);

            for (let i = 0; i < paragraphLines.length; i++) {
                pdf.text(paragraphLines[i], xPosition, localY);
                localY += lineHeight * lineSpacing;
            }
            localY += 2; // Space between paragraphs
        }
    }

    return localY - yPosition;
}

async function rankArticlesByImportance(
    articles: Article[],
    _settings: AppSettings,
    cachedRankings?: ArticleRanking[]
): Promise<RankedArticle[]> {

    // 1. Fast path: Use cached rankings if available (Preferred)
    if (cachedRankings && cachedRankings.length > 0) {
        console.log('Using cached article rankings for PDF...');

        // Map cached rankings to RankedArticle format
        const mappedRankings: RankedArticle[] = cachedRankings
            .map(r => {
                const article = articles.find(a => a.id === r.id);
                if (!article) return null;

                // Use original title and truncated content since we don't have AI summaries
                // Increased to 800 chars since we have larger context budgets now.
                const cleanContent = (article.contentSnippet || article.content || '')
                    .replace(/<[^>]+>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 800); // Truncate body text (increased from 500)

                return {
                    article,
                    importance: r.score,
                    // Use translated title if available, otherwise original
                    translatedTitle: r.translatedTitle || article.title,
                    // Use original content as summary since we aren't generating new ones
                    summary: cleanContent + '...',
                    language: r.language,
                    searchQuery: undefined,
                    category: r.category
                } as RankedArticle;
            })
            .filter((r): r is RankedArticle => r !== null)
            .sort((a, b) => b.importance - a.importance);

        if (mappedRankings.length > 0) {
            return mappedRankings;
        }
    }

    // 2. Fallback: If no cache, just rank by date (No AI)
    // We removed the internal AI call to keep the "Single Pass" architecture strict.
    console.log('No cached rankings found, falling back to date sort.');
    return articles.map(article => ({
        article,
        importance: article.pubDate ? new Date(article.pubDate).getTime() : 0,
        summary: (article.contentSnippet || article.content || '').replace(/<[^>]+>/g, ' ').slice(0, 800) + '...',
        translatedTitle: article.title,
        language: undefined
    })).sort((a, b) => b.importance - a.importance);
}

async function extractArticleImages(rankedArticles: RankedArticle[]): Promise<void> {
    // Only fetch images for top 10 articles to speed up generation
    const articlesToProcess = rankedArticles.slice(0, 10);

    // Process all articles in parallel for speed
    const imagePromises = articlesToProcess.map(async (ranked) => {
        const article = ranked.article;
        if (!article) return;

        try {
            // First try to get image from RSS content (fast, no network needed for URL)
            const content = article.content || '';
            const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);

            if (imgMatch && imgMatch[1]) {
                const base64Image = await fetchImageAsBase64(imgMatch[1]);
                if (base64Image) {
                    ranked.imageUrl = base64Image;
                    return;
                }
            }

            // If no image in RSS, try fetching from the article URL
            if (article.link) {
                // Use a timeout to avoid hanging on slow sites
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                try {
                    const response = await fetch(article.link, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    const html = await response.text();
                    const imageUrl = extractMainImageFromHTML(html, article.link);

                    if (imageUrl) {
                        const base64Image = await fetchImageAsBase64(imageUrl);
                        if (base64Image) {
                            ranked.imageUrl = base64Image;
                        }
                    }
                } catch (e) {
                    clearTimeout(timeoutId);
                    // Timeout or fetch failed, continue without image
                }
            }
        } catch (error) {
            // Continue without image
        }
    });

    // Wait for all image fetches to complete (with 10s overall timeout)
    await Promise.race([
        Promise.all(imagePromises),
        new Promise(resolve => setTimeout(resolve, 10000))
    ]);
}

function extractMainImageFromHTML(html: string, baseUrl: string): string | null {
    // Strategy 1: Look for Open Graph image
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
        return resolveImageUrl(ogImageMatch[1], baseUrl);
    }

    // Strategy 2: Look for Twitter card image
    const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (twitterImageMatch && twitterImageMatch[1]) {
        return resolveImageUrl(twitterImageMatch[1], baseUrl);
    }

    // Strategy 3: Look for first large img tag in article content
    const articleImgMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (articleImgMatch && articleImgMatch[1]) {
        const imgSrc = articleImgMatch[1];
        // Filter out small images (icons, logos, etc.)
        if (!imgSrc.includes('icon') && !imgSrc.includes('logo') && !imgSrc.includes('avatar')) {
            return resolveImageUrl(imgSrc, baseUrl);
        }
    }

    return null;
}

function resolveImageUrl(imageUrl: string, baseUrl: string): string {
    // If already absolute URL, return as-is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // If protocol-relative URL
    if (imageUrl.startsWith('//')) {
        return 'https:' + imageUrl;
    }

    // If absolute path
    if (imageUrl.startsWith('/')) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${imageUrl}`;
    }

    // Relative path
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}/${imageUrl}`;
}

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) return null;

        // Check if running in Node.js (Electron Main Process)
        const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

        if (isNode) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            return `data:${contentType};base64,${buffer.toString('base64')}`;
        } else {
            // Browser environment
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result as string;
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
    } catch (error) {
        console.error('Failed to fetch image:', imageUrl, error);
        return null;
    }
}

// ============================================================================
// NEWSREEL PDF GENERATION
// Generates a PDF from the exact newsreel markdown output with images per section
// ============================================================================

function cleanMarkdownForNewsreel(str: string): string {
    return str.replace(/\*\*([^*]+)\*\*/g, '$1')
              .replace(/__([^_]+)__/g, '$1')
              .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '$1')
              .replace(/</g, '')
              .replace(/>/g, ''); 
}

interface NewsreelSection {
    title: string;
    content: string;
    sourceUrls: string[];
    imageUrl?: string;
}

export async function generateNewsreelPDF(
    markdownContent: string,
    articles: Article[],
    _settings: AppSettings
): Promise<void> {
    try {
        console.log('Starting Newsreel PDF generation...');

        // Parse the markdown into sections
        const sections = parseNewsreelSections(markdownContent);
        console.log(`Parsed ${sections.length} sections from newsreel`);

        // Extract one image per section
        await extractSectionImages(sections, articles);
        console.log('Section images extracted');

        // Generate PDF
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (2 * margin);

        // ---- CUSTOM SPACED HEADER ----
        pdf.setFont('times', 'bold');
        pdf.setFontSize(36);
        pdf.setTextColor(0, 0, 0);
        pdf.text('SimonDailyNews', pageWidth / 2, 25, { align: 'center' }); 

        pdf.setFontSize(10);
        pdf.setFont('times', 'italic');
        pdf.setTextColor(80, 80, 80);
        pdf.text('All the News That\'s Fit to Read', pageWidth / 2, 33, { align: 'center' }); 

        const today = new Date();
        const dateStr = today.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        pdf.setFontSize(10);
        pdf.setTextColor(100, 100, 100);
        pdf.text(dateStr, pageWidth / 2, 42, { align: 'center' }); 
        
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(margin, 46, pageWidth - margin, 46); 

        let yPosition = 56;

        // ---- TABLE OF CONTENTS ----
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(0, 0, 0);
        pdf.text('In This Edition:', margin, yPosition);
        yPosition += 8;

        for (const section of sections) {
            if (yPosition > pageHeight - 30) { pdf.addPage(); yPosition = 20; }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.setTextColor(30, 30, 30);
            pdf.text(`• ${section.title}`, margin + 5, yPosition);
            yPosition += 5;

            let teaser = '';
            for (const line of section.content.split('\n')) {
                if (line.trim() && !line.startsWith('-') && !line.startsWith('*') && !line.includes('Sources:') && !line.includes('To know more')) {
                    const cleanLine = cleanMarkdownForNewsreel(line);
                    const dotSplit = cleanLine.split('. ');
                    teaser = dotSplit[0] + (dotSplit.length > 1 ? '.' : '...');
                    break;
                }
            }
            if (teaser) {
                pdf.setFont('helvetica', 'italic');
                pdf.setFontSize(10);
                pdf.setTextColor(80, 80, 80);
                const teaserLines = pdf.splitTextToSize(teaser, contentWidth - 15);
                for (const tl of teaserLines) {
                    if (yPosition > pageHeight - 20) { pdf.addPage(); yPosition = 20; }
                    pdf.text(tl, margin + 10, yPosition);
                    yPosition += 4.5;
                }
                yPosition += 2;
            }
        }
        yPosition += 10;

        // ---- RENDER SECTIONS ----
        for (let idx = 0; idx < sections.length; idx++) {
            const section = sections[idx];
            
            if (yPosition > pageHeight - 40) {
                pdf.addPage();
                yPosition = 20;
            }

            // Bold colored header bar
            pdf.setFillColor(44, 62, 80); // Charcoal Background
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(14);
            pdf.setTextColor(255, 255, 255);
            const titleLines = pdf.splitTextToSize(section.title, contentWidth - 10);
            const headerHeight = Math.max(12, titleLines.length * 6 + 6);
            pdf.rect(margin, yPosition, contentWidth, headerHeight, 'F');
            let textY = yPosition + 8 + (titleLines.length > 1 ? 2 : 0);
            pdf.text(titleLines, margin + 5, textY);
            yPosition += headerHeight + 8;

            // Extract body vs references
            const bodyParagraphs: string[] = [];
            const references: {text: string, url?: string}[] = [];
            let inRefs = false;

            for (const rawLine of section.content.split('\n')) {
                const line = rawLine.trim();
                if (!line) continue;

                if (line.includes('Sources:') || line.includes('To know more') || line.includes('**Sources') || line.includes('**To know more')) {
                    inRefs = true;
                    continue;
                }
                
                if (inRefs) {
                    if (line.startsWith('-')) {
                        let text = line.substring(1).trim();
                        let url: string | undefined = undefined;
                        const match = text.match(/\[([^\]]+)\]\(([^\)]+)\)/);
                        if (match) {
                            text = match[1];
                            url = match[2];
                        } else {
                            text = cleanMarkdownForNewsreel(text);
                        }
                        references.push({ text, url });
                    }
                } else {
                    bodyParagraphs.push(cleanMarkdownForNewsreel(line));
                }
            }

            const paragraphs = bodyParagraphs.join('\n').split('\n\n').filter(p => p.trim());
            const useTwoColumns = paragraphs.length > 2;

            pdf.setFont('times', 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(30, 30, 30);
            const lineHeight = 5;

            // Image Extraction
            let imgWidth = 0;
            let imgHeight = 0;
            let imgData: string | null = null;
            if (section.imageUrl) {
                try {
                    const data = await fetchImageAsBase64(section.imageUrl);
                    if (data) {
                        pdf.getImageProperties(data);
                        imgData = data;
                        imgWidth = 50; // Approx 250px limit equivalent
                    }
                } catch(e) {}
            }

            if (useTwoColumns) {
                const colWidth = (contentWidth - 8) / 2;
                const halfIdx = Math.ceil(paragraphs.length / 2);
                let col1Y = yPosition;
                let col2Y = yPosition;

                if (imgData) {
                    try {
                        const props = pdf.getImageProperties(imgData);
                        const ratio = props.width / props.height;
                        imgHeight = imgWidth / ratio;
                        if (imgHeight > 60) { imgHeight = 60; imgWidth = imgHeight * ratio; }

                        if (col2Y + imgHeight > pageHeight - 30) { pdf.addPage(); col1Y = 20; col2Y = 20; }
                        pdf.addImage(imgData, 'JPEG', margin + colWidth + 8, col2Y, imgWidth, imgHeight);
                        col2Y += imgHeight + 4;
                    } catch(e){}
                }

                for (let i = 0; i < paragraphs.length; i++) {
                    const isCol1 = i < halfIdx;
                    let currY = isCol1 ? col1Y : col2Y;
                    const lines = pdf.splitTextToSize(paragraphs[i], colWidth);
                    
                    for (const l of lines) {
                        if (currY > pageHeight - 25) {
                            pdf.addPage();
                            currY = 20;
                            if (isCol1) col2Y = 20; else col1Y = 20;
                        }
                        pdf.text(l, isCol1 ? margin : margin + colWidth + 8, currY);
                        currY += lineHeight;
                    }
                    currY += 3;
                    if (isCol1) col1Y = currY; else col2Y = currY;
                }
                yPosition = Math.max(col1Y, col2Y) + 5;
            } else {
                let imgX = pageWidth - margin - imgWidth;
                let imgY = yPosition;

                if (imgData) {
                    try {
                        const props = pdf.getImageProperties(imgData);
                        const ratio = props.width / props.height;
                        imgHeight = imgWidth / ratio;
                        if (imgHeight > 60) { imgHeight = 60; imgWidth = imgHeight * ratio; }
                        imgX = pageWidth - margin - imgWidth; 
                        if (yPosition + imgHeight > pageHeight - 30) { pdf.addPage(); yPosition = 20; imgY = 20; }
                        pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth, imgHeight);
                    } catch(e){ imgWidth = 0; imgHeight = 0; }
                }

                for (const p of paragraphs) {
                    let textWidth = contentWidth;
                    if (imgWidth > 0 && yPosition < imgY + imgHeight + 2) {
                        textWidth = contentWidth - imgWidth - 5;
                    }
                    
                    const lines = pdf.splitTextToSize(p, textWidth);
                    for (const l of lines) {
                        if (yPosition > pageHeight - 20) {
                            pdf.addPage();
                            yPosition = 20;
                            imgY = -1000;
                        }
                        pdf.text(l, margin, yPosition);
                        yPosition += lineHeight;
                    }
                    yPosition += 3;
                }
                yPosition = Math.max(yPosition, imgY + imgHeight) + 5;
            }

            if (references.length > 0) {
                if (yPosition > pageHeight - 30) { pdf.addPage(); yPosition = 20; }
                pdf.setDrawColor(220, 220, 220);
                pdf.setLineWidth(0.2);
                pdf.line(margin + 15, yPosition, pageWidth - margin - 15, yPosition);
                yPosition += 6;

                pdf.setFont('helvetica', 'italic');
                pdf.setFontSize(9);
                pdf.setTextColor(150, 150, 150);
                pdf.text('References:', margin, yPosition);
                yPosition += 5;

                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(140, 140, 140);
                
                for (const ref of references) {
                    if (yPosition > pageHeight - 20) { pdf.addPage(); yPosition = 20; }
                    const refLines = pdf.splitTextToSize(`• ${ref.text}`, contentWidth - 5);
                    for (const rl of refLines) {
                        if (ref.url && rl === refLines[0]) {
                            pdf.textWithLink(rl, margin + 4, yPosition, { url: ref.url });
                        } else {
                            pdf.text(rl, margin + 4, yPosition);
                        }
                        yPosition += 4;
                    }
                }
                yPosition += 4;
            }

            if (idx < sections.length - 1) {
                yPosition += 4;
                if (yPosition > pageHeight - 20) { pdf.addPage(); yPosition = 20; }
                pdf.setDrawColor(180, 180, 180);
                pdf.setLineWidth(0.3);
                pdf.line(margin, yPosition, pageWidth - margin, yPosition);
                yPosition += 12;
            }
        }

        // Save the PDF
        const filename = `SimonNewsreel_${today.toISOString().split('T')[0]}.pdf`;
        if (Capacitor.isNativePlatform()) {
            try {
                const base64data = pdf.output('datauristring').split(',')[1];
                await Filesystem.writeFile({
                    path: filename,
                    data: base64data,
                    directory: Directory.Documents
                });
                console.log(`PDF saved to Documents folder as ${filename}`);
                alert(`PDF saved to Documents folder as ${filename}`);
            } catch (err) {
                console.error('Failed to save PDF on device:', err);
                throw new Error('Failed to save PDF to Documents folder. Ensure permissions are granted.');
            }
        } else {
            pdf.save(filename);
        }
        console.log('Newsreel PDF generation complete');

    } catch (error) {
        console.error('Newsreel PDF generation failed:', error);
        throw new Error(`Newsreel PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

function parseNewsreelSections(markdown: string): NewsreelSection[] {
    const sections: NewsreelSection[] = [];

    // Split by ## headings
    const parts = markdown.split(/^## /m);

    for (const part of parts) {
        if (!part.trim()) continue;

        const lines = part.split('\n');
        const title = lines[0].trim();
        const content = lines.slice(1).join('\n').trim();

        // Extract source URLs from markdown links
        const urlMatches = content.matchAll(/\]\((https?:\/\/[^\)]+)\)/g);
        const sourceUrls: string[] = [];
        for (const match of urlMatches) {
            sourceUrls.push(match[1]);
        }

        sections.push({
            title,
            content,
            sourceUrls
        });
    }

    return sections;
}

async function extractSectionImages(sections: NewsreelSection[], articles: Article[]): Promise<void> {
    // Create a map of article URLs to articles for quick lookup
    const articleMap = new Map<string, Article>();
    for (const article of articles) {
        articleMap.set(article.link, article);
    }

    for (const section of sections) {
        // Try to find an image from the first source URL in this section
        for (const url of section.sourceUrls) {
            const article = articleMap.get(url);
            if (article) {
                // Try to extract image from article
                const imageUrl = await extractImageForArticle(article);
                if (imageUrl) {
                    section.imageUrl = imageUrl;
                    break;
                }
            }
        }

        // If no image found from articles, try to fetch from the first source URL directly
        if (!section.imageUrl && section.sourceUrls.length > 0) {
            try {
                const html = await fetchArticleHTML(section.sourceUrls[0]);
                if (html) {
                    const imageUrl = extractMainImageFromHTML(html, section.sourceUrls[0]);
                    if (imageUrl) {
                        section.imageUrl = imageUrl;
                    }
                }
            } catch (e) {
                console.warn('Failed to extract image from URL:', section.sourceUrls[0]);
            }
        }
    }
}

async function extractImageForArticle(article: Article): Promise<string | null> {
    // First check if article has an image in its content
    if (article.content) {
        const imgMatch = article.content.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (imgMatch) {
            return resolveImageUrl(imgMatch[1], article.link);
        }
    }

    // Try to fetch the article page and extract image
    try {
        const html = await fetchArticleHTML(article.link);
        if (html) {
            return extractMainImageFromHTML(html, article.link);
        }
    } catch (e) {
        console.warn('Failed to fetch article for image:', article.link);
    }

    return null;
}

async function fetchArticleHTML(url: string): Promise<string | null> {
    try {
        const ipcRenderer = (window as any).ipcRenderer;
        if (ipcRenderer) {
            const result = await ipcRenderer.invoke('fetch-url', url);
            if (result.success) {
                return result.content;
            }
        }

        // Fallback to direct fetch
        const response = await fetch(url);
        return await response.text();
    } catch (e) {
        return null;
    }
}


