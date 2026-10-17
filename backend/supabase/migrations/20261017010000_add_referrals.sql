-- ---------------------------------------------------------------------------
-- Referral program
-- ---------------------------------------------------------------------------
-- Phone-first identity makes referral codes simple: every customer owns one
-- code, stored on their `profiles` row, and "claiming" wires the two phones
-- together in `referrals` while the reward itself rides the existing coupons
-- machinery (`discount_for` already knows expiry, one-per-phone and
-- first-booking-only rules, so the program needs no money logic of its own).
--
-- Two rewards, issued at claim time:
--   referee  -> flat Rs 100 off the first booking (first_booking_only)
--   referrer -> flat Rs 100 off any booking (one use)
--
-- Existing profiles get no referral_code column value; the backend assigns one
-- lazily on first `/customer/referral/me` (or admin lookup), which avoids a
-- hand-rolled SQL uniqueness dance in this migration.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

-- One code per customer, and at most one — the partial unique index also keeps
-- the (very many) NULL rows for users who have never opened the referral card.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code
  ON profiles (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_phone text NOT NULL,
  referee_phone text NOT NULL,
  code text NOT NULL,
  -- 'rewarded' is the only state this version reaches (coupons are issued in
  -- the same request); 'pending' exists so a reward-after-first-booking rule
  -- can be introduced later without re-editing an applied migration.
  status text NOT NULL DEFAULT 'rewarded'
    CHECK (status IN ('pending', 'rewarded')),
  referrer_coupon_code text,
  referee_coupon_code text,
  created_at timestamptz DEFAULT now()
);

-- A new account can claim at most one referral — this index IS the rule.
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referee
  ON referrals (referee_phone);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON referrals (referrer_phone, created_at DESC);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['referrals']
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
