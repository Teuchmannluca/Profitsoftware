import { getSalesMetrics, type SalesMetrics } from "@/lib/queries/sales";
import { getTopSellers } from "@/actions/top-sellers";
import type {
  DailyDigest,
  DigestMetric,
  DigestMover,
  MetricFormat,
} from "./types";

/** Local-time YYYY-MM-DD — matches how the dashboard buckets days. */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Percentage change between two days. Returns null when the previous day has
 * no baseline (0) so the digest can show "—" instead of a misleading number.
 */
export function metricDeltaPct(
  value: number,
  prevValue: number
): number | null {
  if (prevValue === 0) return null;
  return ((value - prevValue) / Math.abs(prevValue)) * 100;
}

/** Strongest gain and steepest drop across the comparable metrics. */
export function pickMovers(metrics: DigestMetric[]): {
  best: DigestMover | null;
  worst: DigestMover | null;
} {
  const comparable = metrics.filter((m) => m.deltaPct !== null);
  if (comparable.length === 0) return { best: null, worst: null };

  let best = comparable[0];
  let worst = comparable[0];
  for (const m of comparable) {
    if ((m.deltaPct as number) > (best.deltaPct as number)) best = m;
    if ((m.deltaPct as number) < (worst.deltaPct as number)) worst = m;
  }

  return {
    best: { label: best.label, deltaPct: best.deltaPct as number },
    worst: { label: worst.label, deltaPct: worst.deltaPct as number },
  };
}

export function formatMetricValue(value: number, format: MetricFormat): string {
  if (format === "currency") return `£${value.toFixed(2)}`;
  if (format === "percent") return `${value.toFixed(1)}%`;
  return String(Math.round(value));
}

export function formatDeltaPct(deltaPct: number | null): string {
  if (deltaPct === null) return "—";
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(1)}%`;
}

const METRIC_DEFS: Array<{
  key: string;
  label: string;
  format: MetricFormat;
  pick: (m: SalesMetrics) => number;
}> = [
  { key: "revenue", label: "Revenue", format: "currency", pick: (m) => m.grossSales },
  { key: "profit", label: "Profit", format: "currency", pick: (m) => m.estimatedProfit },
  { key: "margin", label: "Margin", format: "percent", pick: (m) => m.margin },
  { key: "roi", label: "ROI", format: "percent", pick: (m) => m.roi },
  { key: "units", label: "Units Sold", format: "number", pick: (m) => m.unitsSold },
  { key: "orders", label: "Orders", format: "number", pick: (m) => m.totalOrderCount },
];

/**
 * Builds the daily digest for the day that just ended (yesterday relative to
 * `reference`), comparing every metric against the day before that.
 */
export async function buildDailyDigest(
  reference: Date = new Date()
): Promise<DailyDigest> {
  const todayStart = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );

  const yesterdayFrom = new Date(todayStart.getTime() - 86400000);
  const yesterdayTo = new Date(todayStart.getTime() - 1);
  const dayBeforeFrom = new Date(todayStart.getTime() - 2 * 86400000);
  const dayBeforeTo = new Date(yesterdayFrom.getTime() - 1);

  const [yesterday, dayBefore, topSellers] = await Promise.all([
    getSalesMetrics(yesterdayFrom, yesterdayTo),
    getSalesMetrics(dayBeforeFrom, dayBeforeTo),
    getTopSellers("yesterday", "units"),
  ]);

  const metrics: DigestMetric[] = METRIC_DEFS.map((def) => {
    const value = def.pick(yesterday);
    const prevValue = def.pick(dayBefore);
    return {
      key: def.key,
      label: def.label,
      value,
      prevValue,
      format: def.format,
      deltaPct: metricDeltaPct(value, prevValue),
    };
  });

  const { best, worst } = pickMovers(metrics);

  return {
    reportDate: toLocalDateStr(yesterdayFrom),
    compareDate: toLocalDateStr(dayBeforeFrom),
    reportDateLabel: yesterdayFrom.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    metrics,
    topSellers: topSellers.map((s) => ({
      title: s.title ?? "Unknown Product",
      asin: s.asin,
      units: s.units,
      sales: s.sales,
    })),
    bestMover: best,
    worstMover: worst,
  };
}
