import * as cron from 'node-cron';
import { BrowserWindow } from 'electron';

let scheduledTask: cron.ScheduledTask | null = null;

export function setupEmailScheduler(mainWindow: BrowserWindow) {
    // Listen for settings updates from renderer
    mainWindow.webContents.on('ipc-message', async (event, channel, ...args) => {
        if (channel === 'update-email-schedule') {
            const [enabled, sendTime] = args;
            updateSchedule(enabled, sendTime, mainWindow);
        }
    });
}

export function updateSchedule(enabled: boolean, sendTime: string, mainWindow: BrowserWindow) {
    // Stop existing schedule
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }

    if (!enabled || !sendTime) {
        console.log('Email scheduling disabled');
        return;
    }

    // Parse time (format: "HH:MM")
    const [hours, minutes] = sendTime.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
        console.error('Invalid time format:', sendTime);
        return;
    }

    // Create cron expression (runs daily at specified time)
    const cronExpression = `${minutes} ${hours} * * *`;

    console.log(`Scheduling daily email at ${sendTime} (cron: ${cronExpression})`);

    scheduledTask = cron.schedule(cronExpression, () => {
        console.log('Triggering daily newsreel email...');
        // Send message to renderer to trigger email
        mainWindow.webContents.send('trigger-daily-email');
    });
}

export function stopScheduler() {
    if (scheduledTask) {
        scheduledTask.stop();
        scheduledTask = null;
    }
}
