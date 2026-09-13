# LuckySeva 🛠️

**LuckySeva — Trusted Services, At Your Doorstep**

A mobile-first home services marketplace. Customers discover and book verified local
professionals (plumbers, electricians, appliance repair, cleaning, and more); partners manage
their bookings and earnings; an admin dashboard oversees the platform.

Built with **React + Vite + TypeScript + Tailwind CSS** and wrapped as a native mobile app with
**Capacitor** for Android & iOS. Backend data is powered by **Supabase**.

---

## ✨ Brand

| Element  | Value            |
|----------|------------------|
| Mark     | Wrench icon on emerald rounded square |
| Wordmark | `Lucky` in **black**, `Seva` in **orange** |
| Tagline  | Trusted Services, At Your Doorstep |

---

## 🎯 One codebase, three role-locked builds

Each build is locked to **exactly one role** via the `VITE_APP_ROLE` environment variable.
There is **no runtime role switching** — a build only contains that role's screens, auth flow,
and navigation.

| Role     | Website (Vercel)                  | Android app                                 | iOS app                                        |
|----------|-----------------------------------|---------------------------------------------|-------------------------------------------------|
| Customer | ✅ customer site                  | ✅ LuckySeva (`com.luckyseva.app`)          | ✅ LuckySeva                                    |
| Partner  | ✅ partner site                   | ✅ LuckySeva Partner (`com.luckyseva.partner`) | ✅ LuckySeva Partner                        |
| Admin    | ✅ admin dashboard (web only)     | ❌ No                                       | ❌ No                                           |

> Full publishing walkthrough: see [PUBLISHING.md](PUBLISHING.md).
> In-depth feature & architecture docs: see [docs/FEATURES.md](docs/FEATURES.md).

---

## ✨ What's inside

| Area | Highlights |
|------|-----------|
| Customer app | Browse & book services, structured addresses, saved-address picker, click-only location, OTP auth, favourites, notifications, payments, reviews, tracking |
| Provider app | **Radius-based request matching** (set your location + service radius in km, get only in-radius requests with distance shown), accept/reject, job status flow, earnings & payouts, availability, pricing |
| Admin (web) | Real-time dashboard, customers/providers/services/bookings tables, add & edit, export CSV, audit log, platform settings |
| Matching engine | Customer request coords → Haversine distance → provider's `service_radius_km` decides visibility |

> Full feature walkthrough (data model, booking lifecycle, radius matching, geocoding):
> see [docs/FEATURES.md](docs/FEATURES.md).

---

## 📋 Prerequisites

- **Node.js** v18+ (v20 recommended) and npm
- (Optional) **Android Studio** — to build/run the Android app
- (Optional) **Xcode** on macOS — to build/run the iOS app
- (Recommended) [Supabase](https://supabase.com) project — for real backend data

---

## 🚀 Setup & Run

### 1. Install dependencies

```sh
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` (or edit the existing `.env`) and set your credentials:

```sh
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_APP_ROLE=customer        # customer | provider | admin
```

### 3. Run the web app (development)

```sh
npm run dev
```

Open the printed local URL (default `http://localhost:5173`) in your browser.
The app renders full-screen like a website on web and full-screen on real devices.

---

## 🏗️ Building for a specific role

Always set `VITE_APP_ROLE` for **both** `npm run build` and `npx cap sync`.

PowerShell (Windows):

```powershell
$env:VITE_APP_ROLE="customer"   # or "provider" (admin has no native app)
npm run build
npx cap sync
```

macOS / Linux:

```sh
VITE_APP_ROLE=customer npm run build   # or "provider"
VITE_APP_ROLE=customer npx cap sync
```

- `customer` → LuckySeva app (`com.luckyseva.app`)
- `provider` → LuckySeva Partner app (`com.luckyseva.partner`)
- `admin` → web only — do **not** run `cap sync`

---

## 🌐 Web (Vercel) — three separate sites

One repo deployed as **three Vercel projects**, each with its own `VITE_APP_ROLE`:

1. Create three projects from this repo on [Vercel](https://vercel.com).
2. Add the same `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to each.
3. Set the role per project:
   - Customer site → `VITE_APP_ROLE=customer`
   - Partner site → `VITE_APP_ROLE=provider`
   - Admin site → `VITE_APP_ROLE=admin`
4. Build settings come from [`vercel.json`](vercel.json) — no manual config needed.
5. Every push to `master` auto-deploys all three sites.

---

## 📦 Available Scripts

| Command               | Description                                 |
|-----------------------|---------------------------------------------|
| `npm run dev`         | Start the Vite dev server                   |
| `npm run build`       | Build the production bundle to `dist/`      |
| `npm run preview`     | Preview the production build locally        |
| `npm run lint`        | Run ESLint                                 |
| `npm run typecheck`   | Run TypeScript type checking                |
| `npx cap sync`        | Sync web build into native projects         |

---

## 📱 Mobile (Capacitor)

The web code is shared across web, Android, and iOS — no rewrites needed.

### Build for native

```sh
npm run build
npx cap sync
```

### Android

1. Set the role (`customer` or `provider`) and run the build + sync above.
2. Open `android/` in Android Studio (`File > Open`).
3. Run on an emulator or connected device, or build a signed bundle.

### iOS (requires macOS + Xcode)

1. Set the role (`customer` or `provider`) and run the build + sync above.
2. Open `ios/App/App.xcworkspace` in Xcode.
3. Select your Team under `Signing & Capabilities` (requires an Apple Developer account).
4. Choose a simulator or a device and run.

> See [PUBLISHING.md](PUBLISHING.md) for the full app-store & Vercel publishing guide.

---

## 🗂️ Project Structure

```
├── android/                 # Capacitor Android native project
├── ios/                     # Capacitor iOS native project
├── public/                  # Static assets (favicon)
├── src/
│   ├── components/          # Shared UI (Logo, PhoneShell, BottomNav, ui)
│   ├── lib/                 # App context (APP_ROLE), Supabase client, types, helpers
│   └── screens/
│       ├── customer/        # Customer-facing screens
│       ├── provider/        # Partner-facing screens
│       └── admin/           # Admin dashboard screens (web only)
├── supabase/migrations/     # Supabase SQL schema + seed data
├── capacitor.config.ts      # Capacitor config (role-aware app id/name)
├── vercel.json              # Vercel build settings
└── index.html               # HTML entry
```

---

## 🧰 Tech Stack

- **React 18** + **TypeScript**
- **Vite 5** build tooling
- **Tailwind CSS 3** styling
- **Capacitor 8** native mobile wrapper
- **Supabase** backend
- **lucide-react** icons