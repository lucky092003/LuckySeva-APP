# LuckySeva — Features & Architecture

**LuckySeva** is a mobile-first home-services marketplace. One React + Vite + TypeScript
codebase is built with **three role-locked apps** (customer, provider, admin), wrapped
natively with **Capacitor**. Data lives in **Supabase** (PostgreSQL); the business API is a
**FastAPI** (Python) service in `backend/` that reads/writes Supabase and mints JWTs.

This document describes the current system, its data model, and the key features
(especially the **provider radius-based matching system**).

---

## 1. Roles & apps

| Role     | What it is                        | Web   | Android / iOS |
|----------|-----------------------------------|-------|---------------|
| `customer` | Book services at your doorstep  | ✅    | ✅ LuckySeva |
| `provider` | Accept requests, manage jobs    | ✅    | ✅ LuckySeva Partner |
| `admin`    | Platform dashboard              | ✅ web-only | ❌ |

Each build is compiled with `VITE_APP_ROLE` and contains **only** that role's screens.
There is **no runtime role switching**.

---

## 2. Environment variables (`.env`)

Frontend (`.env`):

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_APP_ROLE=customer      # customer | provider | admin
VITE_API_URL=http://localhost:8000   # FastAPI base URL (deployed: https://your-api)
```

Backend (`backend/.env` — see `backend/.env.example`):

```sh
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # service-role key, server only — never expose
SUPABASE_JWT_SECRET=...         # from Supabase: Settings → API → JWT Secret
```

> **Data access — one layer.** All web/app data access goes through the FastAPI
> backend (`frontend/src/services/api.ts` → `backend/`), which uses the **service role**
> key server-side and authorizes requests with a custom JWT. Backend endpooints are
> grouped by role: `auth`, `catalog` (public), `customer`, `provider`, `admin`.

---

## 3. Data model

Migrations live in `backend/supabase/migrations/`. Key tables:

### `services` / `categories`
Catalog of bookable services organised into categories. 15 categories and 182
services are seeded, priced at Indian at-home market rates (visit included,
parts excluded) by `20261003000000_full_catalog_market_rates.sql`.

### `professionals`
| Column | Notes |
|---|---|
| `id` uuid PK | |
| `name`, `phone`, `email` | identity |
| `category_slug`, `skills text[]` | category + skills |
| `experience_years`, `rating`, `reviews_count`, `completed_jobs` | stats |
| `starting_price`, `avatar_url`, `bio`, `distance_km` | static-ish profile data |
| `status` | `available` / `busy` |
| `service_area` | free-text area string |
| `latitude`, `longitude` | **provider location coords** (set via "Update Location") |
| `service_radius_km` | **provider service radius, default 60** |

### `bookings`
| Column | Notes |
|---|---|
| `id` uuid PK | |
| `customer_name`, `customer_phone`, `customer_address` | who + where |
| `latitude`, `longitude` | **customer request location coords** |
| `service_id`, `service_name` | denormalised service |
| `professional_id`, `professional_name` | `NULL` + `Auto-assign` = **open request** |
| `scheduled_date`, `scheduled_time`, `notes` | schedule |
| `base_price`, `visit_fee`, `priority_fee`, `total_amount` | money |
| `payment_method`, `payment_status` | `cash` / `upi` / `card` / `netbanking`; `cash` / `paid` / `pending` |
| `status` | lifecycle (below) |
| `created_at` | |

### `addresses`
Customer saved addresses: `customer_phone`, `label`, `full_address`, `is_default`,
plus `latitude` / `longitude` (captured from GPS or geocoding). At most one address
per customer is `is_default`; deleting the default promotes the newest remaining one.

### Supporting tables
`profiles`, `reviews`, `favourites`, `notifications`, `support_tickets`, `payouts`,
`admin_settings`, `audit_logs`, `professional_services`, `booking_declines`
(per-provider decline tracker: `booking_id`, `professional_id`).

---

## 4. Booking lifecycle

```
confirmed → assigned → on_the_way → started → completed
                └─ cancelled (never accepted)
