-- Live provider tracking for a journey that is underway.
--
-- Why not `professionals.latitude`? That column is the provider's *base*
-- location: the customer-facing radius matching and the provider's own feed
-- distance read it, so overwriting it with live travel coordinates rewrites
-- "who is nearby" with "where they happen to be driving". It is also a shared
-- profile row, so no policy could say which customer may read it.
--
-- A booking-scoped row has exactly one owner on each side, which is what makes
-- the policies below expressible.
--
-- Lifecycle: a row is written while the booking is `on_the_way` and deleted the
-- moment it moves on (started / completed / cancelled / declined), so a
-- position never outlives the journey it describes.

CREATE TABLE IF NOT EXISTS provider_tracking (
  booking_id uuid PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy_m numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_tracking_professional ON provider_tracking(professional_id);
CREATE INDEX IF NOT EXISTS idx_provider_tracking_customer ON provider_tracking(customer_phone);

-- Reads one claim out of the request JWT.
--
-- PostgREST publishes the verified claims as the `request.jwt.claims` GUC;
-- Supabase's own `auth.jwt()` is just a wrapper over it. Going to the GUC
-- directly keeps this migration applicable to the plain postgres:15 that CI
-- runs it against, where the `auth` schema does not exist. `missing_ok` plus
-- the NULL/exception guards make "no token" return NULL, which every policy
-- below treats as deny.
CREATE OR REPLACE FUNCTION luckyseva_jwt_claim(claim text)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE raw text;
BEGIN
  raw := coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    nullif(current_setting('request.jwt.claim', true), '')
  );
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN nullif(raw::jsonb ->> claim, '');
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

ALTER TABLE provider_tracking ENABLE ROW LEVEL SECURITY;

-- Deliberate exception to the `USING (true)` house style: a provider's live
-- GPS is not public data, so these four policies are ownership-scoped instead
-- of open. The names keep the convention, the bodies do not.
--
-- The service-role backend bypasses RLS entirely and its own `.eq(...)` filters
-- remain the real boundary; these exist so a client talking to Supabase
-- directly with a provider or customer token still cannot read or write
-- somebody else's position.

DROP POLICY IF EXISTS "anon_select_provider_tracking" ON provider_tracking;
CREATE POLICY "anon_select_provider_tracking" ON provider_tracking
  FOR SELECT TO anon, authenticated
  USING (customer_phone = luckyseva_jwt_claim('phone'));

DROP POLICY IF EXISTS "anon_insert_provider_tracking" ON provider_tracking;
CREATE POLICY "anon_insert_provider_tracking" ON provider_tracking
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    professional_id::text = luckyseva_jwt_claim('professional_id')
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = provider_tracking.booking_id
        AND b.professional_id = provider_tracking.professional_id
        AND b.status = 'on_the_way'
    )
  );

DROP POLICY IF EXISTS "anon_update_provider_tracking" ON provider_tracking;
CREATE POLICY "anon_update_provider_tracking" ON provider_tracking
  FOR UPDATE TO anon, authenticated
  USING (professional_id::text = luckyseva_jwt_claim('professional_id'))
  WITH CHECK (professional_id::text = luckyseva_jwt_claim('professional_id'));

DROP POLICY IF EXISTS "anon_delete_provider_tracking" ON provider_tracking;
CREATE POLICY "anon_delete_provider_tracking" ON provider_tracking
  FOR DELETE TO anon, authenticated
  USING (professional_id::text = luckyseva_jwt_claim('professional_id'));
