import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import './PodcastPlayer.css';

interface PodcastPlayerProps {
    url: string;
    type: 'audio' | 'video';
    title: string;
    duration?: string;
    artwork?: string;
}

export default function PodcastPlayer({ url, type, title, duration, artwork }: PodcastPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [totalDuration, setTotalDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement>(null);

    useEffect(() => {
        const media = mediaRef.current;
        if (!media) return;

        const updateTime = () => setCurrentTime(media.currentTime);
        const updateDuration = () => setTotalDuration(media.duration);
        const handleEnded = () => setIsPlaying(false);

        media.addEventListener('timeupdate', updateTime);
        media.addEventListener('loadedmetadata', updateDuration);
        media.addEventListener('ended', handleEnded);

        return () => {
            media.removeEventListener('timeupdate', updateTime);
            media.removeEventListener('loadedmetadata', updateDuration);
            media.removeEventListener('ended', handleEnded);
        };
    }, []);

    const togglePlay = () => {
        const media = mediaRef.current;
        if (!media) return;

        if (isPlaying) {
            media.pause();
        } else {
            media.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const media = mediaRef.current;
        if (!media) return;

        const newTime = parseFloat(e.target.value);
        media.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const media = mediaRef.current;
        if (!media) return;

        const newVolume = parseFloat(e.target.value);
        media.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const toggleMute = () => {
        const media = mediaRef.current;
        if (!media) return;

        media.muted = !isMuted;
        setIsMuted(!isMuted);
    };

    const skip = (seconds: number) => {
        const media = mediaRef.current;
        if (!media) return;

        media.currentTime = Math.max(0, Math.min(media.duration, media.currentTime + seconds));
    };

    const changePlaybackRate = () => {
        const media = mediaRef.current;
        if (!media) return;

        const rates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];
        media.playbackRate = nextRate;
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

    return (
        <div className="podcast-player">
            {type === 'video' ? (
                <div className="video-container">
                    <video
                        ref={mediaRef as React.RefObject<HTMLVideoElement>}
                        src={url}
                        controls={false}
                        className="video-element"
                    />
                </div>
            ) : (
                <div className="audio-artwork">
                    {artwork ? (
                        <img src={artwork} alt={title} />
                    ) : (
                        <div className="artwork-placeholder">
                            <Volume2 size={48} />
                        </div>
                    )}
                    <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} src={url} />
                </div>
            )}

            <div className="player-controls">
                <div className="player-info">
                    <h4 className="player-title">{title}</h4>
                    <div className="player-time">
                        {formatTime(currentTime)} / {formatTime(totalDuration || 0)}
                        {duration && !totalDuration && ` (${duration})`}
                    </div>
                </div>

                <div className="progress-bar">
                    <input
                        type="range"
                        min="0"
                        max={totalDuration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="progress-slider"
                    />
                </div>

                <div className="control-buttons">
                    <button onClick={() => skip(-15)} className="control-btn" title="Rewind 15s">
                        <SkipBack size={20} />
                        <span className="skip-label">15</span>
                    </button>

                    <button onClick={togglePlay} className="play-btn" title={isPlaying ? 'Pause' : 'Play'}>
                        {isPlaying ? <Pause size={28} /> : <Play size={28} />}
                    </button>

                    <button onClick={() => skip(15)} className="control-btn" title="Forward 15s">
                        <SkipForward size={20} />
                        <span className="skip-label">15</span>
                    </button>

                    <button onClick={changePlaybackRate} className="rate-btn" title="Playback speed">
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
