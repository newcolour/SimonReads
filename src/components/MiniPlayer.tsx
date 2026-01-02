import { Play, Pause, X, SkipBack, SkipForward } from 'lucide-react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import './MiniPlayer.css';

interface MiniPlayerProps {
    onExpand?: () => void;
}

export default function MiniPlayer({ onExpand }: MiniPlayerProps) {
    const {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        pause,
        resume,
        stop,
        skip,
    } = useAudioPlayer();

    // Don't show if no track is loaded
    if (!currentTrack) {
        return null;
    }

    const formatTime = (seconds: number): string => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="mini-player">
            {/* Progress bar at top */}
            <div className="mini-player-progress">
                <div className="mini-player-progress-fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="mini-player-content">
                {/* Artwork */}
                <div className="mini-player-artwork" onClick={onExpand}>
                    {currentTrack.artwork ? (
                        <img src={currentTrack.artwork} alt="" />
                    ) : (
                        <div className="mini-player-artwork-placeholder">🎵</div>
                    )}
                </div>

                {/* Title and time */}
                <div className="mini-player-info" onClick={onExpand}>
                    <div className="mini-player-title">{currentTrack.title}</div>
                    <div className="mini-player-time">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                </div>

                {/* Controls */}
                <div className="mini-player-controls">
                    <button
                        className="mini-player-btn"
                        onClick={() => skip(-15)}
                        aria-label="Rewind 15 seconds"
                    >
                        <SkipBack size={18} />
                    </button>

                    <button
                        className="mini-player-btn play"
                        onClick={() => isPlaying ? pause() : resume()}
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                    </button>

                    <button
                        className="mini-player-btn"
                        onClick={() => skip(15)}
                        aria-label="Forward 15 seconds"
                    >
                        <SkipForward size={18} />
                    </button>

                    <button
                        className="mini-player-btn close"
                        onClick={stop}
                        aria-label="Close player"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
