-- Instant payouts: bank transfers need the routing code, and the payouts table
-- documents how each withdrawal was executed by the automation.
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS bank_ifsc text NOT NULL DEFAULT '';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS transfer_mode text NOT NULL DEFAULT '';
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS via_gateway boolean NOT NULL DEFAULT false;
