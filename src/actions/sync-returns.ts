import { createServiceClient } from "@/lib/supabase/service";
import { getRefundEvents } from "@/lib/sp-api/returns";
import type { ShipmentEvent, FinancialShipmentItem } from "@/lib/sp-api/types";

function mapRefundEventToReturns(event: ShipmentEvent) {
  return event.ShipmentItemList.map((item: FinancialShipmentItem) => {
    const charges = item.ItemChargeList ?? [];
    const totalRefund = charges.reduce(
      (sum, c) => sum + Math.abs(c.ChargeAmount.Amount),
      0
    );

    return {
      amazon_order_id: event.AmazonOrderId,
      sku: item.SellerSKU,
      return_quantity: item.QuantityShipped,
      return_request_date: event.PostedDate,
      refunded_amount: totalRefund,
      return_status: "Refunded",
      resolution: "Refund",
    };
  });
}

export async function syncReturns(): Promise<{
  refundsWritten: number;
  error?: string;
}> {
  "use server";

  const supabase = createServiceClient();

  // Determine sync start date
  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("finished_at")
    .eq("pillar", "returns")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  const since = lastSync?.finished_at
    ? new Date(lastSync.finished_at)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  console.log(`[returns-sync] Fetching refund events since ${since.toISOString()}`);

  const { data: logEntry, error: logError } = await supabase
    .from("sync_log")
    .insert({
      pillar: "returns",
      endpoint: "financialEvents/RefundEventList",
      status: "running",
    })
    .select("id")
    .single();

  if (logError || !logEntry) {
    return {
      refundsWritten: 0,
      error: `Failed to create sync log: ${logError?.message ?? "unknown"}`,
    };
  }

  const logId = logEntry.id;

  try {
    const refundEvents = await getRefundEvents(since);
    console.log(`[returns-sync] Got ${refundEvents.length} refund events`);

    const returnRows = refundEvents.flatMap(mapRefundEventToReturns);
    console.log(`[returns-sync] Mapped to ${returnRows.length} return rows`);

    let refundsWritten = 0;

    // Batch upsert returns in chunks of 100
    for (let i = 0; i < returnRows.length; i += 100) {
      const chunk = returnRows.slice(i, i + 100);
      const { error: err } = await supabase
        .from("returns")
        .upsert(chunk, { onConflict: "amazon_order_id,sku" });
      if (err) {
        console.error(`[returns-sync] Return batch error:`, err.message);
      } else {
        refundsWritten += chunk.length;
      }
    }
    console.log(`[returns-sync] Upserted ${refundsWritten} returns`);

    // Update order_items refund_status where matching order exists
    const orderIds = [...new Set(returnRows.map((r) => r.amazon_order_id))];
    if (orderIds.length > 0) {
      for (let i = 0; i < orderIds.length; i += 100) {
        const chunk = orderIds.slice(i, i + 100);
        await supabase
          .from("order_items")
          .update({ refund_status: "refunded" })
          .in("amazon_order_id", chunk);
      }
      console.log(`[returns-sync] Updated refund_status for ${orderIds.length} orders`);
    }

    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_written: refundsWritten,
      })
      .eq("id", logId);

    console.log(`[returns-sync] Done: ${refundsWritten} returns written`);

    return { refundsWritten };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[returns-sync] ERROR:`, message);

    await supabase
      .from("sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", logId);

    return { refundsWritten: 0, error: message };
  }
}
