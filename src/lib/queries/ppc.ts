import { createServiceClient } from "@/lib/supabase/service";

export interface PpcProductRow {
  asin: string;
  title: string | null;
  imageUrl: string | null;
  adSpend: number;
  adSales: number;
  adOrders: number;
  impressions: number;
  clicks: number;
  totalSales: number;
  totalUnits: number;
  organicSales: number;
  organicRatio: number;
  totalCogs: number;
  totalFees: number;
  profit: number;
  acos: number;
  tacos: number;
  roas: number;
}

export async function getPpcOverview(from: Date, to: Date): Promise<PpcProductRow[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("get_ppc_overview", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error || !data) {
    console.error("[ppc] RPC error:", error);
    return [];
  }

  return (data as Array<Record<string, unknown>>).map((r) => ({
    asin: String(r.asin ?? ""),
    title: r.title as string | null,
    imageUrl: r.image_url as string | null,
    adSpend: Number(r.ad_spend ?? 0),
    adSales: Number(r.ad_sales ?? 0),
    adOrders: Number(r.ad_orders ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    totalSales: Number(r.total_sales ?? 0),
    totalUnits: Number(r.total_units ?? 0),
    organicSales: Number(r.organic_sales ?? 0),
    organicRatio: Number(r.organic_ratio ?? 0),
    totalCogs: Number(r.total_cogs ?? 0),
    totalFees: Number(r.total_fees ?? 0),
    profit: Number(r.profit ?? 0),
    acos: Number(r.acos ?? 0),
    tacos: Number(r.tacos ?? 0),
    roas: Number(r.roas ?? 0),
  }));
}
