import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export interface AudioTrack {
    id?: string;
    url: string;
    title: string;
    artwork?: string;
    articleId?: string;
    duration?: string;
    feedTitle?: string;
    type?: 'podcast' | 'tts';
}

interface AudioPlayerState {
    currentTrack: AudioTrack | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
    queue: AudioTrack[];
    queueIndex: number;
    isDriveModeOpen: boolean;
}

interface AudioPlayerContextValue extends AudioPlayerState {
    play: (track: AudioTrack) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
    skip: (seconds: number) => void;
    setPlaybackRate: (rate: number) => void;
    audioRef: React.RefObject<HTMLAudioElement>;
    // Queue & Drive Mode features
    addToQueue: (track: AudioTrack) => void;
    addTracksToQueue: (tracks: AudioTrack[]) => void;
    removeFromQueue: (index: number) => void;
    clearQueue: () => void;
    playNext: () => void;
    playPrevious: () => void;
    playQueueIndex: (index: number) => void;
    reorderQueue: (startIndex: number, endIndex: number) => void;
    openDriveMode: () => void;
    closeDriveMode: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

export function useAudioPlayer() {
    const context = useContext(AudioPlayerContext);
    if (!context) {
        throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
    }
    return context;
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [state, setState] = useState<AudioPlayerState>({
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isMuted: false,
        playbackRate: 1,
        queue: [],
        queueIndex: -1,
        isDriveModeOpen: false,
    });

    const stateRef = useRef(state);
    stateRef.current = state;

    const playTrackInternal = useCallback((track: AudioTrack, index?: number) => {
        const audio = audioRef.current;
        if (!audio) return;

        const current = stateRef.current;

        // If it's the same track and already loaded, resume
        if (current.currentTrack?.url === track.url && audio.src.includes(track.url)) {
            audio.play().catch(e => console.warn('Audio resume failed:', e));
            return;
        }

        audio.src = track.url;
        audio.volume = current.volume;
        audio.muted = current.isMuted;
        audio.playbackRate = current.playbackRate;
        audio.play().catch(e => console.warn('Audio play failed:', e));

        setState(prev => ({
            ...prev,
            currentTrack: track,
            queueIndex: typeof index === 'number' ? index : prev.queue.findIndex(t => t.url === track.url),
            currentTime: 0,
            duration: 0,
            isPlaying: true,
        }));
    }, []);

    const playNext = useCallback(() => {
        const { queue, queueIndex } = stateRef.current;
        if (queue.length === 0) return;

        const nextIndex = queueIndex + 1;
        if (nextIndex < queue.length) {
            playTrackInternal(queue[nextIndex], nextIndex);
        } else {
            // Reached end of queue
            setState(prev => ({ ...prev, isPlaying: false }));
        }
    }, [playTrackInternal]);

    const playPrevious = useCallback(() => {
        const { queue, queueIndex } = stateRef.current;
        if (queue.length === 0) return;

        const prevIndex = queueIndex - 1;
        if (prevIndex >= 0) {
            playTrackInternal(queue[prevIndex], prevIndex);
        }
    }, [playTrackInternal]);

    // Set up audio event listeners
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setState(prev => ({ ...prev, currentTime: audio.currentTime }));
        };

        const handleLoadedMetadata = () => {
            setState(prev => ({ ...prev, duration: audio.duration }));
        };

        const handleEnded = () => {
            // Auto-advance to next track in queue!
            const { queue, queueIndex } = stateRef.current;
            if (queue.length > 0 && queueIndex < queue.length - 1) {
                playNext();
            } else {
                setState(prev => ({ ...prev, isPlaying: false }));
            }
        };

        const handlePlay = () => {
            setState(prev => ({ ...prev, isPlaying: true }));
        };

        const handlePause = () => {
            setState(prev => ({ ...prev, isPlaying: false }));
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [playNext]);

    const play = useCallback((track: AudioTrack) => {
        const normalizedTrack = {
            ...track,
            id: track.id || track.articleId || `track_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        };

        // Add to queue if not already present
        setState(prev => {
            const existsIndex = prev.queue.findIndex(t => t.url === normalizedTrack.url);
            let newQueue = [...prev.queue];
            let newIndex = existsIndex;

            if (existsIndex === -1) {
                newQueue.push(normalizedTrack);
                newIndex = newQueue.length - 1;
            }

            return {
                ...prev,
                queue: newQueue,
                queueIndex: newIndex
            };
        });

        playTrackInternal(normalizedTrack);
    }, [playTrackInternal]);

    const addToQueue = useCallback((track: AudioTrack) => {
        const normalizedTrack = {
            ...track,
            id: track.id || track.articleId || `track_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
        };

        setState(prev => {
            // If already in queue, don't duplicate
            if (prev.queue.some(t => t.url === normalizedTrack.url)) {
                return prev;
            }
            return {
                ...prev,
                queue: [...prev.queue, normalizedTrack]
            };
        });
    }, []);

