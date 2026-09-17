
import { HelpCircle, Key, Rss, Headphones } from 'lucide-react';
import './HelpSection.css';

export default function HelpSection() {
    return (
        <div className="help-section">
            <div className="help-header">
                <h3><HelpCircle size={20} /> User Guide & Documentation</h3>
                <p>Welcome to SimonReads. Here is everything you need to know to get the most out of the app.</p>
            </div>

            <div className="help-topic">
                <h4><Rss size={16} /> Getting Started</h4>
                <ul>
                    <li><strong>Adding Feeds:</strong> Paste an RSS URL directly into the search bar, or type keywords to search for feeds.</li>
                    <li><strong>Reading:</strong> Click on an article to read it. Use "Read Mode" for a clutter-free experience.</li>
                    <li><strong>Favorites:</strong> Star articles to save them for later.</li>
                </ul>
            </div>

            <div className="help-topic">
                <h4><Headphones size={16} /> Advanced Features</h4>

                <div className="sub-topic">
                    <h5>AI Podcast & Read Aloud</h5>
                    <p>Listen to articles on the go with two modes:</p>
                    <ul>
                        <li><strong>Standard Read Aloud:</strong> Classic text-to-speech with adjustable speed.</li>
                        <li><strong>AI Podcast:</strong> Generates a dynamic conversation between two AI hosts (Alex & Jordan) discussing the article. Powered by Edge-TTS for high-quality voices.</li>
                    </ul>
                </div>

                <div className="sub-topic">
                    <h5>Focus Mode</h5>
                    <p>Click the <strong>Timer icon</strong> to enter a distraction-free mode. Includes a built-in Pomodoro timer (25m focus / 5m break) that persists even if you close the window.</p>
                </div>

                <div className="sub-topic">
                    <h5>Share Cards</h5>
                    <p>Click the <strong>Share icon</strong> to create beautiful visual cards for social media. You can copy the image directly to your clipboard or save it as a file.</p>
                </div>
            </div>

            <div className="help-topic">
                <h4><Key size={16} /> AI Assistant Setup</h4>
                <p>To use the AI Chat and Summary features, you can configure your own API keys or connect to a local Ollama instance. Keys are stored locally and securely on your device.</p>
                <ul>
                    <li><strong>Gemini:</strong> Get a key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio</a>.</li>
                    <li><strong>OpenAI:</strong> Get a key at <a href="https://platform.openai.com/" target="_blank" rel="noreferrer">OpenAI Platform</a>.</li>
                    <li><strong>Claude:</strong> Get a key at <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">Anthropic Console</a>.</li>
                    <li><strong>Ollama:</strong> Run local models for free (no API key required).</li>
                </ul>
                <p>Configure these in the <strong>Settings -&gt; AI</strong> tab.</p>
            </div>

            <div className="help-topic">
                <h4>Privacy & Local Storage</h4>
                <p>
                    <strong>Local Data:</strong> All your feeds, read states, highlights, notes, and preferences are stored locally on your device.
                </p>
                <p>
                    <strong>API Keys:</strong> Your AI API keys are stored locally and securely on your device and are never sent anywhere except directly to the configured AI providers.
                </p>
            </div>
        </div>
    );
}
