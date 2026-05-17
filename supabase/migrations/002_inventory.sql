-- Add image_url to products, remove brand constraint, create inventory_snapshots

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_brand_check;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS inventory_snapshots (
  date              date,
  sku               text,
  asin              text,
  afn_fulfillable   int DEFAULT 0,
  afn_reserved      int DEFAULT 0,
  afn_inbound       int DEFAULT 0,
  afn_unsellable    int DEFAULT 0,
  mfn_quantity      int DEFAULT 0,
  total_quantity    int DEFAULT 0,
  PRIMARY KEY (date, sku)
);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date
  ON inventory_snapshots(date DESC);
