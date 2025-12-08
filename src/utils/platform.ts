import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const isElectron = () => {
    return !!(window as any).ipcRenderer;
};

export const isAndroid = () => {
    return Capacitor.getPlatform() === 'android';
};

export const isWeb = () => {
    return Capacitor.getPlatform() === 'web';
};

export const isMobile = () => {
    return isAndroid() || Capacitor.getPlatform() === 'ios';
};

export const openExternalUrl = async (url: string) => {
    if (isElectron()) {
        const ipcRenderer = (window as any).ipcRenderer;
        await ipcRenderer.invoke('open-external', url);
    } else if (isMobile()) {
        await Browser.open({ url });
    } else {
        window.open(url, '_blank');
    }
};
