export type FeedType = 'rss' | 'atom' | 'web';

export interface Feed {
    id: string;
    title: string;
    url: string;
    type?: FeedType; // Default is assumed to be 'rss' for backwards compatibility
    icon?: string; // URL to feed icon/favicon
    lastFetched?: Date;
    category?: string; // Optional category/theme for organizing feeds
    // Settings logic for Web Sources
    cookieSession?: string; // Encrypted cookie string
    useBrowserSession?: boolean; // Use Electron hidden BrowserWindow
    paywallMethodSucceeded?: string; // e.g. "cookie", "browser", "amp", "archive", "partial"
}

export interface MediaEnclosure {
    url: string;
    type: string; // MIME type (e.g., 'audio/mpeg', 'video/mp4')
    length?: number; // File size in bytes
}

export type MediaType = 'article' | 'audio' | 'video';

export interface Article {
    id: string;
    feedId: string;
    feedTitle?: string;
    title: string;
    link: string;
    pubDate?: Date;
    creator?: string;
    content?: string;
    contentSnippet?: string;
    guid?: string;
    isoDate?: string;
    isRead: boolean;
    isSaved?: boolean; // Favorite/saved articles
    // Podcast/Media support
    mediaType?: MediaType; // Type of content
    enclosure?: MediaEnclosure; // Audio/video file
    duration?: string; // Episode duration (e.g., "1:23:45")
    image?: string; // Episode artwork URL
    categories?: string[];
    isWebSource?: boolean; // True if scraped from a raw webpage
}

export type Theme = 'system' | 'dark' | 'light' | 'sepia' | 'black' | 'nord' | 'solarized-dark' | 'dracula' | 'gruvbox' | 'tokyo-night' | 'sorcerer' | 'warm';
export type Layout = 'classic' | 'modern';
export type RefreshInterval = 0 | 1 | 5 | 10 | 15 | 30 | 60;
export type RetentionPeriod = 7 | 14 | 30 | 90 | 365 | -1; // days, -1 = forever
export type SummaryTone = 'neutral' | 'formal' | 'witty' | 'critical' | 'eli5';
export type SummaryLength = 'short' | 'medium' | 'long';
export type SummaryDepth = 'brief' | 'detailed' | 'comprehensive';

// Reading Personalities
export type ReadingPersonality =
    | 'focused-minimalist'
    | 'conversational-curator'
    | 'deep-diver'
    | 'daily-brief'
    | 'serendipity-explorer';

export type AutoSwitchTrigger = 'time' | 'device' | 'manual';

export interface PersonalitySchedule {
    enabled: boolean;
    morning?: ReadingPersonality; // 6am-12pm
    afternoon?: ReadingPersonality; // 12pm-6pm
    evening?: ReadingPersonality; // 6pm-12am
    night?: ReadingPersonality; // 12am-6am
}

export interface AppSettings {
    autoRefreshInterval: RefreshInterval; // in minutes, 0 = disabled
    retentionPeriod: RetentionPeriod;
    theme: Theme;
    layout?: Layout; // classic or modern
    font: string;
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    geminiApiKey?: string;
    geminiModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    claudeApiKey?: string;
    claudeModel?: string;
    ollamaUrl?: string;
    ollamaModel?: string;
    aiProvider: 'gemini' | 'openai' | 'claude' | 'ollama';
    ttsProvider: 'system' | 'openai' | 'free';
    summaryTone: SummaryTone;
    summaryLanguage: string;
    summaryLength: SummaryLength;
    summaryDepth: SummaryDepth;
    summaryPrompt?: string;
    readAloudLanguage: string;
    pdfSummaryLength?: SummaryLength;
    pdfSummaryDepth?: SummaryDepth;
    dailyNewsreelTimeHorizon: 1 | 4 | 12 | 24; // hours
    usePublicationColors: boolean; // Apply publication brand colors to article view
    // Email settings
    emailEnabled: boolean;
    emailSmtpHost: string;
    emailSmtpPort: number;
    emailSmtpSecure: boolean;
    emailSmtpUser: string;
    emailSmtpPassword: string;
    emailFrom: string;
    emailTo: string;
    emailSendTime: string; // Format: "HH:MM"
    emailTimeHorizon: number; // Hours to look back
    // Reading Personality settings
    readingPersonality: ReadingPersonality;
    autoSwitchEnabled: boolean;
    autoSwitchTrigger: AutoSwitchTrigger;
    personalitySchedule: PersonalitySchedule;
    // Context window settings for local LLMs
    contextWindowOverride?: number; // Manual override for context window (tokens)
    // Map-Reduce settings for newsreel generation
    newsreelBatchSize?: number; // Number of articles per batch in Map phase (default: 5)
    // Newsreel-specific AI provider settings
    newsreelUseGlobalAI?: boolean; // If true, use global AI settings; if false, use newsreel-specific settings
    newsreelAiProvider?: 'gemini' | 'openai' | 'claude' | 'ollama';
    newsreelGeminiApiKey?: string;
    newsreelGeminiModel?: string;
    newsreelOpenaiApiKey?: string;
    newsreelOpenaiModel?: string;
    newsreelClaudeApiKey?: string;
    newsreelClaudeModel?: string;
    newsreelOllamaModel?: string;
    newsreelOllamaUrl?: string;
}

