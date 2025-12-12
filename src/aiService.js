"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function (o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.summarizeArticle = summarizeArticle;
exports.chatWithArticle = chatWithArticle;
async function summarizeArticle(content, apiKey, settings, instructionOverride) {
    const provider = settings.aiProvider || 'gemini';
    if (provider === 'gemini') {
        return summarizeWithGemini(content, settings.geminiApiKey || apiKey, settings, instructionOverride);
    }
    else if (provider === 'openai') {
        return summarizeWithOpenAI(content, settings.openaiApiKey || '', settings, instructionOverride);
    }
    else if (provider === 'claude') {
        return summarizeWithClaude(content, settings.claudeApiKey || '', settings, instructionOverride);
    }
    else if (provider === 'ollama') {
        return summarizeWithOllama(content, settings, instructionOverride);
    }
    throw new Error(`Unsupported AI provider: ${provider}`);
}
async function summarizeWithGemini(content, apiKey, settings, instructionOverride) {
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
async function summarizeWithOpenAI(content, apiKey, settings, instructionOverride) {
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
async function summarizeWithClaude(content, apiKey, settings, instructionOverride) {
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
async function chatWithArticle(article, userMessage, previousMessages, apiKey, settings) {
    const provider = settings.aiProvider || 'gemini';
    if (provider === 'gemini') {
        return chatWithGemini(article, userMessage, previousMessages, settings.geminiApiKey || apiKey, settings);
    }
    else if (provider === 'openai') {
        return chatWithOpenAI(article, userMessage, previousMessages, settings.openaiApiKey || '', settings);
    }
    else if (provider === 'claude') {
        return chatWithClaude(article, userMessage, previousMessages, settings.claudeApiKey || '', settings);
    }
    else if (provider === 'ollama') {
        return chatWithOllama(article, userMessage, previousMessages, settings);
    }
    throw new Error(`Unsupported AI provider: ${provider}`);
}
async function chatWithGemini(article, userMessage, previousMessages, apiKey, settings) {
    if (!apiKey) {
        throw new Error('Please set your Gemini API Key in Settings.');
    }
    const model = settings.geminiModel || 'gemini-1.5-flash';
    const language = settings.summaryLanguage || 'English';
    const plainText = (article.content || article.contentSnippet || '').replace(/<[^>]+>/g, ' ').slice(0, 8000);
    const needsWebSearch = await shouldSearchWeb(userMessage, plainText, apiKey, settings, 'gemini');
    let searchContext = '';
    if (needsWebSearch) {
        const { searchAndSummarize } = await Promise.resolve().then(() => __importStar(require('./searchService')));
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
async function chatWithOpenAI(article, userMessage, previousMessages, apiKey, settings) {
    if (!apiKey) {
        throw new Error('Please set your OpenAI API Key in Settings.');
    }
    const model = settings.openaiModel || 'gpt-4o-mini';
    const language = settings.summaryLanguage || 'English';
    const plainText = (article.content || article.contentSnippet || '').replace(/<[^>]+>/g, ' ').slice(0, 8000);
    const needsWebSearch = await shouldSearchWeb(userMessage, plainText, apiKey, settings, 'openai');
    let searchContext = '';
    if (needsWebSearch) {
        const { searchAndSummarize } = await Promise.resolve().then(() => __importStar(require('./searchService')));
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
async function chatWithClaude(article, userMessage, previousMessages, apiKey, settings) {
    if (!apiKey) {
        throw new Error('Please set your Anthropic API Key in Settings.');
    }
    const model = settings.claudeModel || 'claude-3-haiku-20240307';
    const language = settings.summaryLanguage || 'English';
    const plainText = (article.content || article.contentSnippet || '').replace(/<[^>]+>/g, ' ').slice(0, 8000);
    const needsWebSearch = await shouldSearchWeb(userMessage, plainText, apiKey, settings, 'claude');
    let searchContext = '';
    if (needsWebSearch) {
        const { searchAndSummarize } = await Promise.resolve().then(() => __importStar(require('./searchService')));
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
async function shouldSearchWeb(userMessage, articleContent, apiKey, settings, provider) {
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
        }
        else if (provider === 'openai') {
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
        }
        else if (provider === 'claude') {
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
        else if (provider === 'ollama') {
            const model = settings.ollamaModel || 'llama3';
            const baseUrl = settings.ollamaUrl || 'http://localhost:11434';
            // Ensure base URL doesn't have trailing slash
            const cleanUrl = baseUrl.replace(/\/$/, '');

            const response = await fetch(`${cleanUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    stream: false,
                    messages: [{ role: 'user', content: checkPrompt }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                const answer = data.message?.content?.trim().toUpperCase() || 'YES';
                return answer.includes('NO');
            }
        }
    }
    catch (error) {
        // If check fails, default to no search (prioritize article)
        return false;
    }
    return false;
}

async function suggestFeeds(currentFeeds, apiKey, settings) {
    const provider = settings.aiProvider || 'gemini';
    const feedList = currentFeeds.map(f => `- ${f.title}`).join('\n');

    const prompt = `I am subscribed to the following RSS feeds:
${feedList}

Please suggest 5-10 new, high-quality RSS feeds that I might like based on these interests.
For each suggestion, provide:
1. Title
2. RSS URL (must be a valid RSS/Atom feed URL)
3. Brief description of why I might like it.

Format the output as a JSON array of objects with keys: 'title', 'url', 'description'.
IMPORTANT: Return ONLY the raw JSON array. Do not include markdown formatting (like \`\`\`json), explanations, or code blocks.`;

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

async function suggestWithGemini(prompt, apiKey, settings) {
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

async function suggestWithOpenAI(prompt, apiKey, settings) {
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

async function suggestWithClaude(prompt, apiKey, settings) {
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

async function summarizeWithOllama(content, settings, instructionOverride) {
    const { summaryTone, summaryLanguage, summaryLength, summaryDepth, summaryPrompt, ollamaModel, ollamaUrl } = settings;
    const model = ollamaModel || 'llama3';
    const baseUrl = ollamaUrl || 'http://localhost:11434';
    const cleanUrl = baseUrl.replace(/\/$/, '');

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

    const response = await fetch(`${cleanUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
}

async function chatWithOllama(article, userMessage, previousMessages, settings) {
    const model = settings.ollamaModel || 'llama3';
    const baseUrl = settings.ollamaUrl || 'http://localhost:11434';
    const cleanUrl = baseUrl.replace(/\/$/, '');

    const language = settings.summaryLanguage || 'English';
    const plainText = (article.content || article.contentSnippet || '').replace(/<[^>]+>/g, ' ').slice(0, 8000);

    const needsWebSearch = await shouldSearchWeb(userMessage, plainText, '', settings, 'ollama');
    let searchContext = '';

    if (needsWebSearch) {
        const { searchAndSummarize } = await Promise.resolve().then(() => __importStar(require('./searchService')));
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
    messages.push({ role: 'system', content: systemPrompt });

    previousMessages.forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
    });

    messages.push({ role: 'user', content: userMessage });

    const response = await fetch(`${cleanUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model,
            stream: false,
            messages: messages
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate response with Ollama: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || 'No response generated.';
}

async function suggestWithOllama(prompt, settings) {
    const model = settings.ollamaModel || 'llama3';
    const baseUrl = settings.ollamaUrl || 'http://localhost:11434';
    const cleanUrl = baseUrl.replace(/\/$/, '');

    const response = await fetch(`${cleanUrl}/api/chat`, {
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
        throw new Error(`Failed to get suggestions from Ollama: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.message?.content || '[]';
}

exports.suggestFeeds = suggestFeeds;
