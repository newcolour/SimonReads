import { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, X, ListMusic, Trash2, Gauge } from 'lucide-react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import './DriveMode.css';

export default function DriveMode() {
    const {
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        playbackRate,
        queue,
        queueIndex,
        isDriveModeOpen,
        closeDriveMode,
        pause,
        resume,
        skip,
        seek,
        setPlaybackRate,
        playNext,
        playPrevious,
        playQueueIndex,
        removeFromQueue,
        clearQueue
    } = useAudioPlayer();

    const [showQueue, setShowQueue] = useState(false);

    if (!isDriveModeOpen) {
        return null;
    }

    const formatTime = (seconds: number): string => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const remainingTime = duration > currentTime ? duration - currentTime : 0;

    const speeds = [1.0, 1.25, 1.5, 1.75, 2.0];

    const cycleSpeed = () => {
        const currentIndex = speeds.indexOf(playbackRate);
        const nextSpeed = speeds[(currentIndex + 1) % speeds.length] || 1.0;
        setPlaybackRate(nextSpeed);
    };

    return (
        <div className="drive-mode-overlay">
            {/* Ambient Blurred Background */}
            <div
                className="drive-mode-backdrop"
                style={{ backgroundImage: currentTrack?.artwork ? `url(${currentTrack.artwork})` : 'none' }}
            />
            <div className="drive-mode-vignette" />

            <div className="drive-mode-container">
                {/* Top Nav */}
                <div className="drive-mode-topbar">
                    <div className="drive-badge">
                        <Gauge size={18} />
                        <span>DRIVE TIME</span>
                    </div>

                    <div className="topbar-actions">
                        <button
                            className={`topbar-btn ${showQueue ? 'active' : ''}`}
                            onClick={() => setShowQueue(!showQueue)}
                            title="Playlist Queue"
                        >
                            <ListMusic size={22} />
                            {queue.length > 0 && <span className="queue-count-badge">{queue.length}</span>}
                        </button>

                        <button className="topbar-btn" onClick={closeDriveMode} title="Exit Drive Mode">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                {!showQueue ? (
                    <div className="drive-player-view">
                        {/* Artwork */}
                        <div className="drive-artwork-wrapper">
                            {currentTrack?.artwork ? (
                                <img src={currentTrack.artwork} alt="" className="drive-artwork" />
                            ) : (
                                <div className="drive-artwork-placeholder">
                                    <span>📻</span>
                                </div>
                            )}
                        </div>

                        {/* Title & Metadata */}
                        <div className="drive-track-info">
                            <h1 className="drive-title">{currentTrack?.title || 'No Audio Playing'}</h1>
                            <p className="drive-subtitle">
                                {currentTrack?.feedTitle || (currentTrack ? 'Audio Queue' : 'Add podcasts or articles to start')}
                            </p>
                        </div>

                        {/* Scrub / Progress Bar */}
                        <div className="drive-progress-container">
                            <input
                                type="range"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={e => seek(Number(e.target.value))}
                                className="drive-slider"
                            />
                            <div className="drive-time-labels">
                                <span>{formatTime(currentTime)}</span>
                                <span>-{formatTime(remainingTime)}</span>
                            </div>
                        </div>

                        {/* Large Transport Controls */}
                        <div className="drive-controls-row">
                            {/* Skip Back 30s */}
                            <button className="drive-ctrl-btn secondary" onClick={() => skip(-30)} title="Rewind 30s">
                                <RotateCcw size={32} />
                                <span className="btn-subtext">30</span>
                            </button>

                            {/* Previous Track */}
                            <button
                                className="drive-ctrl-btn secondary"
                                onClick={playPrevious}
                                disabled={queueIndex <= 0}
                                title="Previous Track"
                            >
                                <SkipBack size={36} />
                            </button>

                            {/* Giant Play/Pause */}
                            <button
                                className="drive-ctrl-btn giant-play"
                                onClick={() => (isPlaying ? pause() : resume())}
                                title={isPlaying ? 'Pause' : 'Play'}
                            >
                                {isPlaying ? <Pause size={48} /> : <Play size={48} className="play-icon" />}
                            </button>

                            {/* Next Track */}
                            <button
                                className="drive-ctrl-btn secondary"
                                onClick={playNext}
                                disabled={queueIndex >= queue.length - 1}
                                title="Next Track"
                            >
                                <SkipForward size={36} />
                            </button>

                            {/* Skip Forward 30s */}
                            <button className="drive-ctrl-btn secondary" onClick={() => skip(30)} title="Forward 30s">
                                <RotateCw size={32} />
                                <span className="btn-subtext">30</span>
                            </button>
                        </div>

                        {/* Bottom Utility Bar (Speed) */}
                        <div className="drive-footer-bar">
                            <button className="speed-toggle-btn" onClick={cycleSpeed}>
                                {playbackRate}x SPEED
                            </button>
                            <div className="track-position-indicator">
                                Track {queueIndex >= 0 ? queueIndex + 1 : 0} of {queue.length}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Queue Drawer View */
                    <div className="drive-queue-view">
                        <div className="queue-header">
                            <h2>Playlist Queue ({queue.length} tracks)</h2>
                            {queue.length > 0 && (
                                <button className="clear-queue-btn" onClick={clearQueue}>
                                    <Trash2 size={16} />
                                    <span>Clear Queue</span>
                                </button>
                            )}
                        </div>

                        <div className="queue-list">
                            {queue.length === 0 ? (
                                <div className="empty-queue-msg">
                                    <ListMusic size={48} />
                                    <p>Your audio queue is empty</p>
                                    <span>Play any podcast or click 'Add to Queue' from articles to build a playlist.</span>
                                </div>
                            ) : (
                                queue.map((track, idx) => {
                                    const isCurrent = idx === queueIndex;
                                    return (
                                        <div
                                            key={track.id || idx}
                                            className={`queue-item ${isCurrent ? 'active' : ''}`}
                                            onClick={() => playQueueIndex(idx)}
                                        >
                                            <div className="queue-item-index">
                                                {isCurrent && isPlaying ? '▶' : idx + 1}
                                            </div>
                                            <div className="queue-item-details">
                                                <div className="queue-item-title">{track.title}</div>
                                                <div className="queue-item-meta">{track.feedTitle || 'Audio Track'}</div>
                                            </div>
                                            <button
                                                className="queue-item-remove"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    removeFromQueue(idx);
                                                }}
                                                title="Remove from queue"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <button className="back-to-player-btn" onClick={() => setShowQueue(false)}>
                            Back to Player
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
