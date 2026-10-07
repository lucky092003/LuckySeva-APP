# LuckySeva — Agent Context

This is the **working mental model** of the LuckySeva repo: how the system actually behaves, the
invariants that break silently, and where the sharp edges are. It is written for an agent about
to change something.

- **Human-facing product/feature doc:** [`FEATURES.md`](FEATURES.md)
- **Setup, deploy, release:** [`../README.md`](../README.md), [`../PUBLISHING.md`](../PUBLISHING.md)
- **This file:** conventions, contracts, gotchas, verification steps.

When this file and the code disagree, **the code is the truth** — fix this file.

Facts below were verified by reading the source and by importing `app.main` to dump the live
route table. Counts and identifiers are exact.

---

## 0. Orientation in 30 seconds

Mobile-first home-services marketplace. **One React codebase, three role-locked builds**
(customer / provider / admin), wrapped natively with Capacitor. Data lives in Supabase Postgres; a
FastAPI service in `backend/` is the only thing allowed to touch it.

```
frontend/  React 18 + Vite + TS + Tailwind 4   ->  Vercel (3 projects, one per role) + Capacitor
backend/   FastAPI (Python)                     ->  Render
Supabase   Postgres (source of truth)           ->  RLS enabled but wide open by design
```

`backend/app/` is small and hand-rolled. There is **no ORM, no Pydantic model, no SQL
functions, no triggers, no Docker, no conftest.py**. Business logic is plain Python in route
handlers.

---

## 1. Non-negotiable invariants

Violating these produces *silent* wrongness, not a compile error.

### 1.1 `maybe_single()` results must go through `one()`

`postgrest`'s `.maybe_single().execute()` returns **`None`** — not a response object — when zero
rows match. Touching `.data` on it raises `AttributeError`, i.e. HTTP 500 instead of 404.

`backend/app/db.py:15`
```python
def one(res):
    """postgrest's maybe_single().execute() returns None on zero rows, not a response."""
    return None if res is None else res.data
```

- Correct: `row = one(client.table("x").select("*").eq(...).maybe_single().execute())`
- Wrong: `client.table("x")....maybe_single().execute().data`

This is **enforced**, not just documented. `tests/test_maybe_single.py` statically greps every
line containing `maybe_single()` in `app/routers/*.py` and fails if `.data` appears in the next
4 lines before an `= one(` / `return one(`. A second test asserts the literal string
`from ..db import db, one` appears in all five routers.

Current parity: **36 `maybe_single(` calls, 36 `one(` calls** across the 5 routers. Keep it 1:1.

### 1.2 The browser never talks to Supabase

All data access goes `screen -> hook -> api.ts -> FastAPI -> supabase-py (service role)`.
`@supabase/supabase-js` is in `package.json` but is **imported nowhere in `frontend/src`** — it is
a dead dependency. Don't wire it up. The service-role key lives only in `backend/`.

### 1.3 Postgres RLS is not the security boundary

Every table has RLS **enabled** with `TO anon, authenticated` policies that are all
`USING (true) / WITH CHECK (true)`. The backend uses the **service role**, which bypasses RLS
entirely. Therefore:

> **Every `.eq("customer_phone", ...)` / ownership check in a route handler is the only thing
> isolating data.** There is no second line of defence. When you add an endpoint, add the scoping
> filter in the same commit.

### 1.4 Identity is a phone number

`JWT.sub` **is** the phone. `profiles.phone` is the **PRIMARY KEY** (not a uuid). `customer_phone`
columns are plain `text` with no FK. There are no user ids anywhere.

### 1.5 `VITE_APP_ROLE` silently defaults to `customer`

`frontend/src/context/app-context.tsx:16`
```ts
export const APP_ROLE: Role =
  import.meta.env.VITE_APP_ROLE === 'provider' ? 'provider'
  : import.meta.env.VITE_APP_ROLE === 'admin' ? 'admin'
  : 'customer';
```
`VITE_APP_ROLE=Provider` (capital P) ships a customer build with no warning. Admin has **no**
native app — never run `npx cap sync` for `admin`.

### 1.6 Route order is load-bearing

`/provider/bookings/mine` is declared **before** `/provider/bookings/{booking_id}`. Swap them
and `mine` gets captured by the path parameter. Same hazard in `customer.py`:
`/customer/notifications/read-all` is a literal path that must not be shadowed by an
`/{notification_id}` pattern.

### 1.7 Nobody pushes to `master` directly

Every change lands on a **descriptive branch** and goes in through a pull request. Direct
commits or `git push` to `master` are forbidden for humans and agents alike — including
trivial edits, docs, and "just one line".

- Branch naming: `fix/…`, `feat/…`, `style/…`, `chore/…` describing the change
  (`fix/booking-saved-address-on-top`).
- Workflow: `git checkout -b <branch>` -> commit -> `git push -u origin <branch>` -> open a PR
  -> merge the PR. Never `git push` while on `master`.
- Why it is load-bearing: CI, the PR review bot and the changelog (§12) only run on pull
  requests. A push to `master` skips review, skips the changelog entry, and fires the whole
  pipeline (three Vercel deploys + Render) on unreviewed code.
- `master` is protected by convention, not by a branch rule — nothing in GitHub stops you, so
  the discipline lives here. If you find yourself on `master`, `git checkout -b <branch>` first.
- Run the §9 verification on the branch **before** pushing.

---

## 2. Request lifecycle, end to end

```
screen
  |- hook (frontend/src/hooks/*)          fetches, swallows errors, exposes reload
      |- api.<ns>.<method>()              frontend/src/services/api.ts — the ONLY call site
          |- fetch(`${BASE}/${fn}${path}`)   BASE = VITE_API_URL, trailing slashes stripped
              headers: Content-Type: application/json
                       Authorization: Bearer <localStorage 'luckyseva_api_token'>
              |- FastAPI router (backend/app/routers/{ns}.py)
                  |- HTTPBearer(auto_error=False) -> get_claims() -> verify_token()  (PyJWT HS256)
                  |- require_<role>(...)          -> ApiError(403) on role mismatch
                  |- handler: client.table(...).select(...).execute()
                      |- PostgREST -> Supabase Postgres (service role, RLS bypassed)
```

Failure shapes the client must handle:

- `ApiError` -> `{"error": "<message>"}`
- FastAPI param validation (422) -> `{"detail": [...]}`, a **different envelope**

`api.ts:44-46` reads `data?.error` and falls back to `API ${res.status}`, so a 422 surfaces to
the user as the literal string `API 422`.

---

## 3. Repo map

