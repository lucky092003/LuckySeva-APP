# LuckySeva — Features & Architecture

**LuckySeva** is a mobile-first home-services marketplace. One React + Vite + TypeScript
codebase is built with **three role-locked apps** (customer, provider, admin), wrapped
natively with **Capacitor** and backed by **Supabase** (PostgreSQL).

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

```sh
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_APP_ROLE=customer      # customer | provider | admin
```

The Supabase client is a single anonymous PostgREST client (`src/lib/supabase.ts`).
RLS is intentionally open for this single-tenant demo (SELECT/INSERT/UPDATE allowed).

---

## 3. Data model

Migrations live in `supabase/migrations/`. Key tables:

### `services` / `categories`
Catalog of bookable services organised into categories (seed data included).

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
| `base_price`, `visit_fee`, `total_amount` | money |
| `payment_method`, `payment_status` | `cash` / `upi` / `card` / `netbanking`; `cash` / `paid` / `pending` |
| `status` | lifecycle (below) |
| `created_at` | |

### `addresses`
Customer saved addresses: `customer_phone`, `label`, `full_address`, `is_default`,
plus `latitude` / `longitude` (captured from GPS or geocoding).

### Supporting tables
`profiles`, `reviews`, `favourites`, `notifications`, `support_tickets`, `payouts`,
`admin_settings`, `audit_logs`, `professional_services`.

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
- **cancelled** — provider rejects or customer cancels.

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
**assigned to this provider** or **open** (`professional_id IS NULL`), then:

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

## 6. Location & geocoding — `src/lib/location.ts`

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

- **Add address** (`AddressesScreen`): Flipkart-style broken form — Label,
  House/Flat No + Street/Road, Area/Locality, City/District + State, numeric Pincode,
  plus an optional "Use my current location" prefill. Coordinates are saved when known.
- **Booking service address** (`BookingFlowScreen`): structured fields + a
  **saved-address picker** (selectable cards, DEFAULT badge); auto-fills the default
  address. Location fetching is **click-only** (never automatic).
- The composed address stored on a booking is the combined structured string
  `"House No, Area, City, State, Pincode"`.

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
| Provider | Requests (Home), Bookings, Earnings (with payout requests), Detail/status advance, Profile (availability, pricing, radius, location), Auth |
| Admin | Dashboard, Customers, Providers, Services, Bookings, Profile, Audit log, Add Provider/Service modals, Export CSV |

Navigation is a simple hand-rolled screen-state machine in `src/lib/app-context.tsx`
(`navigate({ name, ...params })`); the shell (`PhoneShell` / `BottomNav` / `WebTopNav`)
is responsive — phone column on mobile, full width on desktop web.

---

## 10. Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (set `VITE_APP_ROLE` first) |
| `npm run preview` | Preview the build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript checks |
| `npx cap sync` | Sync web build into native projects |

See [README.md](../README.md) for setup and [PUBLISHING.md](../PUBLISHING.md) for releases.