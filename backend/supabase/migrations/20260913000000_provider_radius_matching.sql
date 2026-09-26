-- Provider radius-based customer matching.
-- Providers get a service radius (km) + real coordinates; customer requests
-- carry coordinates too so that distance can be computed against the provider.

ALTER TABLE professionals ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS service_radius_km int NOT NULL DEFAULT 60;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS longitude numeric;

ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude numeric;

-- Speed up the open-request pool lookup (confirmed bookings without a professional).
CREATE INDEX IF NOT EXISTS idx_bookings_open_confirmed ON bookings (created_at DESC) WHERE status = 'confirmed' AND professional_id IS NULL;

-- Provide a login helper before setting their coordinates: radius already defaults to 60 km.
UPDATE professionals SET service_radius_km = 60 WHERE service_radius_km IS NULL OR service_radius_km < 1;