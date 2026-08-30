# LuckySeva — Mobile App Publishing Guide

The app is wrapped with **Capacitor** (`android/` and `ios/` native projects exist).
Your web code (React + Vite) is shared across web, Android, and iOS — no rewrites.

## Common workflow after any code change

```sh
npm run build
npx cap sync
```

## Android (Play Store) — do this on any machine

Requires: Windows/macOS/Linux + **Android Studio**.

1. Open `android/` in Android Studio (`File > Open`).
2. **App icon** (required for listing): replace
   `android/app/src/main/res/mipmap-*/ic_launcher*` with your own icon assets.
   Generate them with https://www.canva.com or an icon generator (512×512 minimum).
3. Set a **signing key**:
   - In Android Studio: `Build > Generate Signed App Bundle / APK`
   - Create a `.jks` keystore file and keep it safe — you'll need it for every future update.
4. Choose **App Bundle (.aab)** — this is what Play Store requires.
5. Create a Google Play Console account (one-time **$25**).
6. `Create app`, fill the store listing, upload the `.aab`, and submit for review.

> Play Store requires target API level 34+ — Capacitor 5+ already targets this, so no change needed.
> The app uses **Supabase** — if your Supabase instance has Row Level Security enabled behind an IP allowlist, add the Play Store security scanners to it, or RLS-based auth will keep working fine as-is.

## iOS (App Store) — requires a Mac

Windows cannot build iOS apps. You'll need any Mac (even a used one) and Xcode.

1. On the Mac: open your project, run `npx cap add ios` (already generated here; just copy the `ios/` folder).
2. Open `ios/App/App.xcworkspace` in Xcode.
3. Replace the app icon & splash in `ios/App/App/Assets.xcassets`.
4. Set your **Team** (Apple Developer account, **$99/year**) in `Signing & Capabilities`.
5. `Product > Archive` then `Distribute App`.
6. Upload via App Store Connect, fill the listing, submit for review.

## Files that matter

| File | Purpose |
|------|---------|
| `capacitor.config.ts` | App id `com.luckyseva.app`, name, web folder |
| `android/app/src/main/AndroidManifest.xml` | Android permissions & launch config |
| `ios/App/App/Info.plist` | iOS settings (display name, permissions) |
| `src/components/PhoneShell.tsx` | Renders full-screen on devices, phone mockup in browser |

## Notes

- The floating **Customer / Provider / Admin** role switcher (bottom of screen) is a demo tool.
  Remove `RoleSwitcher` in `src/App.tsx` before production if you don't want real users switching roles.
- Real push notifications, in-app payments, and file uploads would use Capacitor plugins:
  `@capacitor/push-notifications`, `@capacitor/pay`, `@capacitor/camera`, etc.