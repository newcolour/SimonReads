import { LocalNotifications } from '@capacitor/local-notifications';
import { isElectron, isMobile } from '../utils/platform';

export interface NotificationOptions {
    title: string;
    body: string;
    id?: number;
    schedule?: { at: Date };
    extra?: any;
}

export class NotificationService {
    static async requestPermission(): Promise<boolean> {
        try {
            if (isMobile()) {
                const result = await LocalNotifications.requestPermissions();
                return result.display === 'granted';
            } else {
                // Electron and Web use the same standard API
                const permission = await Notification.requestPermission();
                return permission === 'granted';
            }
        } catch (e) {
            console.error('Error requesting notification permission:', e);
            return false;
        }
    }

    static async checkPermission(): Promise<boolean> {
        try {
            if (isMobile()) {
                const result = await LocalNotifications.checkPermissions();
                return result.display === 'granted';
            } else {
                return Notification.permission === 'granted';
            }
        } catch (e) {
            console.error('Error checking notification permission:', e);
            return false;
        }
    }

    static async send(options: NotificationOptions) {
        try {
            const hasPermission = await this.checkPermission();
            if (!hasPermission) {
                const granted = await this.requestPermission();
                if (!granted) {
                    console.log('Notification permission denied');
                    return;
                }
            }

            const id = options.id || Math.floor(Math.random() * 1000000);

            if (isMobile()) {
                await LocalNotifications.schedule({
                    notifications: [
                        {
                            title: options.title,
                            body: options.body,
                            id: id,
                            schedule: options.schedule,
                            extra: options.extra,
                            smallIcon: 'ic_stat_icon_config_sample', // Android resource, default uses app icon if not found
                            actionTypeId: '',
                            attachments: []
                        }
                    ]
                });
            } else {
                // Electron / Web
                // Note: 'schedule' is ignored for immediate web notifications, 
                // but we can simulate it with setTimeout if really needed. 
                // For now, assume immediate if no schedule or handle schedule in caller via cron/timeout.

                if (options.schedule && options.schedule.at > new Date()) {
                    const delay = options.schedule.at.getTime() - new Date().getTime();
                    setTimeout(() => {
                        this.showWebNotification(options);
                    }, delay);
                } else {
                    this.showWebNotification(options);
                }
            }
        } catch (e) {
            console.error('Error sending notification:', e);
        }
    }

    private static showWebNotification(options: NotificationOptions) {
        const notif = new Notification(options.title, {
            body: options.body,
            icon: '/icon.png' // Default public icon
        });

        notif.onclick = () => {
            // Handle click if needed (e.g. open app, focus window)
            if (isElectron()) {
                (window as any).ipcRenderer.invoke('focus-window');
            }
            window.focus();
        };
    }
}
