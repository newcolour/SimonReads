import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import './WelcomeTour.css';

interface WelcomeTourProps {
    onComplete: () => void;
}

const tourSteps = [
    {
        title: 'Welcome to SimonReads!',
        description: 'Your modern RSS reader with AI-powered features. Let\'s take a quick tour to get you started.',
        image: '🎉',
        highlight: null
    },
    {
        title: 'Add Your First Feed',
        description: 'Click the + button in the sidebar to add RSS feeds from your favorite websites and blogs.',
        image: '📰',
        highlight: '.add-feed-btn'
    },
    {
        title: 'Browse Articles',
        description: 'All your articles appear in the center panel. Click any article to read it in the reader view or browser view.',
        image: '📖',
        highlight: '.article-list-container'
    },
    {
        title: 'AI Summaries',
        description: 'Get instant AI-generated summaries of any article. Just click the "Summarize" button when reading.',
        image: '✨',
        highlight: null
    },
    {
        title: 'Chat with Articles',
        description: 'Ask questions about articles using the AI chat feature. Get deeper insights and explanations.',
        image: '💬',
        highlight: null
    },
    {
        title: 'Create Newsreels',
        description: 'Select multiple articles and create an AI-powered newsreel summary. Perfect for catching up!',
        image: '🎬',
        highlight: '.newsreel-btn'
    },
    {
        title: 'Daily Newsreel',
        description: 'Generate a daily digest of recent articles and export it as a beautiful newspaper-style PDF.',
        image: '📰',
        highlight: '.newsreel-btn'
    },
    {
        title: 'Customize Settings',
        description: 'Configure AI providers, themes, fonts, and more in the settings menu.',
        image: '⚙️',
        highlight: '.settings-btn'
    },
    {
        title: 'You\'re All Set!',
        description: 'Start adding feeds and enjoy your personalized news reading experience with AI assistance.',
        image: '🚀',
        highlight: null
    }
];

export default function WelcomeTour({ onComplete }: WelcomeTourProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isClosing, setIsClosing] = useState(false);

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
            onComplete();
        }, 300);
    };

    const handleSkip = () => {
        handleComplete();
    };

    const step = tourSteps[currentStep];
    const progress = ((currentStep + 1) / tourSteps.length) * 100;

    return (
        <div className={`welcome-tour-overlay ${isClosing ? 'closing' : ''}`}>
            <div className={`welcome-tour-modal ${isClosing ? 'closing' : ''}`}>
                <button className="tour-close-btn" onClick={handleSkip} title="Skip tour">
                    <X size={20} />
                </button>

                <div className="tour-content">
                    <div className="tour-image">
                        <span className="tour-emoji">{step.image}</span>
                    </div>

                    <h2 className="tour-title">{step.title}</h2>
                    <p className="tour-description">{step.description}</p>

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