```
frontend/
  src/
    App.tsx                     role switchboard — renders customer|provider|admin by APP_ROLE
    main.tsx, index.css
    context/app-context.tsx     THE ROUTER + session store (217 lines, no react-router)
    services/
      api.ts                    the only place fetch() is called (160 lines)
      location.ts               GPS, Nominatim reverse+forward geocode, haversineKm
      address.ts                address domain logic: compose/split/validate, INDIAN_STATES
    hooks/                      useCatalog / useBookings / useCustomer / useProvider + index.ts
    types/index.ts              shared DTO types
    utils/                      format.ts, invoice.ts, kyc.ts, native.ts
    components/                 AddressForm, OtpInput, PhoneShell, BottomNav, WebTopNav, ui.tsx, Logo
    screens/customer/ (22)  screens/provider/ (6)  screens/admin/ (5)  InvoiceScreen.tsx
  capacitor.config.ts           role-aware appId/appName (reads process.env, NOT import.meta.env)
  vite.config.ts                base './', alias @ -> ./src
  vitest.config.ts              environment 'node', only src/**/*.test.ts
  vercel.json                   installCommand `npm ci --include=dev`, build `npm run build`
backend/
  app/
    main.py          FastAPI("LuckySeva API"), CORS *, /health, mounts 5 routers
    config.py        load_dotenv + SUPABASE_URL / SERVICE_ROLE_KEY / JWT_SECRET + require_env()
    db.py            @lru_cache service-role client + one()          <- see 1.1
    security.py      PyJWT HS256, 30-day tokens, sign_token/verify_token
    dependencies.py  HTTPBearer, get_claims, require_role factory, 3 guards
    exceptions.py    ApiError(status, message)
    routers/         auth, catalog, customer, provider, admin
  tests/             test_smoke.py (5 tests), test_maybe_single.py (9) — 14 total, no network
  supabase/
    config.toml      [functions.pr-review-bot] verify_jwt = false — GitHub signs the body instead
    functions/       pr-review-bot/ (Deno) + deno.json shared import map. See 12.
    migrations/      9 files, filename-ordered
  requirements.txt / requirements-dev.txt / ruff.toml
android/  ios/       Capacitor native projects
docs/               FEATURES.md (human), brain.md (this file)
```

There is **no `package.json` at the repo root** and no `conftest.py` in the backend. The root
`node_modules/` is orphaned.

---

## 4. Frontend mental model

### 4.1 There is no router library

`context/app-context.tsx` holds a `Screen[]` stack. `screen = stack[stack.length - 1]`.

- `Screen` is a **34-member discriminated union** (`app-context.tsx:21-55`). Adding a screen
  means adding a member there *and* a `case` in the relevant renderer in `App.tsx`.
- `navigate(s)` pushes, **except** for 9 "root" names which replace the whole stack:
  `home, services, bookings, profile, provider-home, provider-bookings, provider-earnings,
  provider-profile, admin-dashboard`.
- `back()` pops unless the stack length is 1 (no way to leave the root).
- A missing `case` in `App.tsx` **silently renders the renderer's default** (e.g. an unhandled
  provider `help` navigation renders `ProviderHomeScreen`). There is no dev warning.

Initial stack per role: provider -> `provider-home` if a stored id exists else `provider-auth`;
admin -> `admin-dashboard` if `adminAuthed` else `admin-auth`; customer -> `splash`
(auto-advances after 2200 ms).

The boot effect (runs once, empty deps) calls `api.auth.me()`; on failure it does
`setApiToken(null)` and resets to the auth screen. If there is **no token** but any of the three
identity keys is present, it clears all three — so losing the token logs you out.

### 4.2 Storage keys (raw strings vs JSON)

| Key | Shape | Writer |
|---|---|---|
| `luckyseva_api_token` | raw string JWT | `api.ts` (`setApiToken`) |
| `luckyseva.customer` | JSON `Customer` | `app-context.tsx` `save()` |
| `luckyseva.providerId` | JSON `string \| null` | `app-context.tsx` |
| `luckyseva.adminAuthed` | JSON `boolean` | `app-context.tsx` |
| `luckyseva.paymentMethod` | raw string, default `upi` | settings screens |
| `luckyseva.email` / `.sms` / `.push` | raw `'on'` / `'off'` | settings |
| `luckyseva.acName` / `.acNo` / `.ifsc` | raw string | payment |
| `luckyseva.provider.push` | raw `'on'` / `'off'` | provider settings |

Toggle idiom: `(localStorage.getItem(key) ?? 'on') === 'on'`.

### 4.3 `api.ts` contract

- `BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')`. If empty, **every** call
  throws a `VITE_API_URL is not set...` error.
- `request<T>(fn, path, method='GET', body?)` — no timeout, no retry, no abort controller, no
  interceptors. `fn` is the router prefix.
- Namespace -> prefix mapping is exact: `auth, catalog, customer, provider, admin`.
- **`catalog.services(categorySlug)` calls `/catalog/services`**, not the backend's also-present
  `/catalog/categories/{slug}/services`.
- `api.ts:146-160` re-declares `Address`, `Favourite`, `Payout`, `AuditLog` locally.
  `Favourite` and `Payout` also exist in `types/index.ts` with **different** shapes (local
  `Payout.status` is `string`, shared is `'requested' | 'completed' | 'failed'`). The local
  declarations are the ones the methods return. Be careful which one you import.

### 4.4 Hooks

All hooks fetch in a bare `useEffect` with **no abort handling**, swallow errors into
`[]` / `null`, and expose `reload`.

Hooks that take a `customerPhone` / `professionalId` **prefix the param with `_` and ignore
it** — the JWT identifies the caller, so the argument is vestigial. Don't add new params the
backend ignores, and don't "fix" these by trusting the caller-supplied id.

| Hook | Data |
|---|---|
| `useCategories`, `usePopularServices`, `useService`, `useProfessionalsByCategory`, `useProfessionalsByService`, `useProfessional`, `useReviews` | catalog |
| `useBookings(filter)` | all bookings, **filtered client-side** by `BookingFilter` |
| `useProviderBookings(profId, status?)` | `provider.myBookings()`, client-side status filter |
| `useNotifications`, `useUnreadNotifications`, `useFavourites`, `useIsFavourite`, `toggleFavourite`, `useSupportTickets` | customer |
| `useProfessionalWithFallback`, `usePayouts` | provider |

`useBookings` mapping: `upcoming` = `confirmed` + `assigned`, `ongoing` = `on_the_way` +
`started`, `completed` = `completed`, `cancelled` = `cancelled`.

`toggleFavourite` is add-first-then-catch-to-remove: the `409 Already a favourite` is the *only*
signal it uses to decide "remove". A network error therefore also attempts a delete.

### 4.5 Platform handling

`utils/native.ts` exports exactly one thing: `isNative`. There is **no `isWeb`** — web is written
as `!isNative`. `PhoneShell` has three branches: native full-bleed; phone mockup when
`!isNative && import.meta.env.VITE_PHONE_MOCKUP === 'true'`; default centred `max-w-lg` column
that goes full width at `md:`.

`vite-env.d.ts` is one line — `import.meta.env` is **untyped**. Adding a `VITE_*` var gives you
no autocomplete and no safety.

---

## 5. Backend mental model

### 5.1 Auth

