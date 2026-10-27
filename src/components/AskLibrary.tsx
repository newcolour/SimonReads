import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Sparkles, X, Search, Clock, Bookmark, Filter, Copy, Check,
    ExternalLink, RefreshCw, AlertCircle, FileText, Target,
    RotateCcw, Globe, Compass, CornerDownRight
} from 'lucide-react';
import { Article, Feed, AppSettings } from '../types';
import {
    askLibraryAI,
    deepDiveLibraryAI,
    RetrievedArticle,
    LibraryQueryOptions
} from '../services/librarySearchService';
import { downloadFile } from '../exportService';
import './AskLibrary.css';

interface AskLibraryProps {
    articles: Article[];
    feeds: Feed[];
    settings: AppSettings;
    onClose: () => void;
    onSelectArticle: (article: Article) => void;
}

export interface ChatTurn {
    id: string;
    type: 'global_search' | 'deep_dive';
    query: string;
    answer: string;
    retrievedArticles: RetrievedArticle[];
    targetTitle?: string;
    provider: string;
    timestamp: string;
}

const SUGGESTIONS = [
    "Quali sono gli sviluppi più importanti nei miei feed?",
    "Riassumi le novità su AI & Tech dell'ultima settimana",
    "Quali sono i punti chiave dei miei articoli salvati?",
    "Sintetizza le notizie economiche e di mercato recenti"
];

