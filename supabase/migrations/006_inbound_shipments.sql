-- Inbound shipments tracking for capital page

CREATE TABLE inbound_shipments (
  shipment_id          text PRIMARY KEY,
  shipment_name        text,
  shipment_status      text NOT NULL,
  destination_fc_id    text,
  are_cases_required   boolean DEFAULT false,
  last_synced_at       timestamptz DEFAULT now(),
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_inbound_shipments_status ON inbound_shipments(shipment_status);

CREATE TABLE inbound_shipment_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id      text NOT NULL REFERENCES inbound_shipments(shipment_id),
  seller_sku       text NOT NULL,
  fnsku            text,
  quantity_shipped  int DEFAULT 0,
  quantity_received int DEFAULT 0,
  quantity_in_case  int,
  last_synced_at   timestamptz DEFAULT now(),
  UNIQUE (shipment_id, seller_sku)
);

CREATE INDEX idx_inbound_items_shipment ON inbound_shipment_items(shipment_id);
CREATE INDEX idx_inbound_items_sku ON inbound_shipment_items(seller_sku);