- `POST /auth/verify-otp` is the **single** login endpoint for all three roles.
- `security.py`: PyJWT **HS256**, `TOKEN_TTL_DAYS = 30`. Claims: `sub` (= phone / admin
  identifier), `phone`, `role`, `exp`, plus `professional_id` **only for provider tokens**.
- `dependencies.py`: `HTTPBearer(auto_error=False)` -> `get_claims()` -> `require_role(role)`
  factory producing `require_customer` / `require_provider` / `require_admin`.
- `require_role` raises `ApiError(403, f"{role.capitalize()} token required")`.
- `verify_token` echoes the raw PyJWT message into the 401 body: `Invalid token: {e}`.
- `bearer()` in `dependencies.py` is **dead code** — nothing imports it. Don't use it.
- `config.SUPABASE_JWT_SECRET` is **not** wrapped in `require_env`, so a missing secret fails at
  request time (signature errors) rather than at boot. `SUPABASE_URL` / `SERVICE_ROLE_KEY` *are*
  checked, but also only on first request — there are no startup hooks.

Guard declaration: `customer.py` and `provider.py` declare `require_*` **twice** — once at
`APIRouter(dependencies=[...])` and again per-route. `admin.py` declares it only at router
level, so **admin handlers cannot read their own token identity**.

### 5.2 Response shapes (no envelope)

There is no `{"data": ...}` wrapper. Four shapes coexist:

| Shape | When | Example |
|---|---|---|
| bare array of raw rows | all list endpoints, via `res.data or []` | `GET /catalog/categories` |
| raw row dict | single-object reads via `one(...)`; then 404 if falsy | `GET /admin/professionals/{id}` |
| purpose-built dict | composite endpoints | `{"category","services"}`, `{"service","providers"}`, `{"role","profile"}` |
| `{"ok": true}` | mutation acks | every `DELETE`, `decline`, `read-all` (-> `{"ok":true,"updated":n}`) |

Status codes in use: `200` (default), `201` (declared on the create routes), `400` (validation
/ business rule), `401` (missing/invalid token), `403` (role mismatch, `Not your booking`,
`Invalid admin credentials`), `404`, `409` (only `Already a favourite`), `422` (FastAPI
validation), `500` (unhandled — i.e. a `maybe_single` bug, see 1.1).

### 5.3 Validation style

**No Pydantic anywhere.** Every body is `body: dict` and fields are hand-checked with
`isinstance(...)`. Column allow-lists (`str_fields` / `num_fields` loops in
`admin.update_professional`) replace schema validation. If you add a field to a PATCH endpoint
you must add it to the allow-list or it is silently dropped.

The insert guard is consistent: `if not res.data: raise ApiError(4xx, "...")`, then `res.data[0]`
as the returned row.

### 5.4 Pagination

**None.** No `page` / `offset` / `cursor` / `total`. Just hard `.limit(...)` ceilings:

| Endpoint | Limit |
|---|---|
| `GET /catalog` | 6 professionals, 8 popular services |
| `GET /catalog/search` | 10 per entity |
| `GET /catalog/professionals` | `Query(default=50, le=100)` — parameterised |
| `GET /provider/bookings` | DB `.limit(50)`, then `feed_rows[:30]` in Python |
| `GET /customer/notifications` | 50 |
| `GET /admin/bookings` | 100 hardcoded |
| `GET /admin/audit-logs` | `Query(default=50, le=200)` — parameterised |
| `/admin/professionals`, `/customer/bookings`, `/customer/addresses`, `/customer/tickets`, `/customer/reviews`, `/customer/favourites`, `/provider/bookings/mine`, `/admin/services`, `/admin/categories` | **unbounded** |

Head-counting idiom (not pagination): `select("*", count="exact", head=True).execute()` then read
`res.count`. Used by `POST /customer/addresses` (first-address detection) and `GET /admin/stats`.

### 5.5 `audit_logs`

Fire-and-forget `.insert({"action","detail"}).execute()` — no `.select()`, no return check, and
**no actor field** (the table is only `id, action, detail, created_at`).

Exactly **four** automatic write sites, all in `admin.py`: `provider_add`, `provider_delete`,
`provider_kyc`, `service_add`. Plus manual `POST /admin/audit-logs`.

**Not audited:** `PUT /admin/professionals/{id}`, `PUT`/`DELETE /admin/services/{id}`,
`POST /admin/categories`, and all of `POST /admin/settings`.

### 5.6 `admin_settings`

`key` is the primary key. Two read patterns:

- single key -> `one(client.table("admin_settings").select("value").eq("key", k).maybe_single().execute())`
  then `.get("value")`. Only `auth.verify_admin` does this, in two round-trips.
