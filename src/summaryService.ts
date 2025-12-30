import { AppSettings } from './types';

export async function summarizeArticle(content: string, apiKey: string, settings: AppSettings, instructionOverride?: string): Promise<string> {
    const provider = settings.aiProvider || 'gemini';

    if (provider === 'gemini') {
        return summarizeWithGemini(content, settings.geminiApiKey || apiKey, settings, instructionOverride);
    } else if (provider === 'openai') {
        return summarizeWithOpenAI(content, settings.openaiApiKey || '', settings, instructionOverride);
    } else if (provider === 'claude') {
        return summarizeWithClaude(content, settings.claudeApiKey || '', settings, instructionOverride);
    } else if (provider === 'ollama') {
        return summarizeWithOllama(content, settings, instructionOverride);
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
}

async function summarizeWithGemini(content: string, apiKey: string, settings: AppSettings, instructionOverride?: string): Promise<string> {
    if (!apiKey) {
        throw new Error('Please set your Gemini API Key in Settings.');
    }

    const { summaryTone, summaryLanguage, summaryLength, summaryDepth, summaryPrompt, geminiModel } = settings;
    const initialModel = geminiModel || 'gemini-1.5-flash';

    // Fallback chain: Chosen Model -> 1.5 Flash
    // If choice IS Flash, no fallback (or maybe 1.0 Pro if available, but Flash is best bet)

    const executeRequest = async (model: string): Promise<string> => {
        // Strip HTML tags to save tokens
        const plainText = content.replace(/<[^>]+>/g, ' ').slice(0, 60000);

        // Construct Prompt
        let prompt = instructionOverride || `Please summarize the following article.`;
        prompt += `\nTarget Language: ${summaryLanguage || 'English'}`;
        prompt += `\nTone: ${summaryTone || 'neutral'}`;
        prompt += `\nLength: ${summaryLength || 'medium'}`;
        prompt += `\nDepth: ${summaryDepth || 'detailed'}`;

        if (summaryPrompt) {
            prompt += `\nAdditional Instructions: ${summaryPrompt}`;
        }

        prompt += `\n\nFormat the output as a clean, readable summary (using bullet points if appropriate).`;
        prompt += `\nIMPORTANT: Start the response with the translated title of the article as a Markdown Heading (e.g. # Translated Title), followed by the summary.`;
        prompt += `\n\nArticle Content:\n${plainText}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();

            // Check for Quota Exceeded (429)
            if (response.status === 429) {
                throw new Error('QUOTA_EXCEEDED');
            }

            throw new Error(errorData.error?.message || `Failed to generate summary with Gemini (${model})`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary generated.';
    };

    try {
        console.log(`🤖 Gemini: Attempting with ${initialModel}...`);
        return await executeRequest(initialModel);
    } catch (error: any) {
        if (error.message === 'QUOTA_EXCEEDED') {
            const fallbackModel = 'gemini-1.5-flash';

            // Only fallback if we haven't already tried the fallback
            if (initialModel !== fallbackModel) {
                console.warn(`⚠️ Gemini Quota Exceeded for ${initialModel}. Falling back to ${fallbackModel}...`);
                try {
                    return await executeRequest(fallbackModel);
                } catch (fallbackError: any) {
                    throw new Error(`Gemini Quota Exceeded (even with fallback to ${fallbackModel}). Please try again later.`);
                }
            }
        }
        throw error;
    }
}

async function summarizeWithOpenAI(content: string, apiKey: string, settings: AppSettings, instructionOverride?: string): Promise<string> {
    if (!apiKey) {
        throw new Error('Please set your OpenAI API Key in Settings.');
    }

    const { summaryTone, summaryLanguage, summaryLength, summaryDepth, summaryPrompt, openaiModel } = settings;
    const initialModel = openaiModel || 'gpt-4o-mini';
    const fallbackModel = 'gpt-4o-mini';

    const executeRequest = async (model: string): Promise<string> => {
        // Increased limit to handle newsreels with many articles and topic grouping
        const plainText = content.replace(/<[^>]+>/g, ' ').slice(0, 60000);

        let systemPrompt = `You are a helpful AI assistant that summarizes news articles.
Target Language: ${summaryLanguage || 'English'}
Tone: ${summaryTone || 'neutral'}
Length: ${summaryLength || 'medium'}
Depth: ${summaryDepth || 'detailed'}`;

        if (summaryPrompt) {
            systemPrompt += `\nAdditional Instructions: ${summaryPrompt}`;
        }

        const userPrompt = `${instructionOverride || 'Please summarize the following article.'}
Format the output as a clean, readable summary (using bullet points if appropriate).
IMPORTANT: Start the response with the translated title of the article as a Markdown Heading (e.g. # Translated Title), followed by the summary.

Article Content:
${plainText}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 429) {
                throw new Error('QUOTA_EXCEEDED');
            }
            throw new Error(errorData.error?.message || `Failed to generate summary with OpenAI (${model})`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || 'No summary generated.';
    };

    try {
        console.log(`🤖 OpenAI: Attempting with ${initialModel}...`);
        return await executeRequest(initialModel);
    } catch (error: any) {
        if (error.message === 'QUOTA_EXCEEDED' && initialModel !== fallbackModel) {
            console.warn(`⚠️ OpenAI Quota Exceeded for ${initialModel}. Falling back to ${fallbackModel}...`);
            try {
                return await executeRequest(fallbackModel);
            } catch (fallbackError: any) {
                throw new Error(`OpenAI Quota Exceeded (even with fallback to ${fallbackModel}). Please try again later.`);
            }
        }
        throw error;
    }
}

async function summarizeWithClaude(content: string, apiKey: string, settings: AppSettings, instructionOverride?: string): Promise<string> {
    if (!apiKey) {
        throw new Error('Please set your Anthropic API Key in Settings.');
    }

    const { summaryTone, summaryLanguage, summaryLength, summaryDepth, summaryPrompt, claudeModel } = settings;
    const initialModel = claudeModel || 'claude-3-haiku-20240307';
    const fallbackModel = 'claude-3-haiku-20240307';

    // Helper to run the request
    const executeRequest = async (model: string): Promise<string> => {
        // ... (existing logic preparation)
        const plainText = content.replace(/<[^>]+>/g, ' ').slice(0, 60000);

        let systemPrompt = `You are a helpful AI assistant that summarizes news articles.
Target Language: ${summaryLanguage || 'English'}
Tone: ${summaryTone || 'neutral'}
Length: ${summaryLength || 'medium'}
Depth: ${summaryDepth || 'detailed'}`;

        if (summaryPrompt) {
            systemPrompt += `\nAdditional Instructions: ${summaryPrompt}`;
        }

        const userPrompt = `${instructionOverride || 'Please summarize the following article.'}
Format the output as a clean, readable summary (using bullet points if appropriate).
IMPORTANT: Start the response with the translated title of the article as a Markdown Heading (e.g. # Translated Title), followed by the summary.

Article Content:
${plainText}`;

        // Attempt direct fetch (simulating what was there, or using proxy if implemented)
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
                'anthropic-dangerous-direct-browser-access': 'true' // Required for browser usage
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 1500,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 429) {
                throw new Error('QUOTA_EXCEEDED');
            }
            // Handle Overloaded error too
            if (response.status === 529) {
                throw new Error('OVERLOADED');
            }
            throw new Error(errorData.error?.message || `Failed to generate summary with Claude (${model})`);
        }

        const data = await response.json();
        return data.content?.[0]?.text || 'No summary generated.';
    };

    try {
        console.log(`🤖 Claude: Attempting with ${initialModel}...`);
        return await executeRequest(initialModel);
    } catch (error: any) {
        const isQuotaIssue = error.message === 'QUOTA_EXCEEDED' || error.message === 'OVERLOADED';

        if (isQuotaIssue && initialModel !== fallbackModel) {
            console.warn(`⚠️ Claude Quota/Load Issue for ${initialModel}. Falling back to ${fallbackModel}...`);
            try {
                return await executeRequest(fallbackModel);
            } catch (fallbackError: any) {
                throw new Error(`Claude Quota/Load Issue (even with fallback to ${fallbackModel}). Please try again later.`);
            }
        }
        throw error;
    }


}

