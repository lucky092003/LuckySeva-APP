# LuckySeva

Trusted home services, at your doorstep. LuckySeva is a mobile-first marketplace that
connects customers with verified local professionals — plumbers, electricians, appliance
repair, cleaning and more. Partners manage their jobs and earnings from their own app,
and an admin dashboard sits over the whole platform.

| | |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4, Capacitor 8 |
| Backend | FastAPI (Python), `supabase-py` service-role client |
| Database | Supabase PostgreSQL with Row Level Security |
| Hosting | Vercel (web, three sites), Render (API), GitHub Releases (APKs) |

## Architecture

```
+---------------------- APP / WEBSITE (Vercel) ----------------------+
|  React + Vite + TypeScript + Tailwind   ·   Capacitor (Android)    |
|  frontend/src/services/api.ts -> FastAPI backend (VITE_API_URL)    |
+-------------------------------+------------------------------------+
                                | HTTPS / JSON + JWT (Bearer token)
+-------------------------------v------------------------------------+
|  BACKEND (FastAPI, Python) - backend/app/                          |
|  /auth/verify-otp mints a JWT (customer / provider / admin)        |
|  Routers: auth · catalog · customer · provider · admin             |
|  Reads/writes Supabase through the service role                    |
+-------------------------------+------------------------------------+
                                | SQL (via PostgREST)
+-------------------------------v------------------------------------+
|  DATABASE (Supabase) - PostgreSQL + Row Level Security             |
|  categories, services, professionals, bookings, reviews, ...      |
+--------------------------------------------------------------------+
```

All data access goes through the API client in `frontend/src/services/api.ts`.
The browser never talks to Supabase directly; the backend holds the service-role
key, which is also what makes the handler-level ownership filters the real
access boundary.

## Features

Each build ships exactly one role — set at build time via `VITE_APP_ROLE`, with no
runtime switching. A build contains only that role's screens, auth flow and
navigation.

