# Changelog

**Last updated:** 2026-10-10

All notable changes to **LuckySeva** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Sections are headed by the date they were written (`## YYYY-MM-DD`), newest first. The
`Last updated` line above is maintained automatically by the PR review bot and always
matches the newest dated section.

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