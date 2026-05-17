import { createServiceClient } from "@/lib/supabase/service";
import { getRecentOrders, getOrderItems } from "@/lib/sp-api/orders";
import { getFeesEstimateForASIN } from "@/lib/sp-api/fees";
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

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const lastSyncDate = lastSync?.finished_at ? new Date(lastSync.finished_at) : yesterday;
    // Always go back at least 24h to catch orders that changed status
    since = lastSyncDate < yesterday ? lastSyncDate : yesterday;
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

    // Fetch items for each order — rate limit: 0.5 req/sec (burst 30)
    // Throttle to ~2 seconds between calls to stay safe
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
      } catch (itemErr: unknown) {
        const msg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        if (msg.includes("429") || msg.includes("QuotaExceeded")) {
          console.log(`[orders-sync] Rate limited at order ${i + 1}/${Orders.length}, waiting 60s...`);
          await new Promise((r) => setTimeout(r, 60000));
          i--; // retry this order
          continue;
        }
        console.error(`[orders-sync] Failed to get items for ${order.AmazonOrderId}:`, msg);
      }

      // Throttle: wait 2s between getOrderItems calls
      await new Promise((r) => setTimeout(r, 2000));

      if ((i + 1) % 25 === 0) {
        console.log(`[orders-sync] Progress: ${i + 1}/${Orders.length} orders processed, ${itemsWritten} items`);
      }
    }

    // Fill in prices for Pending orders (£0) using last known price per ASIN
    const { data: zeroPriceItems } = await supabase
      .from("order_items")
      .select("order_item_id, asin")
      .eq("item_price_gross", 0)
      .not("asin", "is", null);

    if (zeroPriceItems && zeroPriceItems.length > 0) {
      const uniqueAsins = [...new Set(zeroPriceItems.map((i) => i.asin))];
      const priceMap = new Map<string, number>();

      for (const asin of uniqueAsins) {
        const { data: lastKnown } = await supabase
          .from("order_items")
          .select("item_price_gross")
          .eq("asin", asin)
          .gt("item_price_gross", 0)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastKnown) {
          priceMap.set(asin, parseFloat(String(lastKnown.item_price_gross)));
        }
      }

      let pricesFilled = 0;
      for (const item of zeroPriceItems) {
        const price = priceMap.get(item.asin);
        if (price) {
          await supabase
            .from("order_items")
            .update({ item_price_gross: price })
            .eq("order_item_id", item.order_item_id);
          pricesFilled++;
        }
      }
      console.log(`[orders-sync] Filled ${pricesFilled} pending order prices from last known prices`);
    }

    // Estimate fees for new items that don't have them yet
    console.log(`[orders-sync] Estimating fees for new items...`);
    const { data: unfeedItems } = await supabase
      .from("order_items")
      .select("order_item_id, asin, qty, item_price_gross, item_tax, promo_discount")
      .is("estimated_fees", null)
      .not("asin", "is", null)
      .gt("item_price_gross", 0)
      .limit(200);

    // Group by ASIN+price to minimize API calls
    const feeCache = new Map<string, { totalFees: number; referralFee: number; fbaFee: number; closingFee: number }>();
    let feesEstimated = 0;

    // Load COGS for profit calculation
    const { data: cogsData } = await supabase
      .from("cogs_periods")
      .select("asin, total_cogs")
      .is("valid_to", null);
    const cogsMap = new Map((cogsData ?? []).map((c) => [c.asin, parseFloat(c.total_cogs)]));

    for (const item of unfeedItems ?? []) {
      const price = parseFloat(String(item.item_price_gross));
      const cacheKey = `${item.asin}:${price.toFixed(2)}`;

      let fees = feeCache.get(cacheKey);
      if (!fees) {
        try {
          const estimate = await getFeesEstimateForASIN(item.asin, price);
          if (estimate) {
            fees = { totalFees: estimate.totalFees, referralFee: estimate.referralFee, fbaFee: estimate.fbaFee, closingFee: estimate.closingFee };
            feeCache.set(cacheKey, fees);
          }
          await new Promise((r) => setTimeout(r, 1000));
        } catch {
          continue;
        }
      }

      if (fees) {
        const tax = parseFloat(String(item.item_tax ?? 0));
        const promo = parseFloat(String(item.promo_discount ?? 0));
        const cogs = cogsMap.get(item.asin) ?? 0;
        const qty = item.qty ?? 1;
        const profit = price - tax - promo - (fees.totalFees * qty) - (cogs * qty);

        await supabase
          .from("order_items")
          .update({
            estimated_fees: fees,
            estimated_profit: profit,
          })
          .eq("order_item_id", item.order_item_id);
        feesEstimated++;
      }
    }
    console.log(`[orders-sync] Estimated fees for ${feesEstimated} items`);

    console.log(`[orders-sync] Done: ${ordersWritten} orders, ${itemsWritten} items, ${feesEstimated} fees`);

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