    const addTracksToQueue = useCallback((tracks: AudioTrack[]) => {
        setState(prev => {
            const existingUrls = new Set(prev.queue.map(t => t.url));
            const newTracks = tracks.filter(t => !existingUrls.has(t.url)).map(t => ({
                ...t,
                id: t.id || t.articleId || `track_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
            }));
            return {
                ...prev,
                queue: [...prev.queue, ...newTracks]
            };
        });
    }, []);

    const removeFromQueue = useCallback((index: number) => {
        setState(prev => {
            const newQueue = prev.queue.filter((_, i) => i !== index);
            let newQueueIndex = prev.queueIndex;

            if (index < prev.queueIndex) {
                newQueueIndex -= 1;
            } else if (index === prev.queueIndex) {
                // If removing currently playing track, clamp or reset
                newQueueIndex = Math.min(newQueueIndex, newQueue.length - 1);
            }

            return {
                ...prev,
                queue: newQueue,
                queueIndex: newQueueIndex
            };
        });
    }, []);

    const clearQueue = useCallback(() => {
        setState(prev => ({
            ...prev,
            queue: prev.currentTrack ? [prev.currentTrack] : [],
            queueIndex: prev.currentTrack ? 0 : -1
        }));
    }, []);

    const playQueueIndex = useCallback((index: number) => {
        const { queue } = stateRef.current;
        if (index >= 0 && index < queue.length) {
            playTrackInternal(queue[index], index);
        }
    }, [playTrackInternal]);

    const reorderQueue = useCallback((startIndex: number, endIndex: number) => {
        setState(prev => {
            const result = Array.from(prev.queue);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);

            let newQueueIndex = prev.queueIndex;
            if (prev.queueIndex === startIndex) {
                newQueueIndex = endIndex;
            } else if (startIndex < prev.queueIndex && endIndex >= prev.queueIndex) {
                newQueueIndex -= 1;
            } else if (startIndex > prev.queueIndex && endIndex <= prev.queueIndex) {
                newQueueIndex += 1;
            }

            return {
                ...prev,
                queue: result,
                queueIndex: newQueueIndex
            };
        });
    }, []);

    const openDriveMode = useCallback(() => {
        setState(prev => ({ ...prev, isDriveModeOpen: true }));
    }, []);

    const closeDriveMode = useCallback(() => {
        setState(prev => ({ ...prev, isDriveModeOpen: false }));
    }, []);

    const pause = useCallback(() => {
        audioRef.current?.pause();
        setState(prev => ({ ...prev, isPlaying: false }));
    }, []);

    const resume = useCallback(() => {
        audioRef.current?.play().catch(e => console.warn('Resume error:', e));
        setState(prev => ({ ...prev, isPlaying: true }));
    }, []);

    const stop = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            audio.src = '';
        }
        setState(prev => ({
            ...prev,
            currentTrack: null,
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            queueIndex: -1
        }));
    }, []);

    const seek = useCallback((time: number) => {
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = Math.max(0, Math.min(audio.duration || 0, time));
        }
    }, []);

    const setVolume = useCallback((volume: number) => {
        const audio = audioRef.current;
        if (audio) {
            audio.volume = volume;
        }
        setState(prev => ({ ...prev, volume, isMuted: volume === 0 }));
    }, []);

    const toggleMute = useCallback(() => {
        const audio = audioRef.current;
        if (audio) {
            audio.muted = !stateRef.current.isMuted;
        }
        setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }, []);

    const skip = useCallback((seconds: number) => {
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
        }
    }, []);

    const setPlaybackRate = useCallback((rate: number) => {
        const audio = audioRef.current;
        if (audio) {
            audio.playbackRate = rate;
        }
        setState(prev => ({ ...prev, playbackRate: rate }));
    }, []);

    return (
        <AudioPlayerContext.Provider
            value={{
                ...state,
                play,
                pause,
                resume,
                stop,
                seek,
                setVolume,
                toggleMute,
                skip,
                setPlaybackRate,
                audioRef,
                addToQueue,
                addTracksToQueue,
                removeFromQueue,
                clearQueue,
                playNext,
                playPrevious,
                playQueueIndex,
                reorderQueue,
                openDriveMode,
                closeDriveMode
            }}
        >
            {children}
            {/* Global audio element - hidden but always mounted */}
            <audio ref={audioRef} style={{ display: 'none' }} />
        </AudioPlayerContext.Provider>
    );
}
