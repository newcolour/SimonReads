import { Article } from '../types';

const STOP_WORDS = new Set([
    'about', 'above', 'after', 'again', 'against', 'all', 'almost', 'also', 'although',
    'always', 'among', 'another', 'any', 'anyone', 'anything', 'around', 'because',
    'been', 'before', 'being', 'between', 'both', 'business', 'could', 'daily', 'does',
    'doing', 'down', 'during', 'each', 'even', 'every', 'everyone', 'everything', 'first',
    'from', 'further', 'give', 'gives', 'going', 'good', 'great', 'have', 'having',
    'here', 'into', 'just', 'know', 'last', 'like', 'look', 'make', 'many', 'more',
    'most', 'much', 'must', 'never', 'news', 'next', 'only', 'other', 'over', 'people',
    'report', 'reports', 'said', 'same', 'says', 'should', 'since', 'some', 'still',
    'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'thing',
    'things', 'think', 'this', 'those', 'through', 'time', 'today', 'under', 'very',
    'week', 'well', 'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with',
    'would', 'year', 'years', 'yesterday'
]);

const HIGH_IMPACT_KEYWORDS = new Set([
    'alert', 'announces', 'agreement', 'assassinated', 'attack', 'authorities', 'bailout',
    'bankrupt', 'breaking', 'breakthrough', 'catastrophe', 'ceasefire', 'claims', 'collapse',
    'confirmed', 'convicted', 'crash', 'crisis', 'deadly', 'death', 'declares', 'devastating',
    'disaster', 'discovery', 'earthquake', 'election', 'emergency', 'erupts', 'escalates',
    'evacuation', 'explosion', 'fatal', 'fda', 'federal', 'fire', 'flood', 'fraud', 'guidance',
    'historic', 'hostage', 'hurricane', 'impeachment', 'indicted', 'inflation', 'injuries',
    'investigation', 'killed', 'landmark', 'launch', 'launches', 'lawsuit', 'legislation',
    'mandate', 'market', 'massacre', 'merger', 'missile', 'nations', 'outbreak', 'pandemic',
    'passed', 'pentagon', 'pipeline', 'plunge', 'plunges', 'policy', 'protest', 'quake',
    'recall', 'recession', 'record', 'regulation', 'resigns', 'revolution', 'ruling', 'sanctions',
    'scandal', 'sentence', 'shutdown', 'spacex', 'strikes', 'supreme', 'surge', 'target',
    'threat', 'tragedy', 'treaty', 'tsunami', 'ukraine', 'unprecedented', 'unveils', 'verdict',
    'veto', 'virus', 'vote', 'votes', 'warning', 'war'
]);

/**
 * Extracts normalized, lowercase keywords from a headline, filtering out common stop words.
 */
