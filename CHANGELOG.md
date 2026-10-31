# Changelog

**Last updated:** 2026-10-31

All notable changes to **LuckySeva** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Sections are headed by the date they were written (`## YYYY-MM-DD`), newest first. The
`Last updated` line is bumped by hand when a new dated section is added.

## 2026-10-31

### Fixed
- Gemini assistant requests no longer send the unsupported temperature setting to Gemini 3.8 Flash.
- Assistant chat now sends generation settings in the Interactions API format and logs upstream status/code for failures.
- Assistant back navigation now returns to the screen it was opened from.

### Changed
- Customer My Bookings status tabs now fit in a two-by-two grid on phones and a single row on wider screens, removing horizontal scrolling.
- iOS CI dependency caching in the main CI workflow now uses `actions/cache@v6` instead of `v4`.
- AI Assistant heading and welcome suggestions are more compact, without the “Ask Lucky” label.
- Frontend JavaScript dependencies received minor/patch updates, including `lucide-react` 1.60.0 → 1.62.0 (lockfile refreshed).

## 2026-10-30

### Fixed
- Admin notification read state is stored separately from customer/provider read state, preventing admin mark-read actions from changing another user's unread notifications.
- Admin notification actions now report API failures and only update the UI after the backend confirms the change.

## 2026-10-28

### Fixed

- Customer `/notifications/read-all` now declared before `/notifications/{notification_id}/read` so the literal `read-all` route is never shadowed by the path parameter (route order is load-bearing, invariant 3.5). Matches `provider.py`, which already had this correct.
- **Customer All Services screen** now has a service search, clearer category filters, and roomier service cards with easier-to-scan duration and starting-price details.
- **Customer My Bookings screen** now has cleaner tabs with icon labels, roomier booking cards, and clearer action buttons (Cancel / Reschedule / Track / Invoice) laid out horizontally.

## 2026-10-25

### Fixed
- **Assistant voice transcription accepts browser audio MIME types** by removing
  codec parameters and mapping MP4 recordings to Gemini's supported M4A type.
  Unsupported audio types are rejected before calling Gemini.

## 2026-10-24

### Added
- **Customer and provider AI assistant** (`frontend/src/screens/shared/AssistantScreen.tsx`,
  `backend/app/routers/assistant.py`) adds authenticated, role-aware chat, voice
  recording/transcription, and read-aloud responses via Google's Gemini
  Interactions API. The Gemini API key stays on the backend (`AI_API_KEY`); without
  it, the app shows a setup message. Chat cannot read or change live account
  data, bookings, or payments. Missing chatbot backend routes show a deployment
  hint instead of a generic API 404.
- **Stronger pull request CI** now runs for documentation-only changes too, builds
  both customer and provider Android debug APKs plus the iOS Simulator app, and
  requires the frontend, backend, migrations, edge-functions, changelog, Android,
  and iOS checks before merge. A shared Xcode scheme makes the iOS build
  reproducible on CI runners.

### Changed
- **Customer and provider screens** now share polished, accessible UI primitives,
  clearer navigation states, and more consistent mobile/desktop styling.
- **Session token validity is 20 minutes** for customer, provider, and admin
  logins. Tokens include an issued-at claim, and legacy tokens without it are
  rejected so old 30-day sessions cannot bypass the new limit. An expired-token
  401 now clears the saved session and returns the app to login.

## 2026-10-23

### Changed
- **Customer booking screens** (`frontend/src/screens/customer/TrackingScreen.tsx`,
  `frontend/src/screens/customer/BookingSuccessScreen.tsx`) now have a more polished,
  responsive look: laptop users get a side-by-side live map and booking-details
  rail, while phones retain the floating map status and bottom sheet. Tracking
  banners and the booking confirmation’s success state, summary card, and actions
  have clearer hierarchy and a more premium feel. Tracking now loads booking
  details independently of live GPS, so a location-service failure no longer
  blanks the page; booking-load failures show a retry action instead.
- **Desktop customer and provider layouts** now use the full browser viewport
  instead of a floating app frame. The customer home uses a dedicated
  `DesktopHomeScreen` with a light editorial hero, service search, all service
  categories and popular-service discovery, plus booking/professional side
  panels. Desktop navigation spans the site and moves to the desktop breakpoint;
  tablets retain app-style bottom navigation. Desktop pages now use 25px side
  gutters and breakpoint-aware grids. Customer and provider auth pages
  now use the full browser viewport for the split-screen brand/form layout,
  instead of being clipped to the content max width. Native/mobile layouts remain
  unchanged. Desktop home scrolling remains available without displaying a
  scrollbar.
