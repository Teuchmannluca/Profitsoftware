-- Add detailed inventory category columns from Amazon FBA inventory API
ALTER TABLE inventory_snapshots
  ADD COLUMN IF NOT EXISTS afn_researching       int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afn_customer_damaged   int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afn_warehouse_damaged  int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afn_distributor_damaged int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afn_carrier_damaged    int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afn_defective          int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afn_pending_customer_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afn_fc_processing      int DEFAULT 0;
