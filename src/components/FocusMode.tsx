import { useState, useEffect, useCallback } from 'react';
import { X, Play, Pause, RotateCcw, Coffee, StopCircle } from 'lucide-react';
import { focusModeService, FOCUS_DURATION, SHORT_BREAK_DURATION, LONG_BREAK_DURATION, SESSIONS_BEFORE_LONG_BREAK } from '../services/focusModeService';
import type { FocusState } from '../services/focusModeService';
import './FocusMode.css';

interface FocusModeProps {
    onClose: () => void;
    articleTitle?: string;
}

export default function FocusMode({ onClose, articleTitle }: FocusModeProps) {
    const [state, setState] = useState<FocusState>(focusModeService.getState());

    useEffect(() => {
        // Subscribe to focus mode service updates
        const unsubscribe = focusModeService.subscribe(setState);
        return unsubscribe;
    }, []);

    // Format time as MM:SS
    const formatTime = useCallback((seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Start/pause timer
    const toggleTimer = useCallback(() => {
        if (state.isRunning) {
            focusModeService.pause();
        } else {
            focusModeService.start(articleTitle);
        }
    }, [state.isRunning, articleTitle]);

    // Reset timer
    const resetTimer = useCallback(() => {
        focusModeService.reset();
    }, []);

    // Skip to next session
    const skipSession = useCallback(() => {
        focusModeService.skip();
    }, []);

    // Stop entire session
    const stopSession = useCallback(() => {
        if (confirm('End this focus session? Your progress will be saved to stats.')) {
            focusModeService.stopSession();
            onClose();
        }
    }, [onClose]);

    // Calculate progress percentage
    const totalDuration = state.sessionType === 'focus' ? FOCUS_DURATION :
        (state.completedSessions % SESSIONS_BEFORE_LONG_BREAK === 0 ? LONG_BREAK_DURATION : SHORT_BREAK_DURATION);
    const progressPercent = ((totalDuration - state.timeLeft) / totalDuration) * 100;

    return (
        <div className="focus-mode-overlay">
            <div className="focus-mode-container">
                <button className="focus-close-btn" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="focus-content">
                    <div className="focus-header">
                        <h2>{state.sessionType === 'focus' ? '🎯 Focus Time' : '☕ Break Time'}</h2>
                        {(articleTitle || state.articleTitle) && (
                            <p className="focus-article-title">Reading: {articleTitle || state.articleTitle}</p>
                        )}
                        <p className="focus-description">
                            {state.sessionType === 'focus'
                                ? 'Focus on reading for 25 minutes. Minimize distractions and immerse yourself in the content. The timer continues even if you close this window.'
                                : 'Take a break! Step away from the screen, stretch, or grab a drink. You\'ve earned it! 🎉'
                            }
                        </p>
                    </div>

                    <div className="focus-timer-container">
                        <svg className="focus-progress-ring" viewBox="0 0 200 200">
                            <circle
                                className="focus-progress-bg"
                                cx="100"
                                cy="100"
                                r="90"
                            />
                            <circle
                                className="focus-progress-bar"
                                cx="100"
                                cy="100"
                                r="90"
                                style={{
                                    strokeDasharray: `${2 * Math.PI * 90}`,
                                    strokeDashoffset: `${2 * Math.PI * 90 * (1 - progressPercent / 100)}`
                                }}
                            />
                        </svg>
                        <div className="focus-timer">{formatTime(state.timeLeft)}</div>
                    </div>

                    <div className="focus-controls">
                        <button className="focus-btn secondary" onClick={resetTimer}>
                            <RotateCcw size={20} />
                        </button>
                        <button className="focus-btn primary" onClick={toggleTimer}>
                            {state.isRunning ? <Pause size={28} /> : <Play size={28} />}
                        </button>
                        <button className="focus-btn secondary" onClick={skipSession}>
                            <Coffee size={20} />
                        </button>
                    </div>

                    <div className="focus-stats">
                        <div className="focus-stat">
                            <span className="focus-stat-value">{state.completedSessions}</span>
                            <span className="focus-stat-label">Sessions</span>
                        </div>
                        <div className="focus-stat">
                            <span className="focus-stat-value">{Math.floor(state.totalFocusTime / 60)}</span>
                            <span className="focus-stat-label">Minutes Focused</span>
                        </div>
                    </div>

                    <div className="focus-session-dots">
                        {[...Array(SESSIONS_BEFORE_LONG_BREAK)].map((_, i) => (
                            <div
                                key={i}
                                className={`focus-dot ${i < state.completedSessions % SESSIONS_BEFORE_LONG_BREAK ? 'completed' : ''}`}
                            />
                        ))}
                    </div>

                    <button className="focus-stop-btn" onClick={stopSession}>
                        <StopCircle size={18} />
                        End Focus Session
                    </button>
                </div>
            </div>
        </div>
    );
}
