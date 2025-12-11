import { ReadingPersonality, SummaryTone, SummaryLength, SummaryDepth } from './types';

export interface PersonalityConfig {
    id: ReadingPersonality;
    name: string;
    icon: string;
    description: string;
    // AI behavior
    summaryTone: SummaryTone;
    summaryLength: SummaryLength;
    summaryDepth: SummaryDepth;
    // UI preferences
    contentDensity: 'compact' | 'comfortable' | 'spacious';
    emphasizeUnread: boolean;
    // Article filtering & sorting
    sortPreference: 'recent' | 'unread-first' | 'random' | 'oldest-first';
    autoCollapseRead: boolean;
    showOnlyUnread: boolean;
    // Visual style
    themeHint?: string; // Suggested theme for this personality
    accentColor?: string;
    // Layout & Display
    layoutMode: 'single-column' | 'multi-column' | 'cards' | 'list';
    showMetadata: 'full' | 'minimal' | 'none';
    fontSize: 'small' | 'medium' | 'large' | 'xlarge';
    highContrast: boolean;
    showInlineSummary: boolean;
    showQuickActions: boolean;
    keyboardFirst: boolean;
    // Phase 2: Advanced Features
    showRelatedArticles?: boolean;
    showImportanceScore?: boolean;
    showThumbnails?: boolean;
    enableCitationMode?: boolean;
    enableShuffleMode?: boolean;
    maxSummaryLines?: number; // For brief summaries
    showPlayfulMicrocopy?: boolean;
}

