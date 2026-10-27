/**
 * Cross-platform Text-to-Speech Service
 * 
 * This service provides TTS functionality that works across:
 * - Electron (desktop): Uses google-tts-api via IPC
 * - Android/iOS (Capacitor): Uses native TTS plugin
 * - Web: Falls back to browser speechSynthesis
 */

import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export interface TTSOptions {
    text: string;
    language?: string;
    playbackRate?: number;
    voice?: string; // For Edge-TTS: voice name like "en-US-AriaNeural"
    onEnd?: () => void;
    onError?: (error: Error) => void;
}

export interface TTSController {
    pause: () => void;
    resume: () => void;
    stop: () => void;
    setRate: (rate: number) => void;
}

class TTSServiceClass {
    private currentAudio: HTMLAudioElement | null = null;
    private isPlaying: boolean = false;
    private isPaused: boolean = false;
    private currentRate: number = 1.0;
    private currentSessionId: number = 0;

    /**
     * Check if we're running on Electron
     */
    private isElectron(): boolean {
        return !!(window as any).ipcRenderer;
    }

    /**
     * Check if we're running on a native mobile platform (Android/iOS)
     */
    private isNative(): boolean {
        return Capacitor.isNativePlatform();
    }

    /**
     * Speak text using the most appropriate TTS engine for the current platform
     */
    async speak(options: TTSOptions): Promise<TTSController> {
        const { text, language = 'en', playbackRate = 1.0, onEnd, onError } = options;
        this.currentRate = playbackRate;

        // Stop any current playback
        await this.stopCurrent();

        try {
            if (this.isNative()) {
                // Use Capacitor TTS on Android/iOS
                return await this.speakNative(text, language, playbackRate, onEnd, onError);
            } else if (this.isElectron()) {
                // Use IPC to google-tts-api on Electron
                return await this.speakElectron(text, language, playbackRate, onEnd, onError);
            } else {
                // Fallback to browser speechSynthesis
                return this.speakBrowser(text, playbackRate, onEnd, onError);
            }
        } catch (error) {
            console.error('TTS error:', error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
            // Fallback to browser TTS on error
            return this.speakBrowser(text, playbackRate, onEnd, onError);
        }
    }

    /**
     * Native TTS using Capacitor plugin (Android/iOS)
     */
    private async speakNative(
        text: string,
        language: string,
        _rate: number,
        onEnd?: () => void,
        onError?: (error: Error) => void
    ): Promise<TTSController> {
        const sessionId = ++this.currentSessionId;
        this.isPlaying = true;
        this.isPaused = false;
        // Limit for Android TTS is often around 4000 chars. Use 3000 to be safe.
        const chunks = this.splitTextIntoChunks(text, 3000);
        let currentChunkIndex = 0;
        let isStopped = false;

        const runChunkLoop = async (startIndex: number) => {
            try {
                for (let i = startIndex; i < chunks.length; i++) {
                    if (sessionId !== this.currentSessionId || !this.isPlaying || this.isPaused || isStopped) {
                        return;
                    }
                    currentChunkIndex = i;

                    await TextToSpeech.speak({
                        text: chunks[i],
                        lang: language,
                        rate: this.currentRate,
                        pitch: 1.0,
                        volume: 1.0,
                        category: 'playback',
                    });
                }

                if (sessionId === this.currentSessionId && this.isPlaying && !this.isPaused && !isStopped) {
                    this.isPlaying = false;
                    onEnd?.();
                }
            } catch (error) {
                if (sessionId === this.currentSessionId && !isStopped) {
                    this.isPlaying = false;
                    console.error('Native TTS error:', error);
                    onError?.(error instanceof Error ? error : new Error(String(error)));
                }
            }
        };

        // Start playing from beginning
        runChunkLoop(0);

        return {
            pause: async () => {
                this.isPaused = true;
                try {
                    await TextToSpeech.stop();
                } catch (e) {
                    console.warn('Failed to stop native TTS on pause:', e);
                }
            },
            resume: () => {
                if (this.isPaused && this.isPlaying && !isStopped) {
                    this.isPaused = false;
                    runChunkLoop(currentChunkIndex);
                }
            },
            stop: async () => {
                isStopped = true;
                this.isPlaying = false;
                this.isPaused = false;
                try {
                    await TextToSpeech.stop();
                } catch (e) {
                    console.warn('Failed to stop native TTS:', e);
                }
            },
            setRate: (newRate: number) => {
                this.currentRate = newRate;
            }
        };
    }

    /**
     * Electron TTS using google-tts-api via IPC with streaming queue,
     * instant pause/resume, and real-time playback speed control.
     */
    private async speakElectron(
        text: string,
        language: string,
        rate: number,
        onEnd?: () => void,
        onError?: (error: Error) => void
    ): Promise<TTSController> {
        const ipcRenderer = (window as any).ipcRenderer;
        if (!ipcRenderer) {
            throw new Error('IPC not available');
        }

        const sessionId = ++this.currentSessionId;
        this.isPlaying = true;
        this.isPaused = false;
        this.currentRate = rate;

        // Split text into chunks for google-tts-api (max 200 chars per request)
        const chunks = this.splitTextIntoChunks(text, 200);
        const audioSegments: string[] = [];
        let currentIndex = 0;
        let isFetchingComplete = false;

        const controller: TTSController = {
            pause: () => {
                this.isPaused = true;
                if (this.currentAudio) {
                    this.currentAudio.pause();
                }
            },
            resume: () => {
                this.isPaused = false;
                if (this.currentAudio) {
                    this.currentAudio.play().catch(e => console.warn('Audio resume error:', e));
                } else if (this.isPlaying) {
                    playNext();
                }
            },
            stop: () => {
                if (sessionId === this.currentSessionId) {
                    this.isPlaying = false;
                    this.isPaused = false;
                    if (this.currentAudio) {
                        this.currentAudio.pause();
                        this.currentAudio = null;
                    }
                }
            },
            setRate: (newRate: number) => {
                this.currentRate = newRate;
                if (this.currentAudio) {
                    this.currentAudio.playbackRate = newRate;
                }
            }
        };

        const playNext = () => {
            if (sessionId !== this.currentSessionId || !this.isPlaying) {
                return;
            }

            if (this.isPaused) {
                return;
            }

            if (currentIndex >= audioSegments.length) {
                if (isFetchingComplete) {
                    this.isPlaying = false;
                    this.currentAudio = null;
                    onEnd?.();
                }
                return;
            }

            const segment = audioSegments[currentIndex];
            currentIndex++;

            const audio = new Audio(`data:audio/mp3;base64,${segment}`);
            audio.playbackRate = this.currentRate;
            this.currentAudio = audio;

            audio.onended = () => {
                if (sessionId !== this.currentSessionId || !this.isPlaying) return;
                this.currentAudio = null;
                playNext();
            };

            audio.onerror = (e) => {
                console.warn('Audio segment error, skipping to next segment:', e);
                if (sessionId !== this.currentSessionId || !this.isPlaying) return;
                this.currentAudio = null;
                playNext();
            };

            if (!this.isPaused) {
                audio.play().catch((e) => {
                    console.error('Audio play error:', e);
                    if (sessionId !== this.currentSessionId || !this.isPlaying) return;
                    this.currentAudio = null;
                    playNext();
                });
            }
        };

        // Start fetching segments in background and begin playback as soon as first arrives
        (async () => {
            try {
                for (let i = 0; i < chunks.length; i++) {
                    if (sessionId !== this.currentSessionId || !this.isPlaying) {
                        return;
                    }

                    const base64List: string[] = await ipcRenderer.invoke('fetch-tts', {
                        text: chunks[i],
                        lang: language
                    });

                    if (sessionId !== this.currentSessionId || !this.isPlaying) {
                        return;
                    }

                    audioSegments.push(...base64List);

                    // If not currently playing and not paused, kick off playback!
                    if (!this.currentAudio && !this.isPaused) {
                        playNext();
                    }
                }

                isFetchingComplete = true;

                // If finished fetching while no audio is playing
                if (!this.currentAudio && !this.isPaused) {
                    if (currentIndex < audioSegments.length) {
                        playNext();
                    } else if (currentIndex > 0) {
                        this.isPlaying = false;
                        onEnd?.();
                    }
                }
            } catch (error) {
                console.error('TTS fetch error:', error);
                if (sessionId === this.currentSessionId) {
                    this.isPlaying = false;
                    onError?.(error instanceof Error ? error : new Error(String(error)));
                }
            }
        })();

        // Controller returned IMMEDIATELY so pause/resume/speed buttons work right away!
        return controller;
    }

    /**
     * Edge-TTS using Microsoft Edge's neural voices via IPC
     */
    async speakEdgeTTS(
        text: string,
        voice: string,
        rate: number,
        onEnd?: () => void,
        onError?: (error: Error) => void
    ): Promise<TTSController> {
        const ipcRenderer = (window as any).ipcRenderer;
        if (!ipcRenderer) {
            throw new Error('IPC not available');
        }

        this.isPlaying = true;

        try {
            // Fetch audio from Edge-TTS
            const base64Audio: string = await ipcRenderer.invoke('fetch-edge-tts', {
                text,
                voice,
                rate
            });

            // Play the audio
            const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
            audio.playbackRate = rate;
            this.currentAudio = audio;

            audio.onended = () => {
                this.isPlaying = false;
                this.currentAudio = null;
                onEnd?.();
            };

            audio.onerror = (_e) => {
                this.isPlaying = false;
                this.currentAudio = null;
                onError?.(new Error('Audio playback failed'));
            };

            await audio.play();
        } catch (error) {
            this.isPlaying = false;
            throw error;
        }

        return {
            pause: () => {
                if (this.currentAudio) {
                    this.currentAudio.pause();
                }
            },
            resume: () => {
                if (this.currentAudio) {
                    this.currentAudio.play();
                }
            },
            stop: () => {
                this.isPlaying = false;
                if (this.currentAudio) {
                    this.currentAudio.pause();
                    this.currentAudio = null;
                }
            },
            setRate: (newRate: number) => {
                this.currentRate = newRate;
                if (this.currentAudio) {
                    this.currentAudio.playbackRate = newRate;
                }
            }
        };
    }

    /**
     * Browser TTS using Web Speech API
     */
    private speakBrowser(
        text: string,
        rate: number,
        onEnd?: () => void,
        onError?: (error: Error) => void
    ): TTSController {
        this.isPlaying = true;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;

        utterance.onend = () => {
            this.isPlaying = false;
            onEnd?.();
        };

        utterance.onerror = (event) => {
            this.isPlaying = false;
            onError?.(new Error(event.error || 'Speech synthesis error'));
        };

        window.speechSynthesis.speak(utterance);

        return {
            pause: () => {
                window.speechSynthesis.pause();
            },
            resume: () => {
                window.speechSynthesis.resume();
            },
            stop: () => {
                this.isPlaying = false;
                window.speechSynthesis.cancel();
            },
            setRate: (newRate: number) => {
                this.currentRate = newRate;
                // Rate change requires restarting on Web Speech API
            }
        };
    }

    /**
     * Split text into chunks for APIs with character limits
     */
    private splitTextIntoChunks(text: string, maxLength: number): string[] {
        const chunks: string[] = [];

        if (text.length <= maxLength) {
            chunks.push(text);
            return chunks;
        }

        // Split by sentences first
        const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
        let currentChunk = '';

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length <= maxLength) {
                currentChunk += sentence;
            } else {
                if (currentChunk) chunks.push(currentChunk);
                // If single sentence is too long, split by words
                if (sentence.length > maxLength) {
                    const words = sentence.split(' ');
                    let wordChunk = '';
                    for (const word of words) {
                        if ((wordChunk + ' ' + word).length <= maxLength) {
                            wordChunk += (wordChunk ? ' ' : '') + word;
                        } else {
                            if (wordChunk) chunks.push(wordChunk);
                            wordChunk = word;
                        }
                    }
                    if (wordChunk) currentChunk = wordChunk;
                } else {
                    currentChunk = sentence;
                }
            }
        }

