-- Phase 0 schema: products, orders, order_items, sync_log

CREATE TABLE products (
  sku             text PRIMARY KEY,
  asin            text,
  parent_asin     text,
  fnsku           text,
  title           text,
  brand           text CHECK (brand IN ('LVT', 'LAK')),
  category        text,
  vat_rate        numeric DEFAULT 0.20 CHECK (vat_rate IN (0.00, 0.05, 0.20)),
  active          boolean DEFAULT true,
  first_seen_at   timestamptz,
  last_synced_at  timestamptz
);

CREATE TABLE orders (
  amazon_order_id     text PRIMARY KEY,
  purchase_date       timestamptz,
  marketplace         text DEFAULT 'AMAZON_UK',
  order_status        text,
  fulfillment_channel text,
  ship_country        text,
  ship_postcode       text,
  last_updated        timestamptz,
  raw                 jsonb
);

CREATE TABLE order_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_order_id      text REFERENCES orders(amazon_order_id),
  order_item_id        text UNIQUE,
  sku                  text,
  asin                 text,
  qty                  int,
  item_price_gross     numeric,
  item_tax             numeric,
  shipping_price       numeric,
  promo_discount       numeric DEFAULT 0,
  estimated_fees       jsonb,
  estimated_profit     numeric,
  actual_fees          jsonb,
  actual_profit        numeric,
  cogs_snapshot        numeric,
  is_settled           boolean DEFAULT false,
  settled_at           timestamptz,
  refund_status        text DEFAULT 'none',
  refund_window_until  date,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(amazon_order_id);
CREATE INDEX idx_order_items_sku ON order_items(sku);
CREATE INDEX idx_orders_purchase_date ON orders(purchase_date);

CREATE TABLE sync_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar        text NOT NULL,
  endpoint      text,
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz,
  status        text DEFAULT 'running',
  rows_written  int DEFAULT 0,
  error         text,
  request_id    text
);

CREATE INDEX idx_sync_log_pillar ON sync_log(pillar, started_at DESC);
