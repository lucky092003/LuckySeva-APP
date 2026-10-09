# LuckySeva — Database Schema Documentation

**Supabase PostgreSQL** — All timestamps are `timestamptz` (timezone-aware UTC).

---

## 1. Entity Relationship Diagram (Conceptual)

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────────┐
│ categories  │───────│     services     │───────│professional_svc │
└─────────────┘       └──────────────────┘       └────────┬────────┘
                                                          │
                                                          │
┌─────────────┐       ┌──────────────┐       ┌──────────┴───────┐
│  profiles   │       │   bookings   │       │  professionals   │
│ (phone=PK)  │───────│              │───────│                  │
└─────────────┘       └──────┬───────┘       └──────────────────┘
                              │
                              │
              ┌───────────────┼───────────────┐
              │               │               │
       ┌──────┴─────┐  ┌──────┴──────┐  ┌────┴────────┐
       │  reviews   │  │  addresses  │  │ notifications│
       └────────────┘  └─────────────┘  └──────────────┘

       ┌────────────┐  ┌───────────┐  ┌───────────┐
       │ favourites │  │payouts    │  │ coupons   │
       └────────────┘  └───────────┘  └───────────┘
```

---

## 2. Core Tables

### 2.1 `categories`

Service categories (Electrician, Plumber, AC Repair, etc.)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `name` | `text` | NOT NULL | Display name |
| `slug` | `text` | UNIQUE, NOT NULL | URL-safe identifier |
| `icon` | `text` | NOT NULL | Lucide icon name |
| `color` | `text` | NOT NULL | Hex color code |
| `description` | `text` | NOT NULL DEFAULT `''` | |
| `sort_order` | `int` | NOT NULL DEFAULT 0 | Display order |
| `commission_pct` | `numeric` | NULL | Per-category commission override |
| `commission_enabled` | `boolean` | DEFAULT false | Whether custom commission applies |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:**
- `categories_slug_unique` UNIQUE on `slug`

**Seed Data:** 15 categories including electrician, plumber, ac-repair, cleaning, carpenter, painting, appliance-repair, beauty-salon, pest-control, and more.

---

### 2.2 `services`

Concrete services offered under each category.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `category_id` | `uuid` | FK → `categories(id)` ON DELETE CASCADE | |
| `name` | `text` | NOT NULL | |
| `description` | `text` | NOT NULL DEFAULT `''` | |
| `starting_price` | `numeric` | NOT NULL DEFAULT 0 | Base price in INR |
| `estimated_duration` | `text` | NOT NULL DEFAULT `''` | e.g., "45 mins", "2 hrs" |
| `popular` | `boolean` | NOT NULL DEFAULT false | Show on home screen |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:**
- `idx_services_category` on `category_id`

**Note:** No unique constraint on `name`. Seeds use `WHERE NOT EXISTS` guard.

**Seed Data:** 182 services across all categories, priced at Indian market rates.

---

### 2.3 `professionals`

Service provider profiles. **Phone is stored here, not in profiles.**

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `name` | `text` | NOT NULL | |
| `phone` | `text` | NOT NULL | Contact number |
| `email` | `text` | NULL | |
| `category_slug` | `text` | NOT NULL | Trade/category |
| `skills` | `text[]` | NOT NULL DEFAULT `{}` | Array of skill keywords |
| `experience_years` | `int` | NOT NULL DEFAULT 0 | |
| `rating` | `numeric` | NOT NULL DEFAULT 0 | 0.0 - 5.0 |
| `reviews_count` | `int` | NOT NULL DEFAULT 0 | Denormalized count |
| `completed_jobs` | `int` | NOT NULL DEFAULT 0 | Denormalized count |
| `starting_price` | `numeric` | NOT NULL DEFAULT 0 | Floor price |
| `avatar_url` | `text` | NOT NULL DEFAULT `''` | |
| `distance_km` | `numeric` | NOT NULL DEFAULT 0 | Stored (not computed) distance |
| `status` | `text` | NOT NULL DEFAULT `'available'` | `available` or `busy` |
| `bio` | `text` | NOT NULL DEFAULT `''` | |
| `service_area` | `text` | NOT NULL DEFAULT `''` | Free-text area name |
| `latitude` | `numeric` | NULL | Provider's location |
| `longitude` | `numeric` | NULL | Provider's location |
| `service_radius_km` | `int` | NOT NULL DEFAULT 60 | Matching radius |
| `kyc_status` | `text` | NULL | `pending`, `approved`, `rejected` |
| `kyc_doc_type` | `text` | NULL | `aadhaar`, `pan`, `voter`, `driving` |
| `kyc_doc_number` | `text` | NULL | Document number (uppercase) |
| `kyc_submitted_at` | `timestamptz` | NULL | |
| `kyc_reviewed_at` | `timestamptz` | NULL | |
| `kyc_review_note` | `text` | NULL | Admin note |
| `accepting_jobs` | `boolean` | NULL | Online toggle |
| `last_seen_at` | `timestamptz` | NULL | |
| `bank_upi_id` | `text` | NULL | UPI for payouts |
| `bank_account` | `text` | NULL | Bank account for payouts |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:**
- `idx_professionals_category` on `category_slug`
- `idx_professionals_kyc_status` PARTIAL on `(kyc_status)` WHERE `kyc_status = 'pending'`

---

### 2.4 `professional_services`

Many-to-many junction table linking professionals to services they offer (with custom pricing per provider).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `professional_id` | `uuid` | FK → `professionals(id)` ON DELETE CASCADE | |
| `service_id` | `uuid` | FK → `services(id)` ON DELETE CASCADE | |
| `price` | `numeric` | NOT NULL DEFAULT 0 | Provider's price for this service |

**Constraints:**
- UNIQUE `(professional_id, service_id)`

**Indexes:**
- `idx_prof_services_prof` on `professional_id`
- `idx_prof_services_service` on `service_id`

---

### 2.5 `bookings`

Customer bookings with full lifecycle tracking.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `customer_name` | `text` | NOT NULL | Denormalized from profile |
| `customer_phone` | `text` | NOT NULL | FK to `profiles.phone` (no constraint) |
| `customer_address` | `text` | NOT NULL | Full address string |
| `address_id` | `uuid` | FK → `addresses(id)` ON DELETE SET NULL | Link to saved address |
| `service_id` | `uuid` | FK → `services(id)` ON DELETE SET NULL | |
| `service_name` | `text` | NOT NULL | Denormalized |
| `professional_id` | `uuid` | FK → `professionals(id)` ON DELETE SET NULL | NULL = auto-assign |
| `professional_name` | `text` | NOT NULL | Denormalized, `'Auto-assign'` for open |
| `scheduled_date` | `date` | NOT NULL | Booking date |
| `scheduled_time` | `text` | NOT NULL | Time slot string |
| `notes` | `text` | NOT NULL DEFAULT `''` | |
| `base_price` | `numeric` | NOT NULL DEFAULT 0 | Service base price |
| `visit_fee` | `numeric` | NOT NULL DEFAULT 0 | Platform visit fee |
| `priority_fee` | `numeric` | NOT NULL DEFAULT 0 | Surcharge for top-N picks |
| `discount_amount` | `numeric` | NOT NULL DEFAULT 0 | Coupon discount |
| `coupon_code` | `text` | NULL | Applied coupon |
| `commission_pct` | `numeric` | NOT NULL DEFAULT 0 | Frozen at booking time |
| `platform_fee` | `numeric` | NOT NULL DEFAULT 0 | Platform's take |
| `provider_earnings` | `numeric` | NOT NULL DEFAULT 0 | Provider's take |
| `total_amount` | `numeric` | NOT NULL DEFAULT 0 | Final price |
| `payment_method` | `text` | NOT NULL DEFAULT `'cash'` | `cash`, `upi`, `card`, `netbanking` |
| `payment_status` | `text` | NOT NULL DEFAULT `'pending'` | `pending`, `paid`, `cash`, `refund_pending`, `refunded` |
| `settled_amount` | `numeric` | NULL | Amount actually collected |
| `refund_amount` | `numeric` | NULL | Refund issued |
| `status` | `text` | NOT NULL DEFAULT `'confirmed'` | See booking lifecycle |
| `accept_deadline` | `timestamptz` | NULL | When open request expires |
| `accept_expired_at` | `timestamptz` | NULL | When actually expired |
| `decline_count` | `int` | NOT NULL DEFAULT 0 | How many providers declined |
| `latitude` | `numeric` | NULL | Customer location for matching |
| `longitude` | `numeric` | NULL | Customer location for matching |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Status Lifecycle:**
```
confirmed → assigned → on_the_way → started → completed
                 ↓
             cancelled (customer cancels)
