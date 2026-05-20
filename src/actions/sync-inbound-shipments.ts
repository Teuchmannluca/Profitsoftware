import { createServiceClient } from "@/lib/supabase/service";
import {
  getInboundShipments,
  getShipmentItems,
} from "@/lib/sp-api/inbound-shipments";
import type {
  InboundShipmentData,
  InboundShipmentItem,
} from "@/lib/sp-api/types";

export function mapShipmentToRow(shipment: InboundShipmentData) {
  return {
    shipment_id: shipment.ShipmentId,
    shipment_name: shipment.ShipmentName,
    shipment_status: shipment.ShipmentStatus,
    destination_fc_id: shipment.DestinationFulfillmentCenterId,
    are_cases_required: shipment.AreCasesRequired ?? false,
    last_synced_at: new Date().toISOString(),
  };
}

export function mapShipmentItemToRow(
  item: InboundShipmentItem,
  shipmentId: string
) {
  return {
    shipment_id: shipmentId,
    seller_sku: item.SellerSKU,
    fnsku: item.FulfillmentNetworkSKU ?? null,
    quantity_shipped: item.QuantityShipped ?? 0,
    quantity_received: item.QuantityReceived ?? 0,
    quantity_in_case: item.QuantityInCase ?? null,
    last_synced_at: new Date().toISOString(),
  };
}

export async function syncInboundShipments(): Promise<{
  shipmentsWritten: number;
  itemsWritten: number;
  error?: string;
}> {
  "use server";

  const supabase = createServiceClient();

  const { data: logEntry, error: logError } = await supabase
    .from("sync_log")
    .insert({
      pillar: "inbound_shipments",
      endpoint: "getInboundShipments",
      status: "running",
    })
    .select("id")
    .single();

  if (logError || !logEntry) {
    return {
      shipmentsWritten: 0,
      itemsWritten: 0,
      error: `Failed to create sync log: ${logError?.message ?? "unknown"}`,
    };
  }

  const logId = logEntry.id;

  try {
    console.log("[inbound-sync] Fetching inbound shipments from SP-API...");
    const shipments = await getInboundShipments([
      "WORKING",
      "SHIPPED",
      "IN_TRANSIT",
      "RECEIVING",
      "DELIVERED",
      "CHECKED_IN",
      "CLOSED",
    ]);
    console.log(`[inbound-sync] Got ${shipments.length} shipments`);

    const shipmentRows = shipments.map((s) => mapShipmentToRow(s));

    let shipmentsWritten = 0;
    for (let i = 0; i < shipmentRows.length; i += 100) {
      const chunk = shipmentRows.slice(i, i + 100);
      const { error: err } = await supabase
        .from("inbound_shipments")
        .upsert(chunk, { onConflict: "shipment_id" });
      if (err) {
        console.error(`[inbound-sync] Shipment batch error:`, err.message);
      } else {
        shipmentsWritten += chunk.length;
      }
    }
    console.log(`[inbound-sync] Upserted ${shipmentsWritten} shipments`);

    let itemsWritten = 0;
    for (const shipment of shipments) {
      try {
        const items = await getShipmentItems(shipment.ShipmentId);
        if (items.length === 0) continue;

        const itemRows = items.map((item) =>
          mapShipmentItemToRow(item, shipment.ShipmentId)
        );

        for (let i = 0; i < itemRows.length; i += 100) {
          const chunk = itemRows.slice(i, i + 100);
          const { error: err } = await supabase
            .from("inbound_shipment_items")
            .upsert(chunk, { onConflict: "shipment_id,seller_sku" });
          if (err) {
            console.error(
              `[inbound-sync] Item batch error for ${shipment.ShipmentId}:`,
              err.message
            );
          } else {
            itemsWritten += chunk.length;
          }
        }
      } catch (err) {
        console.error(
          `[inbound-sync] Failed to fetch items for ${shipment.ShipmentId}:`,
          err instanceof Error ? err.message : err
        );
      }

      await new Promise((r) => setTimeout(r, 500));
    }
    console.log(`[inbound-sync] Upserted ${itemsWritten} shipment items`);

    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_written: shipmentsWritten + itemsWritten,
      })
      .eq("id", logId);

    return { shipmentsWritten, itemsWritten };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[inbound-sync] ERROR:`, message);

    await supabase
      .from("sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", logId);

    return { shipmentsWritten: 0, itemsWritten: 0, error: message };
  }
}
