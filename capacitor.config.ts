import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.monmoncafe.app',
  appName: 'MonMon Café',
  webDir: 'dist',
  server: {
    // The backend runs on a PC in the local network over plain HTTP, so the
    // WebView is served over http:// too (an https:// origin would block those
    // calls as mixed content) and cleartext traffic is allowed.
    androidScheme: 'http',
    cleartext: true,
  },
};

export default config;
