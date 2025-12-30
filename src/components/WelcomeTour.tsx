import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import './WelcomeTour.css';

interface WelcomeTourProps {
    onComplete: (showAgain: boolean) => void;
    onSelectFirstArticle?: () => void;
}

const tourSteps = [
    {
        title: 'Welcome to SimonReads!',
        description: 'Your modern RSS reader with AI-powered features. Let\'s take a quick tour to get you started.',
        image: '🎉',
        highlight: null,
        requiresArticle: false
    },
    {
        title: 'Add Your First Feed',
        description: 'Click the + button in the sidebar to add RSS feeds from your favorite websites and blogs.',
        image: '📰',
        highlight: '.add-feed-btn',
        requiresArticle: false
    },
    {
        title: 'Discover New Feeds',
        description: 'Not sure what to read? Click the sparkle icon to explore and subscribe to popular feeds across various topics.',
        image: '✨',
        highlight: '.icon-btn[data-tooltip="Discover Feeds"]',
        requiresArticle: false
    },
    {
        title: 'Sort Your Feeds',
        description: 'Organize feeds by last updated, alphabetically (A-Z), or reverse (Z-A) using the sort button in the sidebar.',
        image: '🔄',
        highlight: '.sort-dropdown-container',
        requiresArticle: false
    },
    {
        title: 'Organize with Categories',
        description: 'Right-click on any feed and select "Set Category" to group your subscriptions into folders.',
        image: '📂',
        highlight: '.feed-list',
        requiresArticle: false
    },
    {
        title: 'Browse Articles',
        description: 'All your articles appear in the center panel. Click any article to read it in the reader view or browser view.',
        image: '📖',
        highlight: '.article-list-container',
        requiresArticle: false
    },
    {
        title: 'Smart Reader View',
        description: 'Reader view fetches full content and applies publication brand colors. Toggle between reader and browser view.',
        image: '📄',
        highlight: '.action-btn[data-tooltip*="View"]',
        requiresArticle: true
    },
    {
        title: 'AI Summaries',
        description: 'Get instant AI-generated summaries of any article. Click the brain icon when reading. Right-click to toggle between popup and inline modes.',
        image: '✨',
        highlight: '.ai-summary-btn',
        requiresArticle: true
    },
    {
        title: 'Chat with Articles',
        description: 'Ask questions about articles using the AI chat feature. Get deeper insights and explanations.',
        image: '💬',
        highlight: '.action-btn[data-tooltip="Chat about article"]',
        requiresArticle: true
    },
    {
        title: 'Read Aloud with Controls',
        description: 'Listen to articles with text-to-speech. Use pause/resume and adjust playback speed (0.75x to 2.0x) while listening.',
        image: '🔊',
        highlight: null,
        requiresArticle: false
    },
    {
        title: 'Create Newsreels',
        description: 'Select multiple articles and create an AI-powered newsreel summary. Perfect for catching up! Summaries are cached to save API calls.',
        image: '🎬',
        highlight: '.newsreel-btn',
        requiresArticle: false
    },
    {
        title: 'Daily Newsreel',
        description: 'Generate a daily digest of recent articles and export it as a beautiful newspaper-style PDF with proper formatting.',
        image: '📰',
        highlight: '.newsreel-btn',
        requiresArticle: false
    },
    /* Email Digests step - feature temporarily disabled
    {
        title: 'Email Digests',
        description: 'Schedule daily email digests to be sent automatically. Configure SMTP settings in the settings menu.',
        image: '📧',
        highlight: '.settings-btn',
        requiresArticle: false
    },
    */
    {
        title: 'Customize Everything',
        description: 'Configure AI providers (Gemini, OpenAI, Claude), themes, fonts, TTS settings, and more in the settings menu.',
        image: '⚙️',
        highlight: '.settings-btn',
        requiresArticle: false
    },
    {
        title: 'Optimized for Mobile',
        description: 'On Android, enjoy a redesigned interface with a horizontal icon bar at the top for easy one-handed navigation. Icons and touch targets are optimized for mobile.',
        image: '📱',
        highlight: null,
        requiresArticle: false
    },
    {
        title: 'You\'re All Set!',
        description: 'Start adding feeds and enjoy your personalized news reading experience with AI assistance.',
        image: '🚀',
        highlight: null,
        requiresArticle: false
    }
];