- **Provider desktop workspace** now presents requests as the primary work feed,
  active jobs and service coverage in a side rail, plus a dedicated workspace
  heading and availability indicator. Provider bookings use a responsive card
  grid, and the web navigation now includes role-aware active states and an
  account identity control without a duplicate Profile tab. Navigation links
  align with the account controls on the right. Page backgrounds span the
  viewport, while card grids add columns at wider breakpoints to keep the layout
  balanced.
- **Login sessions survive refreshes** for customer, provider, and admin builds:
  a stored profile plus token now restores the correct start screen. Temporary
  API/network failures during session validation no longer erase the token;
  explicit 401/403 auth failures still return the user to login.

## 2026-10-19

### Added
- **Journey-scoped live tracking ("Provider is on the way")**
  (`backend/supabase/migrations/20261019000000_provider_tracking.sql`,
  `backend/app/routers/provider.py`, `backend/app/routers/customer.py`,
  `frontend/src/screens/customer/TrackingScreen.tsx`,
  `frontend/src/screens/provider/ProviderDetailScreen.tsx`,
  `frontend/src/components/ProviderLocationPublisher.tsx`,
  `frontend/src/services/providerTracking.ts`) — the customer's map now turns on
  exactly when the provider taps **Start Journey** (`assigned` → `on_the_way`)
  and stops the moment the job leaves that status (Start Service / complete /
  cancel / decline re-queues it). Live fixes go to a new booking-scoped
  `provider_tracking` table through `POST /provider/bookings/{id}/location`,
  which refuses coordinates unless the caller is the provider assigned to a
  booking that is genuinely `on_the_way` (404 for someone else's job, 409
  `tracking_not_active` otherwise); the customer reads it through
  `GET /customer/bookings/{id}/tracking`, polled every 8 s. A fix older than
  150 s is treated as lost, so the pin is dropped instead of being drawn stale.
  The green header now carries a real ETA — OSRM road-route minutes when the
  route resolves, otherwise a straight-line estimate floored at 2 min — and the
  floating pill shows live distance. On the provider side "Start Journey" asks
  for the location permission in context and publishes the first fix
  immediately, and a new **Location Sharing** card on the job screen surfaces
  permission-denied / no-GPS / server-unreachable states with a **Retry
  Sharing** button. GPS problems never blank the screen: the booking details,
  provider card (call button included) and timeline stay visible with an
  explanatory notice. Tracking data no longer comes from
  `professionals.latitude` — that column is the provider's *base* location used
  by radius matching, so live travel coordinates no longer risk overwriting it.
- **`provider_tracking` table with ownership-scoped RLS**
  (`backend/supabase/migrations/20261019000000_provider_tracking.sql`) — one row
  per live journey, deleted when it ends. Deliberate exception to the
  `USING (true)` house style: only the booking's customer may SELECT the row and
  only the assigned provider may INSERT/UPDATE/DELETE it, read through a new
  `luckyseva_jwt_claim()` helper so the migration still applies to the plain
  `postgres:15` CI runs. The service-role backend remains the real boundary.
- **Tracking endpoint tests**
  (`backend/tests/test_provider_tracking.py`) — ownership and status gating for
  both new routes, coordinate validation, upsert-replaces-the-previous-fix, and
  the lifecycle rules (leaving `on_the_way` clears the position; `on_the_way`
  keeps it).

### Fixed
- **"Could not reach the server to share your location" now reports what actually
  failed** (`frontend/src/services/providerTracking.ts`,
  `ProviderLocationPublisher.tsx`,
  `frontend/src/screens/provider/ProviderDetailScreen.tsx`) — every failed
  position publish used one generic line, which hid the case it hit in practice:
  an app build that knows the tracking route talking to a backend that has not
  been deployed with it yet (the publish 404s, and now says so). A booking the
  server no longer treats as on-the-way, one it does not recognise for this
  provider, an expired session and a genuine network failure are each named
  separately. Sharing keeps retrying on the 20 s job poll, so it recovers on its
  own once the backend catches up — no app restart needed.

