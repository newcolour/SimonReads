import { useState, useRef, useCallback } from 'react';
import { X, Download, Copy, Share2, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Article } from '../types';
import './ShareCard.css';

interface ShareCardProps {
    article: Article;
    feedTitle?: string;
    onClose: () => void;
}

type CardStyle = 'minimal' | 'gradient' | 'news' | 'quote';

const STYLES: { id: CardStyle; name: string }[] = [
    { id: 'minimal', name: 'Minimal' },
    { id: 'gradient', name: 'Gradient' },
    { id: 'news', name: 'News' },
    { id: 'quote', name: 'Quote' }
];

const GRADIENTS = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
];

export default function ShareCard({ article, feedTitle, onClose }: ShareCardProps) {
    const [style, setStyle] = useState<CardStyle>('gradient');
    const [gradientIndex, setGradientIndex] = useState(0);
    const [copied, setCopied] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const formatDate = (date: string | Date | undefined) => {
        if (!date) return '';
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getExcerpt = (content: string | undefined, maxLength: number = 200) => {
        if (!content) return '';
        const temp = document.createElement('div');
        temp.innerHTML = content;
        const text = temp.textContent || temp.innerText || '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    };

    const cleanTitle = (title: string) => {
        if (!title) return '';
        const temp = document.createElement('div');
        temp.innerHTML = title;
        return temp.textContent || temp.innerText || title;
    };

    const downloadCard = useCallback(async () => {
        if (!cardRef.current) return;

        try {
            // Use html2canvas if available, otherwise fallback
            const html2canvas = (window as any).html2canvas;
            if (html2canvas) {
                const canvas = await html2canvas(cardRef.current, {
                    scale: 2,
                    backgroundColor: null,
                    useCORS: true
                });

                const dataUrl = canvas.toDataURL('image/png');
                const filename = `share-${article.id.substring(0, 8)}.png`;
                if (Capacitor.isNativePlatform()) {
                    try {
                        const base64data = dataUrl.split(',')[1];
                        await Filesystem.writeFile({
                            path: filename,
                            data: base64data,
                            directory: Directory.Documents
                        });
                        alert(`Image saved to Documents folder as ${filename}`);
                    } catch (err) {
                        console.error('Failed to save image:', err);
                        alert('Failed to save image. Ensure permissions are granted.');
                    }
                } else {
                    const link = document.createElement('a');
                    link.download = filename;
                    link.href = dataUrl;
                    link.click();
                }
            } else {
                alert('Image export requires html2canvas library. The card cannot be downloaded as an image.');
            }
        } catch (e) {
            console.error('Failed to export card:', e);
            alert('Failed to create image');
        }
    }, [article.id]);


    const copyAsImage = useCallback(async () => {
        if (!cardRef.current) return;

        try {
            // Use html2canvas if available
            const html2canvas = (window as any).html2canvas;
            if (html2canvas) {
                const canvas = await html2canvas(cardRef.current, {
                    scale: 2,
                    backgroundColor: null,
                    useCORS: true
                });

                // Convert canvas to blob
                canvas.toBlob(async (blob: Blob | null) => {
                    if (!blob) {
                        throw new Error('Failed to create image');
                    }

                    try {
                        // Try to copy image to clipboard
                        await navigator.clipboard.write([
                            new ClipboardItem({
                                'image/png': blob
                            })
                        ]);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                    } catch (clipboardError) {
                        // Fallback: download the image
                        const filename = `share-${article.id.substring(0, 8)}.png`;
                        if (Capacitor.isNativePlatform()) {
                            try {
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                    const base64data = (reader.result as string).split(',')[1];
                                    await Filesystem.writeFile({
                                        path: filename,
                                        data: base64data,
                                        directory: Directory.Documents
                                    });
                                    alert(`Image saved to Documents folder as ${filename}`);
                                };
                                reader.readAsDataURL(blob);
                            } catch (err) {
                                alert('Failed to save image.');
                            }
                        } else {
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.download = filename;
                            link.href = url;
                            link.click();
                            URL.revokeObjectURL(url);
                        }
                    }
                }, 'image/png');
            } else {
                // Fallback: copy formatted text
                await copyFormattedText();
            }
        } catch (e) {
            console.error('Failed to copy as image:', e);
            // Fallback to formatted text
            await copyFormattedText();
        }
    }, [article.id, cardRef]);

    const copyFormattedText = useCallback(async () => {
        const text = `📰 ${cleanTitle(article.title)}\n\n${getExcerpt(article.contentSnippet, 200)}\n\n🔗 ${article.link}\n\n${feedTitle ? `Source: ${feedTitle}` : ''}`;

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error('Failed to copy text:', e);
        }
    }, [article, feedTitle]);

    const shareNative = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: article.title,
                    text: getExcerpt(article.contentSnippet, 100),
                    url: article.link
                });
            } catch (e) {
                // User cancelled or error
            }
        }
    }, [article]);

    const renderCard = () => {
        const commonProps = {
            ref: cardRef,
            className: `share-card-preview ${style}`
        };

        switch (style) {
            case 'minimal':
                return (
                    <div {...commonProps} style={{ background: 'var(--bg-primary)' }}>
                        <div className="card-source">{feedTitle || 'Article'}</div>
                        <h2 className="card-title">{cleanTitle(article.title)}</h2>
                        <p className="card-excerpt">{getExcerpt(article.contentSnippet)}</p>
                        <div className="card-meta">{formatDate(article.pubDate)}</div>
                    </div>
                );

            case 'gradient':
                return (
                    <div {...commonProps} style={{ background: GRADIENTS[gradientIndex] }}>
                        <div className="card-overlay" />
                        <div className="card-content">
                            <div className="card-source">{feedTitle || 'Article'}</div>
                            <h2 className="card-title">{cleanTitle(article.title)}</h2>
                            <div className="card-meta">{formatDate(article.pubDate)}</div>
                        </div>
                    </div>
                );

            case 'news':
                return (
                    <div {...commonProps}>
                        <div className="card-content">
                            <div className="card-badge">{feedTitle || 'NEWS'}</div>
                            <h2 className="card-title">{cleanTitle(article.title)}</h2>
                            <p className="card-excerpt">{getExcerpt(article.contentSnippet, 150)}</p>
                        </div>
                    </div>
                );

            case 'quote':
                return (
                    <div {...commonProps} style={{ background: GRADIENTS[gradientIndex] }}>
                        <div className="card-quote-mark">"</div>
                        <h2 className="card-title">{cleanTitle(article.title)}</h2>
                        <div className="card-attribution">
                            — {feedTitle || 'Source'}, {formatDate(article.pubDate)}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="share-card-overlay" onClick={onClose}>
            <div className="share-card-container" onClick={e => e.stopPropagation()}>
                <div className="share-card-header">
                    <h2><Share2 size={20} /> Create Share Card</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="share-card-body">
                    {renderCard()}

                    <div className="share-card-options">
                        <div className="option-group">
                            <label>Style</label>
                            <div className="style-buttons">
                                {STYLES.map(s => (
                                    <button
                                        key={s.id}
                                        className={style === s.id ? 'active' : ''}
                                        onClick={() => setStyle(s.id)}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {(style === 'gradient' || style === 'quote') && (
                            <div className="option-group">
                                <label>Color</label>
                                <div className="gradient-buttons">
                                    {GRADIENTS.map((g, i) => (
                                        <button
                                            key={i}
                                            className={`gradient-btn ${gradientIndex === i ? 'active' : ''}`}
                                            style={{ background: g }}
                                            onClick={() => setGradientIndex(i)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="share-card-footer">
                    <button className="share-btn secondary" onClick={copyFormattedText}>
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                        {copied ? 'Copied!' : 'Copy Text'}
                    </button>

                    <button className="share-btn secondary" onClick={copyAsImage}>
                        <Copy size={18} />
                        Copy Image
                    </button>

                    {'share' in navigator && (
                        <button className="share-btn secondary" onClick={shareNative}>
                            <Share2 size={18} />
                            Share
                        </button>
                    )}

                    <button className="share-btn primary" onClick={downloadCard}>
                        <Download size={18} />
                        Save Image
                    </button>
                </div>
            </div>
        </div>
    );
}
