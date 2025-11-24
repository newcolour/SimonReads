import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Sparkles, Volume2, RotateCw, Loader } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../index.css'; // Import theme variables
import './SummaryWindow.css';

interface SummaryData {
    summary: string;
    articleTitle: string;
    theme?: string;
}

export default function SummaryWindow() {
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [isReadingAloud, setIsReadingAloud] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isReadingAloudRef = useRef(false);

    const [debugInfo, setDebugInfo] = useState<string>('');

    // Use useLayoutEffect to apply theme before painting
    useLayoutEffect(() => {
        const hash = window.location.hash;
        const idPart = hash.split('/')[2] || 'unknown';

        // Parse theme from URL
        let theme = 'dark'; // Default theme
        if (idPart.includes('theme=')) {
            theme = idPart.split('theme=')[1].split('&')[0];
        }

        console.log('SummaryWindow: Applying theme from URL:', theme);
        document.documentElement.setAttribute('data-theme', theme);
        setDebugInfo(`Theme: ${theme}, ID: ${idPart.split('?')[0]}`);
    }, []);

    useEffect(() => {
        console.log('SummaryWindow: Component mounted, setting up IPC listener');

        const ipcRenderer = (window as any).ipcRenderer;

        // Extract article ID
        const hash = window.location.hash;
        const idPart = hash.split('/')[2] || 'unknown';
        const articleId = idPart.split('?')[0];

        console.log('SummaryWindow: Article ID from hash:', articleId);

        // Listen for summary updates from main process
        if (ipcRenderer) {
            console.log('SummaryWindow: IPC renderer found, registering listener');
            ipcRenderer.on('update-summary', (_event: any, data: SummaryData) => {
                console.log('SummaryWindow: Received summary update:', data);
                setSummaryData(data);

                // Apply theme if provided (update it)
                if (data.theme) {
                    console.log('SummaryWindow: Applying theme from data:', data.theme);
                    document.documentElement.setAttribute('data-theme', data.theme);
                    setDebugInfo(prev => `${prev}, DataTheme: ${data.theme}`);
                }
            });

            // Initial request for data
            console.log('SummaryWindow: Sending ready signal to main process for article:', articleId);
            ipcRenderer.send('summary-window-ready', articleId);

            // Retry mechanism: if data doesn't arrive in 1s, ask again
            const retryInterval = setInterval(() => {
                if (!summaryData) {
                    console.log('SummaryWindow: Retrying data request for article:', articleId);
                    ipcRenderer.send('summary-window-ready', articleId);
                } else {
                    clearInterval(retryInterval);
                }
            }, 1000);

            // Clear interval after 5 seconds to stop retrying
            setTimeout(() => clearInterval(retryInterval), 5000);
        } else {
            console.error('SummaryWindow: IPC renderer not available!');
        }

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            window.speechSynthesis.cancel();
        };
    }, [summaryData]); // Add summaryData dependency to clear interval correctly

    const handleReadAloud = () => {
        if (!summaryData?.summary) return;

        if (isReadingAloud) {
            // Stop reading
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            window.speechSynthesis.cancel();
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
            return;
        }

        // Start reading with system voice
        const plainText = summaryData.summary.replace(/[#*\[\]()]/g, '').replace(/\n+/g, ' ').trim();
        if (!plainText) return;

        setIsReadingAloud(true);
        isReadingAloudRef.current = true;

        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.onend = () => {
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
        };
        utterance.onerror = () => {
            setIsReadingAloud(false);
            isReadingAloudRef.current = false;
        };
        window.speechSynthesis.speak(utterance);
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
                {/* Debug Info Overlay for loading state */}
                <div style={{
                    position: 'fixed',
                    bottom: 0,
                    right: 0,
                    padding: '4px',
                    fontSize: '10px',
                    opacity: 0.5,
                    pointerEvents: 'none',
                    color: 'var(--text-muted)'
                }}>
                    {debugInfo}
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

            <div className="summary-window-article-title">
                <h3>{summaryData.articleTitle}</h3>
            </div>

            <div className="summary-window-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
                    }}
                >
                    {summaryData.summary}
                </ReactMarkdown>
            </div>

            {/* Debug Info Overlay */}
            <div style={{
                position: 'fixed',
                bottom: 0,
                right: 0,
                padding: '4px',
                fontSize: '10px',
                opacity: 0.5,
                pointerEvents: 'none',
                color: 'var(--text-muted)'
            }}>
                {debugInfo}
            </div>
        </div>
    );
}
