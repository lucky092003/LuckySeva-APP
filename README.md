# LuckySeva 🛠️

**LuckySeva — Trusted Services, At Your Doorstep**

A mobile-first home services marketplace. Customers discover and book verified local
professionals (plumbers, electricians, appliance repair, cleaning, and more); partners manage
their bookings and earnings; an admin dashboard oversees the platform.

## 🏗️ Architecture

```
┌─────────────────────────── APP/WEBSITE (Vercel) ───────────────────────────┐
│  React + Vite + TypeScript + Tailwind   ·   Capacitor (Android & iOS)      │
│  frontend/src/services/api.ts  →  calls the FastAPI backend (VITE_API_URL)  │
└───────────────┬────────────────────────────────────────────────────────────┘
                │ HTTPS / JSON + JWT (Bearer token)
┌───────────────▼────────────────────────────────────────────────────────────┐
│  BACKEND (FastAPI · Python) — backend/app/                             │
│  · Auth: /auth/verify-otp mints a JWT (customer / provider / admin roles)  │
│  · Routers: auth · catalog · customer · provider · admin                   │
│  · Writes/reads data through supabase-py (service role)                    │
└───────────────┬────────────────────────────────────────────────────────────┘
                │ SQL (via PostgREST)
┌───────────────▼────────────────────────────────────────────────────────────┐
│  DATABASE (Supabase)  — PostgreSQL + Row Level Security                    │
│  Tables: categories, services, professionals, bookings, reviews, ...       │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Frontend** = `frontend/` (web + mobile), deployed on **Vercel**.
- **Backend** = `backend/` FastAPI server (Python), deployed anywhere (Render/Railway/VPS).
- **Database** = **Supabase** Postgres — the single source of truth for both the app and the API.

> 👉 All data access goes through the API client at
> [`frontend/src/services/api.ts`](frontend/src/services/api.ts). The browser never
> talks to Supabase directly; the backend holds the service-role key.

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
- **Python 3.11+** (for the FastAPI backend)
- (Optional) **Android Studio** — to build/run the Android app
- (Optional) **Xcode** on macOS — to build/run the iOS app
- [Supabase](https://supabase.com) project — the database (required)

---

## 🚀 Setup & Run

### 1. Database (Supabase)

Create a project on [supabase.com](https://supabase.com), then apply the schema:

```sh
npx supabase link          # link your project
npx supabase db push       # apply backend/supabase/migrations/*
```

Or copy the `.sql` files from `backend/supabase/migrations/` into the Supabase
**SQL Editor** and run them in order.

### 2. Backend (FastAPI, Python)

```sh
cd backend
py -m pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env` and set your Supabase credentials
(Project Settings → API):

```sh
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # secret — never expose publicly
SUPABASE_JWT_SECRET=your-jwt-secret
```

Run locally:

```sh
py -m uvicorn app.main:app --reload
```

Interactive API docs: `http://localhost:8000/docs`.

> **JWT note:** the backend mints and verifies its own JWTs using `SUPABASE_JWT_SECRET`
> (same secret Supabase uses), so tokens are valid for the API only.

To run the lint/tests locally too (what CI does), add the dev tooling:

```sh
py -m pip install -r requirements-dev.txt
ruff check app tests
python -m pytest tests -q
```

`requirements-dev.txt` is deliberately kept separate from `requirements.txt` so
production installs (Render) never pull in test/lint packages.

### 3. Frontend (React + Vite)

```sh
cd frontend
npm install
```

Copy `frontend/.env.example` to `frontend/.env` and set:

```sh
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_APP_ROLE=customer        # customer | provider | admin
VITE_API_URL=http://localhost:8000   # FastAPI base URL
```

Run the web app (development):

```sh
npm run dev
```

Open the printed local URL (default `http://localhost:5173`) in your browser.
The app renders full-screen like a website on web and full-screen on real devices.

---

## 🏗️ Building for a specific role

Always set `VITE_APP_ROLE` for **both** `npm run build` and `npx cap sync`.
Run both from the `frontend/` directory — Capacitor resolves its config and
`node_modules` relative to the current working directory.

