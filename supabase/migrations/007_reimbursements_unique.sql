-- Add source tracking columns for deduplication
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'adjustment';
ALTER TABLE reimbursements ADD COLUMN IF NOT EXISTS source_id text;

-- Unique constraint for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_reimbursements_source
  ON reimbursements(source_type, source_id) WHERE source_id IS NOT NULL;
