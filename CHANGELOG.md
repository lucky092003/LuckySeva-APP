# Changelog

All notable changes to **LuckySeva** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project documentation: `README.md` (setup guide) and this `CHANGELOG.md`.
- `.env.example` template for Supabase configuration.
- Provider create-account page with signup (details + OTP) and login.
- Admin login screen with username/password.
- Admin profile page with account settings, platform stats and logout.
- Shared OTP component (`OtpInput.tsx`) with resend countdown, paste support
  and auto-advance, used by both customer and provider auth.
- Removed the unused `.bolt` folder.

### Changed
- **Brand update:** logo changed from a letter mark to a **wrench icon** on an
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
- Admin login landed on an intermediate "Admin signed in" screen instead of the
  dashboard; the "Continue to Dashboard" button also reset navigation. Login now
  navigates straight to the admin dashboard.
- Removed the demo credentials hint from the admin login screen.
- `Wordmark` text colour is now customisable, fixing low contrast on the admin
  login brand panel.