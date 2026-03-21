import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.simonbianco.simonreads',
  appName: 'SimonReads',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false
    },
    CapacitorHttp: {
      enabled: true
    },
    StatusBar: {
      overlaysWebView: true,
      style: 'DARK',
      backgroundColor: '#00000000'
    }
  }
};

export default config;