- whole table -> `GET /admin/settings` **flattens** to `{key: value}` (the only endpoint that
  doesn't return rows verbatim).

Writes are `upsert(..., on_conflict="key")`. Seeded: `admin_password='admin123'`,
`admin_commission_pct='10'`, `notify_email='on'`, `notify_push='on'`. `admin_email` is **not**
seeded, which is why `verify_admin` falls back to the literal identifier `"admin"` and the literal
password `"admin123"`.

### 5.7 Complete route table (64 app routes + 4 framework)

The 4 framework routes are the docs surface — `/openapi.json`, `/docs`, `/redoc`,
`/docs/oauth2-redirect`. They are registered **only when `config.DOCS_ENABLED` is true**:
`main.py` passes `docs_url` / `redoc_url` / `openapi_url` as `None` otherwise, so in
production all four 404 (Render sets `RENDER=true`, or `ENV=production`;
`API_DOCS_ENABLED` overrides). `app.openapi()` still builds the schema in tests either way.

`GET /health` -> `{"ok": true}`, no DB access, so it stays green with bad credentials.

```
PUBLIC (no auth)
  GET    /health
  POST   /auth/verify-otp
  GET    /catalog
  GET    /catalog/categories
  GET    /catalog/categories/{slug}
  GET    /catalog/categories/{slug}/services
  GET    /catalog/search
  GET    /catalog/services
  GET    /catalog/services/{service_id}
  GET    /catalog/professionals
  GET    /catalog/professionals/{professional_id}
  GET    /catalog/reviews/{professional_id}

ANY VALID TOKEN (get_claims, no role check)
  GET    /auth/me

require_customer
  GET    /customer/profile                    PUT  /customer/profile
  GET    /customer/addresses                  POST /customer/addresses
  PUT    /customer/addresses/{address_id}     DELETE /customer/addresses/{address_id}
  GET    /customer/bookings                   POST /customer/bookings
  GET    /customer/bookings/{booking_id}
  PUT    /customer/bookings/{booking_id}/cancel
  PUT    /customer/bookings/{booking_id}/payment
  GET    /customer/favourites                 POST /customer/favourites
  DELETE /customer/favourites/{professional_id}
  GET    /customer/notifications              PUT  /customer/notifications/read-all
  PUT    /customer/notifications/{notification_id}/read
  GET    /customer/reviews                    POST /customer/reviews
  GET    /customer/tickets                    POST /customer/tickets

require_provider
  GET    /provider/me                         PUT  /provider/me
  PUT    /provider/kyc
  GET    /provider/bookings                   (open-request feed)
  GET    /provider/bookings/mine              (declare BEFORE {booking_id})
  GET    /provider/bookings/{booking_id}
  POST   /provider/bookings/{booking_id}/accept
  POST   /provider/bookings/{booking_id}/decline
  PUT    /provider/bookings/{booking_id}/status
  GET    /provider/earnings                   POST /provider/payouts
  GET    /provider/dashboard

require_admin  (no handler receives claims)
  GET    /admin/stats
  GET    /admin/bookings
  GET    /admin/professionals                 POST /admin/professionals
  GET    /admin/professionals/{professional_id}
  PUT    /admin/professionals/{professional_id}
  DELETE /admin/professionals/{professional_id}
  PUT    /admin/kyc/{professional_id}
  GET    /admin/categories                    POST /admin/categories
  GET    /admin/services                      POST /admin/services
  PUT    /admin/services/{service_id}         DELETE /admin/services/{service_id}
  GET    /admin/settings                      POST /admin/settings
  GET    /admin/audit-logs                    POST /admin/audit-logs
```

---

## 6. Data model

17 tables. Migrations are in `backend/supabase/migrations/`, applied in **filename order**.

| Table | Notes that matter |
|---|---|
| `categories` | `slug` UNIQUE, `icon` (lucide name), `color`, `sort_order`. 15 seeded, `other` last. |
| `services` | `category_id` FK->categories CASCADE. `starting_price` numeric, `popular` bool. **No unique constraint on `name`.** 182 seeded. |
| `professionals` | `category_slug` (text, not a FK), `skills text[]`, `status` (`available`/`busy`), `distance_km` (**stored, never computed**), `latitude`/`longitude` numeric, `service_radius_km int NOT NULL DEFAULT 60`, 6 `kyc_*` columns, `phone`, `email`. |
| `professional_services` | junction, `UNIQUE (professional_id, service_id)`, `price`. |
| `bookings` | **denormalized** `customer_name` / `professional_name` / `service_name` / `customer_address`. `professional_id NULL` + `professional_name = 'Auto-assign'` = **open request**. `latitude`/`longitude` = the customer request location. `address_id` FK->addresses SET NULL. `status` default `confirmed`, `payment_status` default `pending`, `payment_method` default `cash`. |
| `reviews` | `customer_name` holds a **name or a phone** depending on the code path — see section 10. |
| `profiles` | **`phone` is the PK.** `role` CHECK is `IN ('customer','provider')` — `admin` is **not** a valid value here even though `admin` is a valid JWT role. |
| `addresses` | `customer_phone`, `label`, `full_address`, `is_default`, `latitude`/`longitude`. |
| `favourites` | `UNIQUE (customer_phone, professional_id)`. |
| `notifications` | `customer_phone`, `type` (`booking`/`alert`/`payment`/`provider`/`review`), `booking_id` FK CASCADE, `read`. |
| `support_tickets`, `payouts`, `admin_settings`, `audit_logs`, `booking_declines` | `booking_declines` = `(booking_id, professional_id)` with **no unique constraint**, so duplicates are possible. |
| `pr_review_settings` | One row per repo for the PR review bot (section 12). `min_severity` / `comment_mode` are CHECKed, `rules text[]` is an allowlist (empty = all), `block_on_blocker` defaults **false** because `REQUEST_CHANGES` blocks the merge. Also holds `changelog_enabled` / `changelog_branch` / `changelog_file` (§12.1). Holds no secrets. |
| `pr_reviews` | One row per webhook run. `UNIQUE (repo_full_name, pr_number, head_sha)` — that index *is* the webhook-replay guard, so the writer **upserts**. `changelog_status` / `changelog_pr_url` record the other half of the run. **No anon policies**: audit log, service-role only. |
| `changelog_entries` | One row per PR, the source of truth the `CHANGELOG.md` block is rendered from (§12.1). `UNIQUE (repo_full_name, pr_number)` makes a replayed `opened` webhook idempotent. `kind` is CHECKed to `added`/`changed`/`fixed`, derived from the PR title prefix. **No anon policies**. |

Index notes: `idx_bookings_open_confirmed` is a **partial** index
`(created_at DESC) WHERE status = 'confirmed' AND professional_id IS NULL` — it exists purely to
serve the provider feed. `idx_professionals_kyc_status` is partial on `kyc_status = 'pending'`.
`idx_pr_reviews_sha`, `idx_pr_review_settings_enabled`, `idx_changelog_entries_pr` and
`idx_changelog_entries_date` are the indexes added by the bot migrations.

---

## 7. Domain logic you must not break

### 7.1 Booking lifecycle

```
confirmed -> assigned -> on_the_way -> started -> completed
                 \-------------> cancelled
```

`type BookingStatus = 'confirmed' | 'assigned' | 'on_the_way' | 'started' | 'completed' | 'cancelled'`
is declared in `frontend/src/types/index.ts`. The **provider-side transition table** lives in
`ProviderDetailScreen.tsx:10-17` as `NEXT_STATUS` (`confirmed->assigned`,
`assigned->on_the_way`, `on_the_way->started`, `started->completed`, terminal -> `null`).
Button labels: Accept Request / Start Journey / Start Service / Mark Complete.

The backend does **not** enforce the ordering. `PUT /provider/bookings/{id}/status` accepts any
value in `{assigned, on_the_way, started, completed, cancelled}` from any state (note
`confirmed` is rejected there), only checking ownership.

- Create always hardcodes `status = "confirmed"` server-side; the client's `status` is ignored.
- `accept` requires `status == "confirmed"`, else `400 Booking is already {status}`.
- `cancel` sets `status='cancelled'` **and** `payment_status='cancelled'`, and refuses only when
  `status == 'completed'`. The UI hides the button for `completed`/`cancelled` only, so a
  `started` booking is still cancelable from the client.
- `decline` **never changes status** — see 7.2.
- Tracking UI: `TrackingScreen.tsx:18` `STATUS_FLOW = ['confirmed','assigned','on_the_way','started','completed']`;
  `cancelled` is a separate branch that hides the timeline.

### 7.2 Accept vs decline (the subtle one)

- **Accept** -> `status='assigned'`, `professional_id` set -> the booking stops being `confirmed`
  -> it vanishes from **every** provider's feed. This is what prevents double-accept.
- **Decline** -> inserts a `booking_declines` row, **status unchanged** -> other providers still
  see it. If it *was* assigned to the decliner and is not `completed`/`cancelled`, it is also
  un-assigned (`professional_id = NULL`, `professional_name = 'Auto-assign'`) and returns to the
  open pool.

**A decline is not a cancellation. Never make them share a code path.**

### 7.3 Radius matching — client-side, and fail-open

`frontend/src/screens/provider/ProviderHomeScreen.tsx:77-92`
```ts
const myRadius = professional?.service_radius_km || 60;
const proHasCoords = professional?.latitude != null && professional?.longitude != null;
const distanceTo = (b) => (b.latitude != null && b.longitude != null && proHasCoords)
  ? haversineKm(...) : null;

const newRequests = requests.filter((b) => {
  if (b.professional_id === myId) return true;   // already mine
  if (declined.has(b.id)) return false;          // I declined it
  const km = distanceTo(b);
  if (km === null) return true;                  // <-- FAIL-OPEN
  return km <= myRadius;
});
```

Facts an agent must know:

- The backend feed (`GET /provider/bookings`) does **no** geo filtering. It returns up to 30
  `confirmed` bookings that are either assigned to the caller or open-and-not-declined. All
  distance logic lives in the browser.
- **Missing coordinates mean "in range"**, deliberately, so a missing GPS fix never hides a job.
- `haversineKm` is in `services/location.ts` with `R = 6371`.
- `declined` is **client state only** for the current session; the server-side `booking_declines`
  is the durable record the feed actually excludes on next load.
- Poll interval is 15 s (`setTick` re-triggers both fetch effects). `ProviderHomeScreen` is the
  **only** polling surface; everything else loads on mount.
- `professionals.distance_km` is a **stored column, never computed**. Every "X km away" string in
  the customer UI reads that column, not real distance. Do not confuse it with the radius logic.

### 7.4 Customer request coordinates — resolution order

`BookingFlowScreen` resolves in this order, and only calls `geocodeAddress` as a last resort:

1. exact GPS, if the user tapped "Use my current location"
2. coords on the **selected saved address**
3. geocoding the typed address (never surfaced to the user if it fails)

### 7.5 `geocodeAddress` fallback chain

Up to 6 Nominatim `/search` attempts, stopped at the first hit, **~1.1 s apart** (rate limiting):
housenumber+street+city+state+postalcode -> street string+city+state+postalcode -> whole address
as `q` -> `area, city, state, pincode` -> `city, state, pincode` -> `pincode` or `city` alone.

Both `fetchCurrentLocation` and `geocodeAddress` call `nominatim.openstreetmap.org` with **no
`User-Agent`, no timeout, and no abort controller**. The fallback coords string is
`Lat x.xxxx, Lng y.yyyy`. Reverse geocode uses `accept-language=en`.

### 7.6 Address domain

`services/address.ts` owns types plus compose/split/parse/validate; `components/AddressForm.tsx`
is the single shared form used by `AddressesScreen` and `BookingFlowScreen`.

- `splitAddress` parses by **content**, not position: pincode by a 6-digit shape, state by
  `STATE_BY_NAME` (built from `STATES` plus ~60 `STATE_ALIASES`, including old spellings like
  `Orissa`), the remainder positionally with a `looksLikeHouseLine` check
  (`HOUSE_NUMBER_RE`, `HOUSE_WORD_RE` covering flat/house/hs/block/blk/tower/apartment/apt/
  plot/villa/door/residence/lodge/bunglow/bungalow).
- The stored form is always the composed `"House No, Area, City, State, Pincode"`.
- Selection in the booking flow is tracked by **address id**, and any hand edit deselects the card
  (`updateAddr` clears `selectedAddressId`).
- Location fetching is **click-only**, never automatic.
- Default-address invariant, enforced server-side: at most one `is_default` per phone. `POST`
  auto-defaults the first address; `PUT` with `is_default: true` clears the others; `DELETE` of
  the default promotes the newest remaining row.
- `POST /customer/bookings` re-checks `address_id` ownership and **silently nulls** it if it
  belongs to someone else (it does not 400).

### 7.7 Auth details

- **The OTP is never verified against anything.** `POST /auth/verify-otp` only checks
  `re.fullmatch(r"\d{6}", code)`. Any 6 digits mints a 30-day token. The UI still shows a 60 s
  resend timer.
- `clean_phone`: strips non-digits, drops a leading `91` when the result is exactly 12 digits,
  requires exactly 10, else `400 Invalid phone number (10 digits required)`.
- An unknown `role` in the body is **silently coerced to `customer`** (not a 400).
- Provider signup (`find_or_create_provider`) inserts defaults: `rating 0`,
  `avatar_url ""`, `distance_km 1.0`, `status 'available'`, `service_radius_km 60`, and upserts a
  `profiles` row with `role='provider'`. `starting_price` is **not** a fixed literal any more — it is
  `links.cheapest_in_category(category_slug)` (cheapest service in their category), falling back to
  `99` only if the category has no priced services. The booking always bills
  `services.starting_price`, so seeding the floor from the catalogue keeps the two in step.
- `category_for(profession)` in `auth.py` maps 14 regex families to slugs and falls back to
  `"other"`. `ProviderAuthScreen.categoryFor` mirrors the same list. They are kept in sync by hand —
  the backend was missing its `physiotherapy` branch until `20261003000000`, so a physiotherapy
  provider who self-signed-up before that landed in `other`.
- `verify_admin` compares credentials with plain `==` against `admin_settings` (cleartext).
  Fallbacks: identifier `"admin"`, password `"admin123"`.
- `admin_password` is written in cleartext by `AdminProfile.changePassword`.

---

## 8. Migrations

11 files, **filename-ordered** (`20260830093336` ... `20260930000000`), all applied by one `psql`
loop in the CI `migrations` job.

| File | What it does |
|---|---|
| `20260830093336_luckyseva_schema.sql` | 6 core tables + RLS policies + 10 categories + 21 services + 7 indexes |
| `20260830093400_luckyseva_platform_tables.sql` | 8 platform tables + `professionals.phone/email` + `bookings.payment_status` + `admin_settings` seed + 5 indexes |
| `20260912000000_seed_professional_services.sql` | data-only backfill of the junction table |
| `20260913000000_provider_radius_matching.sql` | `latitude`/`longitude` on 3 tables, `service_radius_km`, `idx_bookings_open_confirmed` |
| `20260914000000_booking_declines.sql` | `booking_declines` + index + policies |
| `20260924000000_provider_kyc.sql` | 6 `kyc_*` columns + partial index |
| `20260927000000_add_physiotherapy_category.sql` | 11th category + 5 services |
| `20260928000000_booking_address_link.sql` | `bookings.address_id` + index |
| `20260929000000_pr_review_bot.sql` | `pr_review_settings` + `pr_reviews` for the review bot (see §12) |
| `20260930000000_backfill_professional_services.sql` | re-links every professional to every service of their `category_slug` at the starting price, and deletes links that point outside it. The `DELETE` is intentional here but slips past the CI guard below, which only matches an unaliased `DELETE FROM <table>;` |
| `20260930000000_changelog_entries.sql` | `changelog_entries` + the `changelog_*` settings and `pr_reviews` outcome columns (see §12.1) |
| `20261002000000_booking_priority_fee.sql` | `bookings.priority_fee` + `admin_settings` rows `priority_top_n` / `priority_fee` |
| `20261003000000_full_catalog_market_rates.sql` | full catalog: 4 new categories (`packer-mover`, `cctv-security`, `laundry-dry-cleaning`, `lawn-garden`), 182 services re-priced to market, `other` pushed to `sort_order` 15, junction relink + re-mirror, `professionals.starting_price` resynced to each category minimum, and a duplicate-service `DELETE` (see below) |

Rules you must follow:

- **Every migration must be idempotent.** CI applies the full set **twice**. Use
  `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `DROP POLICY IF EXISTS` before `CREATE POLICY`, and `ON CONFLICT ... DO NOTHING` for seeds.
- **CI fails the build** on any `DROP TABLE`, `TRUNCATE`, `DROP SCHEMA`, or `DELETE FROM <table>;`.
  If a change is genuinely destructive, split it and explain it. The guard is a grep for
  `DELETE FROM <table>;` with a `;` straight after the name, so an aliased delete with a
  `WHERE` clause — as in `20260930000000_backfill_professional_services.sql` — passes
  unflagged. Do not rely on it to catch you.
- RLS policies are declared `TO anon, authenticated`. Those roles only exist on Supabase, so the
  CI job creates them in a throwaway `postgres:15` first. If you add a new table, add the four
  `anon_select_*` / `anon_insert_*` / `anon_update_*` / `anon_delete_*` policies, or CI will pass
  but runtime queries through a non-service client will see nothing.
- `services` has **no unique constraint**, so seeds must guard with
  `WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = ...)` — `ON CONFLICT` is unavailable.
  **A bare `ON CONFLICT DO NOTHING` is not a substitute.** With no unique constraint it can never
  fire, so the insert runs again on every apply — which is why
  `20260830093336_luckyseva_schema.sql` duplicates its 21 services on a second pass and CI's own
  double-apply built a database with each of them listed twice.
  `20261003000000_full_catalog_market_rates.sql` repairs the result with an aliased
  `DELETE FROM services keep USING services extra WHERE extra.name = keep.name AND extra.id > keep.id`
  (lowest id per name wins). Edit that base file if you ever need to, but it is already applied in
  production, so prefer a new forward migration.
- **CI does not apply migrations to the real Supabase project.** Applying to production is a
  deliberate manual step (`npx supabase db push`, or paste into the SQL Editor in order).
  Neither path is available without an access token and the DB password; a DML-only migration can
  also be replayed through the PostgREST `/rest/v1` API with the service-role key, but that is
  **not transactional**, so snapshot the affected tables first and verify afterwards.

---

## 9. Verify your change

Run from `frontend/`:

```sh
npm run lint          # eslint .
npm run typecheck     # tsc --noEmit -p tsconfig.app.json
npm run test:unit     # vitest run  (2 files: address.test.ts, format.test.ts)
npm run build         # vite build — NOTE: does NOT typecheck
```

`npm run build` is `vite build` **only** — CI runs `typecheck` as a separate step. Never assume a
green build means a green type check.

Run from `backend/`:

```sh
ruff check app tests
python -m pytest tests -q     # 14 tests
python -m compileall -q app
pip-audit -r requirements.txt # continue-on-error in CI
```

Run from `backend/supabase/functions/` (needs Deno 2):

```sh
deno task test                # 80 tests: diff parser, rules, changelog, HMAC, PEM
deno task lint
deno task check               # type-check index.ts + review_local.ts
deno fmt --check
deno task review main...HEAD  # dry-run the bot's rules against a diff, no deploy
```

`deno task test` passes `--allow-env` only; the rules are pure, so the suite never
touches the network or a Supabase project. The `edge-functions` CI job runs all four
checks plus `deno audit`.

Install dev tools first: `pip install -r requirements.txt -r requirements-dev.txt` (runtime deps
intentionally do **not** include lint/test packages, so Render stays lean).

**There is no way to run the two halves together in one command, and there is no integration
test.** The backend tests never touch the network. If you change a contract, you are the
integration test — verify by hand against a live API at `http://localhost:8000/docs`
(local only; production 404s the docs routes, see 5.7).