export const personalityConfigs: Record<ReadingPersonality, PersonalityConfig> = {
    'focused-minimalist': {
        id: 'focused-minimalist',
        name: 'Focused Minimalist',
        icon: '🎯',
        description: 'Distraction-free reading with essential content only. Clean, minimal interface.',
        summaryTone: 'neutral',
        summaryLength: 'short',
        summaryDepth: 'brief',
        contentDensity: 'spacious',
        emphasizeUnread: true,
        sortPreference: 'unread-first',
        autoCollapseRead: true,
        showOnlyUnread: true,
        themeHint: 'light',
        accentColor: '#2563eb',
        // Focused Minimalist specific
        layoutMode: 'single-column',
        showMetadata: 'minimal',
        fontSize: 'large',
        highContrast: true,
        showInlineSummary: false,
        showQuickActions: false,
        keyboardFirst: true,
        // Phase 2
        showRelatedArticles: false,
        showImportanceScore: false,
        showThumbnails: false,
        enableCitationMode: false,
        enableShuffleMode: false
    },
    'conversational-curator': {
        id: 'conversational-curator',
        name: 'Conversational Curator',
        icon: '💬',
        description: 'Friendly, engaging tone with curated highlights. Perfect for casual browsing.',
        summaryTone: 'witty',
        summaryLength: 'medium',
        summaryDepth: 'detailed',
        contentDensity: 'comfortable',
        emphasizeUnread: false,
        sortPreference: 'recent',
        autoCollapseRead: false,
        showOnlyUnread: false,
        themeHint: 'sorcerer',
        accentColor: '#8b5cf6',
        // Conversational Curator specific
        layoutMode: 'cards',
        showMetadata: 'full',
        fontSize: 'medium',
        highContrast: false,
        showInlineSummary: true,
        showQuickActions: true,
        keyboardFirst: false,
        // Phase 2: Auto-generate inline summaries
        showRelatedArticles: false,
        showImportanceScore: false,
        showThumbnails: false,
        enableCitationMode: false,
        enableShuffleMode: false,
        maxSummaryLines: 3
    },
    'deep-diver': {
        id: 'deep-diver',
        name: 'Deep Diver',
        icon: '🔬',
        description: 'Comprehensive analysis and detailed insights. For thorough reading sessions.',
        summaryTone: 'formal',
        summaryLength: 'long',
        summaryDepth: 'comprehensive',
        contentDensity: 'spacious',
        emphasizeUnread: false,
        sortPreference: 'oldest-first',
        autoCollapseRead: false,
        showOnlyUnread: false,
        themeHint: 'sepia',
        accentColor: '#059669',
        layoutMode: 'multi-column',
        showMetadata: 'full',
        fontSize: 'medium',
        highContrast: false,
        showInlineSummary: false,
        showQuickActions: false,
        keyboardFirst: false,
        // Phase 2: Research mode
        showRelatedArticles: true,
        showImportanceScore: false,
        showThumbnails: false,
        enableCitationMode: true,
        enableShuffleMode: false
    },
    'daily-brief': {
        id: 'daily-brief',
        name: 'Daily Brief',
        icon: '📋',
        description: 'Quick scan mode with bite-sized summaries. Fast catch-up on news.',
        summaryTone: 'neutral',
        summaryLength: 'short',
        summaryDepth: 'brief',
        contentDensity: 'compact',
        emphasizeUnread: true,
        sortPreference: 'recent',
        autoCollapseRead: true,
        showOnlyUnread: true,
        themeHint: 'light',
        accentColor: '#dc2626',
        layoutMode: 'list',
        showMetadata: 'minimal',
        fontSize: 'small',
        highContrast: false,
        showInlineSummary: false,
        showQuickActions: false,
        keyboardFirst: false,
        // Phase 2: Morning briefing
        showRelatedArticles: false,
        showImportanceScore: true,
        showThumbnails: false,
        enableCitationMode: false,
        enableShuffleMode: false,
        maxSummaryLines: 3
    },
    'serendipity-explorer': {
        id: 'serendipity-explorer',
        name: 'Serendipity Explorer',
        icon: '🎲',
        description: 'Discover unexpected gems with randomized content. Adventure mode for curious minds.',
        summaryTone: 'witty',
        summaryLength: 'medium',
        summaryDepth: 'detailed',
        contentDensity: 'comfortable',
        emphasizeUnread: false,
        sortPreference: 'random',
        autoCollapseRead: false,
        showOnlyUnread: false,
        themeHint: 'tokyo-night',
        accentColor: '#f59e0b',
        layoutMode: 'cards',
        showMetadata: 'full',
        fontSize: 'medium',
        highContrast: false,
        showInlineSummary: false,
        showQuickActions: false,
        keyboardFirst: false,
        // Phase 2: Discovery mode
        showRelatedArticles: false,
        showImportanceScore: false,
        showThumbnails: true,
        enableCitationMode: false,
        enableShuffleMode: true,
        showPlayfulMicrocopy: true
    }
};

/**
 * Get the current time-based personality based on hour of day
 */
export function getTimeBasedPersonality(schedule: any): ReadingPersonality | null {
    if (!schedule.enabled) return null;

    const hour = new Date().getHours();

    if (hour >= 6 && hour < 12) {
        return schedule.morning || null;
    } else if (hour >= 12 && hour < 18) {
        return schedule.afternoon || null;
    } else if (hour >= 18 && hour < 24) {
        return schedule.evening || null;
    } else {
        return schedule.night || null;
    }
}

/**
 * Get device type for device-based switching
 */
export function getDeviceType(): 'desktop' | 'mobile' {
    // Check if we're in Capacitor (mobile)
    if ((window as any).Capacitor) {
        return 'mobile';
    }

    // Check screen width as fallback
    if (window.innerWidth <= 768) {
        return 'mobile';
    }

    return 'desktop';
}

/**
 * Apply personality configuration to app settings
 */
export function applyPersonality(
    currentSettings: any,
    personality: ReadingPersonality
): any {
    const config = personalityConfigs[personality];

    return {
        ...currentSettings,
        readingPersonality: personality,
        summaryTone: config.summaryTone,
        summaryLength: config.summaryLength,
        summaryDepth: config.summaryDepth,
        // Store content density and other UI prefs in the personality config
        // These will be read from the config when rendering
    };
}
