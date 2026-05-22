-- Per-ASIN daily ad performance (from spAdvertisedProduct reports)
CREATE TABLE ad_product_daily (
  date           date    NOT NULL,
  campaign_id    text    NOT NULL,
  ad_group_id    text    NOT NULL,
  asin           text    NOT NULL,
  campaign_name  text,
  ad_group_name  text,
  sku            text,
  impressions    bigint  DEFAULT 0,
  clicks         bigint  DEFAULT 0,
  spend          numeric DEFAULT 0,
  ad_sales       numeric DEFAULT 0,
  ad_orders      bigint  DEFAULT 0,
  PRIMARY KEY (date, campaign_id, ad_group_id, asin)
);

CREATE INDEX idx_ad_product_daily_date ON ad_product_daily(date);
CREATE INDEX idx_ad_product_daily_asin ON ad_product_daily(asin, date);

-- Per-keyword/target daily ad performance (from spTargeting reports)
CREATE TABLE ad_targeting_daily (
  date            date    NOT NULL,
  campaign_id     text    NOT NULL,
  ad_group_id     text    NOT NULL,
  targeting_id    text    NOT NULL,
  campaign_name   text,
  ad_group_name   text,
  targeting_type  text,
  targeting_text  text,
  match_type      text,
  impressions     bigint  DEFAULT 0,
  clicks          bigint  DEFAULT 0,
  spend           numeric DEFAULT 0,
  ad_sales        numeric DEFAULT 0,
  ad_orders       bigint  DEFAULT 0,
  PRIMARY KEY (date, campaign_id, ad_group_id, targeting_id)
);

CREATE INDEX idx_ad_targeting_daily_date ON ad_targeting_daily(date);
CREATE INDEX idx_ad_targeting_daily_adgroup ON ad_targeting_daily(ad_group_id, date);


-- Per-ASIN PPC overview: joins ad data with sales/COGS for profitability
CREATE OR REPLACE FUNCTION get_ppc_overview(p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
  asin            text,
  title           text,
  image_url       text,
  ad_spend        numeric,
  ad_sales        numeric,
  ad_orders       bigint,
  impressions     bigint,
  clicks          bigint,
  total_sales     numeric,
  total_units     bigint,
  organic_sales   numeric,
  organic_ratio   numeric,
  total_cogs      numeric,
  total_fees      numeric,
  profit          numeric,
  acos            numeric,
  tacos           numeric,
  roas            numeric
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
  WITH ad_asin AS (
    SELECT
      a.asin                       AS asin,
      SUM(a.spend)::numeric        AS ad_spend,
      SUM(a.ad_sales)::numeric     AS ad_sales,
      SUM(a.ad_orders)::bigint     AS ad_orders,
      SUM(a.impressions)::bigint   AS impressions,
      SUM(a.clicks)::bigint        AS clicks
    FROM ad_product_daily a
    WHERE a.date >= (p_from AT TIME ZONE 'Europe/London')::date
      AND a.date <= (p_to   AT TIME ZONE 'Europe/London')::date
    GROUP BY a.asin
  ),
  sales_asin AS (
    SELECT
      oi.asin                                          AS asin,
      COALESCE(SUM(oi.item_price_gross), 0)            AS gross,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(oi.item_tax, 0) <> 0 THEN oi.item_tax
          WHEN oi.item_price_gross > 0 THEN
            oi.item_price_gross * (COALESCE(p.vat_rate, v_vat_rate)
                                   / (1 + COALESCE(p.vat_rate, v_vat_rate)))
          ELSE 0
        END
      ), 0)                                            AS vat,
      COALESCE(SUM(COALESCE(oi.promo_discount, 0)), 0) AS promo,
      COALESCE(SUM(COALESCE(oi.qty, 0)), 0)::bigint   AS units,
      COALESCE(SUM(
        COALESCE(cp.total_cogs, 0) * COALESCE(oi.qty, 0)
      ), 0)                                            AS cogs,
      COALESCE(SUM(
        COALESCE(
          (oi.actual_fees->>'totalFees')::numeric,
          (oi.estimated_fees->>'totalFees')::numeric,
          0
        ) / (1 + v_vat_rate) * COALESCE(oi.qty, 0)
      ), 0)                                            AS fees_base
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
    GROUP BY oi.asin
  ),
  product_info AS (
    SELECT DISTINCT ON (p.asin)
      p.asin, p.title, p.image_url
    FROM products p
    WHERE p.active = true
    ORDER BY p.asin, p.sku
  ),
  combined AS (
    SELECT
      COALESCE(aa.asin, sa.asin)  AS asin,
      COALESCE(aa.ad_spend, 0)    AS ad_spend,
      COALESCE(aa.ad_sales, 0)    AS ad_sales,
      COALESCE(aa.ad_orders, 0)   AS ad_orders,
      COALESCE(aa.impressions, 0) AS impressions,
      COALESCE(aa.clicks, 0)      AS clicks,
      CASE WHEN v_vat_status = 'not_registered'
        THEN COALESCE(sa.gross, 0) - COALESCE(sa.promo, 0)
        ELSE COALESCE(sa.gross, 0) - COALESCE(sa.vat, 0) - COALESCE(sa.promo, 0)
      END                         AS net_revenue,
      COALESCE(sa.units, 0)       AS units,
      COALESCE(sa.cogs, 0)        AS cogs,
      CASE WHEN v_vat_status = 'not_registered'
        THEN COALESCE(sa.fees_base, 0) * (1 + v_vat_rate)
        ELSE COALESCE(sa.fees_base, 0)
      END                         AS adj_fees
    FROM ad_asin aa
    FULL OUTER JOIN sales_asin sa ON sa.asin = aa.asin
    WHERE COALESCE(aa.asin, sa.asin) IS NOT NULL
  )
  SELECT
    c.asin,
    pi.title,
    pi.image_url,
    ROUND(c.ad_spend, 2)                                                AS ad_spend,
    ROUND(c.ad_sales, 2)                                                AS ad_sales,
    c.ad_orders,
    c.impressions,
    c.clicks,
    ROUND(c.net_revenue, 2)                                             AS total_sales,
    c.units                                                             AS total_units,
    ROUND(GREATEST(c.net_revenue - c.ad_sales, 0), 2)                   AS organic_sales,
    ROUND(CASE WHEN c.net_revenue > 0
      THEN GREATEST(c.net_revenue - c.ad_sales, 0) / c.net_revenue * 100
      ELSE 0
    END, 1)                                                             AS organic_ratio,
    ROUND(c.cogs, 2)                                                    AS total_cogs,
    ROUND(c.adj_fees, 2)                                                AS total_fees,
    ROUND(c.net_revenue - c.adj_fees - c.cogs - c.ad_spend, 2)         AS profit,
    ROUND(CASE WHEN c.ad_sales > 0
      THEN c.ad_spend / c.ad_sales * 100
      ELSE 0
    END, 1)                                                             AS acos,
    ROUND(CASE WHEN c.net_revenue > 0
      THEN c.ad_spend / c.net_revenue * 100
      ELSE 0
    END, 1)                                                             AS tacos,
    ROUND(CASE WHEN c.ad_spend > 0
      THEN c.ad_sales / c.ad_spend
      ELSE 0
    END, 2)                                                             AS roas
  FROM combined c
  LEFT JOIN product_info pi ON pi.asin = c.asin
  ORDER BY c.ad_spend DESC;
END;
$$;