```

- **confirmed** — created by the customer. If no professional was chosen,
  `professional_id = NULL`, `professional_name = 'Auto-assign'` — this is an
  **open request** shown to providers via radius matching.
- **assigned** — accepted by a provider (also set immediately for prepaid online
  bookings).
- **on_the_way / started / completed** — advanced by the provider in the booking detail.
- **cancelled** — the customer cancels. **A provider declining does not cancel** the
  booking: it records a per-provider decline (`booking_declines`) so the request stays
  visible to the other providers.

---

## 5. Provider radius-based matching 🌐

**Goal:** a provider sets a service radius (km). A customer's new request is shown to
the provider **only if the customer is within that radius**, using real coordinates.

### Provider setup — `ProviderProfileScreen`
- **My Location** — "Update" uses GPS (`fetchCurrentLocation`) to store
  `latitude` / `longitude` (green dot shown when set).
- **Service Radius** — one-tap chips `10 / 25 / 50 / 75 / 100 km` or a custom km value;
  saved to `service_radius_km`.

### Customer request coordinates — `BookingFlowScreen`
When the customer confirms a booking, coordinates are resolved in this order:
1. Exact GPS if the user tapped **"Use my current location"**.
2. Coordinates attached to the **selected saved address**.
3. **Geocoding** of the entered address (see §7) as a best-effort fallback.

### The match — `ProviderHomeScreen`
The provider's "New Requests" feed loads all `confirmed` bookings that are either
**assigned to this provider** or **open** (`professional_id IS NULL`), that fall in **their trade**,
then:

```
distance = haversine(provider.latitude, provider.longitude,
                     booking.latitude,  booking.longitude)

show if:
  - booking is assigned to me   (customer explicitly chose this provider), OR
  - no usable coordinates      (cannot be computed → show), OR
  - distance ≤ service_radius_km
```

Each request card shows `X km away` + an **IN RADIUS** badge when computable.
The feed refreshes automatically every **15 seconds** (and after accept/reject).

### A request only reaches professionals who offer that exact service
Radius alone was far too wide — every provider in town saw an electrician's booking, an AC
booking, a beauty booking, all of it. `_field_filter()` in
`backend/app/routers/provider.py` narrows both provider read endpoints to what the caller
actually takes:

```
show an open request to me if:
  - the booking was created for me in person (professional_id = me), OR
  - I am linked to that exact service (professional_services)