```

**Indexes:**
- `idx_bookings_status` on `status`
- `idx_bookings_professional` on `professional_id`
- `idx_bookings_open_confirmed` PARTIAL on `(created_at DESC)` WHERE `status = 'confirmed' AND professional_id IS NULL`

---

### 2.6 `reviews`

Customer reviews for completed services.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `booking_id` | `uuid` | FK → `bookings(id)` ON DELETE CASCADE, NULL | Optional link |
| `professional_id` | `uuid` | FK → `professionals(id)` ON DELETE CASCADE | |
| `customer_name` | `text` | NOT NULL | Profile name or phone |
| `rating` | `int` | NOT NULL DEFAULT 5, CHECK 1-5 | |
| `comment` | `text` | NOT NULL DEFAULT `''` | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Indexes:**
- `idx_reviews_professional` on `professional_id`

---

## 3. Customer Domain Tables

### 3.1 `profiles`

User profiles. **Phone is the PK** (not uuid).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `phone` | `text` | PK | 10-digit phone number |
| `name` | `text` | NOT NULL | Display name |
| `email` | `text` | NOT NULL DEFAULT `''` | |
| `location` | `text` | NOT NULL DEFAULT `''` | |
| `role` | `text` | NOT NULL, CHECK `IN ('customer', 'provider')` | Note: `admin` not valid here |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### 3.2 `addresses`

Customer saved addresses with coordinates.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `customer_phone` | `text` | NOT NULL | FK to `profiles.phone` |
| `label` | `text` | NOT NULL | `Home`, `Work`, `Other` |
| `full_address` | `text` | NOT NULL | Composed: `"House, Area, City, State, Pincode"` |
| `is_default` | `boolean` | NOT NULL DEFAULT false | Only one default per customer |
| `latitude` | `numeric` | NULL | From GPS or geocoding |
| `longitude` | `numeric` | NULL | From GPS or geocoding |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Invariant:** At most one `is_default = true` per `customer_phone`.

---

### 3.3 `notifications`

Push notification records.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `customer_phone` | `text` | NOT NULL | FK to `profiles.phone` |
| `type` | `text` | NOT NULL | `booking`, `alert`, `payment`, `provider`, `review` |
| `title` | `text` | NOT NULL | Notification title |
| `message` | `text` | NOT NULL | Body text |
| `booking_id` | `uuid` | FK → `bookings(id)` ON DELETE CASCADE, NULL | |
| `read` | `boolean` | NOT NULL DEFAULT false | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### 3.4 `favourites`

Customer ↔ Professional favorites relationship.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `customer_phone` | `text` | NOT NULL | FK to `profiles.phone` |
| `professional_id` | `uuid` | FK → `professionals(id)` ON DELETE CASCADE | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Constraints:**
- UNIQUE `(customer_phone, professional_id)`

---

### 3.5 `support_tickets`

Customer support requests.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `customer_phone` | `text` | NOT NULL | FK to `profiles.phone` |
| `message` | `text` | NOT NULL | |
| `status` | `text` | NOT NULL DEFAULT `'open'` | `open`, `resolved` |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### 3.6 `device_tokens`

FCM tokens for push notifications.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `role` | `text` | NOT NULL | `customer` or `provider` |
| `owner_id` | `text` | NOT NULL | Phone (customer) or professional_id |
| `token` | `text` | NOT NULL | FCM token |
| `platform` | `text` | NOT NULL DEFAULT `'web'` | `android`, `ios`, `web` |
| `last_seen_at` | `timestamptz` | NOT NULL | |

**Constraints:**
- UNIQUE on `token`

---

## 4. Financial Tables

### 4.1 `payouts`

Provider payout requests.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `professional_id` | `uuid` | FK → `professionals(id)` ON DELETE CASCADE | |
| `amount` | `numeric` | NOT NULL | Payout amount |
| `status` | `text` | NOT NULL DEFAULT `'requested'` | `requested`, `approved`, `completed`, `rejected`, `cancelled` |
| `reference` | `text` | NULL | UPI/bank reference after completion |
| `note` | `text` | NULL | Admin note |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### 4.2 `payments`

Payment transaction records.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `booking_id` | `uuid` | FK → `bookings(id)` ON DELETE SET NULL | |
| `amount` | `numeric` | NOT NULL | Payment amount |
| `method` | `text` | NOT NULL | `cash`, `upi`, `card`, `netbanking` |
| `status` | `text` | NOT NULL | `pending`, `completed`, `failed`, `refunded` |
| `gateway` | `text` | NULL | `razorpay`, etc. |
| `gateway_txn_id` | `text` | NULL | External transaction ID |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### 4.3 `refunds`

Refund requests and disputes.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `booking_id` | `uuid` | FK → `bookings(id)` ON DELETE SET NULL | |
| `customer_phone` | `text` | NOT NULL | FK to `profiles.phone` |
| `amount` | `numeric` | NOT NULL | Refund amount |
| `reason` | `text` | NOT NULL | Customer's reason |
| `status` | `text` | NOT NULL DEFAULT `'pending'` | `pending`, `approved`, `rejected`, `completed` |
| `note` | `text` | NULL | Admin resolution note |
| `source` | `text` | NULL | `auto` (expired) or `manual` (customer request) |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### 4.4 `coupons`

Discount coupons.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `code` | `text` | UNIQUE, NOT NULL | |
| `description` | `text` | NOT NULL DEFAULT `''` | |
| `discount_type` | `text` | NOT NULL | `percent` or `flat` |
| `discount_value` | `numeric` | NOT NULL | Discount amount |
| `min_amount` | `numeric` | NOT NULL DEFAULT 0 | Minimum booking amount |
| `max_discount` | `numeric` | NULL | Cap for percentage discounts |
| `category_slug` | `text` | NULL | Service category restriction |
| `max_per_phone` | `int` | NULL | Uses per customer |
| `first_booking_only` | `boolean` | NOT NULL DEFAULT false | |
| `usage_limit` | `int` | NULL | Total uses across all customers |
| `used_count` | `int` | NOT NULL DEFAULT 0 | |
| `active` | `boolean` | NOT NULL DEFAULT true | |
| `expires_at` | `timestamptz` | NULL | Expiration |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### 4.5 `coupon_redemptions`

Tracks coupon usage per customer.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `coupon_code` | `text` | NOT NULL | |
| `customer_phone` | `text` | NOT NULL | FK to `profiles.phone` |
| `booking_id` | `uuid` | FK → `bookings(id)` ON DELETE SET NULL | |
| `discount_amount` | `numeric` | NOT NULL | Actual discount given |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

## 5. Platform Tables

### 5.1 `admin_settings`

Key-value platform configuration.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `key` | `text` | PK | Setting key |
| `value` | `text` | NOT NULL | Setting value |

**Seed Data:**
| Key | Default Value |
|-----|--------------|
| `admin_password` | `admin123` |
| `admin_commission_pct` | `10` |
| `notify_email` | `on` |
| `notify_push` | `on` |
| `accept_deadline_minutes` | `300` |
| `auto_refund_minutes` | `1440` |
| `payout_min_amount` | `500` |
| `priority_fee` | `99` |
| `priority_top_n` | `5` |
| `platform_gst_pct` | `18` |

**Note:** `admin_email` is not seeded, so `verify_admin` falls back to identifier `"admin"`.

---

### 5.2 `audit_logs`

Admin action audit trail.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `action` | `text` | NOT NULL | Action identifier |
| `detail` | `text` | NOT NULL DEFAULT `''` | Human-readable detail |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Automatic writes:**
- `provider_add`, `provider_delete`, `provider_kyc`, `service_add`, `coupon_create`, `coupon_update`, `coupon_delete`, `commission_update`, `setting_update`

---

### 5.3 `booking_declines`

Per-provider decline tracker (prevents re-showing declined requests).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `booking_id` | `uuid` | FK → `bookings(id)` ON DELETE CASCADE | |
| `professional_id` | `uuid` | FK → `professionals(id)` ON DELETE CASCADE | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Constraints:** No unique constraint (same provider can "decline" same booking twice, idempotent upsert handles it).

---

### 5.4 `disputes`

Customer disputes (separate from refunds).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `booking_id` | `uuid` | FK → `bookings(id)` ON DELETE SET NULL | |
| `customer_phone` | `text` | NOT NULL | FK to `profiles.phone` |
| `reason` | `text` | NOT NULL | |
| `status` | `text` | NOT NULL DEFAULT `'open'` | `open`, `resolved` |
| `resolution` | `text` | NULL | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### 5.5 `push_outbox`

Queued push notifications (for retry/dead-letter).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `role` | `text` | NOT NULL | `customer` or `provider` |
| `owner_id` | `text` | NOT NULL | |
| `title` | `text` | NOT NULL | |
| `body` | `text` | NOT NULL | |
| `data` | `jsonb` | NULL | Extra payload |
| `status` | `text` | NOT NULL DEFAULT `'pending'` | `pending`, `sent`, `failed` |
| `attempts` | `int` | NOT NULL DEFAULT 0 | |
| `last_attempt_at` | `timestamptz` | NULL | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

## 6. PR Review Bot Tables

### 6.1 `pr_review_settings`

Per-repository bot configuration.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `repo_full_name` | `text` | PK | e.g., `owner/repo` |
| `enabled` | `boolean` | NOT NULL DEFAULT true | |
| `min_severity` | `text` | NOT NULL DEFAULT `'warning'` | `info`, `warning`, `blocker` |
| `comment_mode` | `text` | NOT NULL DEFAULT `'sticky'` | `sticky`, `new`, `dry_run` |
| `rules` | `text[]` | NULL | Allowlist of rule IDs (empty = all) |
| `block_on_blocker` | `boolean` | NOT NULL DEFAULT false | |
| `changelog_enabled` | `boolean` | NOT NULL DEFAULT true | |
| `changelog_branch` | `text` | NOT NULL DEFAULT `'luckyseva/changelog'` | |
| `changelog_file` | `text` | NOT NULL DEFAULT `'CHANGELOG.md'` | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |
| `updated_at` | `timestamptz` | DEFAULT `now()` | |

---

### 6.2 `pr_reviews`

Bot run history (one row per webhook event).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `repo_full_name` | `text` | NOT NULL | |
| `pr_number` | `int` | NOT NULL | |
| `head_sha` | `text` | NOT NULL | PR head commit |
| `verdict` | `text` | NOT NULL | `clean`, `findings`, `error` |
| `findings` | `jsonb` | NULL | Rule findings |
| `changelog_status` | `text` | NULL | `skipped`, `updated`, `created`, `error` |
| `changelog_pr_url` | `text` | NULL | Bot's changelog PR URL |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Constraints:**
- UNIQUE `(repo_full_name, pr_number, head_sha)`

---

### 6.3 `changelog_entries`

Source of truth for changelog generation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK | |
| `repo_full_name` | `text` | NOT NULL | |
| `pr_number` | `int` | NOT NULL | |
| `pr_title` | `text` | NOT NULL | |
| `pr_author` | `text` | NOT NULL | |
| `pr_url` | `text` | NOT NULL | |
| `kind` | `text` | NOT NULL, CHECK `IN ('added', 'fixed', 'changed')` | Derived from PR title prefix |
| `entry_date` | `date` | NOT NULL | PR creation date |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Constraints:**
- UNIQUE `(repo_full_name, pr_number)`

**Indexes:**
- `idx_changelog_entries_pr` on `(repo_full_name, pr_number)`
- `idx_changelog_entries_date` on `(repo_full_name, entry_date DESC)`

---

## 7. Row Level Security

All tables have RLS enabled with `TO anon, authenticated` policies that are `USING (true)`.

**Important:** The backend uses the **service role** which bypasses RLS entirely. Therefore, **all access control is enforced in the backend layer**, not in RLS policies.

**This is a known design trade-off** documented in `docs/brain.md`. Each `.eq("customer_phone", ...)` filter in route handlers is the actual access boundary.

---

## 8. Migrations

Migrations live in `backend/supabase/migrations/` and are applied in **filename order**.

**Migration Files:**

| File | Description |
|------|-------------|
| `20260830093336_luckyseva_schema.sql` | Core 6 tables, RLS, seed categories/services |
| `20260830093400_luckyseva_platform_tables.sql` | Platform tables, payments, admin_settings |
| `20260912000000_seed_professional_services.sql` | Backfill junction table |
| `20260913000000_provider_radius_matching.sql` | lat/lng columns, service_radius_km |
| `20260914000000_booking_declines.sql` | booking_declines table |
| `20260924000000_provider_kyc.sql` | KYC columns on professionals |
| `20260927000000_add_physiotherapy_category.sql` | 11th category |
| `20260928000000_booking_address_link.sql` | address_id on bookings |
| `20260929000000_pr_review_bot.sql` | PR review bot tables |
| `20260930000000_backfill_professional_services.sql` | Re-link junction table |
| `20260930000000_changelog_entries.sql` | changelog_entries table |
| `20261002000000_booking_priority_fee.sql` | priority_fee column |
| `20261003000000_full_catalog_market_rates.sql` | Full 182-service catalog |
| `20261005000000_platform_monetization.sql` | GST, disputes, push_outbox |

**Migration Rules:**
1. All migrations must be **idempotent** (CI applies twice)
2. Use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
3. CI **fails** on `DROP TABLE`, `TRUNCATE`, `DELETE FROM <table>;`
4. After adding a table, add the four `anon_*` policies or anon queries will return nothing

---

## 9. Key Design Decisions

1. **Phone as PK in `profiles`:** No uuid user IDs. JWT `sub` = phone.
2. **Service Role Bypasses RLS:** Backend connects with service role. Access control is in route handlers.
3. **Denormalized Booking Fields:** `customer_name`, `professional_name`, `service_name` stored directly for display without joins.
4. **Open Requests:** `professional_id = NULL` + `professional_name = 'Auto-assign'` marks a request as open.
5. **Coordinates for Matching:** `bookings.latitude/longitude` capture customer location for radius matching.
6. **Frozen Commission:** `bookings.commission_pct` frozen at booking time so historical records are accurate.
7. **No Pagination:** Hard limits on list endpoints, no offset/cursor pagination.