export default function AskLibrary({
    articles,
    feeds,
    settings,
    onClose,
    onSelectArticle
}: AskLibraryProps) {
    const [query, setQuery] = useState('');
    const [timeRange, setTimeRange] = useState<'all' | 'last24h' | 'last7d' | 'last30d'>('all');
    const [scope, setScope] = useState<'all' | 'saved' | 'unread'>('all');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    
    // Conversation turns
    const [turns, setTurns] = useState<ChatTurn[]>([]);
    const [activeMode, setActiveMode] = useState<'follow_up' | 'new_topic'>('new_topic');
    const [selectedArticleId, setSelectedArticleId] = useState<string>('all');
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Scansione della libreria in corso...');
    const [error, setError] = useState<string | null>(null);
    const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

    const turnsEndRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Extract unique categories from feeds
    const categories = Array.from(
        new Set(feeds.map(f => f.category || 'Uncategorized'))
    ).filter(Boolean).sort();

    // Auto-scroll to bottom on new turn or loading
    useEffect(() => {
        turnsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [turns, isLoading]);

    // Focus input on mount or mode switch
    useEffect(() => {
        inputRef.current?.focus();
    }, [activeMode]);

    // The most recent sources available for follow-up
    const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;
    const availableSources = latestTurn?.retrievedArticles || [];

    const handleSearch = async (forcedQuery?: string, forcedMode?: 'follow_up' | 'new_topic') => {
        const textToSearch = (forcedQuery !== undefined ? forcedQuery : query).trim();
        if (!textToSearch) return;

        const modeToUse = forcedMode || (turns.length === 0 ? 'new_topic' : activeMode);

        setIsLoading(true);
        setError(null);
        setQuery('');

        try {
            if (modeToUse === 'follow_up' && latestTurn && availableSources.length > 0) {
                // Execute Follow-up / Deep Dive on specific news
                setLoadingMessage(
                    selectedArticleId !== 'all'
                        ? 'Analisi approfondita (Deep Dive) sulla notizia selezionata...'
                        : 'Elaborazione del follow-up e deep dive sulle fonti collegate...'
                );

                const targetArticlesList = availableSources.map(s => s.article);
                const conversationHistory = turns.flatMap(t => [
                    { role: 'user' as const, text: t.query },
                    { role: 'assistant' as const, text: t.answer }
                ]);

                const deepDiveResult = await deepDiveLibraryAI(
                    {
                        followUpQuery: textToSearch,
                        targetArticles: targetArticlesList,
                        previousAnswer: latestTurn.answer,
                        conversationHistory,
                        specificArticleId: selectedArticleId !== 'all' ? selectedArticleId : undefined
                    },
                    settings
                );

                const newTurn: ChatTurn = {
                    id: 'turn-' + Date.now(),
                    type: 'deep_dive',
                    query: textToSearch,
                    answer: deepDiveResult.answer,
                    retrievedArticles: deepDiveResult.retrievedArticles,
                    targetTitle: deepDiveResult.targetArticleTitle,
                    provider: deepDiveResult.provider,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                setTurns(prev => [...prev, newTurn]);
                setActiveMode('follow_up');
            } else {
                // Execute Global Search across whole library
                setLoadingMessage('Ricerca globale in tutta la libreria e sintesi AI...');

                const options: LibraryQueryOptions = {
                    timeRange,
                    scope,
                    category: selectedCategory !== 'all' ? selectedCategory : undefined,
                    feeds
                };

                const result = await askLibraryAI(textToSearch, articles, settings, options);

                const newTurn: ChatTurn = {
                    id: 'turn-' + Date.now(),
                    type: 'global_search',
                    query: textToSearch,
                    answer: result.answer,
                    retrievedArticles: result.retrievedArticles,
                    provider: result.provider,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                };

                setTurns(prev => [...prev, newTurn]);
                // Switch to follow-up mode by default after answering!
                setActiveMode('follow_up');
                setSelectedArticleId('all');
            }
        } catch (err: any) {
            console.error('AskLibrary error:', err);
            setError(err?.message || 'Analisi degli articoli fallita. Verifica le impostazioni dell\'API AI.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSearch();
        }
    };

    const handleQuickDeepDiveOnSource = (article: Article) => {
        setSelectedArticleId(article.id);
        setActiveMode('follow_up');
        inputRef.current?.focus();
    };

    const handleResetConversation = () => {
        setTurns([]);
        setActiveMode('new_topic');
        setSelectedArticleId('all');
        setError(null);
        setQuery('');
        inputRef.current?.focus();
    };

    const handleCopy = async (turn: ChatTurn) => {
        let text = `# ${turn.query}\n\n${turn.answer}\n\n## Fonti citate\n`;
        turn.retrievedArticles.forEach(item => {
            text += `[${item.index}] ${item.article.title} (${item.article.link})\n`;
        });

        await navigator.clipboard.writeText(text);
        setCopiedTurnId(turn.id);
        setTimeout(() => setCopiedTurnId(null), 2000);
    };

    const handleExportMarkdown = (turn: ChatTurn) => {
        const today = new Date().toISOString().split('T')[0];
        let md = `# SimonReads Library AI: ${turn.query}\n`;
        md += `*Tipo: ${turn.type === 'deep_dive' ? 'Deep Dive Follow-up' : 'Ricerca Globale'} | Generato il ${today} (${turn.provider.toUpperCase()})*\n\n`;
        if (turn.targetTitle) {
            md += `> **Focus notizia:** ${turn.targetTitle}\n\n`;
        }
        md += `## Sintesi / Risposta\n\n${turn.answer}\n\n`;
        if (turn.retrievedArticles.length > 0) {
            md += `## Fonti Citate\n\n`;
            turn.retrievedArticles.forEach(item => {
                const source = item.article.feedTitle || item.article.creator || 'RSS';
                md += `- **[${item.index}]** [${item.article.title}](${item.article.link}) — *${source}*\n`;
            });
        }

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
        downloadFile(blob, `SimonReads_Library_${today}.md`, 'text/markdown');
    };

    return (
        <div className="ask-library-overlay" onClick={onClose}>
            <div className="ask-library-container" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="ask-library-header">
                    <div className="ask-library-title">
                        <Sparkles size={22} className="sparkles-icon" />
                        <div>
                            <h2>Ask My Library</h2>
                            <p className="subtitle">Ricerca cross-feed e sintesi AI intelligente dei tuoi articoli</p>
                        </div>
                    </div>
                    <div className="ask-header-actions">
                        {turns.length > 0 && (
                            <button
                                className="ask-reset-btn"
                                onClick={handleResetConversation}
                                title="Inizia una nuova sessione da zero"
                            >
                                <RotateCcw size={15} />
                                <span>Nuova sessione</span>
                            </button>
                        )}
                        <button className="ask-close-btn" onClick={onClose} aria-label="Chiudi">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Filter bar for Global Search */}
                {(turns.length === 0 || activeMode === 'new_topic') && (
                    <div className="ask-filters-bar">
                        <div className="filter-group">
                            <Clock size={14} />
                            <select
                                value={timeRange}
                                onChange={e => setTimeRange(e.target.value as any)}
                                disabled={isLoading}
                            >
                                <option value="all">Tutto l'archivio</option>
                                <option value="last24h">Ultime 24 ore</option>
                                <option value="last7d">Ultimi 7 giorni</option>
                                <option value="last30d">Ultimi 30 giorni</option>
                            </select>
                        </div>

                        <div className="filter-group">
                            <Bookmark size={14} />
                            <select
                                value={scope}
                                onChange={e => setScope(e.target.value as any)}
                                disabled={isLoading}
                            >
                                <option value="all">Tutti gli articoli</option>
                                <option value="saved">Solo salvati ⭐</option>
                                <option value="unread">Solo non letti</option>
                            </select>
                        </div>

                        {categories.length > 0 && (
                            <div className="filter-group">
                                <Filter size={14} />
                                <select
                                    value={selectedCategory}
                                    onChange={e => setSelectedCategory(e.target.value)}
                                    disabled={isLoading}
                                >
                                    <option value="all">Tutte le categorie</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                )}

                {/* Main Content Area */}
                <div className="ask-content-scroll">
                    {/* Welcome / Empty state */}
                    {turns.length === 0 && !isLoading && (
                        <div className="ask-welcome-view">
                            <div className="welcome-hero">
                                <div className="hero-icon-glow">
                                    <Sparkles size={36} />
                                </div>
                                <h3>Cosa vuoi scoprire nella tua libreria?</h3>
                                <p>Fai una domanda per esplorare e sintetizzare gli articoli presenti in tutti i tuoi feed.</p>
                            </div>

                            <div className="ask-suggestions">
                                <span className="suggestions-label">Domande suggerite:</span>
                                <div className="suggestion-chips">
                                    {SUGGESTIONS.map((suggestion, idx) => (
                                        <button
                                            key={idx}
                                            className="chip"
                                            onClick={() => {
                                                setQuery(suggestion);
                                                handleSearch(suggestion, 'new_topic');
                                            }}
                                        >
                                            <Compass size={14} />
                                            <span>{suggestion}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Conversation Turns Thread */}
                    {turns.length > 0 && (
                        <div className="ask-turns-thread">
                            {turns.map(turn => (
                                <div key={turn.id} className="turn-card">
                                    {/* User Question Bubble */}
                                    <div className="turn-user-box">
                                        <div className="turn-header-line">
                                            {turn.type === 'deep_dive' ? (
                                                <span className="mode-badge deep-dive">
                                                    <Target size={13} />
                                                    Deep Dive
                                                    {turn.targetTitle && ` • ${turn.targetTitle.slice(0, 40)}...`}
                                                </span>
                                            ) : (
                                                <span className="mode-badge global">
                                                    <Globe size={13} />
                                                    Ricerca Globale
                                                </span>
                                            )}
                                            <span className="turn-time">{turn.timestamp}</span>
                                        </div>
                                        <p className="turn-query-text">{turn.query}</p>
                                    </div>

                                    {/* AI Response Card */}
                                    <div className="turn-ai-card">
                                        <div className="ai-meta-bar">
                                            <span className="provider-badge">
                                                <Sparkles size={12} />
                                                {turn.provider.toUpperCase()}
                                            </span>
                                            <div className="turn-actions">
                                                <button
                                                    className="turn-action-btn"
                                                    onClick={() => handleCopy(turn)}
                                                    title="Copia risposta"
                                                >
                                                    {copiedTurnId === turn.id ? <Check size={14} /> : <Copy size={14} />}
                                                    <span>{copiedTurnId === turn.id ? 'Copiato' : 'Copia'}</span>
                                                </button>
                                                <button
                                                    className="turn-action-btn"
                                                    onClick={() => handleExportMarkdown(turn)}
                                                    title="Esporta come Markdown"
                                                >
                                                    <FileText size={14} />
                                                    <span>Esporta</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="ai-markdown-content markdown-body">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {turn.answer}
                                            </ReactMarkdown>
                                        </div>

                                        {/* Cited Sources for this turn */}
                                        {turn.retrievedArticles.length > 0 && (
                                            <div className="turn-sources-box">
                                                <div className="sources-header">
                                                    <span>📚 Fonti collegate ({turn.retrievedArticles.length})</span>
                                                    <span className="sources-hint">Clicca per aprire l'articolo o fai un Deep Dive mirato</span>
                                                </div>
                                                <div className="turn-sources-grid">
                                                    {turn.retrievedArticles.map(item => (
                                                        <div
                                                            key={item.article.id}
                                                            className={`source-mini-card ${selectedArticleId === item.article.id ? 'active-target' : ''}`}
                                                        >
                                                            <div
                                                                className="source-clickable-content"
                                                                onClick={() => {
                                                                    onSelectArticle(item.article);
                                                                    onClose();
                                                                }}
                                                                title="Apri articolo completo"
                                                            >
                                                                <span className="source-num">[{item.index}]</span>
                                                                <div className="source-texts">
                                                                    <div className="source-title-row">
                                                                        <h5 className="source-title">{item.article.title}</h5>
                                                                        <ExternalLink size={13} className="ext-icon" />
                                                                    </div>
                                                                    <div className="source-sub">
                                                                        <span>{item.article.feedTitle || 'Feed RSS'}</span>
                                                                        {item.article.pubDate && (
                                                                            <span> • {new Date(item.article.pubDate).toLocaleDateString()}</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <button
                                                                className="source-deep-dive-btn"
                                                                onClick={() => handleQuickDeepDiveOnSource(item.article)}
                                                                title="Approfondisci specificamente questa notizia"
                                                            >
                                                                <Target size={13} />
                                                                <span>Deep Dive</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={turnsEndRef} />
                        </div>
                    )}

                    {/* Loading State Animation */}
                    {isLoading && (
                        <div className="ask-loading-box">
                            <div className="loading-orbit">
                                <Sparkles size={24} className="spin-icon" />
                            </div>
                            <div className="loading-texts">
                                <h4>{loadingMessage}</h4>
                                <p>L'AI sta analizzando i contenuti della tua libreria...</p>
                            </div>
                        </div>
                    )}

                    {/* Error Banner */}
                    {error && !isLoading && (
                        <div className="ask-error-box">
                            <AlertCircle size={20} />
                            <div>
                                <strong>Operazione fallita</strong>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Interactive Bar: Mode Switcher & Input */}
                <div className="ask-bottom-panel">
                    {/* Mode Selector Tabs (Visible when there is already context) */}
                    {turns.length > 0 && (
                        <div className="ask-mode-tabs">
                            <button
                                className={`mode-tab-btn ${activeMode === 'follow_up' ? 'active' : ''}`}
                                onClick={() => setActiveMode('follow_up')}
                                disabled={isLoading}
                            >
                                <Target size={15} />
                                <span>🎯 Follow-up / Deep Dive (notizia specifica)</span>
                            </button>
                            <button
                                className={`mode-tab-btn ${activeMode === 'new_topic' ? 'active' : ''}`}
                                onClick={() => setActiveMode('new_topic')}
                                disabled={isLoading}
                            >
                                <Globe size={15} />
                                <span>🌐 Nuovo argomento (ricerca globale)</span>
                            </button>
                        </div>
                    )}

                    {/* Follow-up Target Selector (When in follow-up mode) */}
                    {turns.length > 0 && activeMode === 'follow_up' && availableSources.length > 0 && (
                        <div className="deep-dive-context-bar">
                            <span className="context-label">
                                <CornerDownRight size={14} />
                                <strong>Focus Deep Dive:</strong>
                            </span>
                            <select
                                className="deep-dive-target-select"
                                value={selectedArticleId}
                                onChange={e => setSelectedArticleId(e.target.value)}
                                disabled={isLoading}
                            >
                                <option value="all">
                                    🌟 Tutte le fonti collegate ({availableSources.length} articoli)
                                </option>
                                {availableSources.map(item => (
                                    <option key={item.article.id} value={item.article.id}>
                                        [{item.index}] {item.article.title.slice(0, 60)}...
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Input Field and Action Button */}
                    <div className="ask-input-box">
                        <div className="input-icon-slot">
                            {activeMode === 'follow_up' && turns.length > 0 ? (
                                <Target size={18} className="target-input-icon" />
                            ) : (
                                <Search size={18} className="search-input-icon" />
                            )}
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                activeMode === 'follow_up' && turns.length > 0
                                    ? selectedArticleId !== 'all'
                                        ? "Fai un deep dive su questo articolo (es. 'Spiega le cause', 'Quali sono i dati chiave?')..."
                                        : "Chiedi un approfondimento sulla notizia (es. 'Confronta i punti di vista', 'Cosa accadrà dopo?')..."
                                    : "Fai una domanda sui tuoi feed (es. 'Novità sulla fusione nucleare', 'Cosa dicono i mercati?')..."
                            }
                            disabled={isLoading}
                        />
                        <button
                            className={`ask-action-submit-btn ${activeMode === 'follow_up' && turns.length > 0 ? 'deep-dive-btn' : 'global-search-btn'}`}
                            onClick={() => handleSearch()}
                            disabled={!query.trim() || isLoading}
                        >
                            {isLoading ? (
                                <RefreshCw size={17} className="spin-icon" />
                            ) : activeMode === 'follow_up' && turns.length > 0 ? (
                                <>
                                    <Target size={16} />
                                    <span>Deep Dive</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} />
                                    <span>{turns.length > 0 ? 'Cerca Globale' : 'Chiedi all\'AI'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
