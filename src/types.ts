export interface Feed {
    id: string;
    title: string;
    url: string;
    icon?: string; // URL to feed icon/favicon
    lastFetched?: Date;
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
    title: string;
    link: string;
    pubDate?: Date;
    creator?: string;
    content?: string;
    contentSnippet?: string;
    guid?: string;
    isoDate?: string;
    isRead: boolean;
    // Podcast/Media support
    mediaType?: MediaType; // Type of content
    enclosure?: MediaEnclosure; // Audio/video file
    duration?: string; // Episode duration (e.g., "1:23:45")
    image?: string; // Episode artwork URL
}

export type Theme = 'dark' | 'light' | 'sepia' | 'black';
export type RefreshInterval = 0 | 1 | 5 | 10 | 15 | 30 | 60;
export type RetentionPeriod = 7 | 14 | 30 | 90 | 365 | -1; // days, -1 = forever
export type SummaryTone = 'neutral' | 'formal' | 'witty' | 'critical' | 'eli5';
export type SummaryLength = 'short' | 'medium' | 'long';
export type SummaryDepth = 'brief' | 'detailed' | 'comprehensive';

export interface AppSettings {
    autoRefreshInterval: RefreshInterval; // in minutes, 0 = disabled
    retentionPeriod: RetentionPeriod;
    theme: Theme;
    font: string;
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    geminiApiKey?: string;
    geminiModel?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    claudeApiKey?: string;
    claudeModel?: string;
    aiProvider: 'gemini' | 'openai' | 'claude';
    ttsProvider: 'system' | 'openai' | 'free';
    summaryTone: SummaryTone;
    summaryLanguage: string;
    summaryLength: SummaryLength;
    summaryDepth: SummaryDepth;
    summaryPrompt?: string;
    readAloudLanguage: string;
    dailyNewsreelTimeHorizon: 1 | 4 | 12 | 24; // hours
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
}
