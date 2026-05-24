"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/auth-guard";

export interface DailyDataPoint {
  date: string;
  revenue: number;
  profit: number;
  fees: number;
  units: number;
  adSpend: number;
}

export async function getDailyMetrics(
  from: Date,
  to: Date
): Promise<DailyDataPoint[]> {
  await requireAuth();
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("get_daily_metrics", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error || !data) {
    console.error("[daily-metrics] RPC error:", error);
    return [];
  }

  return (
    data as Array<{
      date: string;
      revenue: number;
      profit: number;
      fees: number;
      units: number;
      ad_spend: number;
    }>
  ).map((row) => ({
    date: row.date,
    revenue: Number(row.revenue),
    profit: Number(row.profit),
    fees: Number(row.fees),
    units: Number(row.units),
    adSpend: Number(row.ad_spend ?? 0),
  }));
}
