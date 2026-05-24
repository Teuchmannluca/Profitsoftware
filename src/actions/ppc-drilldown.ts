"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/auth-guard";

export interface PpcCampaignRow {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  adSales: number;
  adOrders: number;
}

export interface PpcAdGroupRow {
  adGroupId: string;
  adGroupName: string;
  impressions: number;
  clicks: number;
  spend: number;
  adSales: number;
  adOrders: number;
}

export interface PpcKeywordRow {
  targetingId: string;
  targetingText: string;
  targetingType: string;
  matchType: string;
  impressions: number;
  clicks: number;
  spend: number;
  adSales: number;
  adOrders: number;
}

function toLocalDate(d: Date): string {
  const utc = new Date(d.getTime());
  const london = utc.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return london;
}

export async function getPpcCampaigns(
  asin: string,
  from: Date,
  to: Date
): Promise<PpcCampaignRow[]> {
  await requireAuth();
  const supabase = createServiceClient();
  const fromDate = toLocalDate(from);
  const toDate = toLocalDate(to);

  const { data, error } = await supabase.rpc("get_ppc_campaigns_for_asin", {
    p_asin: asin,
    p_from: fromDate,
    p_to: toDate,
  });

  if (error || !data) {
    // Fallback: direct query if RPC doesn't exist yet
    const { data: rows, error: err2 } = await supabase
      .from("ad_product_daily")
      .select("campaign_id, campaign_name, impressions, clicks, spend, ad_sales, ad_orders")
      .eq("asin", asin)
      .gte("date", fromDate)
      .lte("date", toDate);

    if (err2 || !rows) return [];

    const grouped = new Map<string, PpcCampaignRow>();
    for (const r of rows) {
      const key = r.campaign_id;
      const existing = grouped.get(key);
      if (existing) {
        existing.impressions += Number(r.impressions ?? 0);
        existing.clicks += Number(r.clicks ?? 0);
        existing.spend += Number(r.spend ?? 0);
        existing.adSales += Number(r.ad_sales ?? 0);
        existing.adOrders += Number(r.ad_orders ?? 0);
      } else {
        grouped.set(key, {
          campaignId: r.campaign_id,
          campaignName: r.campaign_name ?? "",
          impressions: Number(r.impressions ?? 0),
          clicks: Number(r.clicks ?? 0),
          spend: Number(r.spend ?? 0),
          adSales: Number(r.ad_sales ?? 0),
          adOrders: Number(r.ad_orders ?? 0),
        });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => b.spend - a.spend);
  }

  return (data as Array<Record<string, unknown>>).map((r) => ({
    campaignId: String(r.campaign_id ?? ""),
    campaignName: String(r.campaign_name ?? ""),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spend: Number(r.spend ?? 0),
    adSales: Number(r.ad_sales ?? 0),
    adOrders: Number(r.ad_orders ?? 0),
  }));
}

export async function getPpcAdGroups(
  asin: string,
  campaignId: string,
  from: Date,
  to: Date
): Promise<PpcAdGroupRow[]> {
  await requireAuth();
  const supabase = createServiceClient();
  const fromDate = toLocalDate(from);
  const toDate = toLocalDate(to);

  const { data: rows, error } = await supabase
    .from("ad_product_daily")
    .select("ad_group_id, ad_group_name, impressions, clicks, spend, ad_sales, ad_orders")
    .eq("asin", asin)
    .eq("campaign_id", campaignId)
    .gte("date", fromDate)
    .lte("date", toDate);

  if (error || !rows) return [];

  const grouped = new Map<string, PpcAdGroupRow>();
  for (const r of rows) {
    const key = r.ad_group_id;
    const existing = grouped.get(key);
    if (existing) {
      existing.impressions += Number(r.impressions ?? 0);
      existing.clicks += Number(r.clicks ?? 0);
      existing.spend += Number(r.spend ?? 0);
      existing.adSales += Number(r.ad_sales ?? 0);
      existing.adOrders += Number(r.ad_orders ?? 0);
    } else {
      grouped.set(key, {
        adGroupId: r.ad_group_id,
        adGroupName: r.ad_group_name ?? "",
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        spend: Number(r.spend ?? 0),
        adSales: Number(r.ad_sales ?? 0),
        adOrders: Number(r.ad_orders ?? 0),
      });
    }
  }
  return Array.from(grouped.values()).sort((a, b) => b.spend - a.spend);
}

export async function getPpcKeywords(
  adGroupId: string,
  from: Date,
  to: Date
): Promise<PpcKeywordRow[]> {
  await requireAuth();
  const supabase = createServiceClient();
  const fromDate = toLocalDate(from);
  const toDate = toLocalDate(to);

  const { data: rows, error } = await supabase
    .from("ad_targeting_daily")
    .select("targeting_id, targeting_text, targeting_type, match_type, impressions, clicks, spend, ad_sales, ad_orders")
    .eq("ad_group_id", adGroupId)
    .gte("date", fromDate)
    .lte("date", toDate);

  if (error || !rows) return [];

  const grouped = new Map<string, PpcKeywordRow>();
  for (const r of rows) {
    const key = r.targeting_id;
    const existing = grouped.get(key);
    if (existing) {
      existing.impressions += Number(r.impressions ?? 0);
      existing.clicks += Number(r.clicks ?? 0);
      existing.spend += Number(r.spend ?? 0);
      existing.adSales += Number(r.ad_sales ?? 0);
      existing.adOrders += Number(r.ad_orders ?? 0);
    } else {
      grouped.set(key, {
        targetingId: r.targeting_id,
        targetingText: r.targeting_text ?? "",
        targetingType: r.targeting_type ?? "",
        matchType: r.match_type ?? "",
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        spend: Number(r.spend ?? 0),
        adSales: Number(r.ad_sales ?? 0),
        adOrders: Number(r.ad_orders ?? 0),
      });
    }
  }
  return Array.from(grouped.values()).sort((a, b) => b.spend - a.spend);
}
