"use server";

import { createServiceClient } from "@/lib/supabase/service";
import {
  fetchCampaignSpend,
  fetchAdvertisedProductSpend,
  fetchTargetingSpend,
} from "@/lib/ads-api/reports";

export async function syncAds(): Promise<{ rowsWritten: number }> {
  const supabase = createServiceClient();

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400000);
  const startDate = start.toISOString().slice(0, 10);
  const endDate = end.toISOString().slice(0, 10);

  const [campaignLog, productLog, targetingLog] = await Promise.all([
    supabase
      .from("sync_log")
      .insert({ pillar: "ads", endpoint: "spCampaigns", status: "running" })
      .select("id")
      .single(),
    supabase
      .from("sync_log")
      .insert({ pillar: "ads", endpoint: "spAdvertisedProduct", status: "running" })
      .select("id")
      .single(),
    supabase
      .from("sync_log")
      .insert({ pillar: "ads", endpoint: "spTargeting", status: "running" })
      .select("id")
      .single(),
  ]);

  let totalWritten = 0;

  const syncCampaigns = async () => {
    const logId = campaignLog.data?.id;
    try {
      const rows = await fetchCampaignSpend(startDate, endDate);
      console.log(`[ads-sync] Fetched ${rows.length} campaign-day rows`);

      let written = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100).map((r) => ({
          date: r.date,
          campaign_id: r.campaignId,
          campaign_name: r.campaignName,
          impressions: r.impressions,
          clicks: r.clicks,
          spend: r.spend,
          ad_sales: r.sales,
          ad_orders: r.unitsSold,
        }));

        const { error } = await supabase
          .from("ad_spend_daily")
          .upsert(chunk, { onConflict: "date,campaign_id" });

        if (error) console.error("[ads-sync] Campaign upsert error:", error.message);
        else written += chunk.length;
      }

      if (logId) {
        await supabase
          .from("sync_log")
          .update({ status: "success", finished_at: new Date().toISOString(), rows_written: written })
          .eq("id", logId);
      }
      console.log(`[ads-sync] Campaigns: ${written} rows`);
      return written;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[ads-sync] Campaigns failed:", message);
      if (logId) {
        await supabase
          .from("sync_log")
          .update({ status: "error", finished_at: new Date().toISOString(), error: message })
          .eq("id", logId);
      }
      return 0;
    }
  };

  const syncProducts = async () => {
    const logId = productLog.data?.id;
    try {
      const rows = await fetchAdvertisedProductSpend(startDate, endDate);
      console.log(`[ads-sync] Fetched ${rows.length} product-day rows`);

      let written = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100).map((r) => ({
          date: r.date,
          campaign_id: r.campaignId,
          ad_group_id: r.adGroupId,
          asin: r.advertisedAsin,
          campaign_name: r.campaignName,
          ad_group_name: r.adGroupName,
          sku: r.advertisedSku,
          impressions: r.impressions,
          clicks: r.clicks,
          spend: r.spend,
          ad_sales: r.sales,
          ad_orders: r.orders,
        }));

        const { error } = await supabase
          .from("ad_product_daily")
          .upsert(chunk, { onConflict: "date,campaign_id,ad_group_id,asin" });

        if (error) console.error("[ads-sync] Product upsert error:", error.message);
        else written += chunk.length;
      }

      if (logId) {
        await supabase
          .from("sync_log")
          .update({ status: "success", finished_at: new Date().toISOString(), rows_written: written })
          .eq("id", logId);
      }
      console.log(`[ads-sync] Products: ${written} rows`);
      return written;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[ads-sync] Products failed:", message);
      if (logId) {
        await supabase
          .from("sync_log")
          .update({ status: "error", finished_at: new Date().toISOString(), error: message })
          .eq("id", logId);
      }
      return 0;
    }
  };

  const syncTargeting = async () => {
    const logId = targetingLog.data?.id;
    try {
      const rows = await fetchTargetingSpend(startDate, endDate);
      console.log(`[ads-sync] Fetched ${rows.length} targeting-day rows`);

      let written = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100).map((r) => ({
          date: r.date,
          campaign_id: r.campaignId,
          ad_group_id: r.adGroupId,
          targeting_id: r.targetingId,
          campaign_name: r.campaignName,
          ad_group_name: r.adGroupName,
          targeting_type: r.targetingType,
          targeting_text: r.targetingText,
          match_type: r.matchType,
          impressions: r.impressions,
          clicks: r.clicks,
          spend: r.spend,
          ad_sales: r.sales,
          ad_orders: r.orders,
        }));

        const { error } = await supabase
          .from("ad_targeting_daily")
          .upsert(chunk, { onConflict: "date,campaign_id,ad_group_id,targeting_id" });

        if (error) console.error("[ads-sync] Targeting upsert error:", error.message);
        else written += chunk.length;
      }

      if (logId) {
        await supabase
          .from("sync_log")
          .update({ status: "success", finished_at: new Date().toISOString(), rows_written: written })
          .eq("id", logId);
      }
      console.log(`[ads-sync] Targeting: ${written} rows`);
      return written;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[ads-sync] Targeting failed:", message);
      if (logId) {
        await supabase
          .from("sync_log")
          .update({ status: "error", finished_at: new Date().toISOString(), error: message })
          .eq("id", logId);
      }
      return 0;
    }
  };

  // Run sequentially — Amazon queues parallel requests causing timeouts
  totalWritten += await syncCampaigns();
  totalWritten += await syncProducts();
  totalWritten += await syncTargeting();

  console.log(`[ads-sync] Done, ${totalWritten} total rows written`);
  return { rowsWritten: totalWritten };
}
