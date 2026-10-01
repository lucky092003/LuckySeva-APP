-- Charge customers who pick from the top-5 recommended professionals.
--
-- The picker surfaces NEARBY_LIMIT (5) professionals per service. Booking one of
-- those is the "priority" path, so it carries a surcharge on top of the flat
-- visit fee. Auto-assigned bookings (professional_id NULL) and bookings that
-- arrive without a professional pay no surcharge.
--
-- Stored separately from visit_fee so the invoice can itemise the two charges
-- instead of merging them into one opaque number.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS priority_fee numeric NOT NULL DEFAULT 0;

-- The top-N cut-off the fee is tied to. Kept as a setting rather than baked
-- into code so it can be retuned without a deploy; must match NEARBY_LIMIT in
-- app/routers/catalog.py.
INSERT INTO admin_settings (key, value)
VALUES ('priority_top_n', '5')
ON CONFLICT (key) DO NOTHING;

INSERT INTO admin_settings (key, value)
VALUES ('priority_fee', '99')
ON CONFLICT (key) DO NOTHING;