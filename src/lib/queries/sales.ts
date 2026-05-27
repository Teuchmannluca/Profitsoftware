import { createServiceClient } from "@/lib/supabase/service";

export interface SalesMetrics {
  grossSales: number;
  vatCollected: number;
  promoDiscount: number;
  netRevenue: number;
  totalFees: number;
  totalCogs: number;
  adSpend: number;
  expenses: number;
  estimatedProfit: number;
  unitsSold: number;
  orderCount: number;
  totalOrderCount: number;
  margin: number;
  roi: number;
}

const LONDON_TZ = "Europe/London";

export function getLondonToday(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month") - 1, day: get("day") };
}

export function londonMidnight(year: number, month: number, day: number): Date {
  const utcMidnight = new Date(Date.UTC(year, month, day));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(utcMidnight);
  const h = parseInt(parts.find((p) => p.type === "hour")!.value);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value);
  return new Date(utcMidnight.getTime() - (h * 3600000 + m * 60000));
}

function shiftDay(y: number, m: number, d: number, days: number) {
  const date = new Date(Date.UTC(y, m, d + days));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

function dayStart(y: number, m: number, d: number) {
  return londonMidnight(y, m, d);
}

function dayEnd(y: number, m: number, d: number) {
  const next = shiftDay(y, m, d, 1);
  return new Date(londonMidnight(next.year, next.month, next.day).getTime() - 1);
}

export function getDateRange(period: string): { from: Date; to: Date } {
  const { year, month, day } = getLondonToday();

  switch (period) {
    case "today":
      return { from: dayStart(year, month, day), to: dayEnd(year, month, day) };
    case "yesterday": {
      const yd = shiftDay(year, month, day, -1);
      return { from: dayStart(yd.year, yd.month, yd.day), to: dayEnd(yd.year, yd.month, yd.day) };
    }
    case "7days": {
      const s = shiftDay(year, month, day, -7);
      return { from: dayStart(s.year, s.month, s.day), to: dayEnd(year, month, day) };
    }
    case "this_month":
      return { from: dayStart(year, month, 1), to: dayEnd(year, month, day) };
    case "last_month": {
      const lastDay = new Date(Date.UTC(year, month, 0));
      return {
        from: dayStart(year, month - 1, 1),
        to: dayEnd(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), lastDay.getUTCDate()),
      };
    }
    case "this_year":
      return { from: dayStart(year, 0, 1), to: dayEnd(year, month, day) };
    case "90days": {
      const s = shiftDay(year, month, day, -90);
      return { from: dayStart(s.year, s.month, s.day), to: dayEnd(year, month, day) };
    }
    case "365days": {
      const s = shiftDay(year, month, day, -365);
      return { from: dayStart(s.year, s.month, s.day), to: dayEnd(year, month, day) };
    }
    default: {
      if (period.startsWith("custom_")) {
        const seg = period.slice(7).split("_");
        if (seg.length === 2) {
          const fp = seg[0].split("-").map(Number);
          const tp = seg[1].split("-").map(Number);
          if (fp.length === 3 && tp.length === 3) {
            const from = dayStart(fp[0], fp[1] - 1, fp[2]);
            const to = dayEnd(tp[0], tp[1] - 1, tp[2]);
            if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
              return { from, to };
            }
          }
        }
      }
      return { from: dayStart(year, month, day), to: dayEnd(year, month, day) };
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
      totalFees: 0, totalCogs: 0, adSpend: 0, expenses: 0, estimatedProfit: 0, unitsSold: 0,
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
    expenses: d.expenses ?? 0,
    estimatedProfit: d.estimatedProfit ?? 0,
    unitsSold: d.unitsSold ?? 0,
    orderCount: d.orderCount ?? 0,
    totalOrderCount: d.totalOrderCount ?? 0,
    margin: d.margin ?? 0,
    roi: d.roi ?? 0,
  };
}
