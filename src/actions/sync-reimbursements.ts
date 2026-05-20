import { createServiceClient } from "@/lib/supabase/service";
import { getReimbursementEvents } from "@/lib/sp-api/reimbursements";

export async function syncReimbursements(): Promise<{
  written: number;
  error?: string;
}> {
  "use server";

  const supabase = createServiceClient();

  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("finished_at")
    .eq("pillar", "reimbursements")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
  const since = lastSync?.finished_at
    ? new Date(Math.min(new Date(lastSync.finished_at).getTime(), ninetyDaysAgo.getTime()))
    : ninetyDaysAgo;

  const { data: logEntry, error: logError } = await supabase
    .from("sync_log")
    .insert({ pillar: "reimbursements", endpoint: "listFinancialEvents", status: "running" })
    .select("id")
    .single();

  if (logError || !logEntry) {
    return { written: 0, error: `Failed to create sync log: ${logError?.message}` };
  }

  const logId = logEntry.id;

  try {
    console.log(`[reimbursements-sync] Fetching events since ${since.toISOString()}`);
    const { adjustments, safetClaims } = await getReimbursementEvents(since);
    console.log(`[reimbursements-sync] Got ${adjustments.length} adjustments, ${safetClaims.length} SAFE-T claims`);

    const rows: Array<Record<string, unknown>> = [];

    for (const adj of adjustments) {
      if (adj.AdjustmentItemList && adj.AdjustmentItemList.length > 0) {
        for (const item of adj.AdjustmentItemList) {
          const sourceId = `adj_${adj.PostedDate}_${item.SellerSKU}_${item.TotalAmount?.Amount}`;
          rows.push({
            amazon_order_id: null,
            asin: item.ASIN ?? null,
            sku: item.SellerSKU ?? null,
            reason: adj.AdjustmentType,
            quantity: item.Quantity ?? 1,
            amount: item.TotalAmount?.Amount ?? 0,
            currency: item.TotalAmount?.CurrencyCode ?? "GBP",
            status: "completed",
            claim_id: null,
            event_date: adj.PostedDate?.slice(0, 10) ?? null,
            source_type: "adjustment",
            source_id: sourceId,
          });
        }
      } else {
        const sourceId = `adj_${adj.PostedDate}_${adj.AdjustmentType}_${adj.AdjustmentAmount?.Amount}`;
        rows.push({
          amazon_order_id: null,
          asin: null,
          sku: null,
          reason: adj.AdjustmentType,
          quantity: 1,
          amount: adj.AdjustmentAmount?.Amount ?? 0,
          currency: adj.AdjustmentAmount?.CurrencyCode ?? "GBP",
          status: "completed",
          claim_id: null,
          event_date: adj.PostedDate?.slice(0, 10) ?? null,
          source_type: "adjustment",
          source_id: sourceId,
        });
      }
    }

    for (const claim of safetClaims) {
      rows.push({
        amazon_order_id: null,
        asin: null,
        sku: null,
        reason: claim.ReasonCode ?? "SAFE-T Claim",
        quantity: 1,
        amount: claim.ReimbursedAmount?.Amount ?? 0,
        currency: claim.ReimbursedAmount?.CurrencyCode ?? "GBP",
        status: "completed",
        claim_id: claim.SAFETClaimId ?? null,
        event_date: claim.PostedDate?.slice(0, 10) ?? null,
        source_type: "safet",
        source_id: `safet_${claim.SAFETClaimId}`,
      });
    }

    let written = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error: err } = await supabase
        .from("reimbursements")
        .upsert(chunk, { onConflict: "source_type,source_id", ignoreDuplicates: true });
      if (err) {
        console.error(`[reimbursements-sync] Upsert error:`, err.message);
      } else {
        written += chunk.length;
      }
    }

    console.log(`[reimbursements-sync] Wrote ${written} reimbursement rows`);

    await supabase
      .from("sync_log")
      .update({ status: "success", finished_at: new Date().toISOString(), rows_written: written })
      .eq("id", logId);

    return { written };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[reimbursements-sync] ERROR:`, message);

    await supabase
      .from("sync_log")
      .update({ status: "error", finished_at: new Date().toISOString(), error: message })
      .eq("id", logId);

    return { written: 0, error: message };
  }
}