## 2026-10-18

### Added
- **Live provider tracking on the customer's Track screen**
  (`frontend/src/components/LiveMap.tsx`, `ProviderLocationPublisher.tsx`,
  `frontend/src/screens/customer/TrackingScreen.tsx`,
  `backend/app/routers/provider.py`) — while a job is assigned, on the way or
  in progress, the customer now sees an OpenStreetMap (Leaflet, free — no API
  key/billing) with the service address, a pulsing marker for the
  professional's live position, road distance and an ETA estimate (~20 km/h
  city average). The customer screen polls every 15 s. When both the service
  address and the professional's position are known the tracking screen
  renders the map full-bleed, Blinkit-style: floating status card and a
  pulsing "live" distance/ETA pill on top, professional, progress timeline and
  booking details docked in a rounded bottom sheet; otherwise the classic
  stacked layout is kept. The map stack is fully free — OpenStreetMap tiles
  on Leaflet, a pulsing provider marker, a solid green OSRM road-route line
  (with a dashed straight-line fallback) and an OSRM-miss ETA floor; no API
  key or billing account is involved anywhere. A "Navigate to Customer"
  button on the provider's job screen hands off to the Google Maps app for
  real turn-by-turn directions (a plain deep link, not the Maps API). On the
  provider side an
  invisible publisher (mounted for the provider role) watches GPS via
  `watchPosition` and posts coordinates with the 30 s heartbeat whenever an
  active job exists — `POST /provider/heartbeat` now accepts an optional
  `latitude`/`longitude` pair and stores them on the professional row.
  Tracking reflects the provider's position only while the provider app is
  open (foreground), the same v1 limitation most of the category ships with.

### Fixed
- **Past-dated bookings no longer linger under Upcoming**
  (`frontend/src/hooks/useBookings.ts`) — the Upcoming tab previously filtered
  only by status (`confirmed`/`assigned`) and ignored the schedule, so bookings
  whose service date had already passed stayed there indefinitely. A
  confirmed/assigned booking whose `scheduled_date` is before today is now
  shown as completed (Completed tab, "Completed" badge, Rate/Invoice/Refund
  actions), the Upcoming tab only lists bookings from today onward, and the
  Upcoming list is sorted soonest-first.
- **Booking card action buttons fit inside the card**
  (`frontend/src/screens/customer/MyBookingsScreen.tsx`) — the
  Cancel / Reschedule / Track (and Rate Service / Invoice / Refund) rows used
  the default button size whose `px-4` padding pushed the Track button past
  the card edge on narrow screens. Buttons now use the `sm` size, `min-w-0`
  and truncating labels, so the rows always stay inside the card.

## 2026-10-17

### Added
- **Proper referral system**
  (`backend/app/routers/customer.py`, `20261017010000_add_referrals.sql`,
  `frontend/src/screens/customer/ProfileScreen.tsx`) — the profile card's
  placeholder is now a real program: every customer gets a permanent `LS…`
  referral code (assigned lazily, stored on `profiles.referral_code`),
  claiming a friend's code issues the referee a Rs 100 first-booking coupon
  and the referrer a Rs 100 general coupon through the existing coupons
  machinery, subject to no-self-referral and one-claim-per-account
  (`UNIQUE(referrals.referee_phone)`). Sharing uses the Web Share API with a
  clipboard fallback; an admin `/admin/referrals` listing exists.

### Fixed
- **Security & invoice correctness hardening** (deep audit) — `verify_token`
  no longer surfaces PyJWT internals to the client (clean 401);
  `DELETE /admin/professionals/{id}` now 404s on a missing id before it
  deletes or audits; `GET /provider/dashboard`'s "today" is computed in UTC to
  match how `created_at` is written (was server-local, splitting the day at
  the wrong midnight for IST); the invoice now prices from the booking's
  stored fields (`base + visit + priority - discount`), shows a Priority fee
  line and a discount line with the coupon code, and can never claim more
  than `total_amount`; provider renderer gains the missing `help` case; CORS
  is env-driven via `CORS_ORIGINS` (wildcard fallback preserved); dead
  `ADMIN_CREDENTIALS` const replaced by display literals.

## 2026-10-14

