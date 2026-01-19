import { useState, useEffect } from 'react';
import { Timer, Play, Pause } from 'lucide-react';
import { focusModeService } from '../services/focusModeService';
import type { FocusState } from '../services/focusModeService';
import './FocusTimerWidget.css';

interface FocusTimerWidgetProps {
    onClick: () => void;
}

export default function FocusTimerWidget({ onClick }: FocusTimerWidgetProps) {
    const [state, setState] = useState<FocusState>(focusModeService.getState());

    useEffect(() => {
        const unsubscribe = focusModeService.subscribe(setState);
        return unsubscribe;
    }, []);

    // Don't show widget if timer hasn't been started
    if (state.timeLeft === 25 * 60 && !state.isRunning && state.completedSessions === 0) {
        return null;
    }

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (state.isRunning) {
            focusModeService.pause();
        } else {
            focusModeService.start();
        }
    };

    return (
        <div
            className={`focus-timer-widget ${state.isRunning ? 'running' : 'paused'} ${state.sessionType === 'break' ? 'break' : ''}`}
            onClick={onClick}
            title="Click to open Focus Mode"
        >
            <Timer size={16} className="widget-icon" />
            <span className="widget-time">{formatTime(state.timeLeft)}</span>
            <button
                className="widget-toggle"
                onClick={handleToggle}
                title={state.isRunning ? "Pause" : "Resume"}
            >
                {state.isRunning ? <Pause size={14} /> : <Play size={14} />}
            </button>
        </div>
    );
}
