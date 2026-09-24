-- Provider KYC / verification.
-- kyc_status lifecycle: not_submitted -> pending -> approved | rejected (rejected can resubmit -> pending).

ALTER TABLE professionals ADD COLUMN IF NOT EXISTS kyc_status text NOT NULL DEFAULT 'not_submitted';
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS kyc_doc_type text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS kyc_doc_number text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS kyc_review_note text;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS kyc_submitted_at timestamptz;
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS kyc_reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_professionals_kyc_status ON professionals (kyc_status) WHERE kyc_status = 'pending';