### Changed
- **"This number is not registered yet" auto-hides**
  (`frontend/src/screens/customer/AuthScreen.tsx`,
  `frontend/src/screens/provider/ProviderAuthScreen.tsx`) — when a login attempt
  is refused because the number is not on file, the app still switches to the
  signup form and shows the note, but the note now clears itself after 5 seconds
  instead of staying until the next action. A `flashNotice` helper owns the
  timer and only clears the exact message it set, so a newer error is never
  wiped early, and the timer is cleared on unmount.

### Fixed
- **Mobile number validation no longer fires while typing**
  (`frontend/src/screens/customer/AuthScreen.tsx`,
  `frontend/src/screens/provider/ProviderAuthScreen.tsx`) — the "invalid
  number" state is now gated behind a `phoneTouched` flag that is set on blur,
  so the field no longer flags a number as bad while the user is still entering
  the remaining digits of a 10-digit mobile number. The flag resets when
  switching between the login and signup steps.

## 2026-10-13

### Changed
- **Phone bottom navigation spacing** (`frontend/src/components/BottomNav.tsx`) —
  the phone bottom nav no longer looks cramped on small screens: side padding was
  widened (`px-[max(0.75rem,env(safe-area-inset-left))]`), the bar is taller
  (`min-h-[calc(4.25rem+env(safe-area-inset-bottom))]`), each tab keeps a >=52px
  touch target and the label uses a fixed `11px` size with tight tracking instead
  of a viewport-scaled `2.8vw` size (PR #69).
- **APK release is now hands-off** (`.github/workflows/android-apks.yml`) — on
  merge to `master` the workflow builds both signed APKs and publishes them to
  the release for the current `versionName`: it creates `v<versionName>` if it is
  new, and refreshes that release's assets if it already exists. The app version
  is left untouched — the workflow always publishes whatever
  `android/version.properties` declares.

### Removed
- **CodeQL workflow** (`.github/workflows/codeql.yml`) — code scanning is not
  enabled for this repository, so the workflow only produced failing runs.

## 2026-10-11

### Added
- **Provider dark/light theme** (`frontend/src/screens/provider/*`) — the same
  Moon/Sun toggle was added to the **provider Profile** top bar, and the
  provider experience is now fully dark-aware: Auth (signup/OTP inputs), Home
  requests feed (earnings strip, stat cards, request/active-job cards, pills,
  skeletons), Bookings (tabs + rows), Earnings (statement, period tabs,
  overview chart & tooltip, tables), Profile (header, stats, availability,
  KYC card, radius chips, menu rows, all sheets — services/pricing/reviews/
  bank) and the booking detail screen. Emerald/gradient accents and white-on-
  gradient text are untouched.
- **Customer dark/light theme** — new `CustomerThemeProvider`
  (`frontend/src/context/ThemeContext.tsx`) toggles the `dark` class on
  `<html>` and persists the choice in `localStorage` (`luckyseva.theme`).
  Class-based `dark:` variant enabled via `@custom-variant` in
  `frontend/src/index.css`. A round Moon/Sun toggle button was added to the
  **Profile** top bar (right side); the menu does not duplicate it. Dark
  styling covers the whole Profile screen (profile card, edit inputs, location
  card, menu items, refer banner, payment/settings sheets, logout) plus the
  shared chrome it sits on — `TopBar`, `BottomNav`, `Card`, and
  outline/ghost `Button` variants. Colors, icons, labels and routes are
  unchanged; light mode is byte-identical to before.
- **Booking rescheduling** — customers can move a not-yet-started booking:
  - New `PUT /customer/bookings/{id}/reschedule` (`backend/app/routers/customer.py`):
    owner-only, validates the new `scheduled_date`/`scheduled_time`, rejects past
    dates and past/in-progress bookings, and applies the update with a
    status-guarded chain (`neq` on `on_the_way`/`started`/`completed`/`cancelled`)
    so a concurrent provider action can't be overwritten. The assigned
    professional and the customer are both notified.
  - New **Reschedule** button on Upcoming (`confirmed`/`assigned`) booking cards in
    My Bookings (`frontend/src/screens/customer/MyBookingsScreen.tsx`) with a
    date-picker + time-picker dialog; date is floored to today and errors from the
    API are shown inline.
- **Refund visibility on cancelled bookings**
  (`frontend/src/screens/customer/MyBookingsScreen.tsx`):
  - Cancelled (and completed) bookings whose payment was taken now show a refund
    badge on the card — **Refund pending** (amber) / **Refunded** /
    **Partially refunded** (green) — driven by `payment_status`.
  - A cancelled booking that was actually paid (`payment_status` `paid`/`cash`)
    gets a **Request Refund** button, so a paid booking no longer refunds
    only via the admin console silently.
  - The cancel confirmation dialog now tells the customer that the money they
    paid will be returned.

### Fixed
- **Bottom navigation stability on all phone sizes** — app shells in
  `PhoneShell.tsx` now use `h-screen` with a `supports-[height:100dvh]:h-dvh`
  upgrade, so older Android WebViews that lack `dvh` no longer collapse the
  layout and push `BottomNav` off-screen. `BottomNav` gained `z-10`, a
  `min-h-[calc(3.75rem+env(safe-area-inset-bottom))]` guard and 48px+ touch
  targets per tab, keeping it always visible, evenly spaced and clear of
  Android gesture/3-button navigation on small, medium and large screens.
  Page-level scroll is locked (`html, body, #root { height: 100%; overflow:
  hidden }` in `index.css`) so the nav never shifts while screens scroll
  internally.
- ** Booking cancellation couldn't be called.** The customer cancel endpoint
  declared `body: dict` as a *required* FastAPI body, while the app sent the PUT
  with no body at all — every request failed with `422 Field required` before any
  cancel logic ran. The body is now optional
  (`backend/app/routers/customer.py`), a blank/missing `reason` falls back to
  "Cancelled by customer", and the client sends `{}` with the PUT
  (`frontend/src/services/api.ts`).

### Tests
- New `backend/tests/test_booking_reschedule.py` (8 cases): happy path, past-date
  rejection, same-schedule rejection, late statuses (`on_the_way`/`started`/
  `completed`/`cancelled`) refusal, blank time, malformed date.

## 2026-10-10

### Changed
- **Provider My Bookings** (`frontend/src/screens/provider/ProviderBookingsScreen.tsx`) tab
  order was re-worked to match how a provider actually uses the screen: the former
  `All | Completed | Cancelled` order is now **`Upcoming | Completed | Cancelled | All`**,
  and the screen opens on **Upcoming** instead of All. Upcoming collects every
  not-yet-finished job (`confirmed`/`assigned`/`on_the_way`/`started`) — the `mine`
  endpoint accepts only one server-side status, so the tab filters client-side on the
  full list, while Completed/Cancelled keep the server-side fetch and All shows
  everything. Rows, badges and styles are unchanged.
- **Provider Requests dashboard** (`frontend/src/screens/provider/ProviderHomeScreen.tsx`) —
  the screen a provider lands on by default — was polished to a marketplace-grade feed:
  - The earnings snapshot (Today's Earnings / Jobs Done / This Week) returned for
    everyone, responsive by design: a compact 3-up white strip on phones/tablets and
    the gradient + white stat cards on desktop.
  - Request cards were rebuilt: gradient service icon, pulsing-dot **NEW** badge,
    earnings amount chip, an expiry chip (`5m left`) that turns red with a fast pulse
    in the final 3 minutes, a green accent edge on requests inside the provider's
    radius, and hover micro-animations on desktop. The Accept button is now an
    emerald→teal gradient.
  - Active-job cards gained a status ring icon, a status chip (Accepted / On the way /
    In service) beside the amount, and hover chevron motion.
  - The flat spinner was replaced with skeleton cards shaped like the feed, and the
    "No new requests" state became a compact card with a **Check again** refresh
    button instead of the tall shared `EmptyState`.
  - Section headings carry colored count pills (sky for Active, emerald for New
    Requests) and the sort chips are a segmented control matching the earnings
    screen's tabs. On phones the vertical rhythm was tightened so the New Requests
    section — and its Check again button — is visible without scrolling.
  - All logic is unchanged: hooks, accept/decline flows, radius filtering and sorting.
- **Provider Earnings** redesigned the earnings bar chart
  (already shipped as PR #63; noted here for the same date):
  - Bars are green gradient columns that rise from the baseline with a staggered
    animation (new `barRise` keyframe in `frontend/src/index.css`); today's bar is
    highlighted with a stronger gradient and glow, and the best-earning bar gets a
    teal tint.
  - The three tabs now show per-day bars for **Week**, per-date bars for the full
    **Month** (31 columns, today always labelled), and per-month bars for **Year**.
    Bar columns are centred exactly above their day/date label.
  - All `₹` labels were removed from the Y-axis and every horizontal grid line is
    gone — the plot is just bars, labels and a solid baseline. Hover tooltips above
    each bar show the amount (with the date in the Month view).
  - The card header shows the period total plus a **+X% / -X% vs prev
    week/month/year** badge computed from the previous period's completed bookings,
    and the footer shows the best day and the average earning per day/month.

## 2026-10-03

### Added
- Full service catalog at market rates (`20261003000000_full_catalog_market_rates.sql`):
  every category is filled out — 26 services became **182** across **15** categories.
  Prices are Indian at-home market rates (visit included, parts excluded), and the
  26 pre-existing services were re-priced to match; only two actually moved
  (`Full House Wiring` ₹4999→₹7999, `1 BHK Painting` ₹4999→₹5999).
- Four categories a home-services platform is expected to have:
  **Packer & Mover**, **CCTV & Security**, **Laundry & Dry Cleaning**, **Lawn & Garden**.
  `other` moved to `sort_order` 15 so it stays the catch-all.
- `links.cheapest_in_category()` seeds a new professional's `starting_price` from the
  cheapest service in their category instead of the hardcoded `99`, so the "from ₹X"
  shown in the professional list matches what the booking actually charges. Applied to
  both provider signup and admin-created providers.
- `category_for()` on the backend gained the missing `physiotherapy` branch plus branches
  for the four new categories, bringing it in line with `ProviderAuthScreen.categoryFor`.
- **Services Offered** (`GET`/`PUT /provider/services`): a professional now narrows their
  trade to the work they actually do. The signup flow is unchanged — it still links every
  service of the chosen category so the provider is immediately bookable — and
  **Profile → Services Offered** is where the selection is made: a checkbox per service,
  Select all / Clear, a selected count, and a save button that only enables on a change.
  `set_professional_services()` in `backend/app/links.py` refuses an empty selection and
  any service outside the provider's own trade, keeps a hand-set price on services that
  stay selected, and re-derives `professionals.starting_price` from what is left. Because
  both customer reads join through `professional_services`, a deselected service vanishes
  from the public profile and from that service's provider list.
- `PUT /provider/trade`, so a professional can set **or change** their own trade without an
  admin. The trade badge in the sheet header opens the trade list, a confirmation dialog
  explains that the previous services are dropped, and the list reloads so the sheet only
  ever shows the current trade's services.
- Requests are routed only to professionals of that field: `_field_filter()` narrows the
  provider feed and booking lookup by `professional_services`, falling back to
  `category_slug` for professionals who have no links yet.

### Fixed
- The customer's phone number is no longer handed to every provider who can see a request.
  It is released only once a provider accepts the job — before that, the request shows
  without a number, so the shared feed cannot be used to farm leads.
- Duplicate service rows. `20260830093336_luckyseva_schema.sql` seeds with a bare
  `ON CONFLICT DO NOTHING`, which can never fire against a table with no unique
  constraint — so re-applying the migration set inserted its 21 services a second time.
  Any database built by applying the set twice (exactly what CI does) had each of them
  listed twice. Repaired in the new migration with an aliased `DELETE ... USING`, keeping
  the lowest id per name.
- `professionals.starting_price` still held the `99` signup default on existing rows and
  is rendered directly by `ProfessionalListScreen`, `ServiceDetailScreen` and
  `FavouritesScreen`. It is now resynced to each professional's category minimum.
- `professional_services.price` no longer drifts from `services.starting_price`; the new
  migration re-mirrors it (the earlier backfills used `ON CONFLICT DO NOTHING`, so they
  never refreshed an existing row).
- The `TRENDING` search chip "Salon at Home" matched nothing — the service is called
  "Salon Prime for Women". Replaced with terms that resolve against real service names.
- A failed load of the provider's services used to render as "your trade has no services",
  which sent the provider off to re-pick a trade that was in fact fine. The sheet now
  distinguishes a failed load (message plus Retry) from a genuinely empty trade.
- Re-selecting an already linked service raised `insert() got an unexpected keyword
  argument 'on_conflict'`: PostgREST's insert has no conflict handling, so the
  `professional_services` writes go through `upsert(..., ignore_duplicates=True)`, which is
  idempotent on the `(professional_id, service_id)` unique key.
- `test_provider_service_selection.py` seeds fresh rows per test. It reused the module-level
  constants, so a test that added a second trade leaked it into the following ones.

## 2026-10-01

### Added
- Shared `AddressForm` component (`frontend/src/components/AddressForm.tsx`) and an
  address domain module (`frontend/src/services/address.ts`) — composing, parsing and
  validation now live in one place and are shared by the booking flow and the
  saved-address screen instead of being duplicated.
- Address validation: every field required, pincode must be 6 digits, with per-field
  errors and a "Please complete: …" summary. The booking flow's Continue button now
  reveals the errors instead of sitting disabled with no explanation.
- `bookings.address_id` (`20260928000000_booking_address_link.sql`) links a booking to
  the saved address it used; the id is ownership-checked server side.
- State field is backed by a datalist of Indian states and union territories, and the
  add-address form has Home/Work/Other label shortcuts.
- Initial project documentation: `README.md` (setup guide) and this `CHANGELOG.md`.
- `.env.example` template for Supabase configuration.
- Provider create-account page with signup (details + OTP) and login.
- Admin login screen with username/password.
- Admin profile page with account settings, platform stats and logout.
- Shared OTP component (`OtpInput.tsx`) with resend countdown, paste support
  and auto-advance, used by both customer and provider auth.
- Removed the unused `.bolt` folder.
- **Full-app Supabase wiring:** every button/action across the customer,
  provider and admin apps now persists to real Supabase tables (no fake data).
- New platform tables via `20260830093400_luckyseva_platform_tables.sql`:
  `profiles`, `favourites`, `addresses`, `notifications`, `support_tickets`,
  `payouts`, `admin_settings`, `audit_logs`, plus `bookings.payment_status`.
- Session persistence in `localStorage` for customer identity, provider identity
  (`providerId`) and admin auth; `setRole` now routes to the correct home based
  on stored identity.
- Customer OTP verification upserts a real `profiles` row; provider OTP inserts
  a `professionals` row (or logs in by phone); Google-style demo sign-in creates
  real rows for both.
- New `useNotifications`/`useUnreadNotifications` (bell badge on Home),
  `useFavourites`/`useIsFavourite`/`toggleFavourite`, `useProfessionalWithFallback`,
  `usePayouts`, `useSupportTickets`, `useAllBookings`, `insertBookingNotification`.
- `NotificationsScreen` rewritten to list real notifications with mark-as-read
  and booking tracking navigation.
- New `FavouritesScreen` (list, open profile, remove).
- `AddressesScreen` rewritten with real CRUD + set-default on `addresses`.
- `HelpScreen` rewritten with `tel:`/`mailto:` links and in-app chat that inserts
  `support_tickets`.
- `ProfileScreen` rewritten: inline profile edits (`profiles`), payment-methods
  sheet, settings toggles, Refer & Earn clipboard copy, real favourites/unread
  counts, all menu items wired.
- `ReviewScreen` now recomputes the professional's aggregate rating and
  `reviews_count` after submitting.
- `ProviderHomeScreen` rewritten: real today stats, Accept/Reject persist booking
  status and insert provider/customer notifications.
- `ProviderEarningsScreen` rewritten: real weekly earnings chart, Withdraw inserts
  `payouts`, statement modal with payout history.
- `ProviderDetailScreen`: `on_the_way`/`completed` status updates with
  notifications, `completed_jobs` increment, payment status display.
- `ProviderProfileScreen` rewritten: availability toggle persists, sheets for
  services, pricing (`starting_price`), ratings, bank details and settings.
- `BookingFlowScreen`: payment-method selection, `payment_method`/`payment_status`
  persisted, online payments route to `PaymentScreen`, booking notification created.
- `PaymentScreen.pay()` updates payment method/status and inserts a payment
  notification.
- Admin console additions: Add Provider / Add Service modals
  (`professionals`/`services` inserts), Export CSV (all bookings) and a working
  Audit Log; AdminProfile now changes admin password, commission,
  notifications toggles and name/email — all persisted to `admin_settings` and
  logged to `audit_logs`.
- Shared `Modal` component in `AdminScreens.tsx` for all admin dialogs.
- **New `physiotherapy` service category** via
  `20260927000000_add_physiotherapy_category.sql`: category row
  (lucide `Activity`, purple) plus 5 starter services (home session, back &
  neck pain relief, sports injury rehab, post-surgery rehabilitation, knee &
  joint pain therapy). `other` is pushed to the end of the sort order, and
  existing physios are linked to the new services.
- Provider signup now maps physio/physiotherapy/rehab/exercise/massage
  professions to the `physiotherapy` category instead of `other`.

### Changed
- **Only a registered number can log in.** `POST /auth/request-otp` and
  `POST /auth/verify-otp` now take a `mode` (`login` / `signup`, default `signup`).
  In `login` mode an unregistered number is refused with `404` +
  `code: "signup_required"` before any OTP is sent, and `verify-otp` no longer
  creates a profile row behind the caller's back. The app catches that code and
  switches the user to the signup form, phone number carried over — instead of the
  old behaviour where any number silently became a new account at verify time.
- Provider sign-in is now the default on the provider auth screen and asks for the
  phone number only; name, email and profession are collected on the signup form.
- Home and signup steps now render API error messages, which were previously
  computed and then silently dropped.
- Home screen location button navigates to real addresses; bell badge shows real
  unread count; coupon copy via clipboard; recent bookings filtered by the
  logged-in customer's phone.
- `TrackingScreen` calls the professional's saved phone, chat links to Help, and
  shows the payment status badge.
- `MyBookingsScreen` cancels now persist and send an alert notification.
- `ServiceDetailScreen` and `ProfessionalListScreen` compute ratings and filters
  from real `professionals` data (min rating / max price / experience / distance).
- Brand update:** logo changed from a letter mark to a **wrench icon** on an
  emerald rounded square, keeping the yellow accent dot.
- **Wordmark update:** `Lucky` now renders in **black** and `Seva` in **orange**
  (previously emerald).
- Added a matching `public/vite.svg` favicon for the new wrench logo.
- **Admin console reworked as a full-width web dashboard** (no longer confined
  to the phone mockup) with a dark sidebar, header bars, KPI cards, tables for
  customers/providers/services/bookings, and a dedicated dashboard overview.
- Admin dashboard now renders **real Supabase data only**; removed hardcoded
  chart values and placeholder badges (weekly revenue, deltas and KPIs are
  computed from actual bookings).
- Admin login layout redesigned as a split-card screen with a brand panel.

### Fixed
- A failed OTP check raised `OSError: Missing required env var: SUPABASE_URL` instead
  of the intended 400, because `verify_otp` built the Supabase client before validating
  the code. The client is now created only after the OTP is proven, so a wrong or expired
  code needs no database or environment configuration.
- `ApiError` responses can now carry a stable `code` alongside the human-readable
  `error`, and the web app's fetch wrapper keeps that code and the HTTP status instead
  of flattening every failure into a bare message.
- Saved addresses in the booking address step could not be clicked into a selected
  state. Selection was derived from comparing the recomposed form string against the
  stored `full_address`, so the highlight could fail to appear and a click looked like
  a no-op. Selection is now tracked by address id, and the default address is applied
  once per visit to the step instead of being skipped whenever the form already had
  leftover values.
- `splitAddress` no longer shifts fields into each other for addresses that omit the
  state or pincode — `"12, Baner, Pune"` used to parse as area `"12"`, city `"Baner"`,
  state `"Pune"`. Fields are now identified by content, and state abbreviations and
  older spellings (`MH`, `Orissa`) are recognised.
- Deleting your default address left you with no default at all: the delete endpoint
  selected a replacement id into an unused variable and never set `is_default`. It now
  promotes the newest remaining address.
- A booking can no longer be linked to another customer's saved address; the
  `address_id` sent on booking creation is checked against the caller's phone.
- Admin login landed on an intermediate "Admin signed in" screen instead of the
  dashboard; the "Continue to Dashboard" button also reset navigation. Login now
  navigates straight to the admin dashboard.
- Removed the demo credentials hint from the admin login screen.
- `Wordmark` text colour is now customisable, fixing low contrast on the admin
  login brand panel.
- Professional phone backfill now generates a valid random 10-digit number
  (previously used an md5 hex string that could not be dialled).
- Removed the fake static `audit_logs` seed from the migration.
- `Payout.status` type union now includes `'requested'`, matching the database
  default.
- Removed unused imports/variables across screens that failed linting
  (Favourites, ProfessionalProfile, Profile, ProviderEarnings).
