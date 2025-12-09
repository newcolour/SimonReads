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
    private currentRate: number = 1.0;

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
        rate: number,
        onEnd?: () => void,
        onError?: (error: Error) => void
    ): Promise<TTSController> {
        this.isPlaying = true;

        try {
            // The Capacitor TTS plugin doesn't support pause/resume natively
            // so we'll use it for speaking only
            await TextToSpeech.speak({
                text,
                lang: language,
                rate: rate,
                pitch: 1.0,
                volume: 1.0,
                category: 'playback', // Use playback for media audio
            });

            this.isPlaying = false;
            onEnd?.();
        } catch (error) {
            this.isPlaying = false;
            console.error('Native TTS error:', error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
        }

        return {
            pause: async () => {
                // Capacitor TTS doesn't have pause, just stop
                try {
                    await TextToSpeech.stop();
                } catch (e) {
                    console.warn('Failed to stop TTS:', e);
                }
            },
            resume: () => {
                // Not supported - would need to restart
                console.warn('Resume not supported with native TTS');
            },
            stop: async () => {
                this.isPlaying = false;
                try {
                    await TextToSpeech.stop();
                } catch (e) {
                    console.warn('Failed to stop TTS:', e);
                }
            },
            setRate: (newRate: number) => {
                this.currentRate = newRate;
                // Rate change will apply to next speak call
            }
        };
    }

    /**
     * Electron TTS using google-tts-api via IPC
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

        this.isPlaying = true;

        try {
            // Split text into chunks for google-tts-api (max 200 chars per request)
            const chunks = this.splitTextIntoChunks(text, 200);
            const audioSegments: string[] = [];

            // Fetch all audio segments
            for (const chunk of chunks) {
                const base64List: string[] = await ipcRenderer.invoke('fetch-tts', {
                    text: chunk,
                    lang: language
                });
                audioSegments.push(...base64List);
            }

            // Play segments sequentially
            await this.playElectronSegments(audioSegments, 0, rate, onEnd, onError);
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
     * Play audio segments from Electron TTS
     */
    private async playElectronSegments(
        segments: string[],
        index: number,
        rate: number,
        onEnd?: () => void,
        onError?: (error: Error) => void
    ): Promise<void> {
        if (index >= segments.length || !this.isPlaying) {
            this.isPlaying = false;
            this.currentAudio = null;
            onEnd?.();
            return;
        }

        return new Promise((resolve) => {
            const audio = new Audio(`data:audio/mp3;base64,${segments[index]}`);
            audio.playbackRate = rate;
            this.currentAudio = audio;

            audio.onended = () => {
                this.playElectronSegments(segments, index + 1, this.currentRate, onEnd, onError)
                    .then(resolve);
            };

            audio.onerror = () => {
                // Skip errored segment
                this.playElectronSegments(segments, index + 1, this.currentRate, onEnd, onError)
                    .then(resolve);
            };

            audio.play().catch((e) => {
                console.error('Audio play error:', e);
                this.playElectronSegments(segments, index + 1, this.currentRate, onEnd, onError)
                    .then(resolve);
            });
        });
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
        this.isPlaying = false;

        // Stop HTML5 Audio
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }

        // Stop browser speech synthesis
        window.speechSynthesis.cancel();

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
            return window.speechSynthesis.getVoices().map(v => ({
                name: v.name,
                lang: v.lang
            }));
        }
    }
}

// Export singleton instance
export const TTSService = new TTSServiceClass();
