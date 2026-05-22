-- Restock overview: one query that returns per-product stock levels,
-- sales velocity, days of stock, and reorder recommendations.

CREATE OR REPLACE FUNCTION get_restock_overview(
  p_lead_time_days int DEFAULT 7,
  p_target_stock_days int DEFAULT 60
)
RETURNS TABLE (
  sku              text,
  asin             text,
  title            text,
  image_url        text,
  fulfillable      int,
  reserved         int,
  inbound          int,
  units_sold_30d   bigint,
  daily_velocity   numeric,
  days_of_stock    numeric,
  reorder_point    numeric,
  recommended_qty  int,
  unit_cogs        numeric,
  restock_cost     numeric,
  urgency          text
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH latest_snapshot AS (
    SELECT DISTINCT ON (s.sku)
      s.sku,
      s.afn_fulfillable,
      s.afn_reserved,
      s.afn_inbound
    FROM inventory_snapshots s
    ORDER BY s.sku, s.date DESC
  ),
  sales_30d AS (
    SELECT
      oi.sku,
      COALESCE(SUM(COALESCE(oi.qty, 0)), 0)::bigint AS units
    FROM order_items oi
    JOIN orders o ON o.amazon_order_id = oi.amazon_order_id
    WHERE o.purchase_date >= (now() - interval '30 days')
      AND oi.item_price_gross IS NOT NULL
      AND oi.item_price_gross <> 0
    GROUP BY oi.sku
  ),
  current_cogs AS (
    SELECT DISTINCT ON (cp.asin)
      cp.asin,
      cp.total_cogs
    FROM cogs_periods cp
    WHERE cp.valid_to IS NULL
    ORDER BY cp.asin, cp.valid_from DESC
  ),
  computed AS (
    SELECT
      p.sku,
      p.asin,
      p.title,
      p.image_url,
      COALESCE(ls.afn_fulfillable, 0) AS fulfillable,
      COALESCE(ls.afn_reserved, 0) AS reserved,
      COALESCE(ls.afn_inbound, 0) AS inbound,
      COALESCE(s.units, 0)::bigint AS units_sold_30d,
      ROUND(COALESCE(s.units, 0)::numeric / 30, 2) AS daily_velocity,
      CASE
        WHEN COALESCE(s.units, 0) > 0 THEN
          ROUND(COALESCE(ls.afn_fulfillable, 0)::numeric / (COALESCE(s.units, 0)::numeric / 30), 1)
        WHEN COALESCE(ls.afn_fulfillable, 0) > 0 THEN 999
        ELSE 0
      END AS days_of_stock,
      ROUND(COALESCE(s.units, 0)::numeric / 30 * p_lead_time_days, 0) AS reorder_point,
      GREATEST(
        CEIL(COALESCE(s.units, 0)::numeric / 30 * p_target_stock_days)
          - COALESCE(ls.afn_fulfillable, 0)
          - COALESCE(ls.afn_inbound, 0),
        0
      )::int AS recommended_qty,
      COALESCE(c.total_cogs, 0)::numeric AS unit_cogs
    FROM products p
    LEFT JOIN latest_snapshot ls ON ls.sku = p.sku
    LEFT JOIN sales_30d s ON s.sku = p.sku
    LEFT JOIN current_cogs c ON c.asin = p.asin
    WHERE p.active = true
  )
  SELECT
    cm.sku,
    cm.asin,
    cm.title,
    cm.image_url,
    cm.fulfillable,
    cm.reserved,
    cm.inbound,
    cm.units_sold_30d,
    cm.daily_velocity,
    cm.days_of_stock,
    cm.reorder_point,
    cm.recommended_qty,
    cm.unit_cogs,
    (cm.recommended_qty * cm.unit_cogs)::numeric AS restock_cost,
    CASE
      WHEN cm.units_sold_30d > 0 AND cm.fulfillable = 0 THEN 'out_of_stock'
      WHEN cm.units_sold_30d = 0 THEN 'no_sales'
      WHEN cm.days_of_stock <= p_lead_time_days THEN 'critical'
      WHEN cm.days_of_stock <= p_lead_time_days * 3 THEN 'low'
      WHEN cm.days_of_stock > p_target_stock_days * 1.5 THEN 'overstock'
      ELSE 'ok'
    END AS urgency
  FROM computed cm
  ORDER BY
    CASE
      WHEN cm.units_sold_30d > 0 AND cm.fulfillable = 0 THEN 0
      WHEN cm.units_sold_30d > 0 AND cm.days_of_stock <= p_lead_time_days THEN 1
      WHEN cm.units_sold_30d > 0 AND cm.days_of_stock <= p_lead_time_days * 3 THEN 2
      WHEN cm.units_sold_30d > 0 THEN 3
      WHEN cm.units_sold_30d = 0 AND cm.fulfillable > 0 THEN 4
      ELSE 5
    END,
    cm.days_of_stock ASC;
END;
$$;
