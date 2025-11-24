import jsPDF from 'jspdf';
import { Article, AppSettings } from './types';

interface RankedArticle {
    article: Article;
    importance: number;
    summary: string;
    imageUrl?: string;
    language?: string;
}

export async function generateNewspaperPDF(
    articles: Article[],
    settings: AppSettings
): Promise<void> {
    try {
        // Step 1: Rank articles by importance
        const rankedArticles = await rankArticlesByImportance(articles, settings);

        // Step 2: Extract images from articles
        await extractArticleImages(rankedArticles);

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
        yPosition = await layoutNewspaperArticles(pdf, rankedArticles, margin, contentWidth, yPosition, pageHeight, targetLanguage);

        // Save the PDF
        const filename = `SimonDailyNews_${today.toISOString().split('T')[0]}.pdf`;
        pdf.save(filename);
    } catch (error) {
        console.error('PDF generation failed:', error);
        throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

            // Track the tallest article in this row
            const articleBottom = yPosition + articleHeight;
            if (articleBottom > rowMaxY) {
                rowMaxY = articleBottom;
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
    let currentY = yPosition;

    // Check if we need a new page before starting
    if (currentY > pageHeight - 100) {
        pdf.addPage();
        currentY = 20;
    }

    // Title (large, bold, NYT-style, Serif)
    pdf.setFont('times', 'bold');
    pdf.setFontSize(22); // Slightly larger for serif
    pdf.setTextColor(0, 0, 0);

    const titleLines = pdf.splitTextToSize(article.title, contentWidth);

    // Make title clickable
    const titleHeight = titleLines.length * 9;
    pdf.textWithLink(titleLines.join('\n'), margin, currentY, {
        url: article.link
    });
    currentY += titleHeight + 3;

    // Language indicator (if different from target)
    if (ranked.language && ranked.language.toLowerCase() !== targetLanguage.toLowerCase()) {
        pdf.setFont('helvetica', 'italic'); // Keep metadata sans-serif
        pdf.setFontSize(9);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`(original article in ${ranked.language})`, margin, currentY);
        currentY += 5;
    }

    // Embed actual image if available with aspect ratio preservation
    if (ranked.imageUrl) {
        try {
            // Get image dimensions to preserve aspect ratio
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Enable CORS
            img.src = ranked.imageUrl;

            // Wait for image to load with timeout
            const imageLoaded = await Promise.race([
                new Promise<boolean>((resolve) => {
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                }),
                new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)) // 3 second timeout
            ]);

            if (imageLoaded && img.width && img.height && img.complete) {
                const maxWidth = contentWidth;
                const maxHeight = 70;
                const aspectRatio = img.width / img.height;

                let imageWidth = maxWidth;
                let imageHeight = maxWidth / aspectRatio;

                // If height exceeds max, scale down
                if (imageHeight > maxHeight) {
                    imageHeight = maxHeight;
                    imageWidth = maxHeight * aspectRatio;
                }

                // Check if image fits on current page
                if (currentY + imageHeight + 10 > pageHeight - 20) {
                    pdf.addPage();
                    currentY = 20;
                }

                // Center image if it's narrower than max width
                const xOffset = margin + (maxWidth - imageWidth) / 2;

                // Try to add image, catch any jsPDF errors
                try {
                    pdf.addImage(ranked.imageUrl, 'JPEG', xOffset, currentY, imageWidth, imageHeight);
                    currentY += imageHeight + 5;

                    // Image caption
                    pdf.setFont('helvetica', 'italic'); // Metadata sans-serif
                    pdf.setFontSize(8);
                    pdf.setTextColor(120, 120, 120);
                    const caption = `Source: ${new URL(article.link).hostname}`;
                    pdf.text(caption, margin, currentY);
                    currentY += 5;
                } catch (pdfError) {
                    console.error('Failed to add image to PDF:', pdfError);
                    // Continue without image
                }
            } else {
                console.log('Image failed to load or timed out:', ranked.imageUrl);
            }
        } catch (error) {
            console.error('Failed to process image:', error);
        }
    }

    // Summary (3 paragraphs, NYT-style, Serif)
    pdf.setFont('times', 'roman'); // 'roman' is normal for Times
    const fontSize = 11; // Slightly larger for readability
    pdf.setFontSize(fontSize);
    pdf.setTextColor(30, 30, 30);

    const paragraphs = ranked.summary.split('\n\n');
    const lineHeight = fontSize * 0.3527; // Convert pt to mm (1pt = 0.3527mm)
    const lineSpacing = 1.4; // Line spacing multiplier

    for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
            const paragraphLines = pdf.splitTextToSize(paragraph.trim(), contentWidth);
            const paragraphHeight = paragraphLines.length * lineHeight * lineSpacing + 3;

            // Check if paragraph fits on current page
            if (currentY + paragraphHeight > pageHeight - 20) {
                pdf.addPage();
                currentY = 20;
            }

            // Render each line with proper spacing
            for (let i = 0; i < paragraphLines.length; i++) {
                pdf.text(paragraphLines[i], margin, currentY);
                currentY += lineHeight * lineSpacing;
            }
            currentY += 3; // Extra space between paragraphs
        }
    }

    currentY += 5;

    // Thin separator line (NYT-style)
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
    let localY = yPosition;
    const bottomMargin = 20;

    // Title (medium, bold, NYT-style, Serif)
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);

    const titleLines = pdf.splitTextToSize(article.title, columnWidth);
    const titleHeight = titleLines.length * 6;

    // Check if title fits
    if (localY + titleHeight > pageHeight - bottomMargin) {
        return localY - yPosition; // Stop rendering if no space
    }

    pdf.textWithLink(titleLines.join('\n'), xPosition, localY, {
        url: article.link
    });
    localY += titleHeight + 2;

    // Language indicator (if different from target)
    if (ranked.language && ranked.language.toLowerCase() !== targetLanguage.toLowerCase()) {
        pdf.setFont('helvetica', 'italic'); // Metadata sans-serif
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`(original in ${ranked.language})`, xPosition, localY);
        localY += 3;
    }

    // Embed actual image if available with aspect ratio preservation
    if (ranked.imageUrl) {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = ranked.imageUrl;

            const imageLoaded = await Promise.race([
                new Promise<boolean>((resolve) => {
                    img.onload = () => resolve(true);
                    img.onerror = () => resolve(false);
                }),
                new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000))
            ]);

            if (imageLoaded && img.width && img.height && img.complete) {
                const maxWidth = columnWidth;
                const maxHeight = 40;
                const aspectRatio = img.width / img.height;

                let imageWidth = maxWidth;
                let imageHeight = maxWidth / aspectRatio;

                // If height exceeds max, scale down
                if (imageHeight > maxHeight) {
                    imageHeight = maxHeight;
                    imageWidth = maxHeight * aspectRatio;
                }

                // Center image if narrower than column
                const xOffset = xPosition + (maxWidth - imageWidth) / 2;

                // Check if image fits
                if (localY + imageHeight < pageHeight - bottomMargin) {
                    try {
                        pdf.addImage(ranked.imageUrl, 'JPEG', xOffset, localY, imageWidth, imageHeight);
                        localY += imageHeight + 3;
                    } catch (pdfError) {
                        console.error('Failed to add column image to PDF:', pdfError);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to process column image:', error);
        }
    }

    // Summary (3 paragraphs, condensed for column, Serif)
    pdf.setFont('times', 'roman');
    const fontSize = 10;
    pdf.setFontSize(fontSize);
    pdf.setTextColor(40, 40, 40);

    const paragraphs = ranked.summary.split('\n\n');
    const maxParagraphs = 3;
    const displayParagraphs = paragraphs.slice(0, maxParagraphs);
    const lineHeight = fontSize * 0.3527; // Convert pt to mm
    const lineSpacing = 1.4; // Slightly tighter for columns

    for (const paragraph of displayParagraphs) {
        if (paragraph.trim()) {
            const paragraphLines = pdf.splitTextToSize(paragraph.trim(), columnWidth);
            const maxLines = 4;
            const displayLines = paragraphLines.slice(0, maxLines);

            // Check if paragraph fits
            const paragraphHeight = displayLines.length * lineHeight * lineSpacing;
            if (localY + paragraphHeight > pageHeight - bottomMargin) {
                break; // Stop rendering paragraphs if we run out of space
            }

            // Render each line with proper spacing
            for (let i = 0; i < displayLines.length; i++) {
                pdf.text(displayLines[i], xPosition, localY);
                localY += lineHeight * lineSpacing;
            }
            localY += 2; // Space between paragraphs
        }
    }

    localY += 3;

    return localY - yPosition;
}

