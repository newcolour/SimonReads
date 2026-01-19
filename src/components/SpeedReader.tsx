import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Settings } from 'lucide-react';
import './SpeedReader.css';

interface SpeedReaderProps {
    content: string;
    onClose: () => void;
    initialWpm?: number;
}

// Parse content to get clean words
const parseContent = (html: string): string[] => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = temp.textContent || temp.innerText || '';
    return text
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(word => word.length > 0);
};

// Find the optimal recognition point (ORP) - where eye naturally focuses
const findORP = (word: string): number => {
    const len = word.length;
    if (len <= 1) return 0;
    if (len <= 5) return Math.floor(len / 2);
    if (len <= 9) return 3;
    if (len <= 13) return 4;
    return 5;
};

export default function SpeedReader({ content, onClose, initialWpm = 300 }: SpeedReaderProps) {
    const [words, setWords] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [wpm, setWpm] = useState(initialWpm);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Parse content on mount
    useEffect(() => {
        setWords(parseContent(content));
    }, [content]);

    // Calculate interval from WPM
    const getInterval = useCallback(() => {
        return Math.round(60000 / wpm);
    }, [wpm]);

    // Handle word advancement
    useEffect(() => {
        if (!isPlaying || words.length === 0) return;

        intervalRef.current = setInterval(() => {
            setCurrentIndex(prev => {
                if (prev >= words.length - 1) {
                    setIsPlaying(false);
                    return prev;
                }

                // Adjust timing for punctuation
                const word = words[prev];
                if (word.match(/[.!?]$/)) {
                    // Pause longer for sentence endings
                    clearInterval(intervalRef.current!);
                    setTimeout(() => {
                        if (intervalRef.current === null) {
                            intervalRef.current = setInterval(() => {
                                setCurrentIndex(p => Math.min(p + 1, words.length - 1));
                            }, getInterval());
                        }
                    }, getInterval() * 2);
                }

                return prev + 1;
            });
        }, getInterval());

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [isPlaying, wpm, words.length, getInterval]);

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    setIsPlaying(p => !p);
                    break;
                case 'ArrowLeft':
                case 'j':
                    e.preventDefault();
                    setCurrentIndex(p => Math.max(0, p - 10));
                    break;
                case 'ArrowRight':
                case 'l':
                    e.preventDefault();
                    setCurrentIndex(p => Math.min(words.length - 1, p + 10));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setWpm(p => Math.min(1000, p + 25));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setWpm(p => Math.max(100, p - 25));
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [words.length, onClose]);

    const currentWord = words[currentIndex] || '';
    const orp = findORP(currentWord);
    const progress = words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0;

    // Split word for ORP highlighting
    const before = currentWord.substring(0, orp);
    const focus = currentWord.charAt(orp);
    const after = currentWord.substring(orp + 1);

    return (
        <div className="speed-reader-overlay" onClick={onClose}>
            <div className="speed-reader-container" onClick={e => e.stopPropagation()}>
                <button className="speed-reader-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <div className="speed-reader-display">
                    <div className="speed-reader-guides">
                        <div className="guide-line left"></div>
                        <div className="guide-marker"></div>
                        <div className="guide-line right"></div>
                    </div>

                    <div className="speed-reader-word">
                        <span className="word-before">{before}</span>
                        <span className="word-focus">{focus}</span>
                        <span className="word-after">{after}</span>
                    </div>
                </div>

                <div className="speed-reader-progress">
                    <div
                        className="progress-fill"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="speed-reader-controls">
                    <button
                        className="control-btn"
                        onClick={() => setCurrentIndex(p => Math.max(0, p - 10))}
                        title="Back 10 words (←)"
                    >
                        <SkipBack size={20} />
                    </button>

                    <button
                        className="control-btn primary"
                        onClick={() => setIsPlaying(!isPlaying)}
                        title="Play/Pause (Space)"
                    >
                        {isPlaying ? <Pause size={28} /> : <Play size={28} />}
                    </button>

                    <button
                        className="control-btn"
                        onClick={() => setCurrentIndex(p => Math.min(words.length - 1, p + 10))}
                        title="Forward 10 words (→)"
                    >
                        <SkipForward size={20} />
                    </button>

                    <button
                        className={`control-btn ${showSettings ? 'active' : ''}`}
                        onClick={() => setShowSettings(!showSettings)}
                        title="Settings"
                    >
                        <Settings size={20} />
                    </button>
                </div>

                {showSettings && (
                    <div className="speed-reader-settings">
                        <div className="setting-row">
                            <label>Speed</label>
                            <div className="speed-control">
                                <button onClick={() => setWpm(p => Math.max(100, p - 25))}>-</button>
                                <span className="speed-value">{wpm} WPM</span>
                                <button onClick={() => setWpm(p => Math.min(1000, p + 25))}>+</button>
                            </div>
                        </div>
                        <input
                            type="range"
                            min="100"
                            max="1000"
                            step="25"
                            value={wpm}
                            onChange={e => setWpm(Number(e.target.value))}
                            className="speed-slider"
                        />
                    </div>
                )}

                <div className="speed-reader-info">
                    <span>{currentIndex + 1} / {words.length}</span>
                    <span>~{Math.ceil((words.length - currentIndex) / wpm)} min left</span>
                </div>
            </div>
        </div>
    );
}