```

When a professional has linked services (every signup seeds them - see *Services Offered*
below) **that selection is authoritative**: turning a service off stops its requests arriving,
even though the category still matches. A professional row with *no* links at all is a legacy
row, so it falls back to the trade (`service.category_id → categories.slug == my
category_slug`); with neither links nor a category there is nothing to match on, so they see
everything rather than an empty app. `GET /provider/bookings/{id}` returns **404** (not 403) for
a booking outside the caller's field, so a stray id cannot confirm it exists. The feed header
spells the scope out — *"Electrician · within 60 km of Faridabad"*.

### Services Offered - the provider picks their own subset
A plumber does not do everything under "plumber". At signup `links.py` links every service of
the chosen category (`link_professional_to_category`), so the provider is immediately
bookable; **Profile → Services Offered** then narrows that list to the work they actually do.
Only services inside their own trade are ever listed, and the API rejects anything else.

| Endpoint | Behaviour |
|---|---|
| `GET /provider/services` | `{ category_slug, services: [{ ...service, offered }] }` - the whole trade flagged with the current selection |
| `PUT /provider/services` | body `{ service_ids: [...] }` → replaces the selection |
| `PUT /provider/trade` | body `{ category_slug }` → sets/changes the trade, then links that trade |

`set_professional_services()` in `backend/app/links.py` enforces the rules:

- **Non-empty.** Zero links would hide the professional from every service page.
- **Same trade only.** Unknown or out-of-category ids are a 400, so the selection can only ever
  shrink - it cannot add work from another field.
- **Prices survive.** A service that stays selected keeps its existing
  `professional_services.price`; only newly added links are priced from the catalogue.
- **Floor price follows.** `professionals.starting_price` is re-derived to the cheapest service
  still offered, but only when the selection actually changed - re-saving the same set never
  overwrites a price the provider set by hand in **Pricing**.

The consequences reach the customer automatically, because both customer reads join through
`professional_services`: a deselected service disappears from the provider's public profile and
stops listing them on `GET /catalog/services/{id}`.

**No admin in the loop.** A professional whose trade is unset (or whose trade the catalogue has
nothing for) gets the trade list inside *Services Offered* itself and picks their own trade, so
setting a trade is never blocked on someone else. The trade badge in the sheet header is tappable,
so an established professional can switch trade: the app asks for confirmation first (the old
trade's services are dropped), then `PUT /provider/trade` relinks the whole new trade and the list
is reloaded, so the sheet only ever shows the current trade's services.

### Many providers, one request
When several providers in the same area see an open request, the state is managed so
that *accepted* removes it everywhere, but *declined* is **per-provider**:

- **Accept** → booking becomes `assigned` with `professional_id` set → it stops being
  `confirmed`, so it disappears from **every** provider's "New Requests". No double-accept.
- **Reject / Decline** → a row is inserted into `booking_declines`
  (`booking_id`, `professional_id`); the booking status is **unchanged**, so the other
  providers still see it. Only the declining provider filters it out of their feed.
- For a request that was created directly for a specific provider, declining also resets
  `professional_id`/`professional_name` back to `Auto-assign`, turning it into an open
  request that other providers in radius can accept.

### The number unlocks on accept, not on viewing
Every request card is tappable and opens **Booking Details** (`ProviderDetailScreen`) with the
service, date, time, notes, payment and **full customer address**. The customer's
`customer_phone` is withheld until that provider owns the job:

- `_hide_phone()` in `backend/app/routers/provider.py` blanks `customer_phone` on
  `GET /provider/bookings` and `GET /provider/bookings/{id}` while the booking is still
  `confirmed` and not assigned to the caller — the open feed is shared by every provider in
  the radius, so shipping the number there would let anyone farm leads.
- The screen mirrors it: while `status === 'confirmed'` and the booking is not this
  provider's, the number line reads *"Number unlocks after you accept"* with a lock icon
  instead of the digits and the call button.
- After **Accept** the booking reloads as `assigned` with `professional_id` set, so the real
  number and the `tel:` call button appear.

### Example
Provider located in Faridabad with `service_radius_km = 60`:

| Customer location        | Distance | Result        |
|--------------------------|----------|---------------|
| Greenfield, Faridabad    | ~0.0 km  | ✅ Show       |
| Faridabad city centre    | ~6.7 km  | ✅ Show       |
| Varanasi, UP             | ~664 km  | ❌ Hide       |
| Bangalore                | ~1726 km | ❌ Hide       |

Accepting an open request writes `professional_id` / `professional_name` so the job is
now assigned to that provider.

---

## 6. Location & geocoding — `frontend/src/services/location.ts`

| Helper | Purpose |
|---|---|
| `fetchCurrentLocation()` | Browser `navigator.geolocation` + Nominatim reverse geocode; returns `{ address, latitude, longitude, details }` |
| `formatAddress(details)` | Builds `"House No, Road, Locality, City, State, Pincode"` from reverse-geocode parts |
| `splitAddress(full)` | Breaks a full address string back into `houseNo, area, city, state, pincode` |
| `applyDetails(details)` | Maps Nominatim address parts → the structured fields |
| `areaFrom(details)` | Short "suburb, city" label (provider service area) |
| `haversineKm(...)` | Great-circle distance in km (used by radius matching) |
| `geocodeAddress({ house, area, city, state, pincode })` | Turns a typed address into coordinates |

### `geocodeAddress` fallback chain
Runs structured → free-text → minimal queries in order, stopping at the first hit;
each attempt is spaced ~1.1 s to respect Nominatim's rate limit:

1. `housenumber` + `street` + `city` + `state` + `postalcode`
2. full `street` string + `city` + `state` + `postalcode`
3. free text of the **entire** address (`q`)
4. free text of `area, city, state, pincode`
5. free text of `city, state, pincode`
6. `pincode` or `city` alone

This ensures real-world addresses (with commas/buildings/apartments) still produce
coordinates, so radius matching never silently skips the distance check.

---

## 7. Customer address flow

`frontend/src/services/address.ts` owns the address domain logic (types, composing,
parsing, validation) and `frontend/src/components/AddressForm.tsx` is the single
shared form used by both entry points.

- **Address form** (`AddressForm`): Label, House/Flat No + Street/Road, Area/Locality,
  City/District + State (with a datalist of Indian states/UTs), numeric Pincode, plus an
  optional "Use my current location" prefill. Every field is required and the pincode
  must be 6 digits; errors render per-field plus a "Please complete: …" summary, and
  they stay hidden until the user actually attempts to submit.
- **Add address** (`AddressesScreen`): the shared form with Home/Work/Other label
  shortcuts. Coordinates are saved from GPS when available, otherwise geocoded.
- **Booking service address** (`BookingFlowScreen`): the same form plus a
  **saved-address picker**. The default address is applied once per visit to the step;
  selection is tracked by address id (not by string comparison) and any hand edit
  deselects the card. Location fetching is **click-only** (never automatic).
- **Parsing** (`splitAddress`): maps a stored `full_address` back into fields by
  *content* — pincode by 6-digit shape, state by name/abbreviation (incl. old
  spellings like `Orissa`), the remainder in composition order. Addresses that omit
  the state or pincode therefore do not have their fields shifted into each other.
- The composed address stored on a booking is the combined structured string
  `"House No, Area, City, State, Pincode"`. When the booking used a saved address,
  `bookings.address_id` links back to it (ownership-checked server side).

---

## 8. OTP flow — `src/components/OtpInput.tsx`

Shared 6-digit OTP component used by customer + provider auth:

- auto-focus first box, auto-advance, backspace to previous
- paste support (distributes all 6 digits)
- 60 s resend countdown
- responsive `grid-cols-6` layout so boxes never cut off on narrow phones

---

## 9. Key screens & navigation

| Area | Screens |
|---|---|
| Customer | Home, Services, Service detail, Professional list/profile, Booking flow, My Bookings, Tracking, Addresses, Favourites, Notifications, Profile, Auth, Payments, Reviews, Help |
| Provider | Requests (Home), Bookings, Earnings (with payout requests), Detail/status advance, Profile (availability, pricing, radius, location, **services offered**), Auth |
| Admin | Dashboard, Customers, Providers, Services, Bookings, Profile, Audit log, Add Provider/Service modals, Export CSV |

Navigation is a simple hand-rolled screen-state machine in `frontend/src/context/app-context.tsx`
(`navigate({ name, ...params })`); the shell (`PhoneShell` / `BottomNav` / `WebTopNav`)
is responsive — phone column on mobile, full width on desktop web.

---

## 10. Scripts

Frontend commands run from `frontend/`.

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (set `VITE_APP_ROLE` first) |
| `npm run preview` | Preview the build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript checks |
| `npm run test:unit` | Vitest unit tests |
| `npx cap sync` | Sync web build into native projects |

Backend commands run from `backend/`.

| Command | Description |
|---|---|
| `py -m uvicorn app.main:app --reload` | Run the FastAPI backend |
| `ruff check app tests` | Lint the API |
| `python -m pytest tests -q` | Smoke tests (health, routing, auth guards) |
| `pip-audit -r requirements.txt` | Audit runtime deps for known CVEs |

See [README.md](../README.md) for setup, [PUBLISHING.md](../PUBLISHING.md) for releases,
and `backend/` for the backend.