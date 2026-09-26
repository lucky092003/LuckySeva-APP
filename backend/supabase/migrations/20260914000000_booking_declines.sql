-- Per-provider request declines.
-- When several providers see the same open request, a single provider can decline it
-- without cancelling the booking: accepting assigns the booking (removing it for
-- everyone), declining only hides it from that provider.

CREATE TABLE IF NOT EXISTS booking_declines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_declines_pro ON booking_declines (professional_id, booking_id);

ALTER TABLE booking_declines ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text := 'booking_declines';
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS "anon_select_%I" ON %I', t, t);
  EXECUTE format('CREATE POLICY "anon_select_%I" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
  EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%I" ON %I', t, t);
  EXECUTE format('CREATE POLICY "anon_insert_%I" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
  EXECUTE format('DROP POLICY IF EXISTS "anon_update_%I" ON %I', t, t);
  EXECUTE format('CREATE POLICY "anon_update_%I" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
  EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%I" ON %I', t, t);
  EXECUTE format('CREATE POLICY "anon_delete_%I" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
END $$;