function extractTitleKeywords(title: string): string[] {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

/**
 * Evaluates candidate articles and sorts them by an algorithmic heuristic priority score:
 * - Cross-feed topic clustering (coverage across multiple feeds/sources)
 * - Recency decay (fresher within the time window scores higher)
 * - High-impact editorial keywords (crisis, landmark, breakthrough, etc.)
 * - Content substance (rich full text vs empty teasers)
 * - User engagement (saved/bookmarked articles)
 */
export function scoreAndSortArticles(articles: Article[]): Article[] {
    if (articles.length <= 1) return [...articles];

    const now = Date.now();

    // 1. Build word frequency & cross-feed occurrence maps for cluster detection
    const wordFeedMap = new Map<string, Set<string>>();
    for (const article of articles) {
        const keywords = extractTitleKeywords(article.title || '');
        const feedKey = article.feedId || article.feedTitle || 'unknown';
        for (const word of keywords) {
            if (!wordFeedMap.has(word)) {
                wordFeedMap.set(word, new Set());
            }
            wordFeedMap.get(word)!.add(feedKey);
        }
    }

    // Identify words that appear across multiple feeds/sources (indicator of major developing news)
    const multiFeedWords = new Set<string>();
    wordFeedMap.forEach((feeds, word) => {
        if (feeds.size >= 2) {
            multiFeedWords.add(word);
        }
    });

    // 2. Compute individual article scores
    const scored = articles.map(article => {
        let score = 0;
        const keywords = extractTitleKeywords(article.title || '');

        // A. Cross-feed Cluster Boost (0 - 40 pts)
        let clusterMatches = 0;
        for (const word of keywords) {
            if (multiFeedWords.has(word)) {
                clusterMatches++;
            }
        }
        score += Math.min(40, clusterMatches * 15);

        // B. Recency Decay (0 - 30 pts)
        if (article.pubDate) {
            const pubTime = new Date(article.pubDate).getTime();
            const hoursAgo = Math.max(0, (now - pubTime) / (1000 * 60 * 60));
            // Halves roughly every 14 hours within a 24h cycle
            score += Math.max(0, 30 * Math.exp(-0.05 * hoursAgo));
        } else {
            score += 10;
        }

        // C. Editorial Impact Keywords (0 - 20 pts)
        let impactMatches = 0;
        for (const word of keywords) {
            if (HIGH_IMPACT_KEYWORDS.has(word)) {
                impactMatches++;
            }
        }
        score += Math.min(20, impactMatches * 10);

        // D. Content Substance (0 - 10 pts)
        const contentLength = (article.content || article.contentSnippet || '').length;
        score += Math.min(10, Math.floor(contentLength / 200));

        // E. User Favorite / Saved Boost (+5 pts)
        if (article.isSaved) {
            score += 5;
        }

        return { article, score };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    console.log(`📊 Pre-ranked ${articles.length} newsreel articles by heuristic importance:`,
        scored.slice(0, 5).map(s => `[${s.score.toFixed(1)}] ${s.article.title.slice(0, 50)}...`)
    );

    return scored.map(s => s.article);
}

/**
 * Builds an editorial prompt instructing the LLM to divide the digest into distinct thematic
 * sections (e.g., Politics & World, Technology & Science, Business & Finance, Sports, Culture & Entertainment, etc.),
 * and evaluate & rank stories by importance RELATIVE TO THEIR OWN DOMAIN so that non-political domains
 * are not penalized. Within each section, stories are ordered from highest score to lowest score.
 */
export function buildSectionedNewsreelPrompt(
    articlesCount: number,
    targetLanguage: string
): string {
    return `You are an executive editor-in-chief compiling an authoritative, multi-section daily newspaper digest in ${targetLanguage}.

EDITORIAL ASSIGNMENT:
Organize the following ${articlesCount} news stories into distinct, natural thematic SECTIONS based on the content of the stories (for example: "🏛️ Politics & World", "💻 Technology & Science", "📈 Business & Finance", "⚽ Sports", "🎭 Culture & Entertainment", "🌿 Health & Environment", "🔬 Science & Space").
Only create sections that actually have stories from the provided material.

DOMAIN-RELATIVE IMPORTANCE SCORING:
Within EACH section, evaluate and score each story on an objective 1.0 to 10.0 Importance Scale RELATIVE TO ITS OWN DOMAIN:
- CRITICAL: Do NOT penalize non-political domains. A major sports championship or a breakthrough tech product must be judged against other sports or tech news, NOT against wars or elections.
- In Sports: A world championship final, major tournament victory, or historic record is 9.0-10.0; a routine match or player signing is 5.0-6.5.
- In Technology & Science: A major breakthrough (e.g. quantum milestone, revolutionary AI paradigm, zero-day threat) is 9.0-10.0; a minor app feature update is 5.0-6.5.
- In Business & Finance: A monumental central bank rate decision, mega-merger, or market shock is 9.0-10.0; routine quarterly earnings are 5.0-6.5.
- In Politics & World: A major treaty, election outcome, or diplomatic crisis is 9.0-10.0; routine parliamentary remarks are 5.0-6.5.

STRICT FORMATTING & ORDERING REQUIREMENTS:
1. SECTION HEADINGS (Level-1 Markdown):
   Each thematic category must start with a level-1 heading with an emoji:
   # [Emoji] [Section Name]
   (e.g., "# 🏛️ Politics & World", "# 💻 Technology & Science", "# ⚽ Sports", etc.)

2. WITHIN-SECTION ORDERING:
   Within EACH section, you MUST order the stories strictly from HIGHEST domain importance score to LOWEST. The most important story in that section MUST appear first as that section's lead story.

3. STORY HEADINGS (Level-2 Markdown):
   Each individual story within a section must start with its own level-2 heading:
   ## [Compelling Story Title]

4. IMPORTANCE BADGE:
   Immediately beneath each story heading, include the score and a one-sentence editorial justification on a single line:
   **Importance Score:** [Score]/10 • [Brief explanation of significance within this domain]

5. FULL STORY:
   Provide a rich, thorough body text of at least 2-3 detailed paragraphs for EACH story explaining the event, context/background, and its broader implications. Do NOT include inline links inside the body paragraphs.

6. SOURCE:
   At the END of each story section, list the Source as a bullet point with a markdown link:
   - [Source Name (Translated)](URL)

7. SEARCH QUERY:
   Immediately after the source, include:
   SEARCH_QUERY: <3-5 word search query for this story>

8. COMPLETE COVERAGE:
   Include ALL ${articlesCount} stories from the source material. Every story must be classified into its most appropriate section. Translate all output to ${targetLanguage}.

Begin directly with the first section:`;
}

export const buildNewsreelScoringPrompt = buildSectionedNewsreelPrompt;