async function rankArticlesByImportance(
    articles: Article[],
    settings: AppSettings
): Promise<RankedArticle[]> {
    const provider = settings.aiProvider || 'gemini';
    const apiKey = provider === 'gemini' ? settings.geminiApiKey :
        provider === 'openai' ? settings.openaiApiKey :
            settings.claudeApiKey;

    const targetLanguage = settings.summaryLanguage || 'English';

    if (!apiKey) {
        // Fallback: rank by date
        return articles.map(article => ({
            article,
            importance: article.pubDate ? new Date(article.pubDate).getTime() : 0,
            summary: article.contentSnippet || article.content?.slice(0, 200) || 'No summary available.',
            language: undefined
        })).sort((a, b) => b.importance - a.importance);
    }

    try {
        // Use AI to rank articles
        const articlesInfo = articles.map((a, i) =>
            `${i + 1}. ${a.title}\n   ${a.contentSnippet || a.content?.slice(0, 150) || ''}`
        ).join('\n\n');

        const prompt = `Analyze these ${articles.length} news articles and rank them by importance (1-10 scale, 10 being most important). Consider factors like: impact, timeliness, relevance, and newsworthiness.

For each article:
1. Assign an importance score (1-10)
2. Provide a 3-paragraph summary in ${targetLanguage} (each paragraph should be 2-3 sentences, covering: main story, context/background, and implications/significance)
3. Detect the original language of the article

Articles:
${articlesInfo}

Respond in JSON format:
{
  "rankings": [
    {
      "index": 0,
      "importance": 8,
      "summary": "Paragraph 1: Main story details...\\n\\nParagraph 2: Background and context...\\n\\nParagraph 3: Implications and significance...",
      "language": "English" (or "Italian", "Spanish", etc.)
    },
    ...
  ]
}`;

        let response;
        if (provider === 'gemini') {
            const model = settings.geminiModel || 'gemini-1.5-flash';
            response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            const result = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');

            return result.rankings.map((r: any) => ({
                article: articles[r.index],
                importance: r.importance,
                summary: r.summary,
                language: r.language
            })).sort((a: RankedArticle, b: RankedArticle) => b.importance - a.importance);
        } else if (provider === 'openai') {
            const model = settings.openaiModel || 'gpt-4o-mini';
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' }
                })
            });
            const data = await response.json();
            const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');

            return result.rankings.map((r: any) => ({
                article: articles[r.index],
                importance: r.importance,
                summary: r.summary,
                language: r.language
            })).sort((a: RankedArticle, b: RankedArticle) => b.importance - a.importance);
        }
    } catch (error) {
        console.error('AI ranking failed, using fallback:', error);
    }

    // Fallback ranking
    return articles.map(article => ({
        article,
        importance: article.pubDate ? new Date(article.pubDate).getTime() : 0,
        summary: article.contentSnippet || article.content?.slice(0, 200) || 'No summary available.',
        language: undefined
    })).sort((a, b) => b.importance - a.importance);
}

async function extractArticleImages(rankedArticles: RankedArticle[]): Promise<void> {
    // For each article, try to extract and fetch the first image from the web page
    for (const ranked of rankedArticles) {
        const article = ranked.article;

        try {
            // First try to get image from RSS content
            const content = article.content || '';
            const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);

            if (imgMatch && imgMatch[1]) {
                const imageUrl = imgMatch[1];
                // Try to fetch and convert image to base64
                const base64Image = await fetchImageAsBase64(imageUrl);
                if (base64Image) {
                    ranked.imageUrl = base64Image;
                    continue;
                }
            }

            // If no image in RSS, try fetching from the article URL
            if (article.link) {
                const response = await fetch(article.link);
                const html = await response.text();

                // Try multiple strategies to find the main image
                const imageUrl = extractMainImageFromHTML(html, article.link);

                if (imageUrl) {
                    const base64Image = await fetchImageAsBase64(imageUrl);
                    if (base64Image) {
                        ranked.imageUrl = base64Image;
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to extract image for article: ${article.title}`, error);
            // Continue without image
        }
    }
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

        const blob = await response.blob();

        // Convert blob to base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Failed to fetch image:', imageUrl, error);
        return null;
    }
}
