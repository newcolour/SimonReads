import { useEffect } from 'react';
import { AppSettings, ReadingPersonality } from '../types';
import { personalityConfigs, getTimeBasedPersonality, applyPersonality } from '../personalityConfig';

/**
 * Hook to automatically switch personalities based on settings and apply their configurations
 */
export function usePersonalityAutoSwitch(
    settings: AppSettings,
    onSettingsChange: (settings: AppSettings) => void
) {
    useEffect(() => {
        if (!settings.autoSwitchEnabled) return;

        // Time-based switching
        if (settings.autoSwitchTrigger === 'time') {
            const checkAndSwitch = () => {
                const suggestedPersonality = getTimeBasedPersonality(settings.personalitySchedule);

                if (suggestedPersonality && suggestedPersonality !== settings.readingPersonality) {
                    console.log(`Auto-switching personality from ${settings.readingPersonality} to ${suggestedPersonality} based on time`);
                    const updatedSettings = applyPersonality(settings, suggestedPersonality);
                    onSettingsChange(updatedSettings);
                }
            };

            // Check immediately
            checkAndSwitch();

            // Check every minute for time-based switches
            const interval = setInterval(checkAndSwitch, 60 * 1000);

            return () => clearInterval(interval);
        }

        // Device-based switching can be added here if needed
        // For now, it's manual only
    }, [settings.autoSwitchEnabled, settings.autoSwitchTrigger, settings.personalitySchedule, settings.readingPersonality]);
}

/**
 * Get the current personality configuration
 */
export function usePersonalityConfig(personality: ReadingPersonality) {
    return personalityConfigs[personality];
}
