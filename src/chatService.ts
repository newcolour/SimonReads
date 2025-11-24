import { AppSettings, Article } from './types';
import { searchAndSummarize } from './webSearchService';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

export async function chatWithArticle(
    article: Article,
    userMessage: string,
    previousMessages: ChatMessage[],
    apiKey: string,
    settings: AppSettings
): Promise<string> {
    const provider = settings.aiProvider || 'gemini';

    if (provider === 'gemini') {
        return chatWithGemini(article, userMessage, previousMessages, settings.geminiApiKey || apiKey, settings);
    } else if (provider === 'openai') {
        return chatWithOpenAI(article, userMessage, previousMessages, settings.openaiApiKey || '', settings);
    } else if (provider === 'claude') {
        return chatWithClaude(article, userMessage, previousMessages, settings.claudeApiKey || '', settings);
    }

    throw new Error(`Unsupported AI provider: ${provider}`);
}

async function chatWithGemini(article: Article, userMessage: string, previousMessages: ChatMessage[], apiKey: string, settings: AppSettings): Promise<string> {
    if (!apiKey) {
        throw new Error('Please set your Gemini API Key in Settings.');
    }

    const model = settings.geminiModel || 'gemini-1.5-flash';
    const language = settings.summaryLanguage || 'English';

    const plainText = (article.content || article.contentSnippet || '').replace(/<[^>]+>/g, ' ').slice(0, 8000);

    const needsWebSearch = await shouldSearchWeb(userMessage, plainText, apiKey, settings, 'gemini');

    let searchContext = '';
    if (needsWebSearch) {
        searchContext = await searchAndSummarize(userMessage);
    }

    const contents = [];

    let systemPrompt = `You are a helpful AI assistant discussing the following news article with the user.

Article Title: ${article.title}
Published: ${article.pubDate ? new Date(article.pubDate).toLocaleDateString() : 'Unknown'}
Source: ${article.creator || 'Unknown'}

Article Content:
${plainText}`;

    if (searchContext) {
        systemPrompt += `\n\nAdditional Web Search Results (from DuckDuckGo):\n${searchContext}`;
        systemPrompt += `\n\nIMPORTANT: The article content above is your PRIMARY source. Only use web search results to supplement or provide additional context when the article doesn't contain the answer. Always prioritize information from the article.`;
    }

    systemPrompt += `\n\nPlease answer the user's questions about this article in ${language}. 

IMPORTANT GUIDELINES:
- Your PRIMARY focus is the article content above
- Answer questions based on what's IN the article first and foremost
- If the user asks about something mentioned in the article, explain it using the article's context
- Only mention that information is "not in the article" if they're asking about something completely unrelated
- Be conversational and helpful, relating your answers back to the article's main points
- When using web search results, provide your answer first, then add a references section at the end
- Format the references section as: "If you want to know more:" followed by markdown links on separate lines
- Example reference format:
  If you want to know more:
  - [Source Title](URL)
  - [Another Source](URL)`;

    contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
    });

    contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I\'m ready to discuss this article with you. What would you like to know?' }]
    });

    previousMessages.forEach(msg => {
        contents.push({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        });
    });

    contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: contents
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate response with Gemini');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

async function chatWithOpenAI(article: Article, userMessage: string, previousMessages: ChatMessage[], apiKey: string, settings: AppSettings): Promise<string> {
    if (!apiKey) {
        throw new Error('Please set your OpenAI API Key in Settings.');
    }

    const model = settings.openaiModel || 'gpt-4o-mini';
    const language = settings.summaryLanguage || 'English';

    const plainText = (article.content || article.contentSnippet || '').replace(/<[^>]+>/g, ' ').slice(0, 8000);

    const needsWebSearch = await shouldSearchWeb(userMessage, plainText, apiKey, settings, 'openai');

    let searchContext = '';
    if (needsWebSearch) {
        searchContext = await searchAndSummarize(userMessage);
    }

    const messages = [];

    let systemPrompt = `You are a helpful AI assistant discussing the following news article with the user.

Article Title: ${article.title}
Published: ${article.pubDate ? new Date(article.pubDate).toLocaleDateString() : 'Unknown'}
Source: ${article.creator || 'Unknown'}

Article Content:
${plainText}`;

    if (searchContext) {
        systemPrompt += `\n\nAdditional Web Search Results (from DuckDuckGo):\n${searchContext}`;
        systemPrompt += `\n\nIMPORTANT: The article content above is your PRIMARY source. Only use web search results to supplement or provide additional context when the article doesn't contain the answer. Always prioritize information from the article.`;
    }

    systemPrompt += `\n\nPlease answer the user's questions about this article in ${language}. 

IMPORTANT GUIDELINES:
- Your PRIMARY focus is the article content above
- Answer questions based on what's IN the article first and foremost
- If the user asks about something mentioned in the article, explain it using the article's context
- Only mention that information is "not in the article" if they're asking about something completely unrelated
- Be conversational and helpful, relating your answers back to the article's main points
- When using web search results, provide your answer first, then add a references section at the end
- Format the references section as: "If you want to know more:" followed by markdown links on separate lines
- Example reference format:
  If you want to know more:
  - [Source Title](URL)
  - [Another Source](URL)`;

    messages.push({ role: 'system', content: systemPrompt });

    previousMessages.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
    });

    messages.push({ role: 'user', content: userMessage });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: messages
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate response with OpenAI');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || 'No response generated.';
}

