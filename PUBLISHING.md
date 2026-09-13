# LuckySeva — Publishing Guide (Web, Android, iOS)

The same React + Vite + Capacitor codebase produces three role-specific products.
Each build is locked to **one role** via the `VITE_APP_ROLE` environment variable:

| Role      | Website (Vercel)                     | Android app                          | iOS app                          |
|-----------|--------------------------------------|--------------------------------------|----------------------------------|
| Customer  | Yes (customer site)                  | LuckySeva (`com.luckyseva.app`)      | LuckySeva                        |
| Partner   | Yes (partner site)                   | LuckySeva Partner (`com.luckyseva.partner`) | LuckySeva Partner        |
| Admin     | Yes (admin dashboard, web only)      | **No — web only**                    | **No — web only**                |

There is **no runtime role switching** — each build contains only that role's screens,
auth flow, and navigation.

---

## Build for a specific role

Always set `VITE_APP_ROLE` for **both** `npm run build` and `npx cap sync` so the web
bundle and the native app identity (name + bundle/app id) match.

PowerShell (Windows):

```powershell
$env:VITE_APP_ROLE="customer"   # or "provider" (admin has no native app)
npm run build
npx cap sync
```

macOS/Linux:

```sh
VITE_APP_ROLE=customer npm run build   # or "provider"
VITE_APP_ROLE=customer npx cap sync
```

Only `customer` and `provider` produce native apps. If you build with
`VITE_APP_ROLE=admin`, do not run `cap sync` — admin live only on the web.

## Web (Vercel) — three separate sites

Create **three Vercel projects** from this repo; each gets its own `VITE_APP_ROLE`
environment variable (plus `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`):

1. Customer site → `VITE_APP_ROLE=customer`
2. Partner site → `VITE_APP_ROLE=provider`
3. Admin site → `VITE_APP_ROLE=admin` (web only)

Each project uses the same build settings (`npm run build`, output `dist` — Vercel
reads them from `vercel.json`). Every push to the connected branch auto-deploys.

## Android (Play Store) — do this on any machine

Requires: Windows/macOS/Linux + **Android Studio**.

1. Set the role you want to publish (`customer` or `provider`) and run the build +
   `cap sync` above. This regenerates the native identity (app name,
   `com.luckyseva.app` or `com.luckyseva.partner`).
2. Open `android/` in Android Studio (`File > Open`).
3. **App icon** (required for listing): replace
   `android/app/src/main/res/mipmap-*/ic_launcher*` with your own icon assets.
   Generate them with https://www.canva.com or an icon generator (512×512 minimum).
4. Set a **signing key**:
   - In Android Studio: `Build > Generate Signed App Bundle / APK`
   - Create a `.jks` keystore file and keep it safe — you'll need it for every future update.
5. Choose **App Bundle (.aab)** — this is what Play Store requires.
6. Create a Google Play Console account (one-time **$25**).
7. `Create app`, fill the store listing, upload the `.aab`, and submit for review.

Repeat for the other role to publish the second app.

> Play Store requires target API level 34+ — Capacitor 5+ already targets this, so no change needed.
> The app uses **Supabase** — if your Supabase instance has Row Level Security enabled behind an IP allowlist, add the Play Store security scanners to it, or RLS-based auth will keep working fine as-is.

## iOS (App Store) — requires a Mac

Windows cannot build iOS apps. You'll need any Mac (even a used one) and Xcode.

1. On the Mac: set the role to publish and run the build + `cap sync` above.
2. Open `ios/App/App.xcworkspace` in Xcode.
3. Replace the app icon & splash in `ios/App/App/Assets.xcassets`.
4. Set your **Team** (Apple Developer account, **$99/year**) in `Signing & Capabilities`.
5. `Product > Archive` then `Distribute App`.
6. Upload via App Store Connect, fill the listing, submit for review.

Repeat for the other role to publish the second app.

## Files that matter

| File | Purpose |
|------|---------|
| `.env` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ROLE` |
| `vercel.json` | Vercel build settings for all three web projects |
| `capacitor.config.ts` | Sets native app id/name from `VITE_APP_ROLE` |
| `src/lib/app-context.tsx` | `APP_ROLE` — locks each build to one role |
| `android/app/src/main/AndroidManifest.xml` | Android permissions & launch config |
| `ios/App/App/Info.plist` | iOS settings (display name, permissions) |
| `src/components/PhoneShell.tsx` | Renders full-screen on devices, phone mockup in browser |

## Notes

- The old **Customer / Provider / Admin role switcher** demo tool has been removed.
  Roles are fixed per build: `VITE_APP_ROLE=customer|provider|admin`.
- Real push notifications, in-app payments, and file uploads would use Capacitor plugins:
  `@capacitor/push-notifications`, `@capacitor/pay`, `@capacitor/camera`, etc.