| Role | Website | Android app | Coverage |
|------|---------|-------------|----------|
| Customer | Yes | Yes (`com.luckyseva.app`) | Browse and book services, structured and saved addresses, click-only location, OTP auth, favourites, notifications, payments, reviews, live booking status |
| Partner | Yes | Yes (`com.luckyseva.partner`) | Radius-based request matching (requests appear with Haversine distance against the partner's service radius), accept/reject, job status flow, earnings and payouts, availability, pricing |
| Admin | Yes | No (web only) | Dashboard, customers/providers/services/bookings tables, add and edit, CSV export, audit log, platform settings |

The matching engine is deliberately simple: a customer request carries coordinates,
every nearby professional's `service_radius_km` is compared against the Haversine
distance, and only in-radius professionals see the request.

## Project layout

```
LuckySeva-APP/
├── frontend/                  # React + Vite + TypeScript app (Vercel)
│   ├── src/
│   │   ├── components/        # Shared UI (Logo, PhoneShell, BottomNav, ui)
│   │   ├── context/           # APP_ROLE, navigation stack, session
│   │   ├── hooks/             # Data hooks (catalog, bookings, customer, provider)
│   │   ├── screens/           # customer/ · provider/ · admin/
│   │   ├── services/          # API client + geolocation/geocoding
│   │   ├── types/             # Shared DTO types
│   │   └── utils/             # Formatting, invoice, KYC labels, platform checks
│   ├── capacitor.config.ts    # Role-aware app id/name
│   ├── vercel.json            # Build settings + SPA rewrites
│   └── package.json           # Frontend dependencies & scripts
├── backend/                   # FastAPI API (Render)
│   ├── app/
│   │   ├── main.py            # App + CORS + routers
│   │   ├── security.py        # JWT sign/verify (PyJWT)
│   │   ├── dependencies.py    # Role guards (customer/provider/admin)
│   │   ├── db.py              # Supabase client (service role)
│   │   └── routers/           # auth, catalog, customer, provider, admin
│   ├── tests/                 # Smoke tests (health, routing, auth guards)
│   ├── supabase/
│   │   ├── migrations/        # SQL schema + seed data
│   │   └── functions/         # Deno edge functions (PR review bot)
│   ├── requirements.txt       # Runtime deps
│   └── requirements-dev.txt   # Lint + test tooling (CI only)
├── android/                   # Capacitor Android native project
├── ios/                       # Capacitor iOS native project
├── docs/                      # Feature, API and deployment documentation
└── .github/workflows/         # CI, PR labeler, Android APK release
```

## Getting started

Prerequisites: Node.js 22+ (the Capacitor CLI requires it), npm, Python 3.11+,
and a [Supabase](https://supabase.com) project. JDK 21 and Android Studio are
only needed for Android builds.

### 1. Database

Create a Supabase project, then apply the schema:

```sh
npx supabase link
npx supabase db push
```

Alternatively, run the `.sql` files from `backend/supabase/migrations/` in the
Supabase SQL Editor, in filename order. Every migration is idempotent, so
re-running one is safe. CI applies the whole set twice on every push to prove
idempotence and rejects destructive SQL; applying to the live project stays a
manual step on purpose.

### 2. Backend

```sh
cd backend
py -m pip install -r requirements.txt
copy .env.example .env       # fill from Supabase: Project Settings -> API
py -m uvicorn app.main:app --reload
```

Swagger UI runs at `http://localhost:8000/docs`. Docs endpoints are disabled in
production automatically (`RENDER` set or `ENV=production`); override with
`API_DOCS_ENABLED`.

For lint and tests, install the dev requirements too:

```sh
py -m pip install -r requirements-dev.txt
ruff check app tests
python -m pytest tests -q
```

`requirements-dev.txt` is deliberately separate so production installs never
pull in test or lint packages.

### 3. Frontend

```sh
cd frontend
npm install
copy .env.example .env
npm run dev
```

`VITE_API_URL` (the backend base URL, no trailing slash) and `VITE_APP_ROLE`
(customer / provider / admin) are the two variables that matter. The Supabase
anon variables that older setups mention are unused — the frontend never talks
to Supabase directly.

## Building role-locked bundles

Set `VITE_APP_ROLE` for both the build and the Capacitor sync, and run both
from `frontend/`:

```powershell
# Windows
cd frontend
$env:VITE_APP_ROLE = "customer"   # or "provider"
npm run build
npx cap sync
```

```sh
# macOS / Linux
cd frontend
VITE_APP_ROLE=provider npm run build
VITE_APP_ROLE=provider npx cap sync
```

The ready-made aliases `npm run build:customer` and `npm run build:partner` do
the same with the live API URL baked in. Admin is web only — never run
`cap sync` from an admin build or the native app id gets overwritten.

## Deployment

### Web (Vercel)

The repo deploys as three Vercel projects, one per role:

1. Create three projects pointing at this repo with **Root Directory: `frontend`**
   (dashboard setting only — `rootDirectory` in `vercel.json` fails schema validation).
2. Set `VITE_APP_ROLE=customer | provider | admin` and `VITE_API_URL` per project.
3. Build settings come from `frontend/vercel.json`; every push to `master`
   deploys all three sites.

If a build fails with `vite: command not found` (exit 127), npm ran in
production mode and skipped `devDependencies`. `frontend/vercel.json` already
pins `installCommand` to `npm install --include=dev`; also unset any
`NODE_ENV=production` on the project.

### Backend (Render)

1. Render -> New -> Web Service, root directory `backend`.
2. Build: `pip install -r requirements.txt`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`.

A ready [`render.yaml`](render.yaml) blueprint is included (`New -> Blueprint`),
and Railway/Docker work with the same two commands. Copy the resulting URL into
`VITE_API_URL` on all three Vercel projects.

### Android

`android-apks.yml` builds both APKs on every merge to `master` and refreshes
the assets on the latest GitHub release, so users always get the current build
from the [releases page](https://github.com/lucky092003/LuckySeva-APP/releases/latest).
Signed release builds need the secrets documented in
[docs/RELEASE.md](docs/RELEASE.md); without them the workflow produces debug
APKs as artifacts. Store publishing and iOS steps live in
[PUBLISHING.md](PUBLISHING.md).

## API overview

Full reference at `/docs` when running locally; production serves no browsable
docs. The endpoint groups:

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/auth` | none (OTP) | `POST /request-otp`, `POST /verify-otp` mints a JWT, `GET /me` |
| `/catalog` | none | Categories, services, professionals, reviews, search |
| `/customer` | JWT (customer) | Profile, addresses, bookings, favourites, notifications, reviews |
| `/provider` | JWT (provider) | Request feed, accept/decline, job status, earnings, payouts |
| `/admin` | JWT (admin) | Stats, CRUD, settings, audit logs |

Frontend calls all go through one typed client:

```ts
import { api } from '@/services/api';

const catalog = await api.catalog.home();
await api.auth.verifyOtp({ phone: '9876543210', code: '123456', role: 'customer' });
await api.customer.createBooking({ service_id, scheduled_date, scheduled_time });
```

## CI/CD

`ci.yml` runs four jobs in parallel on every push/PR to `master`:

| Job | Checks |
|-----|--------|
| Frontend | `npm ci`, ESLint, TypeScript, Vitest, production build, `npm audit` |
| Backend | `pip install`, `compileall`, Ruff, pytest, `pip-audit` |
| Migrations | Applies every migration to a throwaway Postgres twice; fails on destructive SQL |
| Edge functions | *(removed with the PR review bot)* |

Alongside it: the PR labeler (`label.yml`) and the Android APK build
(`android-apks.yml`, every push to `master`). Dependabot covers GitHub Actions,
npm and pip, weekly, grouped into one PR per ecosystem.

## Commands

Frontend (run from `frontend/`):

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production bundle to `dist/` |
| `npm run build:customer` / `npm run build:partner` | Role build + sync with the live API URL |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run test:unit` | Vitest unit tests |

Backend (run from `backend/`):

| Command | Description |
|---------|-------------|
| `ruff check app tests` | Lint the API |
| `python -m pytest tests -q` | Backend smoke tests |
| `python -m compileall -q app` | Byte-compile every module |
| `pip-audit -r requirements.txt` | Audit runtime deps for CVEs |

## Documentation

| Document | Contents |
|----------|----------|
| [docs/SETUP.md](docs/SETUP.md) | Fresh-machine setup: database, backend, frontend, Android |
| [docs/FEATURES.md](docs/FEATURES.md) | Data model, booking lifecycle, radius matching, geocoding |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Deep architecture notes |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Full deployment guide with checklists and troubleshooting |
| [docs/RELEASE.md](docs/RELEASE.md) | APK release process, secrets and QR download flow |
| [docs/API.md](docs/API.md) | Endpoint reference |
| [docs/SECURITY.md](docs/SECURITY.md) | Security model and hardening checklist |
| [PUBLISHING.md](PUBLISHING.md) | App store and web publishing walkthrough |
| [CHANGELOG.md](CHANGELOG.md) | Date-wise changelog, newest first |
