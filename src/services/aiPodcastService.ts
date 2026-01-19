import { AppSettings } from '../types';
import { TTSService } from './ttsService';

export interface PodcastGenerationOptions {
    articleTitle: string;
    articleContent: string;
    settings: AppSettings;
    style?: 'summary' | 'discussion' | 'news-brief';
    onProgress?: (progress: number, status: string) => void;
}

export interface GeneratedPodcast {
    script: string;
    audioUrl?: string;
    duration?: number;
}

const PODCAST_STYLE_PROMPTS = {
    'summary': `Create a podcast-style summary of this article. Write it as if you're a podcast host explaining the key points to your listeners. Keep it conversational but informative. The summary should be about 2-3 minutes when read aloud (roughly 300-400 words).

Start with a brief intro like "Hey everyone, today we're diving into..." and end with a simple outro. Use natural language and occasionally add phrases like "Now, here's what's really interesting..." or "Let me break this down for you..."

IMPORTANT: Write ONLY the spoken words. Do NOT include:
- Stage directions like [intro music] or (sound effect)
- Markdown formatting (no *, #, or other symbols)
- Any instructions or meta-commentary
Just write what should be spoken aloud.`,

    'discussion': `Create a podcast-style discussion about this article as if there are two hosts having a conversation. Use names like "Alex" and "Jordan". Format it as a dialogue:

Alex: [opening remark]
Jordan: [response]

The discussion should explore different angles of the topic, with hosts asking each other questions and sharing insights. Keep it engaging and about 3-4 minutes when read aloud.

IMPORTANT: Write ONLY the spoken dialogue. Do NOT include:
- Stage directions like [intro music] or (sound effect)
- Markdown formatting (no *, #, or other symbols)
- Any instructions or meta-commentary
Just write the conversation that should be spoken aloud.`,

    'news-brief': `Create a professional news brief podcast segment about this article. Write it in the style of NPR or a morning news show. Keep it concise, factual, and authoritative. About 1-2 minutes when read aloud.

Start with "In today's news..." or similar opener. Include the key facts and context. End with a brief mention of why this matters.

IMPORTANT: Write ONLY the spoken words. Do NOT include:
- Stage directions like [intro music] or (sound effect)
- Markdown formatting (no *, #, or other symbols)
- Any instructions or meta-commentary
Just write what the news anchor should say.`
};

/**
 * Service for generating AI podcast-style audio from articles.
 */
export class AIPodcastService {
    /**
     * Generate a podcast script from article content
     */
    static async generateScript(
        options: PodcastGenerationOptions
    ): Promise<string> {
        const { articleTitle, articleContent, settings, style = 'summary', onProgress } = options;

        onProgress?.(10, 'Generating script...');

        const stylePrompt = PODCAST_STYLE_PROMPTS[style];
        const prompt = `${stylePrompt}

Article Title: ${articleTitle}

Article Content:
${articleContent.substring(0, 4000)}

Please generate the podcast script now:`;

        try {
            const script = await this.callAI(prompt, settings);
            onProgress?.(50, 'Script generated');
            return script;
        } catch (error) {
            console.error('Failed to generate podcast script:', error);
            throw new Error('Failed to generate podcast script');
        }
    }

    /**
     * Generate audio from a script using TTS
     */
    static async generateAudio(
        script: string,
        _settings: AppSettings,
        onProgress?: (progress: number, status: string) => void
    ): Promise<void> {
        onProgress?.(60, 'Generating audio...');

        // Use TTS service to speak the script
        // This will use the appropriate TTS engine based on platform
        await TTSService.speak({
            text: script,
            language: 'en-US',
            playbackRate: 1.0,
            onEnd: () => {
                onProgress?.(100, 'Complete');
            },
            onError: (error) => {
                console.error('TTS error:', error);
            }
        });

        onProgress?.(80, 'Playing audio...');

        return new Promise((resolve) => {
            // The audio will play automatically
            // We'll resolve when it ends (handled by onEnd callback)
            resolve();
        });
    }

    /**
     * Generate a complete podcast from article
     */
    static async generatePodcast(
        options: PodcastGenerationOptions
    ): Promise<GeneratedPodcast> {
        const { onProgress } = options;

        // Step 1: Generate the script
        const script = await this.generateScript(options);

        // Step 2: The audio can be played separately
        // We return the script so the UI can display it
        onProgress?.(100, 'Ready');

        return {
            script,
            duration: this.estimateDuration(script)
        };
    }

    /**
     * Estimate audio duration from script length
     */
    private static estimateDuration(script: string): number {
        // Average speaking rate is about 150 words per minute
        const wordCount = script.split(/\s+/).length;
        return Math.ceil((wordCount / 150) * 60); // Duration in seconds
    }

    /**
     * Call AI provider to generate script
     */
    private static async callAI(prompt: string, settings: AppSettings): Promise<string> {
        const provider = settings.aiProvider || 'gemini';

        switch (provider) {
            case 'gemini':
                return this.callGemini(prompt, settings);
            case 'openai':
                return this.callOpenAI(prompt, settings);
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
                        temperature: 0.8, // Higher for more creative output
                        maxOutputTokens: 2048
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
                temperature: 0.8,
                max_tokens: 2048
            })
        });

        if (!response.ok) throw new Error('OpenAI API request failed');
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
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
                options: { temperature: 0.8 }
            })
        });

        if (!response.ok) throw new Error('Ollama request failed');
        const data = await response.json();
        return data.response || '';
    }
}
