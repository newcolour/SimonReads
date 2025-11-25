import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupEmailScheduler, updateSchedule, stopScheduler } from './emailScheduler';

// Storage file path
const DATA_FILE = path.join(app.getPath('userData'), 'data.json');

// Helper to read data
function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading data:', e);
  }
  return {};
}

// Helper to write data
function writeData(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error writing data:', e);
  }
}

// IPC Handlers
ipcMain.on('read-data-sync', (event) => {
  event.returnValue = readData();
});

ipcMain.on('write-data-sync', (event, arg) => {
  const { key, value } = arg;
  const currentData = readData();
  currentData[key] = value;
  writeData(currentData);
  event.returnValue = true;
});

import * as googleTTS from 'google-tts-api';

// TTS Proxy Handler
ipcMain.handle('fetch-tts', async (event, { text, lang }) => {
  console.log('TTS Proxy: Received request for text length:', text.length, 'lang:', lang);
  try {
    const results = await googleTTS.getAllAudioBase64(text, {
      lang: lang || 'en',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000,
      splitPunct: '.!?',
    });
    const base64List = results.map(result => result.base64);
    console.log('TTS Proxy: Successfully retrieved audio segments:', base64List.length);
    return base64List;
  } catch (error) {
    console.error('TTS Proxy Error:', error);
    throw error;
  }
});

// Open external link handler
ipcMain.handle('open-external', async (event, url: string) => {
  console.log('Open external URL:', url);
  try {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return true;
  } catch (err: unknown) {
    console.error('Failed to open external link:', err);
    throw err;
  }
});

