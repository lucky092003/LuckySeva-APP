# Changelog

All notable changes to **LuckySeva** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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