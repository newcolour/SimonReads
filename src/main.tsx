import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import SummaryWindow from './components/SummaryWindow.tsx'
import './index.css'

// Simple hash-based routing
function RootComponent() {
    const [hash, setHash] = useState(window.location.hash);

    useEffect(() => {
        const handleHashChange = () => {
            console.log('Hash changed to:', window.location.hash);
            setHash(window.location.hash);
        };

        window.addEventListener('hashchange', handleHashChange);
        console.log('Initial hash:', hash);

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // Check if hash starts with #/summary (to handle #/summary/article-id)
    if (hash.startsWith('#/summary')) {
        console.log('Rendering SummaryWindow for hash:', hash);
        return <SummaryWindow />;
    }

    console.log('Rendering App');
    return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RootComponent />
    </React.StrictMode>,
)
