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
  totalOrderCount: number;
  margin: number;
  roi: number;
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
    case "90days": {
      const from = startOfDay(new Date(now.getTime() - 90 * 86400000));
      const to = new Date(startOfDay(now).getTime() + 86400000 - 1);
      return { from, to };
    }
    case "365days": {
      const from = startOfDay(new Date(now.getTime() - 365 * 86400000));
      const to = new Date(startOfDay(now).getTime() + 86400000 - 1);
      return { from, to };
    }
    default: {
      if (period.startsWith("custom_")) {
        const parts = period.slice(7).split("_");
        if (parts.length === 2) {
          const from = new Date(parts[0] + "T00:00:00");
          const to = new Date(parts[1] + "T23:59:59.999");
          if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
            return { from, to };
          }
        }
      }
      const from = startOfDay(now);
      const to = new Date(from.getTime() + 86400000 - 1);
      return { from, to };
    }
  }
}

type CogsPeriod = {
  asin: string;
  total_cogs: unknown;
  valid_from: string;
  valid_to: string | null;
};

export function getCogsForDate(
  periods: Array<{ totalCogs: number; validFrom: string; validTo: string | null }>,
  purchaseDate: string
) {
  const orderDate = purchaseDate.slice(0, 10);
  const period = periods.find(
    (p) => p.validFrom <= orderDate && (!p.validTo || p.validTo >= orderDate)
  );
  return period?.totalCogs ?? 0;
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
  const totalOrderCount = orderIds.length;

  if (orderIds.length === 0) {
    return {
      grossSales: 0, vatCollected: 0, promoDiscount: 0, netRevenue: 0,
      totalFees: 0, totalCogs: 0, estimatedProfit: 0, unitsSold: 0,
      orderCount: 0, totalOrderCount: 0, margin: 0, roi: 0,
    };
  }

  // Step 2: Get all items for those orders (query in chunks to avoid URL length limits)
  const allItems: Array<Record<string, unknown>> = [];
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const { data: items } = await supabase
      .from("order_items")
      .select("sku, asin, qty, item_price_gross, item_tax, shipping_price, promo_discount, estimated_fees, actual_fees, orders!inner(purchase_date)")
      .in("amazon_order_id", chunk);
    allItems.push(...(items ?? []));
  }

  // Step 2b: Get product VAT rates for deriving tax when Amazon returns 0
  const { data: productVatData } = await supabase
    .from("products")
    .select("sku, vat_rate");
  const skuToVatRate = new Map(
    (productVatData ?? []).map((p) => [p.sku, parseFloat(String(p.vat_rate ?? "0.20"))])
  );

  // Step 3: Get COGS periods so historical ranges use the cost active on purchase date.
  const { data: cogs } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs, valid_from, valid_to")
    .lte("valid_from", to.toISOString().slice(0, 10))
    .or(`valid_to.is.null,valid_to.gte.${from.toISOString().slice(0, 10)}`)
    .order("valid_from", { ascending: false });

  const cogsMap = new Map<
    string,
    Array<{ totalCogs: number; validFrom: string; validTo: string | null }>
  >();
  for (const c of (cogs ?? []) as CogsPeriod[]) {
    const periods = cogsMap.get(c.asin) ?? [];
    periods.push({
      totalCogs: parseFloat(String(c.total_cogs ?? "0")),
      validFrom: c.valid_from,
      validTo: c.valid_to,
    });
    cogsMap.set(c.asin, periods);
  }

  // Step 4: Read VAT settings (needed for fee normalisation in aggregation)
  const { data: settings } = await supabase
    .from("business_settings")
    .select("vat_status, vat_rate")
    .eq("id", 1)
    .single();

  const vatStatus = settings?.vat_status ?? "standard";
  const vatRate = parseFloat(String(settings?.vat_rate ?? "0.20"));

  // Step 5: Aggregate
  let grossSales = 0;
  let vatCollected = 0;
  let promoDiscount = 0;
  let unitsSold = 0;
  let totalCogs = 0;
  let totalFees = 0;
  const contributingOrders = new Set<string>();

  for (const item of allItems) {
    const qty = (item.qty as number) ?? 0;
    const price = parseFloat(String(item.item_price_gross ?? "0"));

    // Skip items with £0 price (Pending orders — Amazon hasn't confirmed the charge)
    if (price === 0) continue;

    contributingOrders.add(item.amazon_order_id as string);
    grossSales += price;
    let itemTax = parseFloat(String(item.item_tax ?? "0"));
    if (itemTax === 0 && price > 0) {
      const itemVatRate = skuToVatRate.get(item.sku as string) ?? vatRate;
      itemTax = price * (itemVatRate / (1 + itemVatRate));
    }
    vatCollected += itemTax;
    promoDiscount += parseFloat(String(item.promo_discount ?? "0"));
    unitsSold += qty;

    const ordersData = item.orders as unknown as
      | { purchase_date: string }
      | Array<{ purchase_date: string }>
      | null;
    const purchaseDate = Array.isArray(ordersData)
      ? ordersData[0]?.purchase_date
      : ordersData?.purchase_date;
    const unitCogs = purchaseDate
      ? getCogsForDate(cogsMap.get(item.asin as string) ?? [], purchaseDate)
      : 0;
    totalCogs += unitCogs * qty;

    const fees = (item.actual_fees ?? item.estimated_fees) as Record<string, unknown> | null;
    const perUnitFeeRaw = parseFloat(String(fees?.totalFees ?? "0"));
    // Both actual_fees (Finance API) and estimated_fees (Fees Estimate API) are inc-VAT.
    // Strip VAT to get ex-VAT fee cost (VAT on fees is reclaimable for registered sellers).
    const perUnitFee = perUnitFeeRaw / (1 + vatRate);
    totalFees += perUnitFee * qty;
  }

  console.log(`[sales] VAT status: "${vatStatus}", gross: ${grossSales.toFixed(2)}, fees(ex-VAT): ${totalFees.toFixed(2)}, vatCollected: ${vatCollected.toFixed(2)}`);

  let netRevenue: number;
  let adjustedFees: number;

  if (vatStatus === "not_registered") {
    // Not VAT registered: revenue is the full gross (no VAT owed),
    // but can't reclaim VAT on fees → true cost is fee inc-VAT
    netRevenue = grossSales - promoDiscount;
    adjustedFees = totalFees * (1 + vatRate);
  } else {
    // Standard VAT registered: subtract collected VAT from revenue,
    // fees already normalised to ex-VAT (VAT on fees is reclaimed)
    netRevenue = grossSales - vatCollected - promoDiscount;
    adjustedFees = totalFees;
  }

  const estimatedProfit = netRevenue - adjustedFees - totalCogs;
  const margin = netRevenue > 0 ? (estimatedProfit / netRevenue) * 100 : 0;
  const totalInvestment = adjustedFees + totalCogs;
  const roi = totalInvestment > 0 ? (estimatedProfit / totalInvestment) * 100 : 0;

  return {
    grossSales,
    vatCollected,
    promoDiscount,
    netRevenue,
    totalFees: adjustedFees,
    totalCogs,
    estimatedProfit,
    unitsSold,
    orderCount: contributingOrders.size,
    totalOrderCount,
    margin,
    roi,
  };
}
