import { AppSettings } from '../types';

export interface FactCheckResult {
    claim: string;
    rating: 'likely-true' | 'needs-context' | 'unverifiable' | 'likely-misleading';
    explanation: string;
    confidence: number; // 0-1
    sources?: string[];
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
     * Check an article for factual claims
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

        // Build prompt for fact-checking
        const prompt = this.buildFactCheckPrompt(title, content);

        try {
            // Use the same AI provider as configured for summaries
            const response = await this.callAI(prompt, settings);
            const result = this.parseFactCheckResponse(articleId, response);

            // Cache the result
            this.cache.set(articleId, result);
            this.saveCache();

            return result;
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
     * Build the fact-check prompt
     */
    private static buildFactCheckPrompt(title: string, content: string): string {
        // Truncate content if too long
        const maxContent = 3000;
        const truncatedContent = content.length > maxContent
            ? content.substring(0, maxContent) + '...'
            : content;

        return `Analyze the following article for factual accuracy. Identify key claims and assess their reliability.

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
      "explanation": "Brief explanation of the rating",
      "confidence": 0.8
    }
  ],
  "summary": "A one-sentence summary of the factual reliability of this article"
}

Focus on verifiable factual claims, not opinions. Limit to 3-5 key claims. Be objective and note when claims cannot be verified.`;
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
     * Parse the AI response into a structured result
     */
    private static parseFactCheckResponse(articleId: string, response: string): ArticleFactCheck {
        try {
            // Extract JSON from response (may be wrapped in markdown)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON found');

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                articleId,
                overallRating: parsed.overallRating || 'mixed',
                claims: (parsed.claims || []).map((c: any) => ({
                    claim: c.claim || '',
                    rating: c.rating || 'unverifiable',
                    explanation: c.explanation || '',
                    confidence: c.confidence || 0.5,
                    sources: c.sources
                })),
                summary: parsed.summary || 'Analysis complete.',
                checkedAt: new Date().toISOString()
            };
        } catch (e) {
            console.error('Failed to parse fact-check response:', e);
            return {
                articleId,
                overallRating: 'mixed',
                claims: [],
                summary: response.substring(0, 200) || 'Unable to parse response.',
                checkedAt: new Date().toISOString()
            };
        }
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
