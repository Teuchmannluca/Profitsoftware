import { createServiceClient } from "@/lib/supabase/service";
import { getRecentOrders, getOrderItems } from "@/lib/sp-api/orders";
import type { SpApiOrder, SpApiOrderItem } from "@/lib/sp-api/types";

export function mapSpApiOrderToRow(order: SpApiOrder) {
  return {
    amazon_order_id: order.AmazonOrderId,
    purchase_date: order.PurchaseDate,
    order_status: order.OrderStatus,
    fulfillment_channel: order.FulfillmentChannel,
    ship_country: order.ShippingAddress?.CountryCode ?? null,
    ship_postcode: order.ShippingAddress?.PostalCode ?? null,
    last_updated: order.LastUpdateDate,
    raw: order,
  };
}

export function mapSpApiItemToRow(item: SpApiOrderItem, orderId: string) {
  return {
    amazon_order_id: orderId,
    order_item_id: item.OrderItemId,
    sku: item.SellerSKU,
    asin: item.ASIN,
    qty: item.QuantityOrdered,
    item_price_gross: parseFloat(item.ItemPrice?.Amount ?? "0"),
    item_tax: parseFloat(item.ItemTax?.Amount ?? "0"),
    shipping_price: parseFloat(item.ShippingPrice?.Amount ?? "0"),
    promo_discount: parseFloat(item.PromotionDiscount?.Amount ?? "0"),
  };
}

export async function syncOrders(sinceOverride?: string): Promise<{
  ordersWritten: number;
  itemsWritten: number;
  error?: string;
}> {
  "use server";

  const supabase = createServiceClient();

  let since: Date;
  if (sinceOverride) {
    since = new Date(sinceOverride);
    console.log(`[orders-sync] Backfill mode: syncing from ${since.toISOString()}`);
  } else {
    const { data: lastSync } = await supabase
      .from("sync_log")
      .select("finished_at")
      .eq("pillar", "orders")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1)
      .single();

    since = lastSync?.finished_at
      ? new Date(lastSync.finished_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  console.log(`[orders-sync] Fetching orders since ${since.toISOString()}`);

  const { data: logEntry, error: logError } = await supabase
    .from("sync_log")
    .insert({ pillar: "orders", endpoint: "getOrders", status: "running" })
    .select("id")
    .single();

  if (logError || !logEntry) {
    return { ordersWritten: 0, itemsWritten: 0, error: `Failed to create sync log: ${logError?.message}` };
  }

  const logId = logEntry.id;

  try {
    const { Orders } = await getRecentOrders(since);
    console.log(`[orders-sync] Got ${Orders.length} orders total`);

    let ordersWritten = 0;
    let itemsWritten = 0;

    // Batch upsert orders in chunks of 50
    for (let i = 0; i < Orders.length; i += 50) {
      const chunk = Orders.slice(i, i + 50);
      const rows = chunk.map(mapSpApiOrderToRow);
      const { error: err } = await supabase
        .from("orders")
        .upsert(rows, { onConflict: "amazon_order_id" });
      if (err) {
        console.error(`[orders-sync] Order batch error:`, err.message);
      } else {
        ordersWritten += chunk.length;
      }
    }
    console.log(`[orders-sync] Upserted ${ordersWritten} orders`);

    // Fetch items for each order (rate limited by SP-API)
    for (let i = 0; i < Orders.length; i++) {
      const order = Orders[i];
      try {
        const { OrderItems } = await getOrderItems(order.AmazonOrderId);
        const itemRows = OrderItems.map((item) =>
          mapSpApiItemToRow(item, order.AmazonOrderId)
        );
        if (itemRows.length > 0) {
          const { error: err } = await supabase
            .from("order_items")
            .upsert(itemRows, { onConflict: "order_item_id" });
          if (err) {
            console.error(`[orders-sync] Item upsert error for ${order.AmazonOrderId}:`, err.message);
          } else {
            itemsWritten += itemRows.length;
          }
        }
      } catch (itemErr) {
        console.error(`[orders-sync] Failed to get items for ${order.AmazonOrderId}:`, itemErr);
      }

      if ((i + 1) % 50 === 0) {
        console.log(`[orders-sync] Progress: ${i + 1}/${Orders.length} orders processed, ${itemsWritten} items`);
      }
    }

    console.log(`[orders-sync] Done: ${ordersWritten} orders, ${itemsWritten} items`);

    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_written: ordersWritten + itemsWritten,
      })
      .eq("id", logId);

    return { ordersWritten, itemsWritten };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[orders-sync] ERROR:`, message);

    await supabase
      .from("sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", logId);

    return { ordersWritten: 0, itemsWritten: 0, error: message };
  }
}
