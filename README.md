# LuckySeva 🛠️

**LuckySeva — Trusted Services, At Your Doorstep**

A mobile-first home services marketplace. Customers discover and book verified local
professionals (plumbers, electricians, appliance repair, cleaning, and more); providers manage
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

Copy `.env.example` to `.env` (or edit the existing `.env`) and set your Supabase credentials:

```sh
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_URL=https://your-project.supabase.co
```

### 3. Run the web app (development)

```sh
npm run dev
```

Open the printed local URL (default `http://localhost:5173`) in your browser. The app renders
inside a phone mockup in the browser and full-screen on real devices.

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

1. Open `android/` in Android Studio (`File > Open`).
2. Run on an emulator or connected device, or build a signed bundle.

### iOS (requires macOS + Xcode)

1. Open `ios/App/App.xcworkspace` in Xcode.
2. Select your Team under `Signing & Capabilities` (requires an Apple Developer account).
3. Choose a simulator or a device and run.

> See [PUBLISHING.md](PUBLISHING.md) for the full app-store publishing guide.

---

## 🗂️ Project Structure

```
├── android/                 # Capacitor Android native project
├── ios/                     # Capacitor iOS native project
├── public/                  # Static assets (favicon)
├── src/
│   ├── components/          # Shared UI (Logo, PhoneShell, BottomNav, ui)
│   ├── lib/                 # App context, Supabase client, types, helpers
│   └── screens/
│       ├── customer/        # Customer-facing screens
│       ├── provider/        # Provider-facing screens
│       └── admin/           # Admin dashboard screens
├── supabase/migrations/     # Supabase SQL schema + seed data
├── capacitor.config.ts      # Capacitor config
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
