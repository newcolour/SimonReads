/**
 * Publication color schemes for brand-aware article theming
 * Colors are subtle and non-intrusive, designed to complement the reading experience
 */

export interface PublicationColors {
    primary: string;      // Main brand color
    accent: string;       // Accent/highlight color
    background?: string;  // Optional background tint
}

/**
 * Predefined color schemes for major publications
 */
export const publicationColorSchemes: Record<string, PublicationColors> = {
    // News Organizations
    'npr': {
        primary: '#0077C8',      // NPR Blue
        accent: '#E1523D',       // NPR Red/Orange
        background: '#F5F9FC'    // Very light blue tint
    },
    'nytimes': {
        primary: '#000000',      // NYT Black
        accent: '#326891',       // NYT Blue
        background: '#F7F7F7'    // Light gray
    },
    'new york times': {
        primary: '#000000',
        accent: '#326891',
        background: '#F7F7F7'
    },
    'wsj': {
        primary: '#0274B6',      // WSJ Blue
        accent: '#85714D',       // WSJ Gold
        background: '#F8F9FA'
    },
    'wall street journal': {
        primary: '#0274B6',
        accent: '#85714D',
        background: '#F8F9FA'
    },
    'guardian': {
        primary: '#052962',      // Guardian Blue
        accent: '#FF7F0F',       // Guardian Orange
        background: '#F6F6F6'
    },
    'bbc': {
        primary: '#BB1919',      // BBC Red
        accent: '#000000',       // Black
        background: '#F5F5F5'
    },
    'cnn': {
        primary: '#CC0000',      // CNN Red
        accent: '#000000',
        background: '#F4F4F4'
    },
    'reuters': {
        primary: '#FF8000',      // Reuters Orange
        accent: '#000000',
        background: '#FAFAFA'
    },
    'ap': {
        primary: '#ED1C24',      // AP Red
        accent: '#000000',
        background: '#F8F8F8'
    },
    'associated press': {
        primary: '#ED1C24',
        accent: '#000000',
        background: '#F8F8F8'
    },
    'washington post': {
        primary: '#000000',
        accent: '#C41E3A',       // WaPo Red
        background: '#F7F7F7'
    },
    'washingtonpost': {
        primary: '#000000',
        accent: '#C41E3A',
        background: '#F7F7F7'
    },

    // Tech Publications
    'techcrunch': {
        primary: '#0A0',         // TechCrunch Green
        accent: '#000000',
        background: '#F0FFF0'    // Very light green tint
    },
    'verge': {
        primary: '#E10600',      // Verge Red
        accent: '#000000',
        background: '#FFF5F5'
    },
    'wired': {
        primary: '#000000',
        accent: '#FF006B',       // Wired Pink
        background: '#F5F5F5'
    },
    'ars technica': {
        primary: '#FF4E00',      // Ars Orange
        accent: '#000000',
        background: '#FFF8F5'
    },
    'arstechnica': {
        primary: '#FF4E00',
        accent: '#000000',
        background: '#FFF8F5'
    },
    'engadget': {
        primary: '#0091FF',      // Engadget Blue
        accent: '#000000',
        background: '#F0F8FF'
    },
    'the information': {
        primary: '#FF6B35',      // The Information Orange
        accent: '#004E89',
        background: '#FFF9F5'
    },
    'omgubuntu': {
        primary: '#DD4814',      // Ubuntu Orange
        accent: '#772953',       // Ubuntu Aubergine
        background: '#FFF5F0'
    },
    'omg! ubuntu': {
        primary: '#DD4814',
        accent: '#772953',
        background: '#FFF5F0'
    },

    // Business & Finance
    'bloomberg': {
        primary: '#000000',
        accent: '#5E5E5E',
        background: '#F5F5F5'
    },
    'financial times': {
        primary: '#FFF1E5',      // FT Salmon (as background)
        accent: '#990F3D',       // FT Claret
        background: '#FFF1E5'
    },
    'ft': {
        primary: '#FFF1E5',
        accent: '#990F3D',
        background: '#FFF1E5'
    },
    'economist': {
        primary: '#E3120B',      // Economist Red
        accent: '#000000',
        background: '#FFF5F5'
    },
    'forbes': {
        primary: '#0D0D0D',
        accent: '#0077B5',
        background: '#F7F7F7'
    },

    // Science & Nature
    'nature': {
        primary: '#0F7DC2',      // Nature Blue
        accent: '#000000',
        background: '#F0F8FF'
    },
    'science': {
        primary: '#D32F2F',      // Science Red
        accent: '#000000',
        background: '#FFF5F5'
    },
    'scientific american': {
        primary: '#C41E3A',
        accent: '#000000',
        background: '#FFF5F5'
    },

    // Sports
    'espn': {
        primary: '#D50A0A',      // ESPN Red
        accent: '#000000',
        background: '#FFF5F5'
    },
    'athletic': {
        primary: '#000000',
        accent: '#FF4747',
        background: '#F5F5F5'
    },
    'sports illustrated': {
        primary: '#ED1C24',
        accent: '#000000',
        background: '#FFF5F5'
    }
};

/**
 * Get publication colors based on feed title or article domain
 */
export function getPublicationColors(feedTitle?: string, articleUrl?: string): PublicationColors | null {
    if (!feedTitle && !articleUrl) return null;

    // Normalize feed title for matching
    const normalizedTitle = feedTitle?.toLowerCase().trim() || '';

    // Check for exact or partial matches in feed title
    for (const [key, colors] of Object.entries(publicationColorSchemes)) {
        if (normalizedTitle.includes(key)) {
            return colors;
        }
    }

    // If no match from feed title, try to extract from article URL
    if (articleUrl) {
        try {
            const hostname = new URL(articleUrl).hostname.toLowerCase();
            const domain = hostname.replace('www.', '').split('.')[0];

            for (const [key, colors] of Object.entries(publicationColorSchemes)) {
                if (domain.includes(key.replace(/\s+/g, '')) || key.replace(/\s+/g, '').includes(domain)) {
                    return colors;
                }
            }
        } catch (e) {
            // Invalid URL, ignore
        }
    }

    return null;
}

/**
 * Apply publication colors to article view with CSS variables
 */
export function applyPublicationColors(colors: PublicationColors | null, isDarkMode: boolean): React.CSSProperties {
    if (!colors) return {};

    // In dark mode, we need to adjust colors to be more subtle
    if (isDarkMode) {
        return {
            '--publication-primary': colors.primary,
            '--publication-accent': colors.accent,
            '--publication-bg': 'transparent', // Don't tint background in dark mode
            borderLeft: `3px solid ${colors.primary}`,
            borderRight: `3px solid ${colors.primary}`,
            '--article-link-color': colors.accent
        } as React.CSSProperties;
    }

    // In light mode, use subtle background tint
    return {
        '--publication-primary': colors.primary,
        '--publication-accent': colors.accent,
        '--publication-bg': colors.background || 'transparent',
        backgroundColor: colors.background,
        borderLeft: `3px solid ${colors.primary}`,
        borderRight: `3px solid ${colors.primary}`,
        '--article-link-color': colors.accent
    } as React.CSSProperties;
}
