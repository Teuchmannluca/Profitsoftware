-- Returns and reimbursements tracking

CREATE TABLE returns (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_order_id       text,
  asin                  text,
  sku                   text,
  item_name             text,
  return_quantity        int DEFAULT 1,
  return_reason         text,
  return_request_date   timestamptz,
  return_delivery_date  timestamptz,
  return_status         text,
  resolution            text,
  in_policy             boolean,
  is_prime              boolean,
  refunded_amount       numeric,
  a_to_z_claim          boolean DEFAULT false,
  amazon_rma_id         text,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (amazon_order_id, sku, return_request_date)
);

CREATE INDEX idx_returns_date ON returns(return_request_date DESC);
CREATE INDEX idx_returns_asin ON returns(asin);

CREATE TABLE reimbursements (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_order_id       text,
  asin                  text,
  sku                   text,
  reason                text,
  quantity              int DEFAULT 1,
  amount                numeric,
  currency              text DEFAULT 'GBP',
  status                text DEFAULT 'pending',
  claim_id              text,
  event_date            date,
  claim_deadline        date,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_reimbursements_date ON reimbursements(event_date DESC);
