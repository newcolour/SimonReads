import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader, Plus, Check, Sparkles, CheckCircle } from 'lucide-react';
import { Feed, AppSettings } from '../types';
import { suggestFeeds, FeedSuggestion, validateSuggestions } from '../feedDiscoveryService';
import './FeedDiscovery.css';

interface FeedDiscoveryProps {
    currentFeeds: Feed[];
    settings: AppSettings;
    onClose: () => void;
    onAddFeed: (url: string) => Promise<void>;
}

export default function FeedDiscovery({ currentFeeds, settings, onClose, onAddFeed }: FeedDiscoveryProps) {
    const [suggestions, setSuggestions] = useState<FeedSuggestion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [validationProgress, setValidationProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState<string | null>(null);
    const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
    const [addingUrl, setAddingUrl] = useState<string | null>(null);
    const [keyword, setKeyword] = useState('');
    const [hasSearched, setHasSearched] = useState(false);

    const fetchSuggestions = async (searchKeyword?: string) => {
        setIsLoading(true);
        setIsValidating(false);
        setError(null);
        setHasSearched(true);
        setSuggestions([]);

        try {
            // Get API key based on provider (Ollama doesn't need one)
            let apiKey = '';
            const provider = settings.aiProvider || 'gemini';

            if (provider === 'gemini') apiKey = settings.geminiApiKey || '';
            else if (provider === 'openai') apiKey = settings.openaiApiKey || '';
            else if (provider === 'claude') apiKey = settings.claudeApiKey || '';
            else if (provider === 'ollama') apiKey = 'local'; // Ollama doesn't need an API key

            if (!apiKey && provider !== 'ollama') {
                setError(`Please set your ${provider} API Key in Settings to use Feed Discovery.`);
                setIsLoading(false);
                return;
            }

            // Get AI suggestions
            const rawResults = await suggestFeeds(currentFeeds, apiKey, settings, searchKeyword);

            // Now validate the feeds
            setIsLoading(false);
            setIsValidating(true);
            setValidationProgress({ current: 0, total: rawResults.length });

            const validatedResults = await validateSuggestions(
                rawResults,
                (validated, current, total) => {
                    setValidationProgress({ current, total });
                    // Update suggestions with validated ones as they come in
                    setSuggestions([...validated]);
                }
            );

            setIsValidating(false);

            if (validatedResults.length === 0 && rawResults.length > 0) {
                setError(`Found ${rawResults.length} suggestions, but none could be verified. The AI may have suggested non-existent feeds.`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load suggestions');
            setIsLoading(false);
            setIsValidating(false);
        }
    };

    const handleSearch = () => {
        fetchSuggestions(keyword.trim() || undefined);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleAdd = async (suggestion: FeedSuggestion) => {
        if (addingUrl) return; // Prevent multiple clicks

        setAddingUrl(suggestion.url);
        try {
            await onAddFeed(suggestion.url);
            setAddedUrls(prev => new Set(prev).add(suggestion.url));
        } catch (err) {
            console.error('Failed to add feed:', err);
            alert(`Failed to add feed: ${suggestion.title}. The URL might be invalid or unreachable.`);
        } finally {
            setAddingUrl(null);
        }
    };

    // Group suggestions by category
    const categorizedSuggestions = suggestions.reduce((acc, suggestion) => {
        const category = suggestion.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(suggestion);
        return acc;
    }, {} as { [key: string]: FeedSuggestion[] });

    return createPortal(
        <div className="feed-discovery-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className="feed-discovery-modal">
                <div className="feed-discovery-header">
                    <h2>
                        <Sparkles size={20} className="text-accent" />
                        Discover Feeds
                    </h2>
                    <button className="feed-discovery-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="feed-discovery-content">
                    {/* Search Input */}
                    <div className="discovery-search">
                        <input
                            type="text"
                            placeholder="Enter a keyword or theme (e.g., 'AI', 'cooking', 'sports')..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="discovery-search-input"
                        />
                        <button
                            onClick={handleSearch}
                            className="discovery-search-btn"
                            disabled={isLoading || isValidating}
                        >
                            {isLoading || isValidating ? <Loader className="spin" size={16} /> : 'Search'}
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="discovery-loading">
                            <Loader className="spin" size={32} />
                            <p>Analyzing your interests and finding new feeds...</p>
                        </div>
                    ) : isValidating ? (
                        <div className="discovery-loading">
                            <CheckCircle size={32} className="text-accent" />
                            <p>Verifying feeds... ({validationProgress.current}/{validationProgress.total})</p>
                            <p className="discovery-loading-sub">
                                {suggestions.length} valid feed{suggestions.length !== 1 ? 's' : ''} found so far
                            </p>
                        </div>
                    ) : error ? (
                        <div className="discovery-error">
                            <p>{error}</p>
                        </div>
                    ) : !hasSearched ? (
                        <div className="discovery-prompt">
                            <Sparkles size={48} style={{ opacity: 0.3 }} />
                            <p>Enter a keyword or theme above to discover new RSS feeds,</p>
                            <p>or leave it blank to get suggestions based on your current feeds.</p>
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="discovery-empty">
                            <p>No suggestions found. Try a different keyword!</p>
                        </div>
                    ) : (
                        <div className="categorized-suggestions">
                            {Object.entries(categorizedSuggestions).map(([category, categoryFeeds]) => (
                                <div key={category} className="category-section">
                                    <h3 className="category-title">{category}</h3>
                                    <div className="suggestion-list">
                                        {categoryFeeds.map((suggestion, index) => (
                                            <div key={index} className="suggestion-item">
                                                <div className="suggestion-header">
                                                    <span className="suggestion-title">
                                                        {suggestion.title}
                                                        {suggestion.verificationStatus === 'valid' && (
                                                            <span className="verified-badge">
                                                                <CheckCircle size={12} />
                                                                Verified
                                                            </span>
                                                        )}
                                                    </span>
                                                    <button
                                                        className={`add-suggestion-btn ${addedUrls.has(suggestion.url) ? 'added' : ''}`}
                                                        onClick={() => handleAdd(suggestion)}
                                                        disabled={addedUrls.has(suggestion.url) || addingUrl === suggestion.url}
                                                    >
                                                        {addingUrl === suggestion.url ? (
                                                            <>
                                                                <Loader className="spin" size={14} />
                                                                Adding...
                                                            </>
                                                        ) : addedUrls.has(suggestion.url) ? (
                                                            <>
                                                                <Check size={14} />
                                                                Added
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Plus size={14} />
                                                                Add
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="suggestion-desc">{suggestion.description}</p>
                                                <span className="suggestion-url">{suggestion.url}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
