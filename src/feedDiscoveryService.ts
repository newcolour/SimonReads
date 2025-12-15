import { AppSettings, Feed } from './types';

export interface FeedSuggestion {
    title: string;
    url: string;
    description: string;
    category: string;
}

export interface CategorizedSuggestions {
    [category: string]: FeedSuggestion[];
}

export async function suggestFeeds(
    currentFeeds: Feed[],
    apiKey: string,
    settings: AppSettings,
    keyword?: string
): Promise<FeedSuggestion[]> {
    const provider = settings.aiProvider || 'gemini';
    const feedList = currentFeeds.map(f => `- ${f.title}`).join('\n');

    let prompt = '';

    if (keyword && keyword.trim()) {
        // Keyword-based search
        prompt = `I am interested in: "${keyword}"

${currentFeeds.length > 0 ? `I am currently subscribed to these RSS feeds:\n${feedList}\n\n` : ''}Please suggest 15-20 high-quality RSS feeds related to "${keyword}".
For each suggestion, provide:
1. Title
2. RSS URL (must be a valid RSS/Atom feed URL)
3. Brief description
4. Category (e.g., "News", "Technology", "Science", "Business", "Entertainment", "Sports", "Lifestyle", etc.)

Format the output as a JSON array of objects with keys: 'title', 'url', 'description', 'category'.
IMPORTANT: Return ONLY the raw JSON array. Do not include markdown formatting (like \`\`\`json), explanations, or code blocks.`;
    } else {
        // Interest-based search from current feeds
        if (currentFeeds.length === 0) {
            throw new Error('Please add some feeds first or enter a keyword to search.');
        }

        prompt = `I am subscribed to the following RSS feeds:
${feedList}

Please suggest 15-20 new, high-quality RSS feeds that I might like based on these interests.
For each suggestion, provide:
1. Title
2. RSS URL (must be a valid RSS/Atom feed URL)
3. Brief description of why I might like it
4. Category (e.g., "News", "Technology", "Science", "Business", "Entertainment", "Sports", "Lifestyle", etc.)

Format the output as a JSON array of objects with keys: 'title', 'url', 'description', 'category'.
IMPORTANT: Return ONLY the raw JSON array. Do not include markdown formatting (like \`\`\`json), explanations, or code blocks.`;
    }

    let responseText = '';

    if (provider === 'gemini') {
        responseText = await suggestWithGemini(prompt, settings.geminiApiKey || apiKey, settings);
    } else if (provider === 'openai') {
        responseText = await suggestWithOpenAI(prompt, settings.openaiApiKey || '', settings);
    } else if (provider === 'claude') {
        responseText = await suggestWithClaude(prompt, settings.claudeApiKey || '', settings);
    } else if (provider === 'ollama') {
        responseText = await suggestWithOllama(prompt, settings);
    } else {
        throw new Error(`Unsupported AI provider: ${provider}`);
    }

    // Clean up response if it contains markdown code blocks
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        return JSON.parse(responseText);
    } catch (e) {
        console.error('Failed to parse feed suggestions JSON:', responseText);
        throw new Error('Failed to parse AI response. Please try again.');
    }
}

async function suggestWithGemini(prompt: string, apiKey: string, settings: AppSettings): Promise<string> {
    if (!apiKey) throw new Error('Please set your Gemini API Key in Settings.');
    const model = settings.geminiModel || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get suggestions from Gemini');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
}

async function suggestWithOpenAI(prompt: string, apiKey: string, settings: AppSettings): Promise<string> {
    if (!apiKey) throw new Error('Please set your OpenAI API Key in Settings.');
    const model = settings.openaiModel || 'gpt-4o-mini';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get suggestions from OpenAI');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '[]';
}

async function suggestWithClaude(prompt: string, apiKey: string, settings: AppSettings): Promise<string> {
    if (!apiKey) throw new Error('Please set your Anthropic API Key in Settings.');
    const model = settings.claudeModel || 'claude-3-haiku-20240307';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to get suggestions from Claude');
    }

    const data = await response.json();
    return data.content?.[0]?.text || '[]';
}

async function suggestWithOllama(prompt: string, settings: AppSettings): Promise<string> {
    const model = settings.ollamaModel || 'llama3';
    const baseUrl = (settings.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');

    const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            stream: false,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get suggestions from Ollama: ${response.status} ${response.statusText} - ${errorText}. Make sure Ollama is running at ${baseUrl}.`);
    }

    const data = await response.json();
    return data.message?.content || '[]';
}
