
import { HelpCircle, Database, Key, Rss, Headphones } from 'lucide-react';
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
                <h4><Database size={16} /> Cross-Platform Sync</h4>
                <p>Sync your data across devices using one of two methods:</p>

                <div className="sub-topic">
                    <h5>Option A: Supabase (Recommended for ease of use)</h5>
                    <ol>
                        <li>Create a free account at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.</li>
                        <li>Create a new Project.</li>
                        <li>Go to <strong>Settings -&gt; API</strong> to find your <strong>Project URL</strong> and <strong>anon public key</strong>.</li>
                        <li>In SimonReads, go to <strong>Settings -&gt; Sync</strong>, select <strong>Supabase</strong>, and enter these credentials.</li>
                    </ol>
                </div>

                <div className="sub-topic">
                    <h5>Option B: NAS / WebDAV (Self-Hosted)</h5>
                    <p>Perfect for Synology, Nextcloud, or custom server users.</p>
                    <ol>
                        <li><strong>Synology Users:</strong> Install "WebDAV Server" package. Enable HTTP/HTTPS ports (default 5005/5006).</li>
                        <li><strong>Connection:</strong> In SimonReads, select <strong>NAS / WebDAV</strong>.</li>
                        <li><strong>URL:</strong> Enter your full URL (e.g., <code>https://my-nas.synology.me:5006</code>).</li>
                        <li><strong>Credentials:</strong> Enter your NAS username and password.</li>
                        <li><strong>Encryption:</strong> Set a secure "Encryption Key". This key must be the same on all devices to decrypt your data.</li>
                    </ol>
                </div>
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
                <p>To use the AI Chat features, you need to provide your own API keys. These keys are stored locally on your device and never synced.</p>
                <ul>
                    <li><strong>Gemini:</strong> Get a free key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer">Google AI Studio</a>.</li>
                    <li><strong>OpenAI:</strong> Get a key at <a href="https://platform.openai.com/" target="_blank" rel="noreferrer">OpenAI Platform</a>.</li>
                    <li><strong>Claude:</strong> Get a key at <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer">Anthropic Console</a>.</li>
                </ul>
                <p>Enter these keys in the <strong>Settings -&gt; AI</strong> tab.</p>
            </div>

            <div className="help-topic">
                <h4>Privacy & Security</h4>
                <p>
                    <strong>End-to-End Encryption:</strong> When syncing, your data (feeds, read status, chats) is encrypted on your device using your password/encryption key before being uploaded.
                    The server (Supabase or NAS) only sees encrypted blobs.
                </p>
                <p>
                    <strong>API Keys:</strong> Your AI API keys and Email passwords are <strong>NEVER</strong> synced. You must enter them manually on each device.
                </p>
            </div>
        </div>
    );
}
