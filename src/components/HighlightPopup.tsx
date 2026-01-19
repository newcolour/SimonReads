import { useState, useEffect, useRef } from 'react';
import { X, Highlighter, StickyNote, Trash2 } from 'lucide-react';
import { AnnotationService, Highlight } from '../services/annotationService';
import './HighlightPopup.css';

interface HighlightPopupProps {
    selectedText: string;
    articleId: string;
    position: { x: number; y: number };
    onClose: () => void;
    onHighlightAdded: () => void;
}

const COLORS: Highlight['color'][] = ['yellow', 'green', 'blue', 'pink', 'purple'];

const COLOR_MAP: Record<Highlight['color'], string> = {
    yellow: '#fef08a',
    green: '#bbf7d0',
    blue: '#bfdbfe',
    pink: '#fbcfe8',
    purple: '#ddd6fe'
};

export default function HighlightPopup({
    selectedText,
    articleId,
    position,
    onClose,
    onHighlightAdded
}: HighlightPopupProps) {
    const [selectedColor, setSelectedColor] = useState<Highlight['color']>('yellow');
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [note, setNote] = useState('');
    const popupRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Adjust position to stay in viewport
    const adjustedPosition = {
        x: Math.min(position.x, window.innerWidth - 200),
        y: Math.min(position.y, window.innerHeight - 150)
    };

    const handleHighlight = () => {
        AnnotationService.addHighlight(articleId, selectedText, selectedColor, note || undefined);
        onHighlightAdded();
        onClose();
    };

    return (
        <div
            ref={popupRef}
            className="highlight-popup"
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y
            }}
        >
            <div className="highlight-popup-header">
                <Highlighter size={16} />
                <span>Highlight</span>
                <button className="highlight-close-btn" onClick={onClose}>
                    <X size={14} />
                </button>
            </div>

            <div className="highlight-preview">
                "{selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}"
            </div>

            <div className="highlight-colors">
                {COLORS.map(color => (
                    <button
                        key={color}
                        className={`color-btn ${selectedColor === color ? 'selected' : ''}`}
                        style={{ backgroundColor: COLOR_MAP[color] }}
                        onClick={() => setSelectedColor(color)}
                        title={color}
                    />
                ))}
            </div>

            {!showNoteInput ? (
                <button
                    className="add-note-btn"
                    onClick={() => setShowNoteInput(true)}
                >
                    <StickyNote size={14} />
                    Add note
                </button>
            ) : (
                <textarea
                    className="note-input"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Add a note..."
                    autoFocus
                />
            )}

            <button className="highlight-save-btn" onClick={handleHighlight}>
                Save Highlight
            </button>
        </div>
    );
}

// Separate component for viewing highlights
interface HighlightViewerProps {
    articleId: string;
    onClose: () => void;
}

export function HighlightViewer({ articleId, onClose }: HighlightViewerProps) {
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');

    useEffect(() => {
        setHighlights(AnnotationService.getHighlights(articleId));
    }, [articleId]);

    const handleDeleteHighlight = (id: string) => {
        AnnotationService.removeHighlight(id);
        setHighlights(AnnotationService.getHighlights(articleId));
    };

    const handleSaveNote = (id: string) => {
        AnnotationService.updateNote(id, noteText);
        setEditingNote(null);
        setHighlights(AnnotationService.getHighlights(articleId));
    };

    if (highlights.length === 0) {
        return (
            <div className="highlight-viewer-empty">
                <Highlighter size={24} />
                <p>No highlights yet</p>
                <small>Select text in the article to highlight it</small>
            </div>
        );
    }

    return (
        <div className="highlight-viewer">
            <div className="highlight-viewer-header">
                <h3><Highlighter size={18} /> Highlights ({highlights.length})</h3>
                <button onClick={onClose}><X size={18} /></button>
            </div>

            <div className="highlight-list">
                {highlights.map(h => (
                    <div
                        key={h.id}
                        className="highlight-item"
                        style={{ borderLeftColor: COLOR_MAP[h.color] }}
                    >
                        <div className="highlight-text">"{h.text}"</div>

                        {editingNote === h.id ? (
                            <div className="highlight-note-edit">
                                <textarea
                                    value={noteText}
                                    onChange={e => setNoteText(e.target.value)}
                                    placeholder="Add a note..."
                                    autoFocus
                                />
                                <button onClick={() => handleSaveNote(h.id)}>Save</button>
                                <button onClick={() => setEditingNote(null)}>Cancel</button>
                            </div>
                        ) : h.note ? (
                            <div
                                className="highlight-note"
                                onClick={() => {
                                    setEditingNote(h.id);
                                    setNoteText(h.note || '');
                                }}
                            >
                                <StickyNote size={12} />
                                {h.note}
                            </div>
                        ) : (
                            <button
                                className="add-note-link"
                                onClick={() => {
                                    setEditingNote(h.id);
                                    setNoteText('');
                                }}
                            >
                                + Add note
                            </button>
                        )}

                        <button
                            className="highlight-delete"
                            onClick={() => handleDeleteHighlight(h.id)}
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