export default function WelcomeTour({ onComplete, onSelectFirstArticle }: WelcomeTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isClosing, setIsClosing] = useState(false);
    const [showAgain, setShowAgain] = useState(false);
    const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

    const step = tourSteps[currentStep];

    // Select first article when reaching steps that require it
    useEffect(() => {
        if (step.requiresArticle && onSelectFirstArticle) {
            // Small delay to ensure UI is ready
            setTimeout(() => {
                onSelectFirstArticle();
            }, 100);
        }
    }, [currentStep, step.requiresArticle, onSelectFirstArticle]);

    useEffect(() => {
        if (step.highlight) {
            const element = document.querySelector(step.highlight);
            if (element) {
                // Add highlight class to element
                element.classList.add('tour-highlight');

                // Get element position for spotlight
                const rect = element.getBoundingClientRect();
                setSpotlightRect(rect);

                return () => {
                    element.classList.remove('tour-highlight');
                    setSpotlightRect(null);
                };
            } else {
                setSpotlightRect(null);
            }
        } else {
            setSpotlightRect(null);
        }
    }, [currentStep, step.highlight]);

    const handleNext = () => {
        if (currentStep < tourSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleComplete = () => {
        setIsClosing(true);
        setTimeout(() => {
            onComplete(showAgain);
        }, 300);
    };

    const handleSkip = () => {
        handleComplete();
    };

    const progress = ((currentStep + 1) / tourSteps.length) * 100;
    const isLastStep = currentStep === tourSteps.length - 1;

    return (
        <div className={`welcome-tour-overlay ${isClosing ? 'closing' : ''}`}>
            {/* SVG spotlight overlay with cutout for highlighted element */}
            {spotlightRect && (
                <svg
                    className="tour-spotlight-svg"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                        zIndex: 10000
                    }}
                >
                    <defs>
                        <mask id="spotlight-mask">
                            <rect x="0" y="0" width="100%" height="100%" fill="white" />
                            <rect
                                x={spotlightRect.left - 8}
                                y={spotlightRect.top - 8}
                                width={spotlightRect.width + 16}
                                height={spotlightRect.height + 16}
                                rx="12"
                                fill="black"
                            />
                        </mask>
                    </defs>
                    <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        fill="rgba(0, 0, 0, 0.85)"
                        mask="url(#spotlight-mask)"
                    />
                </svg>
            )}

            <div
                className={`welcome-tour-modal ${isClosing ? 'closing' : ''}`}
            >
                <button className="tour-close-btn" onClick={handleSkip} title="Skip tour">
                    <X size={20} />
                </button>

                <div className="tour-content">
                    <div className="tour-image">
                        <span className="tour-emoji">{step.image}</span>
                    </div>

                    <h2 className="tour-title">{step.title}</h2>
                    <p className="tour-description">{step.description}</p>

                    {isLastStep && (
                        <div className="tour-checkbox-container">
                            <label className="tour-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={showAgain}
                                    onChange={(e) => setShowAgain(e.target.checked)}
                                    className="tour-checkbox"
                                />
                                <span>Show this tutorial again on next launch</span>
                            </label>
                        </div>
                    )}

                    <div className="tour-progress">
                        <div className="tour-progress-bar">
                            <div
                                className="tour-progress-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="tour-step-counter">
                            {currentStep + 1} / {tourSteps.length}
                        </span>
                    </div>
                </div>

                <div className="tour-actions">
                    {currentStep > 0 && (
                        <button className="tour-btn tour-btn-secondary" onClick={handlePrevious}>
                            <ChevronLeft size={18} />
                            Previous
                        </button>
                    )}

                    <div style={{ flex: 1 }} />

                    {currentStep < tourSteps.length - 1 ? (
                        <button className="tour-btn tour-btn-primary" onClick={handleNext}>
                            Next
                            <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button className="tour-btn tour-btn-success" onClick={handleComplete}>
                            Get Started
                            <Check size={18} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
