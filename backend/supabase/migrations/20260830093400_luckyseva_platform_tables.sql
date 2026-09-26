/*
# LuckySeva — profile, engagement & operations tables

Extends the marketplace with:
- `profiles` — customer/provider accounts keyed by phone (session persistence).
- `favourites` — customer favourite professionals.
- `addresses` — saved customer addresses.
- `notifications` — per-customer notifications derived from booking events.
- `support_tickets` — in-app support chat messages.
- `payouts` — provider withdrawal requests.
- `admin_settings` — key/value platform settings (admin password, commission, toggles).
- `audit_logs` — admin action audit trail.
- `professionals.phone` / `professionals.email` — contact details for calling providers.
- `bookings.payment_status` — tracks online/cash payment state.

RLS is open (single-tenant demo), matching the existing schema.
*/

CREATE TABLE IF NOT EXISTS profiles (
  phone text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','provider')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favourites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (customer_phone, professional_id)
);

CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  label text NOT NULL DEFAULT 'Home',
  full_address text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  type text NOT NULL DEFAULT 'booking',
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_phone text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'requested',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE professionals ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_favourites_customer ON favourites(customer_phone);
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_phone);
CREATE INDEX IF NOT EXISTS idx_notifications_customer ON notifications(customer_phone);
CREATE INDEX IF NOT EXISTS idx_payouts_professional ON payouts(professional_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','favourites','addresses','notifications','support_tickets','payouts','admin_settings','audit_logs']
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

INSERT INTO admin_settings (key, value) VALUES
  ('admin_password', 'admin123'),
  ('admin_commission_pct', '10'),
  ('notify_email', 'on'),
  ('notify_push', 'on')
ON CONFLICT (key) DO NOTHING;