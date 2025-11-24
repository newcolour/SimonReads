import { useState, useRef, useEffect } from 'react';
import { Send, X, MessageCircle, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppSettings, Article } from '../types';
import { chatWithArticle } from '../chatService';
import './Chat.css';

interface ChatProps {
    article: Article;
    settings: AppSettings;
    onClose: () => void;
    onNavigateToUrl?: (url: string) => void;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

// Storage key for chat history
const CHAT_STORAGE_KEY = 'chat-history';

export default function Chat({ article, settings, onClose, onNavigateToUrl }: ChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load chat history for this article on mount
    useEffect(() => {
        const loadChatHistory = () => {
            // First, clear current messages to prevent showing old chat
            setMessages([]);

            try {
                const stored = localStorage.getItem(CHAT_STORAGE_KEY);
                if (stored) {
                    const allChats = JSON.parse(stored);
                    const articleChat = allChats[article.id];
                    if (articleChat) {
                        // Convert timestamp strings back to Date objects
                        const messagesWithDates = articleChat.map((msg: any) => ({
                            ...msg,
                            timestamp: new Date(msg.timestamp)
                        }));
                        setMessages(messagesWithDates);
                    }
                }
            } catch (error) {
                console.error('Failed to load chat history:', error);
            }
        };
        loadChatHistory();
    }, [article.id]);

    // Save chat history whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            try {
                const stored = localStorage.getItem(CHAT_STORAGE_KEY);
                const allChats = stored ? JSON.parse(stored) : {};
                allChats[article.id] = messages;
                localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(allChats));
            } catch (error) {
                console.error('Failed to save chat history:', error);
            }
        }
    }, [messages, article.id]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setIsSearching(true);

        try {
            const response = await chatWithArticle(
                article,
                input.trim(),
                messages,
                settings.geminiApiKey || '',
                settings
            );

            const assistantMessage: Message = {
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error: any) {
            const errorMessage: Message = {
                role: 'assistant',
                content: `Error: ${error.message}`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setIsSearching(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleClearChat = () => {
        if (confirm('Are you sure you want to clear this chat history? This cannot be undone.')) {
            setMessages([]);
            try {
                const stored = localStorage.getItem(CHAT_STORAGE_KEY);
                if (stored) {
                    const allChats = JSON.parse(stored);
                    delete allChats[article.id];
                    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(allChats));
                }
            } catch (error) {
                console.error('Failed to clear chat history:', error);
            }
        }
    };

    return (
        <div className="chat-pane">
            <div className="chat-header">
                <div className="chat-title">
                    <MessageCircle size={18} />
                    <h3>Chat about this article</h3>
                </div>
                <div className="chat-header-actions">
                    {messages.length > 0 && (
                        <button
                            className="clear-chat-btn"
                            onClick={handleClearChat}
                            data-tooltip="Clear chat history"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <button className="close-btn" onClick={onClose} data-tooltip="Close chat">
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <MessageCircle size={48} />
                        <p>Ask questions about this article</p>
                        <span>Get deeper insights, clarifications, or explore related topics</span>
                    </div>
                )}
                {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                        <div className="message-content">
                            {msg.role === 'assistant' ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        a: ({ node, href, children, ...props }) => (
                                            <a
                                                href={href}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (href) {
                                                        console.log('Chat link clicked:', href);
                                                        try {
                                                            let fullUrl = href;

                                                            // Handle "www." without protocol
                                                            if (href.startsWith('www.')) {
                                                                fullUrl = 'https://' + href;
                                                            }
                                                            // Handle protocol-relative URLs
                                                            else if (href.startsWith('//')) {
                                                                fullUrl = 'https:' + href;
                                                            }
                                                            // Handle relative URLs (only if not absolute)
                                                            else if (!href.match(/^[a-zA-Z]+:\/\//)) {
                                                                fullUrl = new URL(href, article.link).toString();
                                                            }

                                                            // Use the callback to navigate in the embedded webview
                                                            if (onNavigateToUrl) {
                                                                console.log('Calling onNavigateToUrl with:', fullUrl);
                                                                onNavigateToUrl(fullUrl);
                                                            } else {
                                                                console.log('No onNavigateToUrl callback, using fallback');
                                                                // Fallback: open in external browser
                                                                const ipc = (window as any).ipcRenderer;
                                                                if (ipc) {
                                                                    ipc.invoke('open-external', fullUrl).catch((err: any) => console.error('Failed to open external link', err));
                                                                } else {
                                                                    window.open(fullUrl, '_blank');
                                                                }
                                                            }
                                                        } catch (e) {
                                                            console.error('Invalid URL in chat:', href, e);
                                                        }
                                                    }
                                                }}
                                                {...props}
                                            >
                                                {children}
                                            </a>
                                        )
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            ) : (
                                msg.content
                            )}
                        </div>
                        <div className="message-time">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                ))}
                {isSearching && !isLoading && (
                    <div className="search-indicator">
                        <div className="search-icon">🔍</div>
                        <span>Searching DuckDuckGo for additional information...</span>
                    </div>
                )}
                {isLoading && (
                    <div className="chat-message assistant loading">
                        <div className="message-content">
                            <div className="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-container">
                <textarea
                    className="chat-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask a question about this article..."
                    rows={1}
                    disabled={isLoading}
                />
                <button
                    className="send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    data-tooltip="Send message"
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
}
