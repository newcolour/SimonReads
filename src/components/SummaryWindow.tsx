import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Sparkles, Volume2, RotateCw, Loader, Pause, Play } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppSettings } from '../types';
import { TTSService, TTSController } from '../services/ttsService';
import '../index.css'; // Import theme variables
import './SummaryWindow.css';

interface SummaryData {
    summary: string;
    articleTitle: string;
    theme?: string;
    settings?: AppSettings;
}

export default function SummaryWindow() {
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [isReadingAloud, setIsReadingAloud] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1.0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isReadingAloudRef = useRef(false);
    const ttsControllerRef = useRef<TTSController | null>(null);

    // Use useLayoutEffect to apply theme before painting
    useLayoutEffect(() => {
        const hash = window.location.hash;
        console.log('SummaryWindow: Full URL hash:', hash);

        // Parse theme from URL query string
        // URL format: #/summary/articleId?theme=light
        let theme = 'dark'; // Default theme

        if (hash.includes('?theme=')) {
            const queryPart = hash.split('?')[1];
            if (queryPart) {
                const params = new URLSearchParams(queryPart);
                theme = params.get('theme') || 'dark';
            }
        }

        console.log('SummaryWindow: Parsed theme from URL:', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, []);

    useEffect(() => {
        console.log('SummaryWindow: Component mounted, setting up IPC listener');

        const ipcRenderer = (window as any).ipcRenderer;

        // Extract article ID
        const hash = window.location.hash;
        const idPart = hash.split('/')[2] || 'unknown';
        const articleId = decodeURIComponent(idPart.split('?')[0]);

        console.log('SummaryWindow: Article ID from hash:', articleId);

        // Listen for summary updates from main process (legacy method)
        if (ipcRenderer) {
            console.log('SummaryWindow: IPC renderer found, registering listener');

            // Listen for updates via send
            const updateHandler = (_event: any, data: SummaryData) => {
                console.log('SummaryWindow: Received summary update via send:', data);
                setSummaryData(data);

                // Apply theme if provided
                if (data.theme) {
                    console.log('SummaryWindow: Applying theme from data:', data.theme);
                    document.documentElement.setAttribute('data-theme', data.theme);
                }
            };

            ipcRenderer.on('update-summary', updateHandler);

            // Immediately try to fetch data via invoke
            (async () => {
                try {
                    console.log('SummaryWindow: Fetching data via invoke for article:', articleId);
                    const response = await ipcRenderer.invoke('get-summary-data', articleId);

                    if (response && response.success && response.data) {
                        console.log('SummaryWindow: Successfully fetched data via invoke');
                        console.log('SummaryWindow: Data contains settings?', !!response.data.settings);
                        console.log('SummaryWindow: Settings ttsProvider:', response.data.settings?.ttsProvider);
                        setSummaryData(response.data);
                        if (response.data.theme) {
                            document.documentElement.setAttribute('data-theme', response.data.theme);
                        }
                    } else {
                        console.log('SummaryWindow: No data available yet, will retry');
                    }
                } catch (error) {
                    console.error('SummaryWindow: Error fetching data:', error);
                }
            })();

            // Send ready signal to main process
            setTimeout(() => {
                console.log('SummaryWindow: Sending ready signal to main process for article:', articleId);
                ipcRenderer.send('summary-window-ready', articleId);
            }, 100);

            // Retry fetching data if not received - only run once
            let retryCount = 0;
            const maxRetries = 5;
            let dataReceived = false;

            const retryInterval = setInterval(async () => {
                if (dataReceived || retryCount >= maxRetries) {
                    clearInterval(retryInterval);
                    return;
                }

                console.log(`SummaryWindow: Retry ${retryCount + 1}/${maxRetries} - fetching data`);
                try {
                    const response = await ipcRenderer.invoke('get-summary-data', articleId);
                    if (response && response.success && response.data) {
                        setSummaryData(response.data);
                        dataReceived = true;
                        clearInterval(retryInterval);
                    } else {
                        retryCount++;
                        if (retryCount >= maxRetries) {
                            console.error('SummaryWindow: Failed to load data after max retries');
                            clearInterval(retryInterval);
                        }
                    }
                } catch (error) {
                    console.error('SummaryWindow: Error in retry:', error);
                    retryCount++;
                }
            }, 500);

            return () => {
                clearInterval(retryInterval);
                ipcRenderer.removeListener('update-summary', updateHandler);
                if (ttsControllerRef.current) {
                    ttsControllerRef.current.stop();
                    ttsControllerRef.current = null;
                }
                if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current = null;
                }
                TTSService.stopCurrent();
            };
        } else {
            console.error('SummaryWindow: IPC renderer not available!');
        }

        return () => {
            if (ttsControllerRef.current) {
                ttsControllerRef.current.stop();
                ttsControllerRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            TTSService.stopCurrent();
        };
    }, []); // Empty dependency array - only run once on mount

    const handleTogglePause = () => {
        if (!isReadingAloud) return;

        if (isPaused) {
            // Resume
            if (ttsControllerRef.current) {
                ttsControllerRef.current.resume();
            } else if (audioRef.current) {
                audioRef.current.play();
            }
            setIsPaused(false);
        } else {
            // Pause
            if (ttsControllerRef.current) {
                ttsControllerRef.current.pause();
            } else if (audioRef.current) {
                audioRef.current.pause();
            }
            setIsPaused(true);
        }
    };

    const handleChangeSpeed = () => {
        const rates = [0.75, 1.0, 1.25, 1.5, 2.0];
        const currentIndex = rates.indexOf(playbackRate);
        const nextRate = rates[(currentIndex + 1) % rates.length];

        setPlaybackRate(nextRate);

        if (ttsControllerRef.current) {
            ttsControllerRef.current.setRate(nextRate);
        } else if (audioRef.current) {
            audioRef.current.playbackRate = nextRate;
        }
    };

    const readWithOpenAI = async (text: string) => {
        const settings = summaryData?.settings;
        if (!settings?.openaiApiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'tts-1',
                voice: 'alloy',
                input: text
            })
        });

        if (!response.ok) throw new Error('OpenAI TTS failed');

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.playbackRate = playbackRate;
        audioRef.current = audio;

        audio.onended = () => {
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            setIsPaused(false);
            audioRef.current = null;
        };

        await audio.play();
    };

    const readWithCloudTTS = async (text: string) => {
        const settings = summaryData?.settings;
        const language = settings?.readAloudLanguage || 'en';

        // Use cross-platform TTS service
        const controller = await TTSService.speak({
            text,
            language,
            playbackRate,
            onEnd: () => {
                setIsReadingAloud(false);
                isReadingAloudRef.current = false;
                setIsPaused(false);
                ttsControllerRef.current = null;
            },
            onError: (error) => {
                console.error('TTS error:', error);
                setIsReadingAloud(false);
                isReadingAloudRef.current = false;
                setIsPaused(false);
                ttsControllerRef.current = null;
            }
        });
        ttsControllerRef.current = controller;
    };

    const handleReadAloud = async () => {
        if (!summaryData?.summary) return;

        if (isReadingAloud) {
            // Stop reading
            if (ttsControllerRef.current) {
                ttsControllerRef.current.stop();
                ttsControllerRef.current = null;
            }
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            await TTSService.stopCurrent();
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            setIsPaused(false);
            return;
        }

        const plainText = summaryData.summary.replace(/[#*\[\]()]/g, '').replace(/\n+/g, ' ').trim();
        if (!plainText) return;

        setIsReadingAloud(true);
        isReadingAloudRef.current = true;
        const settings = summaryData.settings;
        const provider = settings?.ttsProvider || 'free';
        console.log('SummaryWindow: TTS provider:', provider, 'Settings:', settings);

        try {
            if (provider === 'openai' && settings?.openaiApiKey) {
                await readWithOpenAI(plainText);
            } else {
                // Use cross-platform TTS service for 'free' and 'system' providers
                // On Android/iOS: uses native TTS
                // On Electron: uses google-tts-api via IPC
                // On Web: uses browser speechSynthesis
                await readWithCloudTTS(plainText);
            }
        } catch (error) {
            console.error('TTS error:', error);
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            setIsPaused(false);
        }
    };

    const handleRegenerate = () => {
        // Send message to main window to regenerate summary
        const ipcRenderer = (window as any).ipcRenderer;
        if (ipcRenderer) {
            ipcRenderer.send('regenerate-summary');
        }
    };

    if (!summaryData) {
        return (
            <div className="summary-window">
                <div className="summary-window-loading">
                    <Loader size={32} className="spin" />
                    <p>Loading summary...</p>
                </div>

            </div>
        );
    }

    return (
        <div className="summary-window">
            <div className="summary-window-header">
                <div className="summary-window-title">
                    <Sparkles size={20} />
                    <h2>AI Summary</h2>
                </div>
                <div className="summary-window-actions">
                    {isReadingAloud && (
                        <>
                            <button
                                className="action-btn"
                                onClick={handleChangeSpeed}
                                title={`Speed: ${playbackRate}x`}
                            >
                                {playbackRate}x
                            </button>
                            <button
                                className="action-btn"
                                onClick={handleTogglePause}
                                title={isPaused ? "Resume" : "Pause"}
                            >
                                {isPaused ? <Play size={18} /> : <Pause size={18} />}
                            </button>
                        </>
                    )}
                    <button
                        className={`action-btn ${isReadingAloud ? 'active' : ''}`}
                        onClick={handleReadAloud}
                        title={isReadingAloud ? "Stop Reading" : "Read Aloud"}
                    >
                        <Volume2 size={18} />
                    </button>
                    <button
                        className="action-btn"
                        onClick={handleRegenerate}
                        title="Regenerate Summary"
                    >
                        <RotateCw size={18} />
                    </button>
                </div>
            </div>
            <div className="summary-window-content">
                <h3 className="article-title">{summaryData.articleTitle}</h3>
                <div className="summary-markdown">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
                        }}
                    >
                        {summaryData.summary}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
}
