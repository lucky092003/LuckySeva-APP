-- Monetization foundation: commission, coupons, payments, refunds, disputes,
-- provider availability, and the auto-assign accept deadline.
--
-- Everything the platform earns is derived here, never accepted from the client:
--   platform_fee    = commission_pct of the discounted total
--   provider_earnings = total_amount - platform_fee
-- stored per booking so the invoice, the provider's balance and the admin's
-- revenue report all read the same number.

-- ---------------------------------------------------------------------------
-- Commission, per category
-- ---------------------------------------------------------------------------
-- Each category carries its own take rate so cleaning can run at 8% while
-- emergency work runs at 15%, without a deploy between changes. NULL means
-- "fall back to the platform-wide admin_commission_pct setting".
ALTER TABLE categories ADD COLUMN IF NOT EXISTS commission_pct numeric;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS commission_enabled boolean NOT NULL DEFAULT true;

-- Backfill from the setting that already existed but was never read by any code.
UPDATE categories
SET commission_pct = NULLIF((SELECT value FROM admin_settings WHERE key = 'admin_commission_pct'), '')::numeric
WHERE commission_pct IS NULL
  AND EXISTS (SELECT 1 FROM admin_settings WHERE key = 'admin_commission_pct');

INSERT INTO admin_settings (key, value) VALUES
  ('platform_gst_pct', '18'),
  ('accept_deadline_minutes', '30'),
  ('auto_refund_minutes', '60'),
  ('payout_min_amount', '500'),
  ('payments_enabled', 'off')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Booking money columns
-- ---------------------------------------------------------------------------
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS discount_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS commission_pct numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_earnings numeric NOT NULL DEFAULT 0;
-- What the customer actually paid back, for cash bookings too, so the payout
-- balance is never inferred from an uncollected amount.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS settled_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount numeric NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Auto-assign accept deadline (#33)
-- ---------------------------------------------------------------------------
-- A request nobody takes must stop sitting in every provider's feed forever.
-- `accept_deadline` is when the offer lapses; `accept_expired_at` records that we
-- actually swept it, so the expiry is idempotent and auditable rather than a
-- silent time comparison that changes on every read.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accept_deadline timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS accept_expired_at timestamptz;
-- How many professionals said no. Surfaced to the customer so "no one took your
-- job" can be explained as "3 declined" instead of a silent stall.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS decline_count int NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- Provider availability (#24)
-- ---------------------------------------------------------------------------
-- `accepting_jobs` is the provider's own switch: off means new requests never
-- reach them. Kept separate from the legacy `status` ('available'/'busy') column
-- so existing reads of `status` keep working unchanged.
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS accepting_jobs boolean NOT NULL DEFAULT true;
-- When the provider app last polled. Drives the "Active now" badge and decides
-- who gets a push when a nearby request lands.
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
-- Where settlements go. Collected once, verified by admin before the first payout.
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bank_upi_id text;

-- ---------------------------------------------------------------------------
-- Coupons (#3)
-- ---------------------------------------------------------------------------
-- Promotions live in the database now instead of a client-side COUPONS map, so a
-- code can be created, paused and expired from the admin console, and the
-- discount actually lands in `bookings.total_amount`.
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  -- 'percent' discounts by a fraction (0.20 == 20% off); 'flat' by rupees.
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  -- Guard rails. `max_discount` caps a percent coupon so it can never exceed
  -- the platform's own margin on a high-value job.
  min_amount numeric NOT NULL DEFAULT 0,
  max_discount numeric,
  -- NULL means every category.
  category_slug text,
  -- NULL means unlimited uses by a given phone number.
  max_per_phone int,
  -- A single-use code, typically used to seed the three welcome offers.
  first_booking_only boolean NOT NULL DEFAULT false,
  usage_limit int,
  used_count int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code text NOT NULL,
  customer_phone text NOT NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  discount_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone ON coupon_redemptions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code ON coupon_redemptions(coupon_code);

-- ---------------------------------------------------------------------------
-- Payments (#1)
-- ---------------------------------------------------------------------------
-- One row per payment attempt. `payments.id` is what a Razorpay refund is
-- requested against, so it is kept even for cash bookings (provider='cash') to
-- give the payout ledger a single source of truth.
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  provider text NOT NULL DEFAULT 'cash',
  method text NOT NULL DEFAULT 'cash',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  gateway text NOT NULL DEFAULT 'cash',
  gateway_order_id text,
  gateway_payment_id text,
  -- Kept so a captured payment can always be re-verified against the gateway
  -- instead of trusting the status we happened to write down.
  gateway_signature text,
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  captured_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_phone ON payments(customer_phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_order ON payments(gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Refunds and disputes (#40)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  customer_phone text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  -- 'pending' until an admin approves; 'auto' means the platform refunded it
  -- without a human, which is only allowed inside auto_refund_minutes.
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  gateway_refund_id text,
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_phone ON refunds(customer_phone);

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
  customer_phone text NOT NULL,
  professional_id uuid REFERENCES professionals(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  resolution text NOT NULL DEFAULT '',
  -- What the customer is waiting on.
  refund_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- ---------------------------------------------------------------------------
-- Push delivery (#25)
-- ---------------------------------------------------------------------------
-- FCM is optional: with no credentials registered here the outbox still records
-- what would have been sent, so delivery can be audited instead of lost.
CREATE TABLE IF NOT EXISTS device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'customer',
  -- customers key on phone, providers on the professional id.
  owner_id text NOT NULL,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_owner ON device_tokens(role, owner_id);

CREATE TABLE IF NOT EXISTS push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL DEFAULT 'customer',
  owner_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- 'queued' when there is no FCM credential configured, 'sent' otherwise.
  status text NOT NULL DEFAULT 'queued',
  provider text NOT NULL DEFAULT 'fcm',
  error text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_outbox_status ON push_outbox(status);

-- ---------------------------------------------------------------------------
-- Payout lifecycle (#28 / #37)
-- ---------------------------------------------------------------------------
-- requested -> approved -> completed, with 'rejected' and 'cancelled' as the two
-- ways out. `settled_at` is when money actually moved, which is the only field
-- the provider's available balance is computed from.
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS settled_at timestamptz;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS settlement_ref text;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'bank';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_outbox ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['coupons','coupon_redemptions','payments','refunds','disputes','device_tokens','push_outbox']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_select_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_select_%I" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_insert_%I" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_update_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_update_%I" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%I" ON %I', t, t);
    EXECUTE format('CREATE POLICY "anon_delete_%I" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Seed: move the three hardcoded welcome coupons into the database
-- ---------------------------------------------------------------------------
-- Identical terms to what BookingFlowScreen.tsx used to enforce in the browser,
-- so no customer sees a price change at cutover.
INSERT INTO coupons (code, description, discount_type, discount_value, max_discount, category_slug, max_per_phone, first_booking_only)
VALUES
  ('LUCKY20', 'Flat 20% off your first booking', 'percent', 0.2, 300, NULL, 1, true),
  ('SEVA50', 'Flat Rs 50 off on any service', 'flat', 50, NULL, NULL, 2, false),
  ('CLEAN100', 'Rs 100 off on cleaning services', 'flat', 100, NULL, 'cleaning', 2, false)
ON CONFLICT (code) DO NOTHING;