/**
 * Sanitizes markdown content for Text-to-Speech (TTS) audio playback.
 * 
 * Removes:
 * - "To know more" / "Per saperne di più" related articles blocks
 * - Source reference links at the end of stories
 * - Raw URLs (http/https/www)
 * - Markdown image tags
 * - Markdown link formatting (keeping only the anchor text)
 * - Markdown structural formatting (headings, asterisks, bullets, dividers, blockquotes)
 * 
 * Preserves the actual prose and readable text for smooth, natural voice reading.
 */
export function cleanTextForTTS(markdown: string): string {
    if (!markdown) return '';

    let text = markdown;

    // 1. Remove "To know more" / "Per saperne di più" / "Per approfondire" sections
    // and all their bullet lists until the next section heading (## or #) or divider or EOF
    text = text.replace(
        /(?:\n|^)[ \t]*(?:\*\*|#{1,3}\s*|\b)(?:To know more|Per saperne di più|Per approfondire|Related articles|Related stories|Articoli correlati)[:\s*]*[\s\S]*?(?=(?:\n[ \t]*#{1,3}\s|\n[ \t]*---|\n[ \t]*\*\*\*|$))/gi,
        '\n'
    );

    // 2. Remove source attribution lines at the end of stories (e.g. "- [Source](url)" or "Source: [Source](url)")
    text = text.replace(/^\s*[-*•]?\s*(?:Source|Fonte|Origine|Riferimento)?[:\s]*\[[^\]\n]+\]\(https?:\/\/[^\s\)\n]+\)\s*$/gim, '');
    text = text.replace(/^\s*[-*•]?\s*(?:Source|Fonte|Origine|Riferimento)?[:\s]*https?:\/\/[^\s\)\n]+\s*$/gim, '');

    // 3. Remove leftover SEARCH_QUERY instructions if any leaked
    text = text.replace(/^\s*SEARCH_QUERY:.*$/gim, '');

    // 4. Remove markdown images: ![alt](url) -> empty
    text = text.replace(/!\[[^\]]*\]\([^\)]+\)/g, '');

    // 5. Convert markdown links into their plain anchor text: [Anchor](url) -> Anchor
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // 6. Remove any remaining raw URLs (http://..., https://..., www....)
    text = text.replace(/(?:https?:\/\/|www\.)[^\s\)]+/gi, '');

    // 7. Strip HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // 8. Clean markdown formatting syntax
    text = text
        .replace(/^#{1,6}\s+/gm, '')       // Heading marks (#, ##, etc.)
        .replace(/[*_~`]/g, '')            // Bold, italics, strikethrough, backticks
        .replace(/^\s*[-*•]\s+/gm, '')     // List bullet symbols
        .replace(/^\s*>\s+/gm, '')         // Blockquote markers
        .replace(/---+|\*\*\*+/g, '');     // Horizontal lines

    // 9. Normalize multiple spaces and whitespace
    return text.replace(/\s+/g, ' ').trim();
}
