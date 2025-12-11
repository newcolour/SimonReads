import { useState } from 'react';
import { Check } from 'lucide-react';
import { ReadingPersonality, PersonalitySchedule, AutoSwitchTrigger } from '../types';
import { personalityConfigs } from '../personalityConfig';
import './PersonalitySelector.css';

interface PersonalitySelectorProps {
    currentPersonality: ReadingPersonality;
    autoSwitchEnabled: boolean;
    autoSwitchTrigger: AutoSwitchTrigger;
    personalitySchedule: PersonalitySchedule;
    onPersonalityChange: (personality: ReadingPersonality) => void;
    onAutoSwitchChange: (enabled: boolean, trigger: AutoSwitchTrigger) => void;
    onScheduleChange: (schedule: PersonalitySchedule) => void;
}

export default function PersonalitySelector({
    currentPersonality,
    autoSwitchEnabled,
    autoSwitchTrigger,
    personalitySchedule,
    onPersonalityChange,
    onAutoSwitchChange,
    onScheduleChange
}: PersonalitySelectorProps) {
    const [activeView, setActiveView] = useState<'select' | 'schedule'>('select');

    const config = personalityConfigs[currentPersonality];

    const handleScheduleUpdate = (timeOfDay: keyof PersonalitySchedule, value: ReadingPersonality | undefined) => {
        onScheduleChange({
            ...personalitySchedule,
            [timeOfDay]: value
        });
    };

    return (
        <div className="personality-selector">
            <div className="personality-header">
                <h3>Reading Personality</h3>
                <p className="personality-subtitle">
                    Adapt the app's tone, layout, and article selection to match your context
                </p>
            </div>

            {/* Current Personality Display */}
            <div className="current-personality-display">
                <span className="personality-display-icon">{config.icon}</span>
                <div className="personality-display-info">
                    <div className="personality-display-name">{config.name}</div>
                    <div className="personality-display-desc">{config.description}</div>
                </div>
            </div>

            {/* Auto-Switch Toggle */}
            <div className="auto-switch-section">
                <label className="switch-label">
                    <input
                        type="checkbox"
                        checked={autoSwitchEnabled}
                        onChange={(e) => onAutoSwitchChange(e.target.checked, autoSwitchTrigger)}
                    />
                    Enable Automatic Switching
                </label>
                {autoSwitchEnabled && (
                    <select
                        value={autoSwitchTrigger}
                        onChange={(e) => onAutoSwitchChange(true, e.target.value as AutoSwitchTrigger)}
                        className="trigger-select"
                    >
                        <option value="time">Time of Day</option>
                        <option value="device">Device Type</option>
                        <option value="manual">Manual Only</option>
                    </select>
                )}
            </div>

            {/* View Tabs */}
            <div className="personality-tabs">
                <button
                    className={activeView === 'select' ? 'active' : ''}
                    onClick={() => setActiveView('select')}
                >
                    Select Personality
                </button>
                {autoSwitchEnabled && autoSwitchTrigger === 'time' && (
                    <button
                        className={activeView === 'schedule' ? 'active' : ''}
                        onClick={() => setActiveView('schedule')}
                    >
                        Time Schedule
                    </button>
                )}
            </div>

            {/* Personality Selection */}
            {activeView === 'select' && (
                <div className="personality-grid">
                    {(Object.keys(personalityConfigs) as ReadingPersonality[]).map((personalityId) => {
                        const personality = personalityConfigs[personalityId];
                        const isActive = personalityId === currentPersonality;

                        return (
                            <button
                                key={personalityId}
                                className={`personality-card ${isActive ? 'active' : ''}`}
                                onClick={() => onPersonalityChange(personalityId)}
                            >
                                {isActive && <Check className="check-icon" size={16} />}
                                <div className="personality-card-icon">{personality.icon}</div>
                                <div className="personality-card-name">{personality.name}</div>
                                <div className="personality-card-desc">{personality.description}</div>
                                <div className="personality-card-features">
                                    <span className="feature-badge">{personality.summaryTone}</span>
                                    <span className="feature-badge">{personality.contentDensity}</span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Time-Based Schedule */}
            {activeView === 'schedule' && autoSwitchEnabled && autoSwitchTrigger === 'time' && (
                <div className="schedule-config">
                    <label>
                        <input
                            type="checkbox"
                            checked={personalitySchedule.enabled}
                            onChange={(e) => onScheduleChange({
                                ...personalitySchedule,
                                enabled: e.target.checked
                            })}
                        />
                        Enable Time-Based Schedule
                    </label>

                    {personalitySchedule.enabled && (
                        <div className="schedule-times">
                            {[
                                { key: 'morning' as const, label: 'Morning (6am - 12pm)', default: 'daily-brief' as ReadingPersonality },
                                { key: 'afternoon' as const, label: 'Afternoon (12pm - 6pm)', default: 'conversational-curator' as ReadingPersonality },
                                { key: 'evening' as const, label: 'Evening (6pm - 12am)', default: 'deep-diver' as ReadingPersonality },
                                { key: 'night' as const, label: 'Night (12am - 6am)', default: 'focused-minimalist' as ReadingPersonality }
                            ].map(({ key, label, default: defaultVal }) => (
                                <div key={key} className="schedule-time-slot">
                                    <label>{label}</label>
                                    <select
                                        value={personalitySchedule[key] || defaultVal}
                                        onChange={(e) => handleScheduleUpdate(key, e.target.value as ReadingPersonality)}
                                    >
                                        {(Object.keys(personalityConfigs) as ReadingPersonality[]).map((pid) => (
                                            <option key={pid} value={pid}>
                                                {personalityConfigs[pid].icon} {personalityConfigs[pid].name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
