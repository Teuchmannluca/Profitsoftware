-- Recurring business expenses (Amazon subscription, software, prep, etc.)

CREATE TABLE expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  amount      numeric NOT NULL,
  frequency   text NOT NULL CHECK (frequency IN ('monthly', 'weekly', 'yearly', 'one_off')),
  start_date  date NOT NULL DEFAULT CURRENT_DATE,
  end_date    date,
  active      boolean DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- Update get_sales_metrics to include recurring expenses
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
  v_ad_spend   numeric := 0;
  v_expenses   numeric := 0;
  v_order_count      bigint := 0;
  v_total_order_count bigint := 0;
  v_net        numeric;
  v_adj_fees   numeric;
  v_profit     numeric;
  v_margin     numeric;
  v_roi        numeric;
  v_days       numeric;
  v_from_date  date;
  v_to_date    date;
BEGIN
  v_from_date := (p_from AT TIME ZONE 'Europe/London')::date;
  v_to_date   := (p_to AT TIME ZONE 'Europe/London')::date;
  v_days      := v_to_date - v_from_date + 1;

  SELECT COALESCE(bs.vat_status, 'standard'),
         COALESCE(bs.vat_rate, 0.20)
    INTO v_vat_status, v_vat_rate
    FROM business_settings bs
   WHERE bs.id = 1;

  v_vat_status := COALESCE(v_vat_status, 'standard');
  v_vat_rate   := COALESCE(v_vat_rate, 0.20);

  SELECT COUNT(*)
    INTO v_total_order_count
    FROM orders
   WHERE purchase_date >= p_from
     AND purchase_date <= p_to;

  SELECT COALESCE(SUM(spend), 0)
    INTO v_ad_spend
    FROM ad_spend_daily
   WHERE date >= v_from_date
     AND date <= v_to_date;

  -- Recurring expenses pro-rated by days in range
  SELECT COALESCE(SUM(
    CASE e.frequency
      WHEN 'monthly' THEN e.amount / 30.44
      WHEN 'weekly'  THEN e.amount / 7
      WHEN 'yearly'  THEN e.amount / 365.25
      WHEN 'one_off' THEN 0
    END
  ), 0) * v_days
  + COALESCE((
    SELECT SUM(e2.amount)
    FROM expenses e2
    WHERE e2.frequency = 'one_off'
      AND e2.active = true
      AND e2.start_date >= v_from_date
      AND e2.start_date <= v_to_date
  ), 0)
    INTO v_expenses
    FROM expenses e
   WHERE e.active = true
     AND e.frequency <> 'one_off'
     AND e.start_date <= v_to_date
     AND (e.end_date IS NULL OR e.end_date >= v_from_date);

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

  IF v_vat_status = 'not_registered' THEN
    v_net      := v_gross - v_promo;
    v_adj_fees := v_fees * (1 + v_vat_rate);
  ELSE
    v_net      := v_gross - v_vat - v_promo;
    v_adj_fees := v_fees;
  END IF;

  v_profit := v_net - v_adj_fees - v_cogs - v_ad_spend - v_expenses;
  v_margin := CASE WHEN v_net > 0 THEN (v_profit / v_net) * 100 ELSE 0 END;
  v_roi    := CASE WHEN (v_adj_fees + v_cogs + v_ad_spend + v_expenses) > 0
              THEN (v_profit / (v_adj_fees + v_cogs + v_ad_spend + v_expenses)) * 100 ELSE 0 END;

  RETURN jsonb_build_object(
    'grossSales',      ROUND(v_gross, 2),
    'vatCollected',    ROUND(v_vat, 2),
    'promoDiscount',   ROUND(v_promo, 2),
    'netRevenue',      ROUND(v_net, 2),
    'totalFees',       ROUND(v_adj_fees, 2),
    'totalCogs',       ROUND(v_cogs, 2),
    'adSpend',         ROUND(v_ad_spend, 2),
    'expenses',        ROUND(v_expenses, 2),
    'estimatedProfit', ROUND(v_profit, 2),
    'unitsSold',       v_units,
    'orderCount',      v_order_count,
    'totalOrderCount', v_total_order_count,
    'margin',          ROUND(v_margin, 2),
    'roi',             ROUND(v_roi, 2)
  );
END;
$$;
