import { createClient } from "@/lib/supabase/server";
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

export async function syncOrders(): Promise<{
  ordersWritten: number;
  itemsWritten: number;
  error?: string;
}> {
  "use server";

  const supabase = await createClient();

  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("finished_at")
    .eq("pillar", "orders")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  const since = lastSync?.finished_at
    ? new Date(lastSync.finished_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({ pillar: "orders", endpoint: "getOrders", status: "running" })
    .select("id")
    .single();

  const logId = logEntry!.id;

  try {
    const { Orders } = await getRecentOrders(since);

    let ordersWritten = 0;
    let itemsWritten = 0;

    for (const order of Orders) {
      const row = mapSpApiOrderToRow(order);
      await supabase
        .from("orders")
        .upsert(row, { onConflict: "amazon_order_id" });
      ordersWritten++;

      const { OrderItems } = await getOrderItems(order.AmazonOrderId);
      for (const item of OrderItems) {
        const itemRow = mapSpApiItemToRow(item, order.AmazonOrderId);
        await supabase
          .from("order_items")
          .upsert(itemRow, { onConflict: "order_item_id" });
        itemsWritten++;
      }
    }

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
