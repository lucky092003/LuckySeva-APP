-- Link a booking to the saved address it was booked against.
-- Lets the customer see "booked from Home" and lets the provider know the
-- service address came from the customer's saved list rather than ad-hoc input.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES addresses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_address ON bookings(address_id);
