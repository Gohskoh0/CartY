-- Manual withdrawal workflow: sellers request payouts, admins pay offline.

ALTER TABLE stores ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS bank_code TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_reference ON withdrawals(reference) WHERE reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