async function chatWithClaude(article: Article, userMessage: string, previousMessages: ChatMessage[], apiKey: string, settings: AppSettings): Promise<string> {
    if (!apiKey) {
        throw new Error('Please set your Anthropic API Key in Settings.');
    }

    const model = settings.claudeModel || 'claude-3-haiku-20240307';
    const language = settings.summaryLanguage || 'English';

    const plainText = (article.content || article.contentSnippet || '').replace(/<[^>]+>/g, ' ').slice(0, 8000);

    const needsWebSearch = await shouldSearchWeb(userMessage, plainText, apiKey, settings, 'claude');

    let searchContext = '';
    if (needsWebSearch) {
        searchContext = await searchAndSummarize(userMessage);
    }

    let systemPrompt = `You are a helpful AI assistant discussing the following news article with the user.

Article Title: ${article.title}
Published: ${article.pubDate ? new Date(article.pubDate).toLocaleDateString() : 'Unknown'}
Source: ${article.creator || 'Unknown'}

Article Content:
${plainText}`;

    if (searchContext) {
        systemPrompt += `\n\nAdditional Web Search Results (from DuckDuckGo):\n${searchContext}`;
        systemPrompt += `\n\nIMPORTANT: The article content above is your PRIMARY source. Only use web search results to supplement or provide additional context when the article doesn't contain the answer. Always prioritize information from the article.`;
    }

    systemPrompt += `\n\nPlease answer the user's questions about this article in ${language}. 

IMPORTANT GUIDELINES:
- Your PRIMARY focus is the article content above
- Answer questions based on what's IN the article first and foremost
- If the user asks about something mentioned in the article, explain it using the article's context
- Only mention that information is "not in the article" if they're asking about something completely unrelated
- Be conversational and helpful, relating your answers back to the article's main points
- When using web search results, provide your answer first, then add a references section at the end
- Format the references section as: "If you want to know more:" followed by markdown links on separate lines
- Example reference format:
  If you want to know more:
  - [Source Title](URL)
  - [Another Source](URL)`;

    const messages = [];
    previousMessages.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
    });
    messages.push({ role: 'user', content: userMessage });

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
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate response with Claude');
    }

    const data = await response.json();
    return data.content?.[0]?.text || 'No response generated.';
}

// Helper function to determine if web search is needed
async function shouldSearchWeb(
    userMessage: string,
    articleContent: string,
    apiKey: string,
    settings: AppSettings,
    provider: 'gemini' | 'openai' | 'claude'
): Promise<boolean> {
    // Keywords that strongly suggest the user wants EXTERNAL information not in the article
    const externalInfoKeywords = [
        'who is', 'what is the company', 'what is the history of',
        'background on', 'tell me about the company', 'tell me about the person',
        'more information about', 'look up', 'search for'
    ];

    const lowerMessage = userMessage.toLowerCase();

    // Only trigger immediate search for very specific external info requests
    const hasExternalKeyword = externalInfoKeywords.some(keyword => lowerMessage.includes(keyword));

    // Don't auto-search for common article-related questions
    const articleRelatedPhrases = [
        'what does this', 'what is this about', 'explain this', 'summarize',
        'main point', 'key takeaway', 'what happened', 'why did this happen',
        'how does this', 'what are the implications'
    ];

    const isArticleRelated = articleRelatedPhrases.some(phrase => lowerMessage.includes(phrase));

    // If it's clearly about the article itself, don't search
    if (isArticleRelated) {
        return false;
    }

    // If it has external keywords AND is asking about something specific, search
    if (hasExternalKeyword && userMessage.length < 100) {
        return true;
    }

    // Use AI to determine if the question can be answered from article alone
    const checkPrompt = `You are analyzing whether a question about an article needs external web search.

Article excerpt: ${articleContent.slice(0, 600)}...

User question: ${userMessage}

Can this question be answered well using ONLY the article content? 
- Answer "YES" if the article contains the information needed
- Answer "NO" only if the question asks for information clearly outside the article's scope

Answer with just YES or NO:`;

    try {
        if (provider === 'gemini') {
            const model = settings.geminiModel || 'gemini-1.5-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: checkPrompt }] }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                const answer = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toUpperCase() || 'YES';
                return answer.includes('NO');
            }
        } else if (provider === 'openai') {
            const model = settings.openaiModel || 'gpt-4o-mini';
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: checkPrompt }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                const answer = data.choices?.[0]?.message?.content?.trim().toUpperCase() || 'YES';
                return answer.includes('NO');
            }
        } else if (provider === 'claude') {
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
                    max_tokens: 100,
                    messages: [{ role: 'user', content: checkPrompt }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                const answer = data.content?.[0]?.text?.trim().toUpperCase() || 'YES';
                return answer.includes('NO');
            }
        }
    } catch (error) {
        // If check fails, default to no search (prioritize article)
        return false;
    }

    return false;
}
