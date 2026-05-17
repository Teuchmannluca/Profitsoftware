import { createServiceClient } from "@/lib/supabase/service";

export interface SalesMetrics {
  grossSales: number;
  vatCollected: number;
  promoDiscount: number;
  netRevenue: number;
  totalCogs: number;
  estimatedProfit: number;
  unitsSold: number;
  orderCount: number;
  margin: number;
}

export function getDateRange(period: string): { from: Date; to: Date } {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (period) {
    case "today": {
      const from = startOfDay(now);
      const to = new Date(from.getTime() + 86400000 - 1);
      return { from, to };
    }
    case "yesterday": {
      const yesterday = new Date(now.getTime() - 86400000);
      const from = startOfDay(yesterday);
      const to = new Date(from.getTime() + 86400000 - 1);
      return { from, to };
    }
    case "7days": {
      const from = startOfDay(new Date(now.getTime() - 7 * 86400000));
      const to = new Date(startOfDay(now).getTime() + 86400000 - 1);
      return { from, to };
    }
    case "this_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(startOfDay(now).getTime() + 86400000 - 1);
      return { from, to };
    }
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { from, to };
    }
    case "this_year": {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(startOfDay(now).getTime() + 86400000 - 1);
      return { from, to };
    }
    default: {
      const from = startOfDay(now);
      const to = new Date(from.getTime() + 86400000 - 1);
      return { from, to };
    }
  }
}

export async function getSalesMetrics(from: Date, to: Date): Promise<SalesMetrics> {
  const supabase = createServiceClient();

  // 1. Get order items joined with orders filtered by date range
  const { data: items } = await supabase
    .from("order_items")
    .select(
      "asin, qty, item_price_gross, item_tax, promo_discount, orders!inner(amazon_order_id, purchase_date)"
    )
    .gte("orders.purchase_date", from.toISOString())
    .lte("orders.purchase_date", to.toISOString());

  // 2. Get active COGS periods
  const { data: cogs } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs")
    .is("valid_to", null);

  const cogsMap = new Map(
    cogs?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
  );

  // 3. Get order count for the period
  const { count } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("purchase_date", from.toISOString())
    .lte("purchase_date", to.toISOString());

  // 4. Aggregate in JS
  let grossSales = 0;
  let vatCollected = 0;
  let promoDiscount = 0;
  let unitsSold = 0;
  let totalCogs = 0;

  for (const item of items ?? []) {
    grossSales += parseFloat(String(item.item_price_gross ?? "0"));
    vatCollected += parseFloat(String(item.item_tax ?? "0"));
    promoDiscount += parseFloat(String(item.promo_discount ?? "0"));
    unitsSold += item.qty ?? 0;

    const unitCogs = cogsMap.get(item.asin) ?? 0;
    totalCogs += unitCogs * (item.qty ?? 0);
  }

  const netRevenue = grossSales - vatCollected - promoDiscount;
  const estimatedProfit = netRevenue - totalCogs;
  const margin = netRevenue > 0 ? (estimatedProfit / netRevenue) * 100 : 0;

  return {
    grossSales,
    vatCollected,
    promoDiscount,
    netRevenue,
    totalCogs,
    estimatedProfit,
    unitsSold,
    orderCount: count ?? 0,
    margin,
  };
}
