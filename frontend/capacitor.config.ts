import type { CapacitorConfig } from '@capacitor/cli';

// Native build identity depends on which role this build targets.
// Set VITE_APP_ROLE when running `npm run build` + `npx cap sync`:
//   customer -> "LuckySeva" app            (com.luckyseva.app)
//   provider -> "LuckySeva Partner" app    (com.luckyseva.partner)
//   admin    -> no native app (web only)
const role = process.env.VITE_APP_ROLE ?? 'customer';
const isPartner = role === 'provider';

// Capacitor resolves every path below against the directory this file lives in
// (frontend/), so the native projects are reached via `../android` and `../ios`.
const config: CapacitorConfig = {
  appId: isPartner ? 'com.luckyseva.partner' : 'com.luckyseva.app',
  appName: isPartner ? 'LuckySeva Partner' : 'LuckySeva',
  webDir: 'dist',
  android: {
    path: '../android',
    allowMixedContent: true,
  },
  ios: {
    path: '../ios',
    contentInset: 'always',
  },
  server: {
    androidScheme: 'https',
  }
};

export default config;