        if (currentChunk) chunks.push(currentChunk);
        return chunks;
    }

    /**
     * Stop current TTS playback
     */
    async stopCurrent(): Promise<void> {
        this.currentSessionId++;
        this.isPlaying = false;
        this.isPaused = false;

        // Stop HTML5 Audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        // Stop browser speech synthesis
        if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
            try {
                window.speechSynthesis.cancel();
            } catch (e) {
                // Ignore
            }
        }

        // Stop native TTS
        if (this.isNative()) {
            try {
                await TextToSpeech.stop();
            } catch (e) {
                // Ignore errors when stopping
            }
        }
    }

    /**
     * Check if TTS is currently playing
     */
    isCurrentlyPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Get available voices (for voice selection UI if needed)
     */
    async getAvailableVoices(): Promise<{ name: string; lang: string }[]> {
        if (this.isNative()) {
            try {
                const result = await TextToSpeech.getSupportedVoices();
                return result.voices.map(v => ({ name: v.name || 'Default', lang: v.lang || 'en' }));
            } catch {
                return [{ name: 'Default', lang: 'en' }];
            }
        } else {
            // Web Speech API voices
            if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis) {
                return window.speechSynthesis.getVoices().map(v => ({
                    name: v.name,
                    lang: v.lang
                }));
            }
            return [{ name: 'Default', lang: 'en' }];
        }
    }
}

// Export singleton instance
export const TTSService = new TTSServiceClass();