Dependency pinning style: only `supabase==2.31.0` is pinned in `requirements.txt`; the rest are
unpinned. All four `requirements-dev.txt` entries are pinned. Note `httpx2` there is a
**different PyPI distribution from `httpx`** — `TestClient` needs `httpx`, which currently
arrives transitively via FastAPI. `ruff.toml` selects only `E4,E7,E9,F` (no isort, no
line-length, no security rules) and CI runs `ruff check`, never `ruff format --check`.

---

## 10. Known gaps, bugs, and asymmetries

Treat this list as **known, not endorsed**. Fixing one is fine — but fix it deliberately and
update this file rather than leaving the doc and the code disagreeing.

**Auth / security**

- The OTP is never actually verified (7.7). No SMS provider is integrated.
- The admin password is cleartext in `admin_settings`, defaults to `admin123`, and is also
  hardcoded in the frontend as `ADMIN_CREDENTIALS` in `app-context.tsx:6` (exported, used to
  prefill the admin login form).
- CORS is `allow_origins=["*"]` with `allow_credentials=False` — no origin allowlist anywhere.
- JWT lifetime is 30 days with no revocation mechanism.
- `verify_token` leaks the raw PyJWT decode error into the response body.

**Data isolation holes** — each is a real authorization gap; 1.3 explains why nothing catches them

