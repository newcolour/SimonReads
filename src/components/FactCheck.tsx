import { useState, useEffect } from 'react';
import { X, Shield, AlertTriangle, CheckCircle, HelpCircle, Loader, AlertCircle } from 'lucide-react';
import { AppSettings } from '../types';
import { FactCheckService, ArticleFactCheck, FactCheckResult } from '../services/factCheckService';
import './FactCheck.css';

interface FactCheckProps {
    articleId: string;
    title: string;
    content: string;
    settings: AppSettings;
    onClose: () => void;
}

const RATING_ICONS: Record<string, any> = {
    'reliable': CheckCircle,
    'mostly-reliable': CheckCircle,
    'mixed': HelpCircle,
    'caution': AlertTriangle,
    'likely-true': CheckCircle,
    'needs-context': HelpCircle,
    'unverifiable': HelpCircle,
    'likely-misleading': AlertCircle
};

export default function FactCheck({ articleId, title, content, settings, onClose }: FactCheckProps) {
    const [result, setResult] = useState<ArticleFactCheck | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState('Initializing fact-check...');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const check = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const factCheck = await FactCheckService.checkArticle(
                    articleId,
                    title,
                    content,
                    settings,
                    (newStatus) => setStatus(newStatus)
                );
                setResult(factCheck);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Fact-check failed');
            } finally {
                setIsLoading(false);
            }
        };

        check();
    }, [articleId, title, content, settings]);

    const OverallIcon = result ? RATING_ICONS[result.overallRating] : Shield;

    return (
        <div className="fact-check-overlay" onClick={onClose}>
            <div className="fact-check-container" onClick={e => e.stopPropagation()}>
                <div className="fact-check-header">
                    <h2><Shield size={22} /> AI Fact-Check</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {isLoading ? (
                    <div className="fact-check-loading">
                        <Loader size={32} className="spin" />
                        <p>{status}</p>
                        <small>This may take a moment</small>
                    </div>
                ) : error ? (
                    <div className="fact-check-error">
                        <AlertCircle size={32} />
                        <p>{error}</p>
                        <button onClick={onClose}>Close</button>
                    </div>
                ) : result ? (
                    <div className="fact-check-content">
                        <div
                            className="overall-rating"
                            style={{ '--rating-color': FactCheckService.getRatingColor(result.overallRating) } as React.CSSProperties}
                        >
                            <OverallIcon size={24} style={{ color: FactCheckService.getRatingColor(result.overallRating) }} />
                            <div className="rating-info">
                                <span className="rating-label">
                                    {FactCheckService.getRatingLabel(result.overallRating)}
                                </span>
                                <p className="rating-summary">{result.summary}</p>
                            </div>
                        </div>

                        {result.claims.length > 0 && (
                            <div className="claims-section">
                                <h3>Key Claims Analyzed</h3>
                                <div className="claims-list">
                                    {result.claims.map((claim, i) => (
                                        <ClaimCard key={i} claim={claim} />
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="fact-check-disclaimer">
                            <AlertTriangle size={14} />
                            <span>
                                This is an AI-powered analysis and may not be 100% accurate.
                                Always verify important claims with authoritative sources.
                            </span>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function ClaimCard({ claim }: { claim: FactCheckResult }) {
    const Icon = RATING_ICONS[claim.rating] || HelpCircle;
    const color = FactCheckService.getRatingColor(claim.rating);

    return (
        <div className="claim-card" style={{ '--claim-color': color } as React.CSSProperties}>
            <div className="claim-header">
                <Icon size={18} style={{ color }} />
                <span className="claim-rating" style={{ color }}>
                    {FactCheckService.getRatingLabel(claim.rating)}
                </span>
                <span className="claim-confidence">
                    {Math.round(claim.confidence * 100)}% confidence
                </span>
            </div>
            <div className="claim-text">"{claim.claim}"</div>
            <div className="claim-explanation">{claim.explanation}</div>

            {claim.sources && claim.sources.length > 0 && (
                <div className="claim-sources">
                    <span className="sources-label">Verified against:</span>
                    {claim.sources.map((source, i) => (
                        <a
                            key={i}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="source-tag"
                            title={source.title}
                        >
                            [{source.index}] {source.domain}
                        </a>
                    ))}
                </div>
            )}
        </div>
    );
}
