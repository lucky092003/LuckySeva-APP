# Complete setup guide

Step-by-step instructions to get LuckySeva running from a fresh clone:
database → backend → web app → (optionally) the Android app.

For deployment to staging/production instead of local setup, see
[DEPLOYMENT.md](DEPLOYMENT.md).

## What you will end up with

| Piece | Where | Runs on |
|-------|-------|---------|
| PostgreSQL + migrations | Supabase cloud (free tier works) | Managed |
| FastAPI backend | `backend/` | `http://127.0.0.1:8000` |
| React web app (one role) | `frontend/` | `http://localhost:5173` |
| Android app (optional) | `frontend/dist` → `android/` | Emulator or device |

## Prerequisites

| Tool | Version | Check with |
|------|---------|-----------|
| Node.js | 22+ (Capacitor CLI requires it; the web build alone works on 20) | `node -v` |
| npm | bundled with Node | `npm -v` |
| Python | 3.11+ | `py --version` |
| Git | any recent | `git --version` |
| JDK 21 | only for Android builds | `java -version` |
| Android Studio / SDK | only for Android builds (compile SDK 36) | — |

## 1. Get the code

```sh
git clone https://github.com/lucky092003/LuckySeva-APP.git
cd LuckySeva-APP
```

## 2. Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a project.
2. Collect three values (Project Settings → API):
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (secret, never in the frontend)
   - **JWT secret** → `SUPABASE_JWT_SECRET`

### Apply the schema

Either the CLI:

```sh
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

…or paste every file from `backend/supabase/migrations/` into the Supabase
SQL Editor in filename order. All migrations are idempotent, so re-running one
is safe.

Verify: several tables exist (`categories`, `services`, `professionals`,
`bookings`, `admin_settings`, …). The migrations also seed demo data —
categories, services, sample professionals and admin settings.

## 3. Backend (FastAPI)

```sh
cd backend
py -m pip install -r requirements.txt
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

Edit `backend/.env` with your Supabase values:

```sh
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=...
OTP_DEBUG=true              # dev only: returns the OTP in the response
```

Start it:

```sh
py -m uvicorn app.main:app --reload
```

Verify:

- `curl http://127.0.0.1:8000/health` → `{"ok": true}`
- `http://127.0.0.1:8000/docs` → Swagger UI (local only; disabled in production)

### How login works (dev)

- Customer/provider login is phone OTP. With `OTP_DEBUG=true` the generated
  code is returned in the API response instead of being sent by SMS, so you can
  complete login without an SMS provider. (`OTP_BYPASS=true` additionally
  accepts any 6-digit code.) Both flags must stay `false` in production.
- Admin login at `/admin` uses the credentials in the `admin_settings` table;
  seeded default is identifier `admin` with password `admin123`. Change it
  before exposing anything.

## 4. Frontend (React + Vite)

```sh
cd frontend
npm install
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

Edit `frontend/.env`:

```sh
VITE_API_URL=http://127.0.0.1:8000   # your local backend, no trailing slash
VITE_APP_ROLE=customer                # customer | provider | admin
```

Only these two variables matter. The Supabase anon variables that appear in
older notes are unused — the frontend talks exclusively to the FastAPI backend.

Run the dev server:

```sh
npm run dev
```

Open `http://localhost:5173`. Requests hit whichever role
`VITE_APP_ROLE` locks the build to — restart the dev server after switching
roles by hand, or use the role-specific store entry.

> The frontend never talks to Supabase directly. Every request goes through
> `frontend/src/services/api.ts` → `VITE_API_URL`.

## 5. Checks (what CI runs)

```sh
# frontend
cd frontend
npm run lint
npm run typecheck
npm run test:unit
npm run build

# backend
cd ../backend
py -m pip install -r requirements-dev.txt
ruff check app tests
python -m pytest tests -q
```

## 6. Android app (optional)

On Windows with JDK 21 and the Android SDK (compile SDK 36) installed:

```powershell
cd frontend
npm run build:customer      # builds, sets the role/API URL, and runs cap sync
cd ..\android
.\gradlew.bat assembleDebug
```

Then install `android/app/build/outputs/apk/debug/app-debug.apk` on an emulator
or device (or open `android/` in Android Studio and press Run). `.env` in
`frontend/` controls the API URL baked into the bundle — pointing at
`127.0.0.1:8000` works on an emulator only with a mapped port; use your LAN IP
(e.g. `http://192.168.x.x:8000`) for a physical device.

For the release APKs and signing, see [RELEASE.md](RELEASE.md).

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Frontend loads but login fails / blank data | Backend not reachable | Check the backend URL in `frontend/.env`, restart Vite, confirm `/health` |
| `429`/404 on `POST /auth/request-otp` in the app | Pointing the app at the deployed backend while running an old API locally | Match the backend URL: local frontend → local `VITE_API_URL` |
| `vite: command not found` (exit 127) | npm skipped `devDependencies` (production mode) | `npm install --include=dev`, and remove any `NODE_ENV=production` |
| Supabase `permission denied` on a table | RLS enabled and queries not going through the backend | Query via the FastAPI backend (service role), not the anon key |
| OTP never arrives | No SMS provider configured in dev | Set `OTP_DEBUG=true` in the backend and read the code from the response |
| Android gradle fails with `invalid source release: 21` | Wrong JDK | Use JDK 21 (`JAVA_HOME`), not 17 |
| Port 8000 already in use | Another uvicorn instance running | Kill it or run with `--port 8001` (and update `VITE_API_URL`) |

## Next steps

- Deploy: [DEPLOYMENT.md](DEPLOYMENT.md)
- Publish or download the apps: [RELEASE.md](RELEASE.md) and [PUBLISHING.md](PUBLISHING.md)
- Architecture and feature behaviour: [FEATURES.md](FEATURES.md) and [ARCHITECTURE.md](ARCHITECTURE.md)
- API reference: [API.md](API.md)