// Article ranking metadata returned from AI single-pass generation
export interface ArticleRanking {
    id: string;          // Article ID
    score: number;       // Importance score 1-10
    reason: string;      // Brief reason for the score
    category?: string;   // Category assigned by AI
    translatedTitle?: string;
    summary?: string;
    language?: string;
}

export interface NewsreelMetadata {
    article_rankings: ArticleRanking[];
    search_queries: string[];
}

// Known model context limits (in tokens)
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
    // Gemini models
    'gemini-1.5-flash': 1000000,
    'gemini-1.5-flash-latest': 1000000,
    'gemini-1.5-flash-8b': 1000000,
    'gemini-1.5-pro': 2000000,
    'gemini-1.5-pro-latest': 2000000,
    'gemini-2.0-flash-exp': 1000000,
    'gemini-flash-latest': 1000000,
    // OpenAI models
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,
    // Claude models
    'claude-3-5-sonnet-20241022': 200000,
    'claude-3-5-haiku-20241022': 200000,
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,
    // Ollama / Local models (common defaults)
    'gemma': 8192,
    'gemma:2b': 8192,
    'gemma:7b': 8192,
    'gemma2': 8192,
    'gemma2:2b': 8192,
    'gemma-2-9b': 8192,
    'gemma2:9b': 8192,
    'gemma2:27b': 8192,
    'llama2': 4096,
    'llama2:7b': 4096,
    'llama2:13b': 4096,
    'llama2:70b': 4096,
    'llama3': 8192,
    'llama3:8b': 8192,
    'llama-3-8b': 8192,
    'llama3:70b': 8192,
    'llama3.1': 128000,
    'llama3.1:8b': 128000,
    'llama3.1:70b': 128000,
    'llama3.1:405b': 128000,
    'llama3.2': 128000,
    'llama3.2:1b': 128000,
    'llama3.2:3b': 128000,
    'mistral': 32000,
    'mistral:7b': 32000,
    'mistral-nemo': 32000,
    'mixtral': 32000,
    'mixtral:8x7b': 32000,
    'mixtral:8x22b': 65536,
    'codellama': 16384,
    'phi3': 128000,
    'phi3:mini': 128000,
    'phi3:medium': 128000,
    'qwen2': 32768,
    'qwen2:7b': 32768,
    'qwen2.5': 32768,
    'qwen2.5-coder': 128000,
    'qwen2.5-coder:7b': 128000,
    'qwen2.5-coder:14b': 128000,
    'qwen2.5-coder:32b': 128000,
    'deepseek-coder': 16384,
    'deepseek-coder-v2': 128000,
};

// VRAM Safe Caps: Character limits for models that have large context windows
// but need memory constraints to avoid OOM on consumer GPUs (e.g., RTX 4080 16GB)
// These override the calculated limits based on context window
export const MODEL_VRAM_SAFE_CAPS: Record<string, number> = {
    'qwen2.5-coder:14b': 60000, // ~15k tokens, safe for 16GB VRAM
    'qwen2.5-coder:32b': 40000, // Larger model needs tighter cap
    'llama3.1:70b': 40000,      // Large models need tighter caps
    'mixtral:8x22b': 40000,
};

