# Automated Daily Newsreel Email Feature

## Overview
Automated daily email feature that sends an AI-generated newsreel of recent articles every morning.

## Implementation Status

### ✅ Completed
1. **Email Service (`src/emailService.ts`)**:
   - [x] `sendDailyNewsreelEmail` function.
   - [x] Fetch recent articles based on `timeHorizon`.
   - [x] Generate plain text newsreel (using `summaryService`).
   - [x] Generate PDF newsreel (using `pdfService`).
   - [x] Send email with Nodemailer (text body + PDF attachment).
   - [x] `testEmailConnection` function.

2. **Email Scheduler (`electron/emailScheduler.ts`)**:
   - [x] `setupEmailScheduler` function.
   - [x] Use `node-cron` for scheduling.
   - [x] Handle `update-email-schedule` IPC.
   - [x] Trigger `send-daily-email` IPC.

3. **Electron Main Process (`electron/main.ts`)**:
   - [x] Initialize scheduler.
   - [x] Add IPC handlers (`update-email-schedule`, `send-daily-email`, `test-email-connection`).
   - [x] Handle dynamic imports/requires correctly for build.

4. **UI Integration**:
   - [x] Add Email settings to `Toolbar.tsx` (SMTP config, Schedule, Time Horizon).
   - [x] Add "Test Connection" and "Send Test Newsreel" buttons.
   - [x] Update `App.tsx` to handle settings changes and pass articles.
   - [x] Fix missing Email tab button in Settings modal.
   - [x] Group Voice & Speech settings in AI tab.

5. **Build & Refactoring**:
   - [x] Refactor `aiService.ts` into `summaryService.ts`, `chatService.ts`, `webSearchService.ts`.
   - [x] Rename `newspaperPdfService.ts` to `pdfService.ts`.
   - [x] Fix Rollup/Vite build issues.

6. **Android Support**:
   - [x] Verified Capacitor setup.
   - [x] Updated `ANDROID_BUILD.md` with limitations (Email feature is desktop-only).
   - [ ] Build APK (Requires local Java/Android SDK setup).

### 🚧 Pending / Next Steps
- [ ] User testing and feedback.
- [ ] Potential future enhancement: OAuth2 for Gmail (instead of App Passwords).

## Troubleshooting
- **Build Errors**: If Rollup complains about missing exports, ensure tree-shaking is disabled in `vite.config.ts` and that service files are clean and have unique names (renaming helps clear cache).
- **Email Failures**: Check console logs in Electron (Main process). Ensure "Less Secure Apps" or App Passwords are used for Gmail.
