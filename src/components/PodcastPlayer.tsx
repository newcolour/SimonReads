import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useAudioPlayer, AudioTrack } from '../contexts/AudioPlayerContext';
import './PodcastPlayer.css';

interface PodcastPlayerProps {
    url: string;
    type: 'audio' | 'video';
    title: string;
    duration?: string;
    artwork?: string;
    articleId?: string;
}

export default function PodcastPlayer({ url, type, title, duration, artwork, articleId }: PodcastPlayerProps) {
    const {
        currentTrack,
        isPlaying,
        currentTime,
        duration: totalDuration,
        volume,
        isMuted,
        playbackRate,
        play,
        pause,
        resume,
        seek,
        setVolume,
        toggleMute,
        skip,
        setPlaybackRate,
    } = useAudioPlayer();

    // Check if this player's track is currently playing
    const isCurrentTrack = currentTrack?.url === url;
    const isThisPlaying = isCurrentTrack && isPlaying;

    const handleTogglePlay = () => {
        if (type === 'video') {
            // Video uses local state (not global audio player)
            return;
        }

        if (isCurrentTrack) {
            // Same track - toggle play/pause
            if (isPlaying) {
                pause();
            } else {
                resume();
            }
        } else {
            // New track - play it (this will stop any other playing audio)
            const track: AudioTrack = {
                url,
                title,
                artwork,
                articleId,
                duration,
            };
            play(track);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isCurrentTrack) return;
        const newTime = parseFloat(e.target.value);
        seek(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
    };

    const handleSkip = (seconds: number) => {
        if (!isCurrentTrack) return;
        skip(seconds);
    };

    const cyclePlaybackRate = () => {
        const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];
        setPlaybackRate(nextRate);
    };

    const formatTime = (seconds: number): string => {
        if (isNaN(seconds)) return '0:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
            return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // For video, we keep the old behavior with local video element
    if (type === 'video') {
        return (
            <div className="podcast-player">
                <div className="video-container">
                    <video
                        src={url}
                        controls
                        className="video-element"
                    />
                </div>
            </div>
        );
    }

    // Current display time and duration
    const displayTime = isCurrentTrack ? currentTime : 0;
    const displayDuration = isCurrentTrack ? totalDuration : 0;

    return (
        <div className={`podcast-player ${isCurrentTrack ? 'active' : ''}`}>
            <div className="audio-artwork">
                {artwork ? (
                    <img src={artwork} alt={title} />
                ) : (
                    <div className="artwork-placeholder">
                        <Volume2 size={48} />
                    </div>
                )}
            </div>

            <div className="player-controls">
                <div className="player-info">
                    <h4 className="player-title">{title}</h4>
                    <div className="player-time">
                        {formatTime(displayTime)} / {formatTime(displayDuration || 0)}
                        {duration && !displayDuration && ` (${duration})`}
                    </div>
                </div>

                <div className="progress-bar">
                    <input
                        type="range"
                        min="0"
                        max={displayDuration || 0}
                        value={displayTime}
                        onChange={handleSeek}
                        className="progress-slider"
                        disabled={!isCurrentTrack}
                    />
                </div>

                <div className="control-buttons">
                    <button
                        onClick={() => handleSkip(-15)}
                        className="control-btn"
                        title="Rewind 15s"
                        disabled={!isCurrentTrack}
                    >
                        <SkipBack size={20} />
                        <span className="skip-label">15</span>
                    </button>

                    <button
                        onClick={handleTogglePlay}
                        className="play-btn"
                        title={isThisPlaying ? 'Pause' : 'Play'}
                    >
                        {isThisPlaying ? <Pause size={28} /> : <Play size={28} />}
                    </button>

                    <button
                        onClick={() => handleSkip(15)}
                        className="control-btn"
                        title="Forward 15s"
                        disabled={!isCurrentTrack}
                    >
                        <SkipForward size={20} />
                        <span className="skip-label">15</span>
                    </button>

                    <button
                        onClick={cyclePlaybackRate}
                        className="rate-btn"
                        title="Playback speed"
                    >
                        {playbackRate}x
                    </button>

                    <div className="volume-control">
                        <button onClick={toggleMute} className="control-btn" title={isMuted ? 'Unmute' : 'Mute'}>
                            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={handleVolumeChange}
                            className="volume-slider"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
