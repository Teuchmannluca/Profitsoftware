import { createServiceClient } from "@/lib/supabase/service";
import {
  getInventorySummaries,
  getCatalogItemImage,
} from "@/lib/sp-api/inventory";
import { getLondonToday } from "@/lib/queries/sales";
import type { InventorySummary } from "@/lib/sp-api/types";

export function mapSummaryToProduct(summary: InventorySummary) {
  return {
    sku: summary.sellerSku,
    asin: summary.asin,
    fnsku: summary.fnSku,
    title: summary.productName ?? null,
    active: true,
    last_synced_at: new Date().toISOString(),
  };
}

export function mapSummaryToSnapshot(summary: InventorySummary, date: string) {
  const details = summary.inventoryDetails;
  const reserved = details?.reservedQuantity;
  const unfulfillable = details?.unfulfillableQuantity;
  return {
    date,
    sku: summary.sellerSku,
    asin: summary.asin,
    afn_fulfillable: details?.fulfillableQuantity ?? 0,
    afn_reserved: reserved?.totalReservedQuantity ?? 0,
    afn_unsellable: unfulfillable?.totalUnfulfillableQuantity ?? 0,
    afn_inbound: 0,
    mfn_quantity: 0,
    total_quantity: summary.totalQuantity ?? 0,
    afn_researching: details?.researchingQuantity?.totalResearchingQuantity ?? 0,
    afn_customer_damaged: unfulfillable?.customerDamagedQuantity ?? 0,
    afn_warehouse_damaged: unfulfillable?.warehouseDamagedQuantity ?? 0,
    afn_distributor_damaged: unfulfillable?.distributorDamagedQuantity ?? 0,
    afn_carrier_damaged: unfulfillable?.carrierDamagedQuantity ?? 0,
    afn_defective: unfulfillable?.defectiveQuantity ?? 0,
    afn_pending_customer_order: reserved?.pendingCustomerOrderQuantity ?? 0,
    afn_fc_processing: reserved?.fcProcessingQuantity ?? 0,
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
    console.log("[inventory-sync] Fetching inventory summaries from SP-API...");
    const summaries = await getInventorySummaries();
    console.log(`[inventory-sync] Got ${summaries.length} summaries`);

    if (summaries.length > 0) {
      console.log("[inventory-sync] Sample:", JSON.stringify(summaries[0], null, 2));
    }

    const { year, month, day } = getLondonToday();
    const today = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const productRows = summaries.map((s) => mapSummaryToProduct(s));
    const snapshotRows = summaries.map((s) => mapSummaryToSnapshot(s, today));

    // Batch upsert products in chunks of 100
    let productsWritten = 0;
    for (let i = 0; i < productRows.length; i += 100) {
      const chunk = productRows.slice(i, i + 100);
      const { error: err } = await supabase
        .from("products")
        .upsert(chunk, { onConflict: "sku" });
      if (err) {
        console.error(`[inventory-sync] Product batch error:`, err.message);
      } else {
        productsWritten += chunk.length;
      }
    }
    console.log(`[inventory-sync] Upserted ${productsWritten} products`);

    // Batch upsert snapshots in chunks of 100
    let snapshotsWritten = 0;
    for (let i = 0; i < snapshotRows.length; i += 100) {
      const chunk = snapshotRows.slice(i, i + 100);
      const { error: err } = await supabase
        .from("inventory_snapshots")
        .upsert(chunk, { onConflict: "date,sku" });
      if (err) {
        console.error(`[inventory-sync] Snapshot batch error:`, err.message);
      } else {
        snapshotsWritten += chunk.length;
      }
    }
    console.log(`[inventory-sync] Upserted ${snapshotsWritten} snapshots`);

    // Fetch images for products missing them
    const { data: missingImages } = await supabase
      .from("products")
      .select("asin")
      .is("image_url", null)
      .not("asin", "is", null);

    const uniqueAsins = [...new Set((missingImages ?? []).map((r) => r.asin))];
    console.log(`[inventory-sync] ${uniqueAsins.length} ASINs need images`);

    let imagesUpdated = 0;
    let imagesFailed = 0;
    for (const asin of uniqueAsins) {
      try {
        const imageUrl = await getCatalogItemImage(asin);
        if (imageUrl) {
          await supabase
            .from("products")
            .update({ image_url: imageUrl })
            .eq("asin", asin);
          imagesUpdated++;
        }
      } catch {
        imagesFailed++;
      }
      // Throttle: 2 requests/sec limit on Catalog API
      await new Promise((r) => setTimeout(r, 550));
    }
    if (imagesFailed > 0) {
      console.log(`[inventory-sync] ${imagesFailed} ASINs not found in catalog (old/inactive listings)`);
    }

    console.log(`[inventory-sync] Done: ${productsWritten} products, ${snapshotsWritten} snapshots, ${imagesUpdated} images`);

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
    console.error(`[inventory-sync] ERROR:`, message);

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