- `GET /provider/bookings/{booking_id}` — **no ownership check**; any provider can read any booking.
- `DELETE /admin/professionals/{id}` and `DELETE /customer/favourites/{id}` — no existence check.
- `POST /admin/settings` — no audit log.
- `profiles.role` CHECK excludes `admin`, so an admin has no `profiles` row.

**Correctness bugs**

- `GET /customer/reviews` filters `.eq("customer_name", customer_phone(claims))` — it matches
  reviews whose `customer_name` literally equals a phone number. But `POST /customer/reviews`
  writes `customer_name` from the profile **name** (falling back to the phone). A user with a
  real name will never see their own reviews. "My reviews" is broken for most accounts.
- `GET /provider/dashboard` returns `today_earnings` filtered on `created_at[:10]`, i.e.
  **creation** date, not `scheduled_date`. Meanwhile `ProviderHomeScreen.tsx:96` computes
  today's earnings from `scheduled_date`. The dashboard and the home screen can disagree.
- `POST /customer/bookings`: `total = float(body.get("total_amount") or 0) or base + visit_fee`.
  The `or` means an explicit `total_amount: 0` silently becomes `base + visit_fee`.
- `utils/invoice.ts` `invoiceAmounts` clamps `total` up to `service + visit`, so a discounted
  booking's invoice can show **more** than the booking's `total_amount`.
- `invoiceNumber` derives its suffix from the last 6 hex chars of the booking uuid.
- `INDIAN_STATES` in `address.ts` is stale: it carries both merged and pre-merger UT names
  (`Dadra & Nagar Haveli and Daman & Diu` alongside `Daman & Diu`).