async function summarizeWithOllama(content: string, settings: AppSettings, instructionOverride?: string): Promise<string> {
    const { summaryTone, summaryLanguage, summaryLength, summaryDepth, summaryPrompt, ollamaModel, ollamaUrl } = settings;
    const model = ollamaModel || 'llama3';
    const baseUrl = ollamaUrl || 'http://localhost:11434';
    const cleanUrl = baseUrl.replace(/\/$/, '');

    // Shorter limit for local models to avoid OOM or slow processing
    const plainText = content.replace(/<[^>]+>/g, ' ').slice(0, 32000);

    let systemPrompt = `You are a helpful AI assistant that summarizes news articles.
Target Language: ${summaryLanguage || 'English'}
Tone: ${summaryTone || 'neutral'}
Length: ${summaryLength || 'medium'}
Depth: ${summaryDepth || 'detailed'}`;

    if (summaryPrompt) {
        systemPrompt += `\nAdditional Instructions: ${summaryPrompt}`;
    }

    const userPrompt = `${instructionOverride || 'Please summarize the following article.'}
Format the output as a clean, readable summary (using bullet points if appropriate).
IMPORTANT: Start the response with the translated title of the article as a Markdown Heading (e.g. # Translated Title), followed by the summary.

Article Content:
${plainText}`;

    try {
        const response = await fetch(`${cleanUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                stream: false,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to generate summary with Ollama: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        return data.message?.content || 'No summary generated.';
    } catch (e: any) {
        console.error('Ollama summary failed:', e);
        throw new Error(`Ollama summary failed: ${e.message}. Ensure Ollama is running at ${cleanUrl}.`);
    }
}


export async function generateHashtags(content: string, settings: AppSettings): Promise<string[]> {
    const provider = settings.aiProvider || 'gemini';
    const plainText = content.replace(/<[^>]+>/g, ' ').slice(0, 5000); // Shorter context mainly for tags
    const prompt = "Generate 5 relevant, popular hashtags for this article. Output ONLY the hashtags separated by spaces (e.g. #tech #ai #news). Do not include any other text.";

    try {
        let text = '';
        if (provider === 'gemini') {
            text = await summarizeWithGemini(plainText, settings.geminiApiKey || '', settings, prompt);
        } else if (provider === 'openai') {
            text = await summarizeWithOpenAI(plainText, settings.openaiApiKey || '', settings, prompt);
        } else if (provider === 'claude') {
            text = await summarizeWithClaude(plainText, settings.claudeApiKey || '', settings, prompt);
        } else {
            return [];
        }

        // Extract hashtags
        const matches = text.match(/#[a-zA-Z0-9_]+/g);
        return matches ? matches.slice(0, 5) : [];
    } catch (e) {
        console.error("Failed to generate hashtags:", e);
        return [];
    }
}