// Search proxy handler
ipcMain.handle('perform-search', async (event, query: string) => {
  console.log('Search Proxy: Received query:', query);
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Search failed with status: ${response.status}`);
    }

    const html = await response.text();
    return html;
  } catch (error) {
    console.error('Search Proxy Error:', error);
    throw error;
  }
});

// Email scheduler IPC handlers
ipcMain.on('update-email-schedule', (event, enabled: boolean, sendTime: string) => {
  if (win) {
    updateSchedule(enabled, sendTime, win);
  }
});

ipcMain.handle('send-daily-email', async (event, { articles, emailSettings, appSettings }) => {
  try {
    // Use require instead of dynamic import to avoid TypeScript rootDir issues
    // The emailService will be bundled and available at runtime
    const emailService = require('./emailService');
    await emailService.sendDailyNewsreelEmail(articles, emailSettings, appSettings);
    return { success: true };
  } catch (error) {
    console.error('Failed to send daily email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// System theme IPC handler
ipcMain.handle('get-system-theme', () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

// Listen for system theme changes
nativeTheme.on('updated', () => {
  if (win) {
    const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    win.webContents.send('system-theme-changed', theme);
  }
});



// Track multiple summary windows by article ID
const summaryWindows = new Map<string, BrowserWindow>();
const pendingSummaryData = new Map<string, { summary: string; articleTitle: string; articleId: string; theme: string }>();

// Handle request for summary data (invoke/handle pattern - more reliable)
ipcMain.handle('get-summary-data', async (event, articleId: string) => {
  console.log('Main: Received get-summary-data request for article:', articleId);
  const data = pendingSummaryData.get(articleId);

  if (data) {
    console.log('Main: Returning summary data for article:', articleId);
    // Don't delete yet - window might request again
    return { success: true, data };
  } else {
    console.log('Main: No pending data found for article:', articleId);
    return { success: false, error: 'No data available' };
  }
});

// Legacy listener for backward compatibility
ipcMain.on('summary-window-ready', (event, articleId: string) => {
  console.log('Main: Received ready signal from summary window for article:', articleId);
  const data = pendingSummaryData.get(articleId);
  const window = summaryWindows.get(articleId);

  if (data && window && !window.isDestroyed()) {
    console.log('Main: Sending pending summary data immediately for article:', articleId);
    window.webContents.send('update-summary', data);
  }
});

// Create summary window handler
ipcMain.handle('create-summary-window', async (event, { summary, articleTitle, articleId, theme: passedTheme }) => {
  try {
    // Determine theme: use passed theme, or fallback to storage
    let theme = passedTheme;
    if (!theme) {
      const appData = readData();
      const settings = appData['rss-reader-settings'] || {};
      theme = settings.theme || 'dark';
    }

    // Store the data for when window is ready
    const data = { summary, articleTitle, articleId, theme };
    pendingSummaryData.set(articleId, data);
    console.log('Main: Stored pending summary data for article:', articleId);

    // Check if window for this article already exists
    const existingWindow = summaryWindows.get(articleId);
    if (existingWindow && !existingWindow.isDestroyed()) {
      console.log('Main: Summary window for this article already exists, focusing');
      existingWindow.focus();
      existingWindow.webContents.send('update-summary', data);
      return { success: true };
    }

    console.log('Main: Creating new summary window for article:', articleId);
    const mainBounds = win?.getBounds();

    // Calculate position - offset each window slightly
    const windowCount = summaryWindows.size;
    const offset = windowCount * 30;

    const summaryWindow = new BrowserWindow({
      width: 500,
      height: 700,
      x: mainBounds ? mainBounds.x + mainBounds.width + offset : undefined,
      y: mainBounds ? mainBounds.y + offset : undefined,
      title: `AI Summary - ${articleTitle.substring(0, 50)}...`,
      // Remove parent to fix dragging and always-on-top issues
      vibrancy: 'under-window',
      visualEffectState: 'active',
      transparent: false,
      backgroundColor: '#1a1a1a',
      titleBarStyle: 'hiddenInset',
      alwaysOnTop: false, // Explicitly set to false
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    // Store the window
    summaryWindows.set(articleId, summaryWindow);

    summaryWindow.on('closed', () => {
      console.log('Main: Summary window closed for article:', articleId);
      summaryWindows.delete(articleId);
      pendingSummaryData.delete(articleId);
    });

    // Load the summary page
    // Load the summary page
    const encodedArticleId = encodeURIComponent(articleId);
    if (VITE_DEV_SERVER_URL) {
      await summaryWindow.loadURL(`${VITE_DEV_SERVER_URL}#/summary/${encodedArticleId}?theme=${theme}`);
    } else {
      const indexPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')
        : path.join(__dirname, '../dist/index.html');
      await summaryWindow.loadFile(indexPath, { hash: `/summary/${encodedArticleId}?theme=${theme}` });
    }


    // Send data immediately after page loads
    summaryWindow.webContents.on('did-finish-load', () => {
      console.log('Main: Summary window finished loading for article:', articleId);
      const currentData = pendingSummaryData.get(articleId);
      if (currentData) {
        console.log('Main: Sending summary data via did-finish-load');
        // Wait a bit for React to mount
        setTimeout(() => {
          if (!summaryWindow.isDestroyed()) {
            summaryWindow.webContents.send('update-summary', currentData);
          }
        }, 100);
      }
    });

    // Also send via dom-ready as a fallback
    summaryWindow.webContents.on('dom-ready', () => {
      console.log('Main: Summary window DOM ready for article:', articleId);
      setTimeout(() => {
        const currentData = pendingSummaryData.get(articleId);
        const currentWindow = summaryWindows.get(articleId);
        if (currentWindow && !currentWindow.isDestroyed() && currentData) {
          console.log('Main: Sending summary data via dom-ready fallback for article:', articleId);
          currentWindow.webContents.send('update-summary', currentData);
        }
      }, 300);
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to create summary window:', error);
    if (articleId) {
      pendingSummaryData.delete(articleId);
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle('test-email-connection', async (event, emailSettings) => {
  console.log('Testing email connection with settings:', {
    host: emailSettings.smtpHost,
    port: emailSettings.smtpPort,
    secure: emailSettings.smtpSecure,
    user: emailSettings.smtpUser
  });

  try {
    const emailService = require('./emailService');
    console.log('Email service loaded:', typeof emailService.testEmailConnection);

    const result = await emailService.testEmailConnection(emailSettings);
    console.log('Test result:', result);
    return { success: result };
  } catch (error) {
    console.error('Failed to test email connection:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : '');
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'SimonReads',
    vibrancy: 'under-window', // macOS vibrancy effect
    visualEffectState: 'active',
    transparent: false,
    backgroundColor: '#ffffff',
    titleBarStyle: 'hiddenInset', // Native-like title bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Allow fetching RSS feeds from other domains
      webviewTag: true, // Enable <webview> tag
    },
  });

  // Strip X-Frame-Options and CSP headers to allow embedding sites like omgubuntu
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    // Remove blocking headers
    const headersToRemove = [
      'x-frame-options',
      'content-security-policy',
      'frame-options'
    ];

    Object.keys(responseHeaders).forEach(header => {
      if (headersToRemove.includes(header.toLowerCase())) {
        delete responseHeaders[header];
      }
    });

    callback({
      cancel: false,
      responseHeaders,
    });
  });

  // Ad blocker - block requests to known ad/tracking domains
  const adDomains = [
    'doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.com/tr',
    'facebook.net',
    'scorecardresearch.com',
    'outbrain.com',
    'taboola.com',
    'advertising.com',
    'adnxs.com',
    'adsystem.com',
    'adservice.google',
    'criteo.com',
    'quantserve.com',
    'pubmatic.com',
    'rubiconproject.com',
    'amazon-adsystem.com',
    'adsafeprotected.com',
    'moatads.com',
    'chartbeat.com',
    'newrelic.com',
    'hotjar.com',
    'mouseflow.com',
    'clicktale.com',
    'crazyegg.com',
    'zedo.com',
    'advertising.com',
    'adroll.com',
    'serving-sys.com',
    'turn.com',
    'casalemedia.com',
    'bluekai.com',
    'exelator.com',
    'addthis.com',
    'sharethis.com',
  ];

  win.webContents.session.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
    const url = details.url.toLowerCase();
    const shouldBlock = adDomains.some(domain => url.includes(domain));

    callback({ cancel: shouldBlock });
  });

  // Handle external links - open in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    // If the URL starts with http/https, open in default browser
    if (url.startsWith('http:') || url.startsWith('https:')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' }; // Prevent Electron from creating a new window
    }
    return { action: 'allow' };
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    // Development mode
    win.loadURL(VITE_DEV_SERVER_URL);
    win.webContents.openDevTools(); // Open DevTools for debugging
  } else {
    // Production mode – load the bundled index.html correctly
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')
      : path.join(__dirname, '../dist/index.html');
    win.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
    });
    // Open DevTools for debugging
    // win.webContents.openDevTools();
  }

  // Setup email scheduler
  if (win) {
    setupEmailScheduler(win);
  }

}

app.on('window-all-closed', () => {
  stopScheduler(); // Stop email scheduler
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopScheduler(); // Ensure scheduler is stopped
});

app.whenReady().then(createWindow);
