import { useState, useEffect } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { ChevronDown, ChevronRight, MessageSquare, ArrowUp } from 'lucide-react';
import DOMPurify from 'dompurify';
import './RedditComments.css';

interface CommentData {
    id: string;
    author: string;
    body: string; // Raw markdown
    body_html?: string; // Escaped HTML
    replies?: { data: { children: RedditNode[] } } | ""; // Empty string if no replies
    ups: number;
    created_utc: number;
    depth?: number;
}

interface RedditNode {
    kind: string; // 't1' for comment, 't3' for link, 'more' for load more
    data: CommentData;
}

interface RedditCommentsProps {
    articleUrl: string;
    theme?: string;
}

async function fetchUrl(url: string): Promise<any> {
    if ((window as any).ipcRenderer) {
        const result = await (window as any).ipcRenderer.invoke('fetch-url', url);
        if (result.success === false) throw new Error(result.error);
        const text = (typeof result === 'string') ? result : result.content;
        return JSON.parse(text);
    } else if (Capacitor.isNativePlatform()) {
        const response = await CapacitorHttp.get({ url });
        const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        return JSON.parse(text);
    } else {
        const response = await fetch(url);
        return await response.json();
    }
}

const CommentNode = ({ node, depth = 0 }: { node: RedditNode, depth?: number }) => {
    const [collapsed, setCollapsed] = useState(false);

    if (node.kind === 'more') {
        return <div className="reddit-comment-more">Load more comments...</div>;
    }

    const { author, body_html, ups, created_utc, replies } = node.data;

    // Decode HTML entities in body_html
    const decodeHtml = (html: string) => {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    };

    const renderedBody = body_html ? decodeHtml(body_html) : '';
    const cleanBody = DOMPurify.sanitize(renderedBody);

    const hasReplies = replies && typeof replies === 'object' && replies.data && replies.data.children && replies.data.children.length > 0;

    // Format time (e.g., "2 hours ago")
    const timeAgo = (date: number) => {
        const seconds = Math.floor((new Date().getTime() / 1000) - date);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + "y";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + "mo";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + "d";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m";
        return Math.floor(seconds) + "s";
    };

    return (
        <div className={`reddit-comment depth-${depth} ${collapsed ? 'collapsed' : ''}`}>
            <div className="comment-header" onClick={() => setCollapsed(!collapsed)}>
                <div className="comment-meta">
                    {hasReplies && (
                        <button className="collapse-btn">
                            {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </button>
                    )}
                    <span className="comment-author">{author}</span>
                    <span className="comment-points"><ArrowUp size={10} /> {ups}</span>
                    <span className="comment-time">{timeAgo(created_utc)}</span>
                </div>
            </div>

            {!collapsed && (
                <>
                    <div className="comment-body" dangerouslySetInnerHTML={{ __html: cleanBody }} />

                    {hasReplies && (
                        <div className="comment-replies">
                            {(replies as any).data.children.map((child: RedditNode) => (
                                <CommentNode key={child.data.id} node={child} depth={depth + 1} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default function RedditComments({ articleUrl }: RedditCommentsProps) {
    const [comments, setComments] = useState<RedditNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadComments = async () => {
            if (!articleUrl.includes('reddit.com')) return;

            setLoading(true);
            try {
                // Ensure URL ends with .json
                // Strip existing query
                const u = new URL(articleUrl);
                if (u.pathname.endsWith('/')) {
                    u.pathname = u.pathname.slice(0, -1);
                }
                u.pathname += '.json';

                const data = await fetchUrl(u.toString());

                // Reddit API returns array: [postData, coverageData(comments)]
                if (Array.isArray(data) && data.length > 1) {
                    setComments(data[1].data.children);
                }
            } catch (err) {
                console.error('Failed to load Reddit comments', err);
                setError('Failed to load comments');
            } finally {
                setLoading(false);
            }
        };

        loadComments();
    }, [articleUrl]);

    if (!articleUrl.includes('reddit.com')) return null;

    return (
        <div className="reddit-comments-section">
            <div className="comments-header-main">
                <MessageSquare size={18} />
                <h3>Comments</h3>
            </div>

            {loading && <div className="comments-loading">Loading comments...</div>}
            {error && <div className="comments-error">{error}</div>}

            <div className="comments-list">
                {comments.map(node => (
                    <CommentNode key={node.data.id} node={node} />
                ))}
            </div>
        </div>
    );
}