- The backend `category_for` has no `physiotherapy` pattern; the client does (7.7).

**Behavioural quirks**

- Every role's screens are **statically imported in `App.tsx`**, so every build ships every
  role's code. The comment at `app-context.tsx:11-15` claims otherwise — the comment is wrong.
- `renderProvider` has **no `help` case**, so `navigate({name:'help'})` from
  `ProviderProfileScreen` silently renders `ProviderHomeScreen`.
- `AdminSidebar.logout()` clears `adminAuthed` but **not** the JWT; the other three logout paths
  call `setApiToken(null)`.
- `capacitor.config.ts` reads `process.env.VITE_APP_ROLE`, which Vite's `loadEnv` does not
  populate. A `cap sync` can disagree with the web build unless the var is exported in the shell.
- **Most mutations swallow their errors** with `.catch(() => {})` — `createBooking`, `accept`,
  `decline`, `updateStatus`, `cancelBooking`, all address mutations, `updateProfile`,
  `addTicket`, and all admin mutations. A failed write looks like a successful one until a
  reload. This is why several of the bugs above survive.
- `PaymentScreen` has no payment gateway: 1500 ms of fake latency, then `payBooking`. The
  Razorpay mention in the UI is copy.
- `useIsFavourite` / `toggleFavourite` download the whole favourites list on every call.

**Coverage gaps**

- No test touches `sign_token`, `verify_token`, `require_role`, any router business logic, or
  `clean_phone` / `category_for` / `verify_admin`. `POST /auth/verify-otp` is untested.
- The frontend has only 2 test files (`address.test.ts`, `format.test.ts`) with
  `environment: 'node'` — no component, hook, or context tests. `api.ts` has none.
- `@supabase/supabase-js` is an unused dependency.
- `dependencies.py::bearer()` is dead code.

**Inconsistencies to preserve or fix deliberately**

- `catalog.services(slug)` in `api.ts` hits `/catalog/services`; the backend's
  `/catalog/categories/{slug}/services` has no client method.
- There is no client method for `GET /admin/professionals/{id}`.
- `api.ts` mixes a template literal and a plain string for the same `fn` argument (harmless).
- `api.ts` re-declares `Address`, `Favourite`, `Payout`, `AuditLog`, shadowing
  `types/index.ts` for two of them (4.3).
- `api.admin.bookings()` sends no `status` param even though the backend supports one, so
  `AdminBookings` filters client-side. It also hard-caps at the backend's 100-row limit.
- Two different support emails: `support@luckyseva.in` (`utils/invoice.ts`) and
  `support@luckyseva.com` (`AdminProfile`).
- `README.md` documents `installCommand: npm install --include=dev`; `vercel.json` actually
  contains `npm ci --include=dev`.

---

## 11. Change recipes

| Task | Files to touch |
|---|---|
| Add a screen | `context/app-context.tsx` (`Screen` union) + `App.tsx` (renderer `case`) + `screens/<role>/` |
| Add an API call | `services/api.ts` only — never call `fetch` from a component or hook |
| Add a backend endpoint | `app/routers/<ns>.py`; add the `require_*` guard; route any `maybe_single()` through `one()`; hand-roll `isinstance` checks; `if not res.data: raise ApiError(...)` after inserts |
| Add a DB column | new `backend/supabase/migrations/<timestamp>_<slug>.sql` using `ADD COLUMN IF NOT EXISTS`; never edit an applied migration |
| Add a table | `CREATE TABLE IF NOT EXISTS` + RLS enabled + the four `anon_*` policies in a `DO $$` loop |
| Change booking states | `types/index.ts` (`BookingStatus`), `ProviderDetailScreen.tsx` (`NEXT_STATUS`), `TrackingScreen.tsx` (`STATUS_FLOW`), `useBookings.ts` (`BookingFilter`), `routers/provider.py` (the `VALID` set inside `update_status`) — **five places, all of them** |
| Change radius behaviour | `ProviderHomeScreen.tsx` filter + `ProviderProfileScreen` chips + `routers/provider.py` feed. The filter is client-only; keep it client-side or move the *whole* thing server-side, never half |
| Change the address model | `services/address.ts` (compose/split/validate) + `components/AddressForm.tsx` + the address handlers in `routers/customer.py` |
| Change a role's capabilities | `VITE_APP_ROLE` handling in `app-context.tsx` + `capacitor.config.ts` (appId/appName) + the `Screen` union + `App.tsx` renderers + the `require_*` guard on the backend |
| Touch anything audited | the four write sites in `routers/admin.py`; if you add a mutation, decide whether it needs an `audit_logs` row |
| Change a table's shape | new migration + update section 6 of this file in the same commit |
| Add a review rule | `RULES` in `backend/supabase/functions/pr-review-bot/checks.ts` + a test in `checks_test.ts`; document it in the README table |
| Change what lands in `CHANGELOG.md` | `classifyTitle` / `KIND_BY_PREFIX` / `renderBlock` in `pr-review-bot/changelog.ts` + a test in `changelog_test.ts`; the writing/orchestration is `changelog_writer.ts` (§12.1) |

---

## 12. The PR review bot

`backend/supabase/functions/pr-review-bot/` is a Supabase Edge Function (Deno) that
reviews pull requests and maintains the changelog. It is **not** an LLM: every rule is
a pure function over the diff, so it costs nothing, is deterministic, and cannot be
talked into a wrong answer.

Flow, for `pull_request` `opened` / `synchronize` / `reopened` / `ready_for_review`:

1. Verify `X-Hub-Signature-256` (HMAC-SHA256 over the raw body) with
   `GITHUB_WEBHOOK_SECRET`. No secret set => 500, deliberately. A missing or malformed
   header is a 401, never an exception.
2. Read `pr_review_settings` for the repo. Missing row => defaults, and it gets inserted
   so you can then edit it. `enabled = false` or a draft PR => stop.
3. `idx_pr_reviews_sha` on `(repo, pr, head_sha)` short-circuits a replayed webhook.
4. On `opened` / `ready_for_review`, do the **changelog** step (12.1). It is wrapped in
   its own try/catch: a changelog failure must not cost the PR its review.
5. `GET /repos/{repo}/pulls/{n}/files`, then run the rules, then edit the existing
   comment (found by the `<!-- luckyseva-pr-review-bot -->` marker) or post a new one.
6. Upsert one `pr_reviews` row carrying both outcomes. Errors land there too and return
   502 so GitHub retries.

