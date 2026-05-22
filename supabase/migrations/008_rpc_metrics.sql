-- Server-side aggregation functions to replace client-side pagination loops.
-- getSalesMetrics() and getDailyMetrics() previously made ~15+ sequential
-- Supabase queries per call; each RPC replaces that with a single query.

CREATE OR REPLACE FUNCTION get_sales_metrics(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_vat_status text;
  v_vat_rate   numeric;
  v_gross      numeric := 0;
  v_vat        numeric := 0;
  v_promo      numeric := 0;
  v_units      bigint  := 0;
  v_cogs       numeric := 0;
  v_fees       numeric := 0;
  v_order_count      bigint := 0;
  v_total_order_count bigint := 0;
  v_net        numeric;
  v_adj_fees   numeric;
  v_profit     numeric;
  v_margin     numeric;
  v_roi        numeric;
BEGIN
  SELECT COALESCE(bs.vat_status, 'standard'),
         COALESCE(bs.vat_rate, 0.20)
    INTO v_vat_status, v_vat_rate
    FROM business_settings bs
   WHERE bs.id = 1;

  v_vat_status := COALESCE(v_vat_status, 'standard');
  v_vat_rate   := COALESCE(v_vat_rate, 0.20);

  -- Total orders in range (including those with $0 items / pending)
  SELECT COUNT(*)
    INTO v_total_order_count
    FROM orders
   WHERE purchase_date >= p_from
     AND purchase_date <= p_to;

  -- Main aggregate: join items → orders → products → cogs_periods
  SELECT
    COALESCE(SUM(oi.item_price_gross), 0),
    COALESCE(SUM(
      CASE
        WHEN COALESCE(oi.item_tax, 0) <> 0 THEN oi.item_tax
        WHEN oi.item_price_gross > 0 THEN
          oi.item_price_gross * (COALESCE(p.vat_rate, v_vat_rate)
                                 / (1 + COALESCE(p.vat_rate, v_vat_rate)))
        ELSE 0
      END
    ), 0),
    COALESCE(SUM(COALESCE(oi.promo_discount, 0)), 0),
    COALESCE(SUM(COALESCE(oi.qty, 0)), 0),
    COALESCE(SUM(COALESCE(cp.total_cogs, 0) * COALESCE(oi.qty, 0)), 0),
    COALESCE(SUM(
      COALESCE(
        (oi.actual_fees->>'totalFees')::numeric,
        (oi.estimated_fees->>'totalFees')::numeric,
        0
      ) / (1 + v_vat_rate) * COALESCE(oi.qty, 0)
    ), 0),
    COUNT(DISTINCT oi.amazon_order_id)
  INTO v_gross, v_vat, v_promo, v_units, v_cogs, v_fees, v_order_count
  FROM order_items oi
  JOIN orders o ON o.amazon_order_id = oi.amazon_order_id
  LEFT JOIN products p ON p.sku = oi.sku
  LEFT JOIN LATERAL (
    SELECT cp2.total_cogs
      FROM cogs_periods cp2
     WHERE cp2.asin = oi.asin
       AND cp2.valid_from <= o.purchase_date::date
       AND (cp2.valid_to IS NULL OR cp2.valid_to >= o.purchase_date::date)
     ORDER BY cp2.valid_from DESC
     LIMIT 1
  ) cp ON true
  WHERE o.purchase_date >= p_from
    AND o.purchase_date <= p_to
    AND oi.item_price_gross IS NOT NULL
    AND oi.item_price_gross <> 0;

  -- VAT-status-dependent revenue and fee adjustments
  IF v_vat_status = 'not_registered' THEN
    v_net      := v_gross - v_promo;
    v_adj_fees := v_fees * (1 + v_vat_rate);
  ELSE
    v_net      := v_gross - v_vat - v_promo;
    v_adj_fees := v_fees;
  END IF;

  v_profit := v_net - v_adj_fees - v_cogs;
  v_margin := CASE WHEN v_net > 0 THEN (v_profit / v_net) * 100 ELSE 0 END;
  v_roi    := CASE WHEN (v_adj_fees + v_cogs) > 0
              THEN (v_profit / (v_adj_fees + v_cogs)) * 100 ELSE 0 END;

  RETURN jsonb_build_object(
    'grossSales',      ROUND(v_gross, 2),
    'vatCollected',    ROUND(v_vat, 2),
    'promoDiscount',   ROUND(v_promo, 2),
    'netRevenue',      ROUND(v_net, 2),
    'totalFees',       ROUND(v_adj_fees, 2),
    'totalCogs',       ROUND(v_cogs, 2),
    'estimatedProfit', ROUND(v_profit, 2),
    'unitsSold',       v_units,
    'orderCount',      v_order_count,
    'totalOrderCount', v_total_order_count,
    'margin',          ROUND(v_margin, 2),
    'roi',             ROUND(v_roi, 2)
  );
END;
$$;


CREATE OR REPLACE FUNCTION get_daily_metrics(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  date    date,
  revenue numeric,
  profit  numeric,
  fees    numeric,
  units   bigint
)
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_vat_status text;
  v_vat_rate   numeric;
BEGIN
  SELECT COALESCE(bs.vat_status, 'standard'),
         COALESCE(bs.vat_rate, 0.20)
    INTO v_vat_status, v_vat_rate
    FROM business_settings bs
   WHERE bs.id = 1;

  v_vat_status := COALESCE(v_vat_status, 'standard');
  v_vat_rate   := COALESCE(v_vat_rate, 0.20);

  RETURN QUERY
  WITH item_data AS (
    SELECT
      o.purchase_date::date AS day,
      oi.item_price_gross AS price,
      CASE
        WHEN COALESCE(oi.item_tax, 0) <> 0 THEN oi.item_tax
        WHEN oi.item_price_gross > 0 THEN
          oi.item_price_gross * (COALESCE(p.vat_rate, v_vat_rate)
                                 / (1 + COALESCE(p.vat_rate, v_vat_rate)))
        ELSE 0
      END AS tax,
      COALESCE(oi.promo_discount, 0) AS promo,
      COALESCE(
        (oi.actual_fees->>'totalFees')::numeric,
        (oi.estimated_fees->>'totalFees')::numeric,
        0
      ) AS fee_raw,
      COALESCE(oi.qty, 0) AS qty,
      COALESCE(cp.total_cogs, 0) AS unit_cogs
    FROM order_items oi
    JOIN orders o ON o.amazon_order_id = oi.amazon_order_id
    LEFT JOIN products p ON p.sku = oi.sku
    LEFT JOIN LATERAL (
      SELECT cp2.total_cogs
        FROM cogs_periods cp2
       WHERE cp2.asin = oi.asin
         AND cp2.valid_from <= o.purchase_date::date
         AND (cp2.valid_to IS NULL OR cp2.valid_to >= o.purchase_date::date)
       ORDER BY cp2.valid_from DESC
       LIMIT 1
    ) cp ON true
    WHERE o.purchase_date >= p_from
      AND o.purchase_date <= p_to
      AND oi.item_price_gross IS NOT NULL
      AND oi.item_price_gross <> 0
  )
  SELECT
    d.day,
    ROUND(SUM(
      CASE WHEN v_vat_status = 'not_registered'
        THEN d.price - d.promo
        ELSE d.price - d.tax - d.promo
      END
    ), 2),
    ROUND(SUM(
      CASE WHEN v_vat_status = 'not_registered'
        THEN d.price - d.promo
        ELSE d.price - d.tax - d.promo
      END
      - CASE WHEN v_vat_status = 'not_registered'
          THEN d.fee_raw * d.qty
          ELSE d.fee_raw / (1 + v_vat_rate) * d.qty
        END
      - d.unit_cogs * d.qty
    ), 2),
    ROUND(SUM(
      CASE WHEN v_vat_status = 'not_registered'
        THEN d.fee_raw * d.qty
        ELSE d.fee_raw / (1 + v_vat_rate) * d.qty
      END
    ), 2),
    SUM(d.qty)::bigint
  FROM item_data d
  GROUP BY d.day
  ORDER BY d.day;
END;
$$;
