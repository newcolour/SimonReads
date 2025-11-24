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

            // Method 1: Listen for push updates
            ipcRenderer.on('update-summary', (_event: any, data: SummaryData) => {
                console.log('SummaryWindow: Received summary update via send:', data);
                setSummaryData(data);

                // Apply theme if provided (update it)
                if (data.theme) {
                    console.log('SummaryWindow: Applying theme from data:', data.theme);
                    document.documentElement.setAttribute('data-theme', data.theme);
                }
            });

            // Method 2: Pull data using invoke (more reliable)
            const fetchData = async () => {
                try {
                    console.log('SummaryWindow: Fetching data via invoke for article:', articleId);
                    const result = await ipcRenderer.invoke('get-summary-data', articleId);

                    if (result.success && result.data) {
                        console.log('SummaryWindow: Successfully fetched data via invoke');
                        setSummaryData(result.data);

                        if (result.data.theme) {
                            document.documentElement.setAttribute('data-theme', result.data.theme);
                        }
                    } else {
                        console.log('SummaryWindow: No data available yet, will retry');
                    }
                } catch (error) {
                    console.error('SummaryWindow: Error fetching data:', error);
                }
            };

            // Try to fetch immediately
            fetchData();

            // Also send ready signal (legacy method)
            console.log('SummaryWindow: Sending ready signal to main process for article:', articleId);
            ipcRenderer.send('summary-window-ready', articleId);

            // Retry mechanism: if data doesn't arrive, keep trying
            let retryCount = 0;
            const maxRetries = 10;
            const retryInterval = setInterval(() => {
                if (!summaryData && retryCount < maxRetries) {
                    console.log(`SummaryWindow: Retry ${retryCount + 1}/${maxRetries} - fetching data`);
                    fetchData();
                    ipcRenderer.send('summary-window-ready', articleId);
                    retryCount++;
                } else {
                    clearInterval(retryInterval);
                    if (retryCount >= maxRetries && !summaryData) {
                        console.error('SummaryWindow: Failed to load data after max retries');
                    }
                }
            }, 500);

            // Clear interval after timeout
            setTimeout(() => clearInterval(retryInterval), 6000);

            return () => {
                clearInterval(retryInterval);
            };
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


        </div>
    );
}