PowerShell (Windows):

```powershell
cd frontend
$env:VITE_APP_ROLE="customer"   # or "provider" (admin has no native app)
npm run build
npx cap sync
```

macOS / Linux:

```sh
cd frontend
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
2. Set **Root Directory** to `frontend` on each project
   (Project Settings → Build and Deployment → Root Directory).
   This is a dashboard setting — it is **not** a `vercel.json` property, and
   putting `rootDirectory` in `vercel.json` fails schema validation.
3. Add the same `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` + `VITE_API_URL` to each.
4. Set the role per project:
   - Customer site → `VITE_APP_ROLE=customer`
   - Partner site → `VITE_APP_ROLE=provider`
   - Admin site → `VITE_APP_ROLE=admin`
5. Build settings come from [`frontend/vercel.json`](frontend/vercel.json) — no manual config needed.
6. Every push to `master` auto-deploys all three sites.

<details>
<summary>Build fails with <code>vite: command not found</code> (exit 127)</summary>

The build toolchain (`vite`, `typescript`, `tailwindcss`, …) lives in
`devDependencies`. If the install runs in production mode they are skipped, so
`node_modules/.bin/vite` never exists and the build exits 127.

- `frontend/vercel.json` already pins `installCommand` to
  `npm install --include=dev`, which forces dev dependencies regardless.
- Also check the project env vars for **`NODE_ENV=production`** — that is what
  puts npm into production mode in the first place. Unset it for builds.
- Leave **Include source files outside the Root Directory in the Build Step**
  off. This repo has no `package.json` at its root, so enabling it makes the
  build step look for one in the wrong place and dependencies never install.

</details>

## 🐍 Backend (FastAPI) — deployment

The API is a plain Python service; deploy it on any host. Recommended: **Render**:

1. Push this repo to GitHub.
2. On [Render](https://render.com) → **New → Web Service** → pick the repo.
3. Root Directory: `backend`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add the environment variables from `backend/.env.example`
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`).
7. Copy the generated URL (e.g. `https://luckyseva-app-gbjw.onrender.com`) into
   `VITE_API_URL` on every Vercel project. No trailing slash.

<details>
<summary>Other hosts</summary>

**Railway** — same build/start commands, env vars set under Variables.

**Docker VPS** — or run with:

```sh
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Render blueprint** — a ready-made [`render.yaml`](render.yaml) is included:
use **New → Blueprint** and pick this repo to deploy with zero manual config.

</details>

## API reference

The backend exposes these endpoint groups (full docs at `/docs` when it's running):

| Prefix | Auth      | Purpose |
|--------|-----------|---------|
| `/auth` | none (OTP) | `POST /verify-otp` mints a JWT, `GET /me` |
| `/catalog` | none | Public: categories, services, professionals, reviews, search |
| `/customer` | JWT (customer) | Profile, addresses, bookings, favourites, notifications, reviews |
| `/provider` | JWT (provider) | Feed, accept/decline, status, earnings, payouts, dashboard |
| `/admin` | JWT (admin) | Stats, professionals/services CRUD, settings, audit logs |

Frontend calls live in one place: [`frontend/src/services/api.ts`](frontend/src/services/api.ts).

```ts
import { api } from '@/services/api';
const catalog = await api.catalog.home();
await api.auth.verifyOtp({ phone: '9876543210', code: '123456', role: 'customer' });
await api.customer.createBooking({ service_id, scheduled_date, scheduled_time });
```

---

## 📦 Available Scripts

All npm scripts run from `frontend/`.

| Command               | Description                                 |
|-----------------------|---------------------------------------------|
| `npm run dev`         | Start the Vite dev server                   |
| `npm run build`       | Build the production bundle to `dist/`      |
| `npm run preview`     | Preview the production build locally        |
| `npm run lint`        | Run ESLint                                 |
| `npm run typecheck`   | Run TypeScript type checking                |
| `npm run test:unit`   | Run Vitest unit tests                       |
| `npx cap sync`        | Sync web build into native projects         |
| `cd backend && py -m uvicorn app.main:app --reload` | Run the FastAPI backend      |

Backend checks (run from `backend/`, after `pip install -r requirements.txt -r requirements-dev.txt`):

| Command                        | Description                              |
|--------------------------------|------------------------------------------|
| `ruff check app tests`         | Lint the API                            |
| `python -m pytest tests -q`    | Run the backend smoke tests              |
| `python -m compileall -q app`  | Byte-compile every module                |
| `pip-audit -r requirements.txt`| Audit runtime deps for known CVEs       |

---

## 🔁 Continuous integration

`.github/workflows/ci.yml` runs two jobs in parallel on every push/PR to `master`:

| Job | What it checks |
|-----|----------------|
| **Frontend** | `npm ci` → ESLint → TypeScript → Vitest → production build → `npm audit` |
| **Backend** | `pip install` → `compileall` → Ruff → pytest → `pip-audit` |

CodeQL security scanning ([`codeql.yml`](.github/workflows/codeql.yml)) runs separately
across Python, JavaScript/TypeScript, Java/Kotlin, Swift and Actions.

Dependabot ([`.github/dependabot.yml`](.github/dependabot.yml)) watches the whole repo:

| Ecosystem | Directory | Covers |
|---|---|---|
| `github-actions` | `/` | CI + CodeQL workflow pinning |
| `npm` | `/frontend` | `package.json` + `package-lock.json` |
| `pip` | `/backend` | `requirements.txt` **and** `requirements-dev.txt` |

All three run weekly (Friday 23:00 Asia/Kolkata) and group minor/patch bumps into
single PRs, so you get one reviewable update instead of a stream of them.

---

## 📱 Mobile (Capacitor)

The web code is shared across web, Android, and iOS — no rewrites needed.

### Build for native

```sh
cd frontend
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
├── frontend/                # React + Vite + TypeScript app (deployed on Vercel)
│   ├── src/
│   │   ├── components/      # Shared UI (Logo, PhoneShell, BottomNav, ui)
│   │   ├── context/         # App context — APP_ROLE, navigation stack, session
│   │   ├── hooks/           # Data hooks (catalog, bookings, customer, provider)
│   │   ├── screens/         # customer/ · provider/ · admin/
│   │   ├── services/        # API client + geolocation/geocoding
│   │   ├── types/           # Shared DTO types
│   │   └── utils/           # Formatting, invoice, KYC labels, platform checks
│   ├── public/              # Static assets (favicon)
│   ├── index.html           # HTML entry
│   ├── capacitor.config.ts  # Capacitor config (role-aware app id/name)
│   ├── vite.config.ts       # Vite build config (`@` → src alias)
│   ├── vercel.json           # Vercel build settings (build, output, SPA rewrites)
│   └── package.json         # Frontend dependencies & scripts
├── backend/                 # FastAPI backend (Python) — deployed on Render
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS + routers
│   │   ├── security.py      # JWT sign/verify (PyJWT)
│   │   ├── dependencies.py  # Role guards (customer/provider/admin)
│   │   ├── db.py            # Supabase client (supabase-py, service role)
│   │   └── routers/         # auth, catalog, customer, provider, admin
│   ├── tests/               # Smoke tests (health, routing, auth guards)
│   ├── supabase/migrations/ # SQL schema + seed data
│   ├── requirements.txt     # Runtime deps (installed on Render)
│   ├── requirements-dev.txt # Lint + test tooling (CI only)
│   ├── ruff.toml            # Ruff lint rules
│   └── .env.example
├── android/                 # Capacitor Android native project
├── ios/                     # Capacitor iOS native project
├── docs/                    # Feature & architecture documentation
└── render.yaml              # Render blueprint (one-click API deploy)
```

---

## 🧰 Tech Stack

- **React 18** + **TypeScript**
- **Vite** build tooling
- **Tailwind CSS 4** styling
- **Capacitor 8** native mobile wrapper
- **Supabase** — PostgreSQL database (schema in `backend/supabase/migrations/`)
- **FastAPI** (Python) — backend API (`backend/`) talking to Supabase via `supabase-py`
- **Vercel** — frontend hosting (three role-locked sites)
- **lucide-react** icons