// Default context limit for unknown models
const DEFAULT_CONTEXT_LIMIT = 8192;

/**
 * Get the context window limit for a given model name.
 * Returns the known limit or a safe default for unknown models.
 * 
 * @param modelName - The model identifier (e.g., 'gemini-1.5-flash', 'llama3.1:8b')
 * @param settings - App settings to check for manual override
 * @returns Token limit for the model
 */
export function getModelContextLimit(modelName: string | undefined, settings?: AppSettings): number {
    // Check for manual override first
    if (settings?.contextWindowOverride && settings.contextWindowOverride > 0) {
        return settings.contextWindowOverride;
    }

    if (!modelName) {
        return DEFAULT_CONTEXT_LIMIT;
    }

    // Direct match
    const normalizedName = modelName.toLowerCase().trim();
    if (MODEL_CONTEXT_LIMITS[normalizedName]) {
        return MODEL_CONTEXT_LIMITS[normalizedName];
    }

    // Try partial matching for versioned models (e.g., "llama3.1:8b-instruct-q4" -> "llama3.1:8b")
    for (const [key, value] of Object.entries(MODEL_CONTEXT_LIMITS)) {
        if (normalizedName.startsWith(key)) {
            return value;
        }
    }

    // Try base model matching (e.g., "mistral:7b-instruct-v0.2-q4" -> "mistral")
    const baseModel = normalizedName.split(':')[0];
    if (MODEL_CONTEXT_LIMITS[baseModel]) {
        return MODEL_CONTEXT_LIMITS[baseModel];
    }

    console.warn(`Unknown model "${modelName}", using default context limit of ${DEFAULT_CONTEXT_LIMIT}`);
    return DEFAULT_CONTEXT_LIMIT;
}

/**
 * Calculate the maximum input characters based on context window.
 * Uses a safety buffer for system instructions and output generation.
 * 
 * @param tokenLimit - Total token limit for the model
 * @param safetyBuffer - Tokens reserved for system prompt and output (default: 2000)
 * @param charsPerToken - Approximate characters per token (default: 4)
 * @returns Maximum input characters
 */
export function calculateMaxInputChars(
    tokenLimit: number,
    safetyBuffer: number = 2000,
    charsPerToken: number = 4
): number {
    const availableTokens = Math.max(0, tokenLimit - safetyBuffer);
    return availableTokens * charsPerToken;
}

/**
 * Get the effective character budget for a model, respecting VRAM caps.
 * For memory-constrained models (like qwen2.5-coder:14b on 16GB VRAM),
 * returns the VRAM safe cap instead of the calculated context-based limit.
 * 
 * @param modelName - The model identifier
 * @param settings - App settings for context override
 * @returns Effective max input characters
 */
export function getEffectiveCharBudget(modelName: string | undefined, settings?: AppSettings): number {
    if (!modelName) {
        return calculateMaxInputChars(DEFAULT_CONTEXT_LIMIT, 2500);
    }

    const normalizedName = modelName.toLowerCase().trim();

    // Check for VRAM safe cap first (takes priority)
    for (const [key, cap] of Object.entries(MODEL_VRAM_SAFE_CAPS)) {
        if (normalizedName.includes(key.toLowerCase())) {
            console.log(`Using VRAM safe cap for ${modelName}: ${cap} chars`);
            return cap;
        }
    }

    // Fall back to calculated limit based on context window
    const contextLimit = getModelContextLimit(modelName, settings);
    return calculateMaxInputChars(contextLimit, 2500);
}

/**
 * Check if a model is a "coder" model that benefits from special persona prompts.
 * Coder models tend to be dry/technical by default.
 */
export function isCoderModel(modelName: string | undefined): boolean {
    if (!modelName) return false;
    const lower = modelName.toLowerCase();
    return lower.includes('coder') || lower.includes('deepseek-coder') || lower.includes('codellama');
}
