import { createServiceClient } from "@/lib/supabase/service";
import {
  getInventorySummaries,
  getCatalogItemImage,
} from "@/lib/sp-api/inventory";
import type { InventorySummary } from "@/lib/sp-api/types";

export function mapSummaryToProduct(summary: InventorySummary) {
  return {
    sku: summary.sellerSku,
    asin: summary.asin,
    fnsku: summary.fnSku,
    title: summary.productName,
    active: true,
    last_synced_at: new Date().toISOString(),
  };
}

export function mapSummaryToSnapshot(summary: InventorySummary, date: string) {
  return {
    date,
    sku: summary.sellerSku,
    asin: summary.asin,
    afn_fulfillable: summary.inventoryDetails?.fulfillableQuantity ?? 0,
    afn_reserved:
      summary.inventoryDetails?.reservedQuantity?.totalReservedQuantity ?? 0,
    afn_unsellable:
      summary.inventoryDetails?.unfulfillableQuantity
        ?.totalUnfulfillableQuantity ?? 0,
    afn_inbound: 0,
    mfn_quantity: 0,
    total_quantity: summary.totalQuantity,
  };
}

export async function syncInventory(): Promise<{
  productsWritten: number;
  snapshotsWritten: number;
  imagesUpdated: number;
  error?: string;
}> {
  "use server";

  const supabase = createServiceClient();

  const { data: logEntry, error: logError } = await supabase
    .from("sync_log")
    .insert({
      pillar: "inventory",
      endpoint: "getInventorySummaries",
      status: "running",
    })
    .select("id")
    .single();

  if (logError || !logEntry) {
    return {
      productsWritten: 0,
      snapshotsWritten: 0,
      imagesUpdated: 0,
      error: `Failed to create sync log: ${logError?.message ?? "unknown"}`,
    };
  }

  const logId = logEntry.id;

  try {
    const summaries = await getInventorySummaries();
    const today = new Date().toISOString().split("T")[0];

    let productsWritten = 0;
    let snapshotsWritten = 0;

    for (const summary of summaries) {
      const productRow = mapSummaryToProduct(summary);
      await supabase
        .from("products")
        .upsert(productRow, { onConflict: "sku" });
      productsWritten++;

      const snapshotRow = mapSummaryToSnapshot(summary, today);
      await supabase
        .from("inventory_snapshots")
        .upsert(snapshotRow, { onConflict: "date,sku" });
      snapshotsWritten++;
    }

    const { data: missingImages } = await supabase
      .from("products")
      .select("asin")
      .is("image_url", null)
      .not("asin", "is", null);

    let imagesUpdated = 0;

    for (const { asin } of missingImages ?? []) {
      const imageUrl = await getCatalogItemImage(asin);
      if (imageUrl) {
        await supabase
          .from("products")
          .update({ image_url: imageUrl })
          .eq("asin", asin);
        imagesUpdated++;
      }
    }

    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_written: productsWritten + snapshotsWritten,
      })
      .eq("id", logId);

    return { productsWritten, snapshotsWritten, imagesUpdated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await supabase
      .from("sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", logId);

    return {
      productsWritten: 0,
      snapshotsWritten: 0,
      imagesUpdated: 0,
      error: message,
    };
  }
}
