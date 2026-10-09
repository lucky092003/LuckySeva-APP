# LuckySeva — AI Agent Context

**For:** AI coding assistants, copilots, and autonomous agents
**Version:** 1.0
**Last Updated:** October 2026

---

## 1. Project Overview

LuckySeva is a mobile-first home services marketplace. One React codebase builds three role-locked apps (customer/provider/admin), wrapped natively with Capacitor. Data lives in Supabase PostgreSQL; business logic is in a FastAPI backend.

```
frontend/  React 18 + Vite + TS + Tailwind 4  →  Vercel + Capacitor
backend/   FastAPI (Python)                    →  Render
Supabase   PostgreSQL (source of truth)        →  Supabase Cloud
```

**Key invariant:** The browser/app never talks to Supabase directly. All data access goes through the FastAPI backend using the service role key.

---

## 2. Quick Start

### Setup

```bash
# Frontend
cd frontend && npm install
cp .env.example .env  # Configure VITE_SUPABASE_URL, VITE_API_URL, VITE_APP_ROLE

# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env  # Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET

# Database (Supabase)
npx supabase link --project-ref <ref>
npx supabase db push
```

### Run

```bash
# Frontend (from frontend/)
npm run dev

# Backend (from backend/)
py -m uvicorn app.main:app --reload
```

### Verify

```bash
# Frontend
cd frontend && npm run lint && npm run typecheck && npm run test:unit

# Backend
cd backend && ruff check app tests && python -m pytest tests -q
```

---

## 3. Architecture invariants (DO NOT BREAK)

These are the hard rules of this codebase. Violations produce *silent wrongness*.

### 3.1 maybe_single() results MUST go through one()

```python
# WRONG — crashes on 404
row = client.table("x").select("*").eq("id", id).maybe_single().execute().data

# CORRECT
row = one(client.table("x").select("*").eq("id", id).maybe_single().execute())
if not row:
    raise ApiError(404, "Not found")
```

Enforced by `tests/test_maybe_single.py`.

### 3.2 The browser never talks to Supabase

All data access: `screen → hook → api.ts → FastAPI → supabase-py (service role)`

Never import `@supabase/supabase-js` in frontend code. Never call Supabase directly from React.

### 3.3 RLS is not the security boundary

Every table has `USING (true)` RLS policies. The backend uses service role. **Every `.eq("customer_phone", ...)` filter in a route handler is the only access boundary.**

When you add an endpoint, add the scoping filter in the same commit.

### 3.4 Identity is a phone number

`JWT.sub` IS the phone. `profiles.phone` is the PRIMARY KEY (not uuid). No user IDs anywhere.

### 3.5 Route order is load-bearing

`/provider/bookings/mine` MUST be declared before `/provider/bookings/{booking_id}`. Same hazard in `customer.py` with `/customer/notifications/read-all`.

### 3.6 Nobody pushes to master directly

Every change goes through a descriptive branch → PR → review → merge. Direct commits or pushes to `master` are forbidden.

---

## 4. Frontend Mental Model

### 4.1 No router library

`context/app-context.tsx` holds a `Screen[]` stack. Adding a screen means:
1. Add a member to the `Screen` discriminated union
2. Add a `case` in the relevant renderer in `App.tsx`

Missing case silently renders the renderer's default (e.g., unhandled provider `help` shows `ProviderHomeScreen`).

### 4.2 Storage keys

| Key | Shape |
|-----|-------|
| `luckyseva_api_token` | raw JWT string |
| `luckyseva.customer` | JSON `Customer` |
| `luckyseva.providerId` | JSON string \| null |
| `luckyseva.adminAuthed` | JSON boolean |

### 4.3 API client pattern

Only place `fetch()` is called: `frontend/src/services/api.ts`

```typescript
import { api } from '@/services/api';
await api.catalog.home();
await api.auth.verifyOtp({ phone: '9876543210', code: '123456', role: 'customer' });
```

### 4.4 Hooks

Hooks take `customerPhone`/`professionalId` params but **prefix with `_` and ignore them** — the JWT identifies the caller. Don't add new params the backend ignores.

### 4.5 VITE_ vars are build-time

Adding a `VITE_*` var gives you no TypeScript autocomplete and no safety.

---

## 5. Backend Mental Model

### 5.1 Auth

- `POST /auth/verify-otp` only checks `re.fullmatch(r"\d{6}", code)` — no real SMS verification
- `POST /auth/verify-otp` for admin uses plain text password from `admin_settings`
- JWT: PyJWT HS256, 30-day TTL, claims include `sub` (phone), `role`, `professional_id` (provider only)

### 5.2 No Pydantic, no ORM

Every body is `body: dict` and fields are hand-checked. Column allow-lists replace schema validation. If you add a field to a PATCH endpoint, you must add it to the allow-list.

### 5.3 Response shapes (no envelope)

| Shape | When |
|-------|------|
| bare array | list endpoints |
| raw row dict | single-object reads via `one()` |
| purpose-built dict | composite endpoints |
| `{"ok": true}` | mutation acks |

