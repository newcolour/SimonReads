import { useState, useEffect } from 'react';
import { X, Mic, Play, Pause, Loader, FileText, Radio } from 'lucide-react';
import { AppSettings } from '../types';
import { AIPodcastService, GeneratedPodcast } from '../services/aiPodcastService';
import { TTSService } from '../services/ttsService';
import './AIPodcast.css';

interface AIPodcastProps {
    articleTitle: string;
    articleContent: string;
    settings: AppSettings;
    onClose: () => void;
}

type PodcastStyle = 'summary' | 'discussion' | 'news-brief';

const STYLE_OPTIONS: { id: PodcastStyle; name: string; icon: any; description: string }[] = [
    { id: 'summary', name: 'Summary', icon: FileText, description: 'Conversational summary' },
    { id: 'discussion', name: 'Discussion', icon: Radio, description: 'Two-host dialogue' },
    { id: 'news-brief', name: 'News Brief', icon: Mic, description: 'Professional news style' }
];

export default function AIPodcast({ articleTitle, articleContent, settings, onClose }: AIPodcastProps) {
    const [style, setStyle] = useState<PodcastStyle>('summary');
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('');
    const [podcast, setPodcast] = useState<GeneratedPodcast | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stop audio when component unmounts or closes
    useEffect(() => {
        return () => {
            console.log('AIPodcast unmounting, stopping audio');
            TTSService.stopCurrent();
        };
    }, []);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        setProgress(0);
        setPodcast(null);

        try {
            const result = await AIPodcastService.generatePodcast({
                articleTitle,
                articleContent,
                settings,
                style,
                onProgress: (p, s) => {
                    setProgress(p);
                    setStatus(s);
                }
            });
            setPodcast(result);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to generate podcast');
        } finally {
            setIsGenerating(false);
        }
    };

    const cleanScriptForSpeech = (script: string): string => {
        return script
            // Remove markdown headers (# ## ###)
            .replace(/^#{1,6}\s+/gm, '')
            // Remove markdown bold/italic (**text** or *text*)
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            // Remove markdown links [text](url) -> text
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            // Remove stage directions in brackets or parentheses
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?sound.*?\)/gi, '')
            .replace(/\(.*?music.*?\)/gi, '')
            .replace(/\(.*?intro.*?\)/gi, '')
            .replace(/\(.*?outro.*?\)/gi, '')
            .replace(/\(.*?pause.*?\)/gi, '')
            // Remove common stage direction patterns
            .replace(/^.*?sound.*?$/gmi, '')
            .replace(/^.*?music.*?$/gmi, '')
            .replace(/^.*?intro.*?$/gmi, '')
            .replace(/^.*?outro.*?$/gmi, '')
            // Remove extra whitespace and newlines
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };

    const parseDialogue = (script: string): Array<{ speaker: string; text: string }> => {
        const lines = script.split('\n');
        const dialogue: Array<{ speaker: string; text: string }> = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Match patterns like "Alex: text" or "Jordan: text"
            const match = trimmed.match(/^(Alex|Jordan):\s*(.+)$/i);
            if (match) {
                dialogue.push({
                    speaker: match[1].toLowerCase(),
                    text: match[2].trim()
                });
            } else {
                // Non-dialogue text (narrator or intro/outro)
                dialogue.push({
                    speaker: 'narrator',
                    text: trimmed
                });
            }
        }

        return dialogue;
    };

    const playDialogueWithOpenAI = async (dialogue: Array<{ speaker: string; text: string }>) => {
        const voiceMap: Record<string, string> = {
            'alex': 'echo',      // Male voice
            'jordan': 'shimmer', // Female voice
            'narrator': 'alloy'  // Neutral voice
        };

        for (let i = 0; i < dialogue.length; i++) {
            const { speaker, text } = dialogue[i];
            const voice = voiceMap[speaker] || 'alloy';

            const response = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${settings.openaiApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'tts-1',
                    voice,
                    input: text
                })
            });

            if (!response.ok) throw new Error('OpenAI TTS failed');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            await new Promise<void>((resolve, reject) => {
                const audio = new Audio(audioUrl);
                audio.onended = () => resolve();
                audio.onerror = () => reject(new Error('Audio playback failed'));
                audio.play();
            });
        }
    };

    const playDialogueWithTTS = async (dialogue: Array<{ speaker: string; text: string }>) => {
        const language = settings.readAloudLanguage || 'en-US';

        // Check if Edge-TTS is available (Electron only)
        const ipcRenderer = (window as any).ipcRenderer;
        const useEdgeTTS = !!ipcRenderer;

        for (let i = 0; i < dialogue.length; i++) {
            const { speaker, text } = dialogue[i];

            if (useEdgeTTS) {
                // Use Edge-TTS with different neural voices for each speaker
                const voiceMap: Record<string, string> = {
                    'alex': 'en-US-GuyNeural',      // Male voice
                    'jordan': 'en-US-JennyNeural',  // Female voice
                    'narrator': 'en-US-AriaNeural'  // Neutral voice
                };

                const voice = voiceMap[speaker] || 'en-US-AriaNeural';

                await new Promise<void>((resolve, reject) => {
                    TTSService.speakEdgeTTS(
                        text,
                        voice,
                        1.0, // Normal rate for Edge-TTS (it already sounds natural)
                        () => resolve(),
                        (error) => {
                            console.error('Edge-TTS error:', error);
                            reject(error);
                        }
                    );
                });
            } else {
                // Fallback to playback rate differences for non-Electron platforms
                const rateMap: Record<string, number> = {
                    'alex': 0.85,    // Noticeably slower (deeper/male-sounding)
                    'jordan': 1.15,  // Noticeably faster (higher/female-sounding)
                    'narrator': 1.0  // Normal
                };

                const rate = rateMap[speaker] || 1.0;

                await new Promise<void>((resolve, reject) => {
                    TTSService.speak({
                        text,
                        language,
                        playbackRate: rate,
                        onEnd: () => resolve(),
                        onError: (error) => {
                            console.error('TTS error:', error);
                            reject(error);
                        }
                    });
                });
            }
        }
    };

    const handlePlay = async () => {
        if (!podcast?.script) return;

        if (isPlaying) {
            console.log('Stopping playback');
            await TTSService.stopCurrent();
            setIsPlaying(false);
        } else {
            console.log('Starting playback');
            setIsPlaying(true);
            const provider = settings.ttsProvider || 'free';

            // Clean the script before speaking
            const cleanedScript = cleanScriptForSpeech(podcast.script);
            console.log('Cleaned script:', cleanedScript.substring(0, 100));

            try {
                // Check if this is a discussion style with dialogue
                const isDiscussion = style === 'discussion' && cleanedScript.includes('Alex:');
                console.log('Is discussion:', isDiscussion, 'Style:', style);

                if (isDiscussion) {
                    // Parse dialogue and play with different voices
                    const dialogue = parseDialogue(cleanedScript);
                    console.log('Parsed dialogue:', dialogue.length, 'lines');

                    if (provider === 'openai' && settings.openaiApiKey) {
                        console.log('Using OpenAI multi-voice');
                        await playDialogueWithOpenAI(dialogue);
                    } else {
                        console.log('Using TTS multi-voice');
                        await playDialogueWithTTS(dialogue);
                    }
                    console.log('Dialogue playback complete');
                } else {
                    // Single voice playback for summary and news-brief styles
                    console.log('Using single voice, provider:', provider);
                    if (provider === 'openai' && settings.openaiApiKey) {
                        const response = await fetch('https://api.openai.com/v1/audio/speech', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${settings.openaiApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model: 'tts-1',
                                voice: 'alloy',
                                input: cleanedScript
                            })
                        });

                        if (!response.ok) throw new Error('OpenAI TTS failed');

                        const audioBlob = await response.blob();
                        const audioUrl = URL.createObjectURL(audioBlob);
                        const audio = new Audio(audioUrl);

                        await new Promise<void>((resolve) => {
                            audio.onended = () => {
                                console.log('Audio ended');
                                resolve();
                            };
                            audio.onerror = () => {
                                console.error('Audio error');
                                resolve();
                            };
                            audio.play();
                        });
                    } else {
                        const language = settings.readAloudLanguage || 'en-US';
                        await new Promise<void>((resolve) => {
                            TTSService.speak({
                                text: cleanedScript,
                                language,
                                playbackRate: 1.0,
                                onEnd: () => {
                                    console.log('TTS ended');
                                    resolve();
                                },
                                onError: (error) => {
                                    console.error('TTS error:', error);
                                    resolve();
                                }
                            });
                        });
                    }
                }

                console.log('Playback finished, setting isPlaying to false');
                setIsPlaying(false);
            } catch (e) {
                console.error('TTS error:', e);
                setIsPlaying(false);
            }
        }
    };

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="ai-podcast-overlay" onClick={onClose}>
            <div className="ai-podcast-container" onClick={e => e.stopPropagation()}>
                <div className="ai-podcast-header">
                    <h2><Mic size={22} /> AI Podcast</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="ai-podcast-content">
                    {!podcast ? (
                        <>
                            <div className="podcast-intro">
                                <p>Transform this article into an AI-generated podcast. Choose a style and let AI create a script that will be read aloud.</p>
                            </div>

                            <div className="style-selector">
                                <label>Podcast Style</label>
                                <div className="style-options">
                                    {STYLE_OPTIONS.map(opt => {
                                        const Icon = opt.icon;
                                        return (
                                            <button
                                                key={opt.id}
                                                className={`style-option ${style === opt.id ? 'active' : ''}`}
                                                onClick={() => setStyle(opt.id)}
                                            >
                                                <Icon size={24} />
                                                <span className="style-name">{opt.name}</span>
                                                <span className="style-desc">{opt.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {isGenerating ? (
                                <div className="generating-state">
                                    <Loader size={32} className="spin" />
                                    <p>{status}</p>
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className="generate-btn"
                                    onClick={handleGenerate}
                                    disabled={!settings.geminiApiKey && !settings.openaiApiKey}
                                >
                                    <Mic size={20} />
                                    Generate Podcast
                                </button>
                            )}

                            {error && (
                                <div className="error-message">{error}</div>
                            )}

                            {!settings.geminiApiKey && !settings.openaiApiKey && (
                                <div className="api-warning">
                                    ⚠️ Configure an AI API key in Settings to use this feature
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="podcast-result">
                            <div className="podcast-player-ui">
                                <button
                                    className="play-button"
                                    onClick={handlePlay}
                                >
                                    {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                                </button>
                                <div className="podcast-info">
                                    <div className="podcast-title">{articleTitle}</div>
                                    <div className="podcast-meta">
                                        {STYLE_OPTIONS.find(s => s.id === style)?.name} •
                                        Est. {formatDuration(podcast.duration || 0)}
                                    </div>
                                </div>
                            </div>

                            <div className="script-preview">
                                <h4>Script</h4>
                                <div className="script-text">
                                    {podcast.script}
                                </div>
                            </div>

                            <button
                                className="regenerate-btn"
                                onClick={() => setPodcast(null)}
                            >
                                Try Different Style
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
