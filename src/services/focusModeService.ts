/**
 * Focus Mode Service - Manages persistent focus timer state
 * Allows timer to continue running even when modal is closed
 */

type SessionType = 'focus' | 'break';

interface FocusState {
    timeLeft: number;
    isRunning: boolean;
    sessionType: SessionType;
    completedSessions: number;
    totalFocusTime: number;
    articleTitle?: string;
}

type FocusStateListener = (state: FocusState) => void;

const FOCUS_DURATION = 25 * 60; // 25 minutes in seconds
const SHORT_BREAK_DURATION = 5 * 60; // 5 minutes
const LONG_BREAK_DURATION = 15 * 60; // 15 minutes
const SESSIONS_BEFORE_LONG_BREAK = 4;

class FocusModeService {
    private state: FocusState = {
        timeLeft: FOCUS_DURATION,
        isRunning: false,
        sessionType: 'focus',
        completedSessions: 0,
        totalFocusTime: 0
    };

    private listeners: Set<FocusStateListener> = new Set();
    private intervalId: ReturnType<typeof setInterval> | null = null;

    subscribe(listener: FocusStateListener): () => void {
        this.listeners.add(listener);
        // Immediately call with current state
        listener(this.state);

        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners() {
        // Create a new object so React detects the change
        this.listeners.forEach(listener => listener({ ...this.state }));
    }

    getState(): FocusState {
        return { ...this.state };
    }

    start(articleTitle?: string) {
        if (this.state.isRunning) return;

        if (articleTitle) {
            this.state.articleTitle = articleTitle;
        }

        this.state.isRunning = true;
        this.notifyListeners();

        this.intervalId = setInterval(() => {
            this.state.timeLeft--;

            if (this.state.timeLeft <= 0) {
                this.handleSessionComplete();
            }

            this.notifyListeners();
        }, 1000);
    }

    pause() {
        if (!this.state.isRunning) return;

        this.state.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.notifyListeners();
    }

    reset() {
        this.pause();
        this.state.timeLeft = this.state.sessionType === 'focus' ? FOCUS_DURATION : SHORT_BREAK_DURATION;
        this.notifyListeners();
    }

    skip() {
        this.pause();

        if (this.state.sessionType === 'focus') {
            this.state.sessionType = 'break';
            this.state.timeLeft = SHORT_BREAK_DURATION;
        } else {
            this.state.sessionType = 'focus';
            this.state.timeLeft = FOCUS_DURATION;
        }

        this.notifyListeners();
    }

    stopSession() {
        this.pause();
        // Reset everything to initial state
        this.state.timeLeft = FOCUS_DURATION;
        this.state.sessionType = 'focus';
        this.state.completedSessions = 0;
        this.state.totalFocusTime = 0;
        this.state.articleTitle = undefined;
        this.notifyListeners();
    }

    private handleSessionComplete() {
        this.pause();

        if (this.state.sessionType === 'focus') {
            this.state.completedSessions++;
            this.state.totalFocusTime += FOCUS_DURATION;

            // Determine break type
            const nextBreakDuration = this.state.completedSessions % SESSIONS_BEFORE_LONG_BREAK === 0
                ? LONG_BREAK_DURATION
                : SHORT_BREAK_DURATION;

            this.state.sessionType = 'break';
            this.state.timeLeft = nextBreakDuration;

            this.playNotificationSound();
            this.showNotification('Focus session complete!', 'Time for a break 🎉');
        } else {
            // Break complete
            this.state.sessionType = 'focus';
            this.state.timeLeft = FOCUS_DURATION;

            this.playNotificationSound();
            this.showNotification('Break over!', 'Ready to focus again? 💪');
        }

        this.notifyListeners();
    }

    private playNotificationSound() {
        try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {
                // Fallback: use Web Audio API beep
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;

                oscillator.start();
                setTimeout(() => oscillator.stop(), 200);
            });
        } catch (e) {
            console.log('Could not play sound');
        }
    }

    private showNotification(title: string, body: string) {
        if (typeof Notification === 'undefined') return;

        if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/icon.png' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body, icon: '/icon.png' });
                }
            });
        }
    }
}

// Export singleton instance
export const focusModeService = new FocusModeService();
export type { FocusState, SessionType };
export { FOCUS_DURATION, SHORT_BREAK_DURATION, LONG_BREAK_DURATION, SESSIONS_BEFORE_LONG_BREAK };
