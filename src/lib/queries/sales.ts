import { createServiceClient } from "@/lib/supabase/service";

export interface SalesMetrics {
  grossSales: number;
  vatCollected: number;
  promoDiscount: number;
  netRevenue: number;
  totalFees: number;
  totalCogs: number;
  adSpend: number;
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

  const { data, error } = await supabase.rpc("get_sales_metrics", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error || !data) {
    console.error("[sales] RPC error:", error);
    return {
      grossSales: 0, vatCollected: 0, promoDiscount: 0, netRevenue: 0,
      totalFees: 0, totalCogs: 0, adSpend: 0, estimatedProfit: 0, unitsSold: 0,
      orderCount: 0, totalOrderCount: 0, margin: 0, roi: 0,
    };
  }

  const d = data as Record<string, number>;
  return {
    grossSales: d.grossSales ?? 0,
    vatCollected: d.vatCollected ?? 0,
    promoDiscount: d.promoDiscount ?? 0,
    netRevenue: d.netRevenue ?? 0,
    totalFees: d.totalFees ?? 0,
    totalCogs: d.totalCogs ?? 0,
    adSpend: d.adSpend ?? 0,
    estimatedProfit: d.estimatedProfit ?? 0,
    unitsSold: d.unitsSold ?? 0,
    orderCount: d.orderCount ?? 0,
    totalOrderCount: d.totalOrderCount ?? 0,
    margin: d.margin ?? 0,
    roi: d.roi ?? 0,
  };
}
