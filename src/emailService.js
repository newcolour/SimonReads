"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendDailyNewsreelEmail = sendDailyNewsreelEmail;
exports.validateEmailSettings = validateEmailSettings;
exports.testEmailConnection = testEmailConnection;
const nodemailer_1 = __importDefault(require("nodemailer"));
const aiService_1 = require("./aiService");
const newspaperPdfService_1 = require("./newspaperPdfService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function sendDailyNewsreelEmail(articles, emailSettings, appSettings) {
    if (!emailSettings.enabled) {
        console.log('Email sending is disabled');
        return;
    }
    // Filter articles from the last N hours
    const cutoffTime = Date.now() - (emailSettings.timeHorizon * 60 * 60 * 1000);
    const recentArticles = articles.filter(article => {
        if (!article.pubDate)
            return false;
        const articleTime = new Date(article.pubDate).getTime();
        return articleTime >= cutoffTime;
    });
    if (recentArticles.length === 0) {
        console.log('No recent articles to send');
        return;
    }
    console.log(`Generating newsreel for ${recentArticles.length} articles`);
    // Generate plain text newsreel
    const plainTextNewsreel = await generatePlainTextNewsreel(recentArticles, appSettings, emailSettings);
    // Generate PDF newsreel
    const pdfPath = await generatePDFForEmail(recentArticles, appSettings);
    // Send email
    await sendEmail(emailSettings, plainTextNewsreel, pdfPath, recentArticles.length);
    // Clean up PDF file
    if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
    }
    console.log('Daily newsreel email sent successfully');
}
async function generatePlainTextNewsreel(articles, settings, emailSettings) {
    // Prepare article content for AI
    const targetTotalChars = 50000;
    const charsPerArticle = Math.max(800, Math.floor(targetTotalChars / articles.length));
    const articleContents = articles.map((article, index) => {
        const content = (article.content || article.contentSnippet || '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, charsPerArticle);
        return `Article ${index + 1}: ${article.title}\nURL: ${article.link}\n${content}`;
    }).join('\n\n---\n\n');
    const instruction = `Please create a comprehensive daily news digest from the following ${articles.length} articles.

IMPORTANT INSTRUCTIONS:
1. First, identify common topics/themes across the articles
2. Group related articles together by topic
3. For each topic group:
   - Create a topic heading (use "===" for section breaks)
   - Provide a comprehensive summary that synthesizes information from ALL articles in that group
   - List each article title with its URL
   - Write 2-4 detailed paragraphs covering the key points from all articles in the group
4. Make sure EVERY article is included in at least one topic group
5. Format as PLAIN TEXT (no markdown, no HTML)
6. Use simple text formatting:
   - Topic headings in ALL CAPS
   - Separate sections with "==="
   - Bullet points with "- "
   - Article links on separate lines

This is for an email, so keep formatting simple and readable in plain text.`;
    const newsreel = await (0, aiService_1.summarizeArticle)(articleContents, settings.geminiApiKey || '', settings, instruction);
    // Add header and footer
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const header = `
╔════════════════════════════════════════════════════════════════╗
║                      SIMON'S DAILY NEWSREEL                    ║
║                    ${dateStr.padStart(54)}    ║
║                ${articles.length} Articles from the Last ${emailSettings.timeHorizon} Hours                ║
╚════════════════════════════════════════════════════════════════╝

`;
    const footer = `

═══════════════════════════════════════════════════════════════

This newsreel was automatically generated by SimonReads.
Articles are grouped by topic and summarized using AI.

To manage your email preferences, open SimonReads and go to Settings > Email.

═══════════════════════════════════════════════════════════════
`;
    return header + newsreel + footer;
}
async function generatePDFForEmail(articles, settings) {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    const today = new Date();
    const filename = `SimonDailyNews_${today.toISOString().split('T')[0]}.pdf`;
    const pdfPath = path.join(tmpDir, filename);
    // Generate PDF (this will save to downloads by default, we need to modify it)
    await (0, newspaperPdfService_1.generateNewspaperPDF)(articles, settings);
    // For now, return a placeholder path
    // In production, we'd need to modify generateNewspaperPDF to return the file path
    // or save to a specific location instead of triggering download
    return pdfPath;
}
async function sendEmail(settings, plainTextContent, pdfPath, articleCount) {
    // Create transporter
    const transporter = nodemailer_1.default.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpSecure,
        auth: {
            user: settings.smtpUser,
            pass: settings.smtpPassword
        }
    });
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const subject = `📰 Your Daily Newsreel - ${dateStr} (${articleCount} articles)`;
    const mailOptions = {
        from: settings.fromEmail,
        to: settings.toEmail,
        subject: subject,
        text: plainTextContent,
        attachments: fs.existsSync(pdfPath) ? [{
                filename: path.basename(pdfPath),
                path: pdfPath,
                contentType: 'application/pdf'
            }] : []
    };
    await transporter.sendMail(mailOptions);
}
function validateEmailSettings(settings) {
    if (!settings.smtpHost)
        return 'SMTP host is required';
    if (!settings.smtpPort)
        return 'SMTP port is required';
    if (!settings.smtpUser)
        return 'SMTP username is required';
    if (!settings.smtpPassword)
        return 'SMTP password is required';
    if (!settings.fromEmail)
        return 'From email is required';
    if (!settings.toEmail)
        return 'To email is required';
    if (!settings.sendTime)
        return 'Send time is required';
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(settings.fromEmail))
        return 'Invalid from email format';
    if (!emailRegex.test(settings.toEmail))
        return 'Invalid to email format';
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(settings.sendTime))
        return 'Invalid time format (use HH:MM)';
    return null;
}
async function testEmailConnection(settings) {
    try {
        const transporter = nodemailer_1.default.createTransport({
            host: settings.smtpHost,
            port: settings.smtpPort,
            secure: settings.smtpSecure,
            auth: {
                user: settings.smtpUser,
                pass: settings.smtpPassword
            }
        });
        await transporter.verify();
        return true;
    }
    catch (error) {
        console.error('Email connection test failed:', error);
        return false;
    }
}
