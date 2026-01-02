import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export interface AudioTrack {
    url: string;
    title: string;
    artwork?: string;
    articleId?: string;
    duration?: string;
}

interface AudioPlayerState {
    currentTrack: AudioTrack | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
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
    });

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
            setState(prev => ({ ...prev, isPlaying: false }));
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
    }, []);

    const play = useCallback((track: AudioTrack) => {
        const audio = audioRef.current;
        if (!audio) return;

        // If it's the same track, just resume
        if (state.currentTrack?.url === track.url) {
            audio.play();
            return;
        }

        // New track - stop current and play new
        audio.src = track.url;
        audio.volume = state.volume;
        audio.muted = state.isMuted;
        audio.playbackRate = state.playbackRate;
        audio.play();

        setState(prev => ({
            ...prev,
            currentTrack: track,
            currentTime: 0,
            duration: 0,
        }));
    }, [state.currentTrack?.url, state.volume, state.isMuted, state.playbackRate]);

    const pause = useCallback(() => {
        audioRef.current?.pause();
    }, []);

    const resume = useCallback(() => {
        audioRef.current?.play();
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
            audio.muted = !state.isMuted;
        }
        setState(prev => ({ ...prev, isMuted: !prev.isMuted }));
    }, [state.isMuted]);

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
            }}
        >
            {children}
            {/* Global audio element - hidden but always mounted */}
            <audio ref={audioRef} style={{ display: 'none' }} />
        </AudioPlayerContext.Provider>
    );
}
