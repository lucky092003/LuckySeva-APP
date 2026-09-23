## Summary

Python FastAPI backend API + full documentation updates for the app & website architecture (Supabase DB + FastAPI API + Vercel frontend).

## Changes

- **`api/`** — new FastAPI backend (supabase-py service-role client):
  - Auth: `POST /auth/verify-otp` mints custom JWT (HS256, `SUPABASE_JWT_SECRET`), roles: customer/provider/admin; `GET /auth/me`
  - `catalog` — public reads (home, categories, services, professionals, reviews, search)
  - `customer` — profile, addresses, bookings, favourites, notifications, reviews
  - `provider` — feed, accept/decline/status, earnings, payouts, dashboard
  - `admin` — stats, professionals/services CRUD, settings, audit logs
  - `api/requirements.txt`, `api/.env.example`, `api/.gitignore`
- **`src/lib/api.ts`** — typed frontend API client (Bearer JWT in `localStorage`, base from `VITE_API_URL`)
- **`render.yaml`** — Render blueprint for one-click API deployment
- **README.md / PUBLISHING.md / docs/FEATURES.md** — full stack docs: architecture diagram, 3-step setup (Supabase → FastAPI → Vercel), API reference, deploy guide, env vars
- **`.env.example`** — new `VITE_API_URL`
- **`.gitignore`** — Python ignores

## Verify

```sh
npm run typecheck && npm run lint && npm run test:unit && npm run build
```

```sh
cd api && py -m pip install -r requirements.txt
py -m uvicorn app.main:app --reload   # docs at /docs
```

## Notes

- `api/.env` is gitignored — fill from Supabase dashboard (service_role key + JWT secret)
- JWT schema matches Supabase's own signatures tied to `SUPABASE_JWT_SECRET`