"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { getDateRange } from "@/lib/queries/sales";

export type TopSellersSortBy = "units" | "revenue" | "profit";
export type TopSellersPeriod =
  | "today"
  | "yesterday"
  | "this_month"
  | "all_time";

export interface TopSellerItem {
  asin: string;
  sku: string;
  title: string | null;
  image_url: string | null;
  units: number;
  sales: number;
  profit: number;
}

export async function getTopSellers(
  period: TopSellersPeriod,
  sortBy: TopSellersSortBy
): Promise<TopSellerItem[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("order_items")
    .select(
      "sku, asin, qty, item_price_gross, estimated_profit, orders!inner(purchase_date)"
    );

  if (period !== "all_time") {
    const { from, to } = getDateRange(period);
    query = query
      .gte("orders.purchase_date", from.toISOString())
      .lte("orders.purchase_date", to.toISOString());
  }

  const { data: items } = await query;
  if (!items || items.length === 0) return [];

  const skus = [...new Set(items.map((i) => i.sku).filter(Boolean))];
  const { data: products } =
    skus.length > 0
      ? await supabase
          .from("products")
          .select("sku, title, image_url")
          .in("sku", skus)
      : { data: [] };

  const productMap = new Map(
    products?.map((p) => [p.sku, p]) ?? []
  );

  const agg = new Map<string, TopSellerItem>();
  for (const item of items) {
    const price = parseFloat(String(item.item_price_gross ?? "0"));
    if (price === 0) continue;
    const key = item.asin ?? item.sku;
    const existing = agg.get(key) ?? {
      asin: key,
      sku: item.sku,
      title: productMap.get(item.sku)?.title ?? null,
      image_url: productMap.get(item.sku)?.image_url ?? null,
      units: 0,
      sales: 0,
      profit: 0,
    };
    existing.units += item.qty ?? 0;
    existing.sales += price;
    existing.profit +=
      item.estimated_profit == null
        ? 0
        : parseFloat(String(item.estimated_profit));
    agg.set(key, existing);
  }

  return [...agg.values()]
    .sort((a, b) => b[sortBy === "revenue" ? "sales" : sortBy] - a[sortBy === "revenue" ? "sales" : sortBy])
    .slice(0, 5);
}
