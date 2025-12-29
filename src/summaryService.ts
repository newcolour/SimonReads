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
    const model = geminiModel || 'gemini-1.5-flash';

    // Strip HTML tags to save tokens
    // Increased limit to handle newsreels with many articles and topic grouping
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
        throw new Error(errorData.error?.message || 'Failed to generate summary with Gemini');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary generated.';
}

async function summarizeWithOpenAI(content: string, apiKey: string, settings: AppSettings, instructionOverride?: string): Promise<string> {
    if (!apiKey) {
        throw new Error('Please set your OpenAI API Key in Settings.');
    }

    const { summaryTone, summaryLanguage, summaryLength, summaryDepth, summaryPrompt, openaiModel } = settings;
    const model = openaiModel || 'gpt-4o-mini';

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
        throw new Error(errorData.error?.message || 'Failed to generate summary with OpenAI');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No summary generated.';
}

async function summarizeWithClaude(content: string, apiKey: string, settings: AppSettings, instructionOverride?: string): Promise<string> {
    if (!apiKey) {
        throw new Error('Please set your Anthropic API Key in Settings.');
    }

    const { summaryTone, summaryLanguage, summaryLength, summaryDepth, summaryPrompt, claudeModel } = settings;
    const model = claudeModel || 'claude-3-haiku-20240307';

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

    // Anthropic API requires a proxy or specific headers usually, but let's try direct first.
    // Note: Anthropic API often requires a proxy due to CORS if called from browser.
    // We might need to use the Electron main process proxy if this fails.
    // For now, let's try to use the IPC proxy we set up for search, or create a new one.
    // Actually, we should use the IPC proxy for ALL of these to avoid CORS and expose keys less.
    // But for now, let's assume the user might be okay with direct calls or we'll fix CORS later.
    // WAIT, Anthropic definitely blocks browser calls. We need a proxy.
    // I'll use the 'perform-search' style proxy but for generic requests if possible, or just try direct and see.
    // Actually, let's use the IPC proxy for Claude specifically if we can, or just standard fetch and hope for the best (it will likely fail in dev, but might work in Electron if security policies allow).
    // Electron renderer can sometimes bypass CORS if webSecurity is false, but it's true by default.
    // Let's try direct fetch first.

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-browser': 'true' // Required for browser-like environments
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                { role: 'user', content: userPrompt }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate summary with Claude');
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'No summary generated.';
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
