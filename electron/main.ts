import { app, BrowserWindow, ipcMain, nativeTheme, net, session, Menu } from 'electron';
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

// Async read data handler for better performance
ipcMain.handle('read-data', async () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = await fs.promises.readFile(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading data async:', e);
  }
  return {};
});

// Simple ping handler for testing IPC
ipcMain.handle('ping', async () => {
  console.log('🏓 Ping received!');
  return 'pong';
});

// Image proxy handler - fetches images with proper headers to bypass hotlink protection
ipcMain.handle('proxy-image', async (event, imageUrl: string) => {
  try {
    // Extract the origin from the image URL to use as referer
    const urlObj = new URL(imageUrl);
    const referer = `${urlObj.protocol}//${urlObj.hostname}/`;

    return new Promise((resolve, reject) => {
      const request = net.request({
        url: imageUrl,
        method: 'GET'
      });

      request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      request.setHeader('Referer', referer);
      request.setHeader('Accept', 'image/webp,image/apng,image/*,*/*;q=0.8');

      const chunks: Buffer[] = [];

      request.on('response', (response) => {
        const contentType = response.headers['content-type'] as string || 'image/jpeg';

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          const dataUrl = `data:${contentType};base64,${base64}`;
          resolve({ success: true, dataUrl });
        });

        response.on('error', (err: Error) => {
          reject(err);
        });
      });

      request.on('error', (err: Error) => {
        reject(err);
      });

      request.end();
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return { success: false, error: String(error) };
  }
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

// Open YouTube in a popup window (bypasses embed restrictions)
let youtubeWindow: BrowserWindow | null = null;

ipcMain.handle('open-youtube-popup', async (event, videoId: string) => {
  console.log('Opening YouTube popup for video:', videoId);

  // Close existing popup if any
  if (youtubeWindow && !youtubeWindow.isDestroyed()) {
    youtubeWindow.close();
  }

  // Create popup window
  youtubeWindow = new BrowserWindow({
    width: 854,
    height: 520,
    title: 'YouTube Video',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  // Load YouTube watch page (NOT embed - embed can still be blocked)
  youtubeWindow.loadURL(`https://www.youtube.com/watch?v=${videoId}`);

  youtubeWindow.on('closed', () => {
    youtubeWindow = null;
  });

  return true;
});

// Share feed handler - uses native OS share panel
ipcMain.handle('share-feed', async (event, { title, url }: { title: string; url: string }) => {
  console.log('Share feed:', { title, url });
  try {
    const { shell, dialog } = require('electron');

    // On macOS, we can use the native share menu via shell.openExternal with mailto
    // or we can show a dialog with options
    if (process.platform === 'darwin') {
      // For macOS, we'll use shell.openExternal with different protocols
      // Show a simple dialog with share options
      const { response } = await dialog.showMessageBox(win!, {
        type: 'info',
        title: 'Share Feed',
        message: `Share "${title}"`,
        detail: url,
        buttons: ['Email', 'Copy Link', 'Cancel'],
        defaultId: 1,
        cancelId: 2
      });

      if (response === 0) {
        // Email
        const mailtoUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`Check out this RSS feed:\n\n${title}\n${url}`)}`;
        await shell.openExternal(mailtoUrl);
      } else if (response === 1) {
        // Copy to clipboard
        const { clipboard } = require('electron');
        clipboard.writeText(`${title}\n${url}`);
        return { success: true, action: 'copied' };
      }

      return { success: true, action: response === 0 ? 'email' : 'cancelled' };
    } else {
      // For other platforms, just copy to clipboard
      const { clipboard } = require('electron');
      clipboard.writeText(`${title}\n${url}`);
      return { success: true, action: 'copied' };
    }
  } catch (err: unknown) {
    console.error('Failed to share feed:', err);
    throw err;
  }
});

// Share to Mastodon handler - shows dialog to choose Mastodon app
ipcMain.handle('share-to-mastodon', async (event, { text }: { text: string }) => {
  console.log('Share to Mastodon:', text.substring(0, 50) + '...');
  const { shell, clipboard, dialog } = require('electron');
  const { execSync } = require('child_process');
  const encodedText = encodeURIComponent(text);

  // Mastodon apps with their URL schemes and bundle identifiers
  const mastodonApps: { name: string; scheme: string; bundleId: string }[] = [
    { name: 'Ivory', scheme: `ivory://acct/post?text=${encodedText}`, bundleId: 'com.tapbots.Ivory' },
    { name: 'Ice Cubes', scheme: `icecubesapp://compose?text=${encodedText}`, bundleId: 'com.thomasricouard.IceCubesApp' },
    { name: 'Mona', scheme: `mona://post?text=${encodedText}`, bundleId: 'me.johnxnguyen.Mona' },
    { name: 'Mastonaut', scheme: `mastonaut://compose?text=${encodedText}`, bundleId: 'com.brunoph.Mastonaut' },
    { name: 'Toot!', scheme: `toot://compose?text=${encodedText}`, bundleId: 'com.DAtek.Toot' },
  ];

  // Find installed apps (macOS only)
  let installedApps: typeof mastodonApps = [];
  if (process.platform === 'darwin') {
    for (const app of mastodonApps) {
      try {
        const result = execSync(`mdfind "kMDItemCFBundleIdentifier == '${app.bundleId}'"`, { encoding: 'utf8' });
        if (result.trim().length > 0) {
          installedApps.push(app);
        }
      } catch {
        // App not found
      }
    }
  }

  // Build dialog buttons
  const buttons = installedApps.map(app => app.name);
  buttons.push('Copy to Clipboard');
  buttons.push('Cancel');

  const { response } = await dialog.showMessageBox(win!, {
    type: 'question',
    title: 'Share to Mastodon',
    message: installedApps.length > 0 ? 'Choose your Mastodon app:' : 'No Mastodon app found',
    detail: text.length > 100 ? text.substring(0, 100) + '...' : text,
    buttons: buttons,
    defaultId: 0,
    cancelId: buttons.length - 1
  });

  if (response === buttons.length - 1) {
    return { success: true, action: 'cancelled' };
  } else if (response === buttons.length - 2) {
    clipboard.writeText(text);
    return { success: true, action: 'copied' };
  } else if (response < installedApps.length) {
    const selectedApp = installedApps[response];

    // Use URL scheme for the selected app
    try {
      await shell.openExternal(selectedApp.scheme);
      return { success: true, action: 'opened' };
    } catch (err) {
      console.error(`Failed to open ${selectedApp.name}:`, err);
      clipboard.writeText(text);
      return { success: true, action: 'copied' };
    }
  }

  return { success: true, action: 'cancelled' };
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

// Fetch Gemini Models
ipcMain.handle('fetch-gemini-models', async (event, apiKey: string) => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);
    const data = await response.json();
    return data.models
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => m.name.replace('models/', ''));
  } catch (error) {
    console.error('Failed to fetch Gemini models:', error);
    throw error;
  }
});

// Fetch OpenAI Models
ipcMain.handle('fetch-openai-models', async (event, apiKey: string) => {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    if (!response.ok) throw new Error(`OpenAI API Error: ${response.statusText}`);
    const data = await response.json();
    return data.data
      .filter((m: any) => m.id.includes('gpt')) // Filter for GPT models
      .map((m: any) => m.id)
      .sort();
  } catch (error) {
    console.error('Failed to fetch OpenAI models:', error);
    throw error;
  }
});

// Fetch Claude Models
ipcMain.handle('fetch-claude-models', async (event, apiKey: string) => {
  try {
    // Anthropic doesn't have a simple public list models endpoint that works with just an API key in the same way
    // But we can try the standard one if it exists, otherwise we might need to return a static list
    // or try to hit their models endpoint if available.
    // As of late 2024, Anthropic added a models endpoint.
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    if (!response.ok) {
      // Fallback to static list if endpoint fails (e.g. strict CORS or auth issues)
      console.warn('Anthropic models endpoint failed, using static list');
      return [
        'claude-3-5-sonnet-20240620',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ];
    }

    const data = await response.json();
    return data.data.map((m: any) => m.id);
  } catch (error) {
    console.error('Failed to fetch Claude models:', error);
    // Fallback
    return [
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
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
ipcMain.handle('create-summary-window', async (event, { summary, articleTitle, articleId, theme: passedTheme, settings: passedSettings }) => {
  try {
    // Determine theme: use passed theme, or fallback to storage
    let theme = passedTheme;
    let settings = passedSettings;
    if (!theme || !settings) {
      const appData = readData();
      const storedSettings = appData['rss-reader-settings'] || {};
      theme = theme || storedSettings.theme || 'dark';
      settings = settings || storedSettings;
    }

    // Store the data for when window is ready
    const data = { summary, articleTitle, articleId, theme, settings };
    pendingSummaryData.set(articleId, data);
    console.log('Main: Stored pending summary data for article:', articleId);
    console.log('Main: Settings received ttsProvider:', settings?.ttsProvider);

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
      // macOS-specific visual effects
      ...(process.platform === 'darwin' ? {
        vibrancy: 'under-window',
        visualEffectState: 'active',
        titleBarStyle: 'hiddenInset',
      } : {}),
      transparent: false,
      backgroundColor: '#1a1a1a',
      alwaysOnTop: false,
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


// Helper to fetch via BrowserWindow (bypasses most anti-bot checks)
async function fetchUrlViaWindow(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
  console.log(`Fallback fetching via Window: ${url}`);
  let fetchWin: BrowserWindow | null = new BrowserWindow({
    show: false, // Invisible
    width: 1024,
    height: 768,
    webPreferences: {
      offscreen: true, // Render offscreen
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    // Set a timeout
    const timeout = setTimeout(() => {
      if (fetchWin && !fetchWin.isDestroyed()) {
        fetchWin.destroy();
        fetchWin = null;
      }
    }, 15000); // 15s timeout

    await fetchWin.loadURL(url, { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' });

    // Wait a moment for dynamic content
    await new Promise(r => setTimeout(r, 1000));

    if (!fetchWin || fetchWin.isDestroyed()) throw new Error('Window destroyed/timeout');

    // Get HTML
    const content = await fetchWin.webContents.executeJavaScript('document.documentElement.outerHTML');

    clearTimeout(timeout);
    if (fetchWin && !fetchWin.isDestroyed()) fetchWin.destroy();

    return { success: true, content };
  } catch (error) {
    console.error('Window fetch failed:', error);
    if (fetchWin && !fetchWin.isDestroyed()) fetchWin.destroy();
    return { success: false, error: String(error) };
  }
}

ipcMain.handle('fetch-url', async (event, url) => {
  try {
    console.log(`Fetching URL content: ${url}`);

    // Get cookies from the default session for this URL
    const cookies = await session.defaultSession.cookies.get({ url });
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    const result: any = await new Promise((resolve) => {
      const request = net.request({
        method: 'GET',
        url: url,
        redirect: 'follow',
        session: session.defaultSession
      });

      // Set browser-like headers
      request.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      request.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7');
      request.setHeader('Accept-Language', 'en-US,en;q=0.9');
      request.setHeader('Accept-Encoding', 'gzip, deflate, br');
      request.setHeader('Upgrade-Insecure-Requests', '1');
      request.setHeader('Connection', 'keep-alive');

      if (cookieHeader) request.setHeader('Cookie', cookieHeader);

      let responseData = '';

      request.on('response', (response) => {
        // If we get specific error codes that imply blocking, resolve with failure to trigger fallback
        if (response.statusCode === 403 || response.statusCode === 503 || response.statusCode === 429) {
          console.log(`Primary fetch blocked: ${response.statusCode}`);
          resolve({ success: false, error: `Status ${response.statusCode}`, attemptFallback: true });
          return;
        }

        if (response.statusCode !== 200) {
          resolve({ success: false, error: `Failed to fetch: ${response.statusCode} ${response.statusMessage}` });
          return;
        }

        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          resolve({ success: true, content: responseData });
        });

        response.on('error', (error: Error) => {
          resolve({ success: false, error: error.message });
        });
      });

      request.on('error', (error: Error) => {
        resolve({ success: false, error: error.message });
      });

      request.end();
    });

    // If primary fetch failed with a blocking status, or if successful but content looks like a captcha/challenge
    if (result.attemptFallback || (result.success && (
      result.content.includes('cf-challenge') ||
      result.content.includes('Just a moment...') ||
      result.content.includes('security check') ||
      result.content.length < 500 // Too short to be real article
    ))) {
      console.log('Detected blocking or challenge, attempting fallback fetch via Window...');
      return await fetchUrlViaWindow(url);
    }

    return result;

  } catch (error) {
    console.error(`Error fetching URL ${url}:`, error);
    // Try fallback on general error too
    return await fetchUrlViaWindow(url);
  }
});

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  // Create a minimal menu (this is required for basic keyboard shortcuts on macOS)
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        { role: 'close' as const },
        ...(process.platform !== 'darwin' ? [{ role: 'quit' as const }] : []) // Quit is in App menu on Mac
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        { role: 'selectAll' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'close' as const },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' as const },
          { role: 'front' as const }
        ] : [])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'SimonReads',
    // macOS-specific visual effects
    ...(process.platform === 'darwin' ? {
      vibrancy: 'under-window',
      visualEffectState: 'active',
      titleBarStyle: 'hiddenInset',
    } : {}),
    transparent: false,
    backgroundColor: '#1a1a1a',
    autoHideMenuBar: true, // Hide menu bar on Windows/Linux (press Alt to show)
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
      : path.join(__dirname, '../../dist/index.html');
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
