import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.luckyseva.app',
  appName: 'LuckySeva',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'always',
  },
  server: {
    androidScheme: 'https',
  }
};

export default config;