### 5.4 Route table (64 app routes + 4 framework)

```
PUBLIC:
  GET  /health
  POST /auth/request-otp
  POST /auth/verify-otp
  GET  /catalog/* (7 routes)

ANY VALID TOKEN:
  GET  /auth/me

require_customer (18 routes):
  GET/PUT /customer/profile
  GET/POST/PUT/DELETE /customer/addresses
  GET/POST /customer/bookings
  GET/PUT /customer/bookings/{id}/cancel, /payment
  GET/POST /customer/favourites
  GET/PUT /customer/notifications
  GET/POST /customer/reviews, /tickets

require_provider (19 routes):
  GET/PUT /provider/me
  PUT /provider/kyc
  GET/PUT /provider/services, /provider/trade
  PUT /provider/availability
  GET /provider/bookings (feed), /provider/bookings/mine, /provider/bookings/{id}
  POST /provider/bookings/{id}/accept, /decline
  PUT /provider/bookings/{id}/status
  GET /provider/earnings, /provider/dashboard
  GET/POST /provider/payouts

require_admin (21 routes):
  GET /admin/stats, /admin/revenue
  GET/POST/PUT/DELETE /admin/professionals
  PUT /admin/kyc/{id}
  GET/POST/PUT/DELETE /admin/categories, /admin/services
  PUT /admin/categories/{slug}/commission
  GET/POST/PUT/DELETE /admin/coupons
  GET/POST/PUT/DELETE /admin/settings
  GET/POST /admin/audit-logs, /admin/bookings, /admin/payouts, /admin/refunds
```

### 5.5 Booking lifecycle

```
confirmed → assigned → on_the_way → started → completed
                 ↓
             cancelled (customer cancels)

Accept: status='assigned', professional_id set, removed from all feeds
Decline: booking_declines row, status unchanged, other providers still see it
```

### 5.6 Radius matching

Backend does NO geo filtering. Frontend filters by Haversine distance client-side. Missing coords = "in range" (fail-open).

---

## 6. Database

17 tables in Supabase PostgreSQL. Migrations in `backend/supabase/migrations/`, applied in filename order.

Key tables: `categories`, `services`, `professionals`, `professional_services`, `bookings`, `reviews`, `addresses`, `profiles` (phone=PK), `notifications`, `favourites`, `support_tickets`, `payouts`, `payments`, `refunds`, `coupons`, `coupon_redemptions`, `admin_settings`, `audit_logs`, `booking_declines`, `pr_review_settings`, `pr_reviews`, `changelog_entries`.

---

## 7. Known Gaps (DO NOT FIX without asking)

These are known, not endorsed. Fix deliberately and update this file:

**Auth/Security:**
- OTP never verified (no SMS provider)
- Admin password cleartext, default `admin123`
- CORS `allow_origins=["*"]`
- JWT no revocation (30 days)
- `verify_token` leaks PyJWT error

**Data isolation holes:**
- `GET /provider/bookings/{id}` no ownership check
- `DELETE /admin/professionals/{id}` no existence check
- `POST /admin/settings` no audit log

**Correctness bugs:**
- `GET /customer/reviews` broken for named users
- `GET /provider/dashboard` wrong date filter
- `POST /customer/bookings` explicit `total_amount: 0` becomes `base + visit_fee`
- `invoiceAmounts` can show more than booking total

**Behavioral quirks:**
- Every role's screens statically imported (comment says otherwise)
- `renderProvider` has no `help` case
- Most mutations swallow errors `.catch(() => {})`
- No payment gateway (1500ms fake latency)
- `toggleFavourite` downloads whole list on every call

---

## 8. Change Recipes

| Task | Files to touch |
|------|---------------|
| Add a screen | `context/app-context.tsx` (`Screen` union) + `App.tsx` (renderer `case`) + `screens/<role>/` |
| Add an API call | `services/api.ts` only — never call `fetch` from a component or hook |
| Add a backend endpoint | `app/routers/<ns>.py`; add `require_*` guard; route `maybe_single()` through `one()`; hand-roll validation; `if not res.data: raise ApiError(...)` |
| Add a DB column | new migration `backend/supabase/migrations/<timestamp>_<slug>.sql` with `ADD COLUMN IF NOT EXISTS` |
| Add a table | `CREATE TABLE IF NOT EXISTS` + RLS enabled + four `anon_*` policies in a `DO $$` loop |
| Change booking states | `types/index.ts`, `ProviderDetailScreen.tsx`, `TrackingScreen.tsx`, `useBookings.ts`, `routers/provider.py` — **five places** |
| Change radius behavior | `ProviderHomeScreen.tsx` filter + `ProviderProfileScreen` + `routers/provider.py` — keep client-side or move whole thing server-side, never half |
| Change address model | `services/address.ts` + `components/AddressForm.tsx` + `routers/customer.py` |
| Change a role's capabilities | `VITE_APP_ROLE` handling + `capacitor.config.ts` + `Screen` union + `App.tsx` + `require_*` backend guard |
| Touch anything audited | the four write sites in `routers/admin.py` |

