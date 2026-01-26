import { AppSettings } from '../types';

export interface FactCheckResult {
    claim: string;
    rating: 'likely-true' | 'needs-context' | 'unverifiable' | 'likely-misleading';
    explanation: string;
    confidence: number; // 0-1
    sources?: { index: number, domain: string, url: string, title: string }[];
}


export interface ArticleFactCheck {
    articleId: string;
    overallRating: 'reliable' | 'mostly-reliable' | 'mixed' | 'caution';
    claims: FactCheckResult[];
    summary: string;
    checkedAt: string;
}

const STORAGE_KEY = 'fact_check_cache';

/**
 * Service for AI-powered fact-checking of article claims.
 * Uses the configured AI provider to analyze claims.
 */
export class FactCheckService {
    private static cache: Map<string, ArticleFactCheck> = new Map();
    private static loaded = false;

    /**
     * Load cache from storage
     */
    private static loadCache(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const arr: ArticleFactCheck[] = JSON.parse(stored);
                this.cache = new Map(arr.map(fc => [fc.articleId, fc]));
            }
            this.loaded = true;
        } catch (e) {
            console.error('Failed to load fact-check cache:', e);
        }
    }

    /**
     * Save cache to storage
     */
    private static saveCache(): void {
        try {
            // Keep only last 100 entries
            const arr = Array.from(this.cache.values()).slice(-100);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch (e) {
            console.error('Failed to save fact-check cache:', e);
        }
    }

    /**
     * Get cached fact-check for an article
     */
    static getCached(articleId: string): ArticleFactCheck | null {
        if (!this.loaded) this.loadCache();
        return this.cache.get(articleId) || null;
    }

    /**
     * Check an article for factual claims with external verification
     */
    static async checkArticle(
        articleId: string,
        title: string,
        content: string,
        settings: AppSettings
    ): Promise<ArticleFactCheck> {
        if (!this.loaded) this.loadCache();

        // Check cache first
        const cached = this.cache.get(articleId);
        if (cached) return cached;

        try {
            // Step 1: Analyze Article & Extract Claims
            console.log('FactCheck: Starting analysis for', articleId);
            const analysisPrompt = this.buildAnalysisPrompt(title, content);
            const analysisResponse = await this.callAI(analysisPrompt, settings);
            const initialResult = this.parseAnalysisResponse(analysisResponse);

            // Step 2: Verify Claims with External Search
            const verifiedClaims: FactCheckResult[] = [];

            // Limit to top 3 claims to save time/resources
            const claimsToVerify = initialResult.claims.slice(0, 3);

            for (const claim of claimsToVerify) {
                if (!claim.rating.includes('unverifiable') && claim.searchQuery) {
                    console.log(`FactCheck: Verifying claim "${claim.claim}" with query: "${claim.searchQuery}"`);

                    try {
                        // Perform search
                        const searchResults = await this.performSearch(claim.searchQuery);

                        if (searchResults.length > 0) {
                            // Verify against search results
                            const verificationPrompt = this.buildVerificationPrompt(claim, searchResults);
                            const verificationResponse = await this.callAI(verificationPrompt, settings);
                            const verifiedClaim = this.parseVerificationResponse(claim, verificationResponse, searchResults);
                            verifiedClaims.push(verifiedClaim);
                        } else {
                            verifiedClaims.push(claim);
                        }
                    } catch (err) {
                        console.error('FactCheck: specific claim verification failed', err);
                        verifiedClaims.push(claim);
                    }
                } else {
                    verifiedClaims.push(claim);
                }
            }

            // Combine results
            const finalResult: ArticleFactCheck = {
                articleId,
                overallRating: initialResult.overallRating, // Keep overall rating from initial analysis (or recalculate based on verified claims)
                claims: verifiedClaims,
                summary: initialResult.summary,
                checkedAt: new Date().toISOString()
            };

            // Cache the result
            this.cache.set(articleId, finalResult);
            this.saveCache();

            return finalResult;

        } catch (error) {
            console.error('Fact-check failed:', error);

            // Return a default result on error
            return {
                articleId,
                overallRating: 'mixed',
                claims: [],
                summary: 'Unable to perform fact-check. Please verify claims independently.',
                checkedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Perform web search using Electron IPC
     */
    private static async performSearch(query: string): Promise<{ title: string, url: string, snippet: string }[]> {
        // Check if running in Electron
        if ((window as any).ipcRenderer) {
            try {
                const results = await (window as any).ipcRenderer.invoke('perform-search', query);
                // Parse if string, otherwise assume object
                return typeof results === 'string' ? JSON.parse(results) : results;
            } catch (e) {
                console.error('Search failed:', e);
                return [];
            }
        }
        return [];
    }

    /**
     * Build the initial analysis prompt
     */
    private static buildAnalysisPrompt(title: string, content: string): string {
        // Truncate content if too long
        const maxContent = 3000;
        const truncatedContent = content.length > maxContent
            ? content.substring(0, maxContent) + '...'
            : content;

        return `Analyze the following article for factual accuracy. Identify key verifiable claims.
For each claim, provide a search query that could be used to verify it.

Article Title: ${title}

Article Content:
${truncatedContent}

Please respond in the following JSON format:
{
  "overallRating": "reliable" | "mostly-reliable" | "mixed" | "caution",
  "claims": [
    {
      "claim": "The specific claim made",
      "rating": "likely-true" | "needs-context" | "unverifiable" | "likely-misleading",
      "explanation": "Brief explanation based on internal knowledge",
      "confidence": 0.8,
      "searchQuery": "Specific search query to verify this claim"
    }
  ],
  "summary": "A one-sentence summary of the factual reliability of this article"
}

Focus on 3 key verifiable factual claims.`;
    }

    /**
     * Build validation prompt using search results
     */
    private static buildVerificationPrompt(claim: FactCheckResult, searchResults: { title: string, snippet: string, url: string }[]): string {
        const sourcesText = searchResults.map((s, i) =>
            `Source ${i + 1}: ${s.title}\nSnippet: ${s.snippet}\n`
        ).join('\n');

        return `Verify the following claim against the provided external sources.
        
Claim: "${claim.claim}"

External Sources:
${sourcesText}

Based on these sources, re-evaluate the claim.
Respond in JSON:
{
    "rating": "likely-true" | "needs-context" | "unverifiable" | "likely-misleading",
    "explanation": "Updated explanation citing the sources if relevant",
    "confidence": 0.9,
    "supportedBySources": true/false
}`;
    }

    private static parseAnalysisResponse(response: string): any {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found');
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('Failed to parse analysis response', e);
            return { overallRating: 'mixed', claims: [], summary: 'Analysis failed' };
        }
    }

    private static parseVerificationResponse(originalClaim: FactCheckResult, response: string, sources: any[]): FactCheckResult {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return originalClaim;

            const verified = JSON.parse(jsonMatch[0]);

            // Map all sources to structured objects with index
            const structuredSources = sources.map((s, i) => {
                try {
                    return {
                        index: i + 1,
                        domain: new URL(s.url).hostname.replace('www.', ''),
                        url: s.url,
                        title: s.title
                    };
                } catch {
                    return { index: i + 1, domain: 'External Source', url: s.url, title: s.title };
                }
            });

            return {
                ...originalClaim,
                rating: verified.rating || originalClaim.rating,
                explanation: verified.explanation || originalClaim.explanation,
                confidence: verified.confidence || originalClaim.confidence,
                sources: structuredSources
            };
        } catch (e) {
            return originalClaim;
        }
    }

    /**
     * Call the AI provider
     */
    private static async callAI(prompt: string, settings: AppSettings): Promise<string> {
        const provider = settings.aiProvider || 'gemini';

        switch (provider) {
            case 'gemini':
                return this.callGemini(prompt, settings);
            case 'openai':
                return this.callOpenAI(prompt, settings);
            case 'claude':
                return this.callClaude(prompt, settings);
            case 'ollama':
                return this.callOllama(prompt, settings);
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }
    }

    private static async callGemini(prompt: string, settings: AppSettings): Promise<string> {
        const apiKey = settings.geminiApiKey;
        if (!apiKey) throw new Error('Gemini API key not configured');

        const model = settings.geminiModel || 'gemini-1.5-flash';
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 1024
                    }
                })
            }
        );

        if (!response.ok) throw new Error('Gemini API request failed');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    private static async callOpenAI(prompt: string, settings: AppSettings): Promise<string> {
        const apiKey = settings.openaiApiKey;
        if (!apiKey) throw new Error('OpenAI API key not configured');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: settings.openaiModel || 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 1024
            })
        });

        if (!response.ok) throw new Error('OpenAI API request failed');
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    private static async callClaude(_prompt: string, settings: AppSettings): Promise<string> {
        const apiKey = settings.claudeApiKey;
        if (!apiKey) throw new Error('Claude API key not configured');

        // Note: Claude API requires proxy due to CORS
        throw new Error('Claude fact-check requires Electron. Use Gemini or OpenAI for web.');
    }

    private static async callOllama(prompt: string, settings: AppSettings): Promise<string> {
        const baseUrl = settings.ollamaUrl || 'http://localhost:11434';
        const model = settings.ollamaModel || 'llama3';

        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false,
                options: { temperature: 0.3 }
            })
        });

        if (!response.ok) throw new Error('Ollama request failed');
        const data = await response.json();
        return data.response || '';
    }

    /**
     * Get rating color for display
     */
    static getRatingColor(rating: string): string {
        switch (rating) {
            case 'reliable':
            case 'likely-true':
                return '#22c55e';
            case 'mostly-reliable':
            case 'needs-context':
                return '#f59e0b';
            case 'mixed':
            case 'unverifiable':
                return '#94a3b8';
            case 'caution':
            case 'likely-misleading':
                return '#ef4444';
            default:
                return '#94a3b8';
        }
    }

    /**
     * Get rating label for display
     */
    static getRatingLabel(rating: string): string {
        switch (rating) {
            case 'reliable':
                return 'Reliable';
            case 'mostly-reliable':
                return 'Mostly Reliable';
            case 'mixed':
                return 'Mixed';
            case 'caution':
                return 'Use Caution';
            case 'likely-true':
                return 'Likely True';
            case 'needs-context':
                return 'Needs Context';
            case 'unverifiable':
                return 'Unverifiable';
            case 'likely-misleading':
                return 'Potentially Misleading';
            default:
                return rating;
        }
    }
}
