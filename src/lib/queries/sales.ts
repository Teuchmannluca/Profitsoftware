import { createServiceClient } from "@/lib/supabase/service";

export interface SalesMetrics {
  grossSales: number;
  vatCollected: number;
  promoDiscount: number;
  netRevenue: number;
  totalFees: number;
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

  // Step 1: Get ALL order IDs in the date range (paginate past Supabase 1000 row limit)
  const orderIds: string[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data: batch } = await supabase
      .from("orders")
      .select("amazon_order_id")
      .gte("purchase_date", from.toISOString())
      .lte("purchase_date", to.toISOString())
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (!batch || batch.length === 0) break;
    orderIds.push(...batch.map((o) => o.amazon_order_id));
    if (batch.length < pageSize) break;
    page++;
  }
  const orderCount = orderIds.length;

  if (orderIds.length === 0) {
    return {
      grossSales: 0, vatCollected: 0, promoDiscount: 0, netRevenue: 0,
      totalFees: 0, totalCogs: 0, estimatedProfit: 0, unitsSold: 0,
      orderCount: 0, margin: 0,
    };
  }

  // Step 2: Get all items for those orders (query in chunks to avoid URL length limits)
  const allItems: Array<Record<string, unknown>> = [];
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const { data: items } = await supabase
      .from("order_items")
      .select("asin, qty, item_price_gross, item_tax, shipping_price, promo_discount, estimated_fees, actual_fees")
      .in("amazon_order_id", chunk);
    allItems.push(...(items ?? []));
  }

  // Step 3: Get active COGS
  const { data: cogs } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs")
    .is("valid_to", null);

  const cogsMap = new Map(
    cogs?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
  );

  // Step 4: Aggregate
  let grossSales = 0;
  let vatCollected = 0;
  let promoDiscount = 0;
  let unitsSold = 0;
  let totalCogs = 0;
  let totalFees = 0;

  for (const item of allItems) {
    const qty = (item.qty as number) ?? 0;
    grossSales += parseFloat(String(item.item_price_gross ?? "0"));
    vatCollected += parseFloat(String(item.item_tax ?? "0"));
    promoDiscount += parseFloat(String(item.promo_discount ?? "0"));
    unitsSold += qty;

    const unitCogs = cogsMap.get(item.asin as string) ?? 0;
    totalCogs += unitCogs * qty;

    const fees = (item.actual_fees ?? item.estimated_fees) as Record<string, unknown> | null;
    const perUnitFee = parseFloat(String(fees?.totalFees ?? "0"));
    totalFees += perUnitFee * qty;
  }

  const netRevenue = grossSales - vatCollected - promoDiscount;
  const estimatedProfit = netRevenue - totalFees - totalCogs;
  const margin = netRevenue > 0 ? (estimatedProfit / netRevenue) * 100 : 0;

  return {
    grossSales,
    vatCollected,
    promoDiscount,
    netRevenue,
    totalFees,
    totalCogs,
    estimatedProfit,
    unitsSold,
    orderCount,
    margin,
  };
}