---

## 9. File Locations

```
frontend/src/
  App.tsx                     — role switchboard
  context/app-context.tsx      — THE ROUTER + session store
  services/api.ts              — ONLY place fetch() is called
  services/location.ts         — GPS, Nominatim, Haversine
  services/address.ts          — address domain logic
  hooks/                       — useCatalog, useBookings, useCustomer, useProvider
  types/index.ts               — shared DTO types
  components/AddressForm.tsx    — shared address form
  components/OtpInput.tsx      — 6-digit OTP

backend/app/
  main.py                      — FastAPI app + CORS
  config.py                    — environment variables
  db.py                        — Supabase client + one() helper
  security.py                  — JWT sign/verify
  dependencies.py              — require_customer/provider/admin guards
  exceptions.py                — ApiError
  routers/auth.py              — OTP auth
  routers/catalog.py           — public catalog
  routers/customer.py          — customer bookings
  routers/provider.py          — provider feed, earnings
  routers/admin.py             — admin CRUD
  links.py                     — professional-to-service linking
  ledger.py                    — payouts, refunds
  events.py                    — push notifications
  pricing.py                   — commission calculations
  otp.py                       — OTP generation (dev)

backend/supabase/migrations/   — SQL schema migrations (filename order)
backend/supabase/functions/     — Deno edge functions (PR review bot)
```

---

## 10. CI/CD

Four parallel jobs on every push/PR to `master`:

| Job | Steps |
|-----|-------|
| Frontend | npm ci → ESLint → TypeScript → Vitest → Build → npm audit |
| Backend | pip install → compileall → Ruff → pytest → pip-audit |
| Migrations | Apply all migrations twice → grep for destructive SQL |
| Edge functions | deno fmt → lint → check → tests |

Dependabot runs weekly on: GitHub Actions, npm (frontend/), pip (backend/).

---

## 11. PR Review Bot

`backend/supabase/functions/pr-review-bot/` is a Supabase Edge Function (Deno) that:
1. Verifies GitHub webhook HMAC
2. Runs static rules on the diff
3. Posts review comment
4. Maintains CHANGELOG.md via PR

Key rules (all enforced, not style):
- `secret`: blocks Supabase keys, JWTs, private keys
- `hardcoded-admin-credentials`: blocks `admin`/`admin123` literals
- `destructive-sql`: blocks `DROP TABLE`, `TRUNCATE`, `DELETE FROM`
- `ownership-filter-removed`: blocks removed `.eq("customer_phone", ...)`
- `auth-guard-removed`: blocks removed `require_admin`/`require_customer`

---

## 12. Environment Variables

### Frontend (VITE_* — build-time)

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...      # Public, safe
VITE_API_URL=http://localhost:8000  # or https://api.luckyseva.com
VITE_APP_ROLE=customer             # customer | provider | admin
```

### Backend

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # SECRET — never expose
SUPABASE_JWT_SECRET=xxx           # From Supabase API Settings
ENV=production                     # Enables production mode
API_DOCS_ENABLED=false            # Disable /docs in production
OTP_DEBUG=true                    # Dev mode: OTP in response
```

---

## 13. PR & Changelog Workflow

### PR Title Convention

PR title prefix determines changelog category:

| Prefix | Changelog Section |
|--------|-------------------|
| `feat:`, `feature:` | ### Added |
| `fix:`, `bugfix:`, `hotfix:` | ### Fixed |
| Everything else | ### Changed |

**Format:** `feat: short description` or `fix: issue description`

### Changelog Auto-Update

When you open a PR:
1. PR review bot detects the PR
2. Bot extracts prefix from title (feat/fix/other)
3. Entry added to `CHANGELOG.md` under that date's section
4. Bot creates/updates a changelog PR automatically

### Example PR Title

```
feat: add priority fee for top-N provider picks
fix: correct dashboard earnings date filter
docs: update API documentation
```

---

## 14. Important Commands

```bash
# Frontend (from frontend/)
npm run dev                        # Dev server
npm run build                     # Production build (set VITE_APP_ROLE first)
npm run lint                      # ESLint
npm run typecheck                 # TypeScript
npm run test:unit                 # Vitest

# Backend (from backend/)
py -m uvicorn app.main:app --reload
ruff check app tests              # Lint
python -m pytest tests -q         # Tests

# Capacitor
npx cap sync                       # Sync to native projects

# Supabase
npx supabase db push               # Apply migrations
npx supabase functions deploy      # Deploy edge functions
```

---

## 15. Getting Help

- **Product/feature docs:** `docs/FEATURES.md`
- **Setup/deploy docs:** `README.md`, `docs/DEPLOYMENT.md`
- **This file:** agent conventions, gotchas, verification steps
- **Brain file:** `docs/REFERENCE/brain.md` — the working mental model

If code and docs disagree, **the code is the truth**.
