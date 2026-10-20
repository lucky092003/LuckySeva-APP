-- Provider-side in-app notifications.
--
-- The `notifications` table doubles as the provider bell: a row is addressed to
-- either a customer (`customer_phone`) or a professional (`professional_id`),
-- never both. `customer_phone` drops NOT NULL so a provider-addressed row can
-- exist; every existing row keeps its customer phone, so nothing customer-facing
-- changes shape. Provider read endpoints scope on `professional_id` - RLS is
-- not the security boundary (see AGENT_CONTEXT 3.3).

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE;
ALTER TABLE notifications ALTER COLUMN customer_phone DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_professional ON notifications(professional_id);
