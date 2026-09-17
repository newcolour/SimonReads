export const FONT_FAMILIES: Record<string, string> = {
    'system-ui': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
    'Inter': '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, sans-serif',
    'Arial': 'Arial, "Liberation Sans", "Noto Sans", sans-serif',
    'Georgia': 'Georgia, "Noto Serif", "Liberation Serif", serif',
    'Merriweather': '"Merriweather", Georgia, "Noto Serif", "Liberation Serif", serif',
    'Roboto': '"Roboto", "Noto Sans", system-ui, -apple-system, sans-serif',
    'Open Sans': '"Open Sans", "Noto Sans", system-ui, sans-serif',
    'Lato': '"Lato", "Noto Sans", system-ui, sans-serif',
    'Source Sans Pro': '"Source Sans 3", "Source Sans Pro", "Noto Sans", system-ui, sans-serif',
    'Fira Sans': '"Fira Sans", "Noto Sans", system-ui, sans-serif',
    'PT Sans': '"PT Sans", "Noto Sans", system-ui, sans-serif',
    'Ubuntu': '"Ubuntu", "Noto Sans", system-ui, sans-serif',
    'Nunito': '"Nunito", "Noto Sans", system-ui, sans-serif',
};

export const APP_FONT_SIZES: Record<string, string> = {
    small: '13px',
    medium: '15px',
    large: '18px',
    xlarge: '22px'
};

export const READER_FONT_SIZES: Record<string, string> = {
    small: '14px',
    medium: '16px',
    large: '19px',
    xlarge: '23px'
};

export function applyFontSettings(font: string, fontSize?: string) {
    const fontFamily = FONT_FAMILIES[font] || FONT_FAMILIES['system-ui'];
    const currentSize = fontSize || 'medium';
    document.documentElement.style.setProperty('--app-font', fontFamily);
    document.documentElement.style.setProperty('--app-font-size', APP_FONT_SIZES[currentSize] || '15px');
    document.documentElement.style.setProperty('--reader-font-size', READER_FONT_SIZES[currentSize] || '16px');
}
