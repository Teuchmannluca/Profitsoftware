import { createServiceClient } from "@/lib/supabase/service";
import { getShipmentEvents } from "@/lib/sp-api/finances";
import type { ShipmentEvent, FinancialShipmentItem } from "@/lib/sp-api/types";

function parseItemFees(item: FinancialShipmentItem) {
  const feeBreakdown: Record<string, number> = {};
  let totalFees = 0;

  for (const fee of item.ItemFeeList ?? []) {
    const amount = Math.abs(fee.FeeAmount.Amount);
    feeBreakdown[fee.FeeType] = amount;
    totalFees += amount;
  }

  return {
    totalFees,
    referralFee: feeBreakdown["Commission"] ?? feeBreakdown["ReferralFee"] ?? 0,
    fbaFee: feeBreakdown["FBAPerUnitFulfillmentFee"] ?? feeBreakdown["FBAFees"] ?? 0,
    closingFee: feeBreakdown["VariableClosingFee"] ?? 0,
    digitalServicesFee: feeBreakdown["DigitalServicesFee"] ?? 0,
    ...feeBreakdown,
  };
}

function parseItemCharges(item: FinancialShipmentItem) {
  const charges: Record<string, number> = {};
  for (const charge of item.ItemChargeList ?? []) {
    charges[charge.ChargeType] = charge.ChargeAmount.Amount;
  }
  return charges;
}

export async function syncFinances(): Promise<{
  reconciled: number;
  error?: string;
}> {
  "use server";

  const supabase = createServiceClient();

  // Get last successful finance sync
  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("finished_at")
    .eq("pillar", "finances")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const since = lastSync?.finished_at
    ? new Date(Math.min(new Date(lastSync.finished_at).getTime(), sevenDaysAgo.getTime()))
    : sevenDaysAgo;

  // Create sync log entry
  const { data: logEntry, error: logError } = await supabase
    .from("sync_log")
    .insert({ pillar: "finances", endpoint: "listFinancialEvents", status: "running" })
    .select("id")
    .single();

  if (logError || !logEntry) {
    return { reconciled: 0, error: `Failed to create sync log: ${logError?.message}` };
  }

  const logId = logEntry.id;

  try {
    console.log(`[finances] Fetching shipment events since ${since.toISOString()}`);
    const events = await getShipmentEvents(since);
    console.log(`[finances] Got ${events.length} shipment events`);

    // Load COGS for profit calculation
    const { data: cogsData } = await supabase
      .from("cogs_periods")
      .select("asin, total_cogs")
      .is("valid_to", null);
    const cogsMap = new Map(
      cogsData?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
    );

    // Load SKU -> ASIN mapping from products table
    const { data: productData } = await supabase
      .from("products")
      .select("sku, asin");
    const skuToAsin = new Map(productData?.map((p) => [p.sku, p.asin]) ?? []);

    let reconciled = 0;

    for (const event of events) {
      for (const item of event.ShipmentItemList ?? []) {
        const actualFees = parseItemFees(item);
        const charges = parseItemCharges(item);

        const principal = charges["Principal"] ?? 0;
        const tax = charges["Tax"] ?? 0;
        const asin = skuToAsin.get(item.SellerSKU);
        const cogs = asin ? cogsMap.get(asin) ?? 0 : 0;

        const actualProfit = principal - tax - actualFees.totalFees - (cogs * item.QuantityShipped);

        // Update order_items by (amazon_order_id + sku)
        const { error: updateErr } = await supabase
          .from("order_items")
          .update({
            actual_fees: actualFees,
            actual_profit: actualProfit,
            is_settled: true,
            settled_at: new Date().toISOString(),
            // Also update the actual sale price from charges if we have it
            ...(principal > 0 ? { item_price_gross: principal + tax } : {}),
          })
          .eq("amazon_order_id", event.AmazonOrderId)
          .eq("sku", item.SellerSKU);

        if (!updateErr) {
          reconciled++;
        }
      }
    }

    console.log(`[finances] Reconciled ${reconciled} items`);

    await supabase
      .from("sync_log")
      .update({ status: "success", finished_at: new Date().toISOString(), rows_written: reconciled })
      .eq("id", logId);

    return { reconciled };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[finances] ERROR:`, message);

    await supabase
      .from("sync_log")
      .update({ status: "error", finished_at: new Date().toISOString(), error: message })
      .eq("id", logId);

    return { reconciled: 0, error: message };
  }
}