Files: `index.ts` (handler), `github.ts` (REST + App/PAT tokens), `checks.ts` (the
rules), `changelog.ts` (block rendering), `changelog_writer.ts` (orchestration),
`diff.ts` (hunk parser), `signature.ts` (HMAC), `pem.ts` (GitHub's PKCS#1 key
=> PKCS#8 for WebCrypto), `review_local.ts` (dry run), `types.ts`, `deno.json`.

Constraints worth knowing before you change it:

- **`verify_jwt = false`** in `supabase/config.toml`. The platform's JWT gate would
  reject GitHub's requests before the HMAC check ever runs.
- **Secrets live in `supabase secrets`, never in a table.** `pr_review_settings` has
  the same `USING (true)` policies as everything else here, so a webhook secret in a
  row would be readable with the public anon key.
- **`pr_reviews` and `changelog_entries` have no anon policies on purpose.** The run
  log is an audit trail and the entries are mirrored into a committed file; nothing in
  the app reads either from a browser.
- **`recordRun` upserts, it does not insert.** Retries are deliberate (`verdict =
  'error'` rows are re-runnable) and `UNIQUE (repo, pr, head_sha)` means a plain
  insert would collide with its own previous attempt and lose the retry.
- **Token resolution**: App installation token (RS256 JWT built by hand in `github.ts`,
  cached until 60s before expiry) when the payload has an `installation`, otherwise
  `GITHUB_TOKEN` as a PAT fallback.
- **Diff truncation is real.** GitHub omits `patch` for binary files and for diffs over
  its size cap. Those files are reported as "not scanned" rather than passed over in
  silence, and the run caps at 300 files.

The rules exist because of specific properties of *this* codebase, not generic style.
The highest-value ones encode §1.3 and §1.6: RLS is `USING (true)` and the backend uses
the service role, so a removed `.eq("customer_phone", ...)` is a real data leak, and
route declaration order is load-bearing.

**Tuning rules — check the false positives first.** Several suppressions are deliberate
and will look wrong in isolation:

| Suppression | Why |
|---|---|
| `ownership-filter-removed` compares removals against additions **per column** | A refactor that moves `.eq("phone", p)` onto a rewritten line shows as `-` then `+`. Counting deletions alone flagged 6 false blockers on `cd977cd`. |
| `secret`'s fuzzy pattern is skipped in tests and `.example` files | A repo's own fakes live there. Known-shape tokens (private key, `ghp_`, `eyJ...`, `sk-`, `AKIA`, Supabase key) are still reported everywhere. |
| `secret` / `hardcoded-admin-credentials` skip `pr-review-bot/` | The rules match their own pattern literals. Every other rule still runs there. |
| `hardcoded-admin-credentials` is scoped to code files | `docs/brain.md` documents the `admin` / `admin123` fallback on purpose. |
| `destructive-sql` excludes `DROP POLICY` | Every migration opens `CREATE POLICY` with `DROP POLICY IF EXISTS`; that is what makes the second CI pass a no-op. |

`deno task review <ref>` runs the rules against any diff in the repo with no deploy
step, which is the fastest way to check a rule edit against real history. It reports
zero findings across the 20 most recent commits.

### 12.1 The date-wise changelog

On `opened` (and `ready_for_review`, so a PR drafted first is not missed) the bot
appends a dated entry to `CHANGELOG.md` via its own PR. The choices were deliberate:

- **The bot opens a PR, it does not push to `master`.** A push to `master` would fire
  the whole pipeline on every PR and could land entries for work that never merged.
- **Entries are written on `opened`, not on merge.** This means a PR you later close
  unmerged still appears. Accepted knowingly: you see the entry while the work is in
  flight, and `changelog_enabled = false` turns the whole thing off.
- **The PR title is the entry text.** Nothing smarter was attempted — the hand-written
  dated sections are far richer than anything derivable from a title. Bucket =
  conventional-commit prefix (`feat` => Added, `fix` => Fixed, else
  Changed); the prefix is stripped from the line because the bucket already says it.

Four invariants make re-running safe, and all four are load-bearing:

1. **The table is the source of truth; the file is a rendering.** `changelog_entries`
   is rebuilt into the block every run, so a hand-edited branch is corrected rather
   than compounded. Never patch the file incrementally.
2. **`UNIQUE (repo_full_name, pr_number)`.** A replayed `opened` webhook, or a PR that
   fires both `opened` and `ready_for_review`, produces one entry.
3. **Dates are UTC, taken from the PR's `created_at`.** A webhook replayed tomorrow
   still lands under the day the PR was opened, so the block is deterministic.
4. **Only the marked region is written.** `applyBlock` replaces everything between
   `<!-- luckyseva-changelog:start -->` and `<!-- ...:end -->` and joins the parts with
   exactly one blank line, so it is idempotent. `normalizeBlock` re-adds the markers if
   they are ever missing — without that, a marker-less block would be inserted again on
   every run and the file would grow without bound.

**The file format is dated, and the bot owns the header.** Sections are `## YYYY-MM-DD`,
newest first — never `## [Unreleased]` — and the line directly under `# Changelog` is
`**Last updated:** <newest entry date>`, written by `applyLastUpdated` from
`newestEntryDate(entries)`. It is idempotent and rewrites in place rather than
appending, so a hand-written date can be corrected. Because the header is machine-written,
`recordChangelog` treats a run as `unchanged` only when **both** the block and the header
match, otherwise the header could go stale behind a `hasChanged: false` short-circuit.
`emptyChangelog()` — used only when the file is missing entirely — seeds the same header
with `no entries yet`. Hand-written sections below the block follow the same dated
convention; keep them dated when you add to them.

The bot PR is **reused**, not recreated: it looks for an open PR whose head is
`changelog_branch` and pushes to it, so you get one PR per batch of PRs rather than
one per merged PR. `hasChanged` short-circuits the write entirely when the rendered
block already matches the branch, so a no-op webhook makes no commit.

Watch for the one silent failure mode: if `pr.base.sha` is absent from the payload the
branch is never created and the write fails. `readFile` returning `null` on a branch
that does not exist is the intended path, not an error.

---

## 13. Quick reference

```sh
# frontend/  (all commands)
npm run dev | lint | typecheck | test:unit | build | preview
npx cap sync                       # requires VITE_APP_ROLE exported in the shell
#   admin has NO native app — never cap sync for admin

# backend/
py -m uvicorn app.main:app --reload      # http://localhost:8000/docs
ruff check app tests
python -m pytest tests -q
python -m compileall -q app
pip-audit -r requirements.txt

# backend/supabase/functions/  (Deno 2)
deno task test | lint | check
deno fmt --check
deno task review main...HEAD              # dry-run the review bot's rules

# supabase
npx supabase db push
npx supabase functions deploy pr-review-bot

# env vars
# frontend/.env      VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_ROLE, VITE_API_URL
#                     (+ optional VITE_PHONE_MOCKUP)
# backend/.env       SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET
# edge fn secrets    GITHUB_WEBHOOK_SECRET, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY
#                    (or GITHUB_TOKEN for a PAT) — SUPABASE_URL and
#                    SUPABASE_SERVICE_ROLE_KEY are injected automatically
```

Roles and roles builds: `customer` -> `com.luckyseva.app` (web + native), `provider` ->
`com.luckyseva.partner` (web + native), `admin` -> web only. One repo, three Vercel projects, one
`VITE_APP_ROLE` each.

