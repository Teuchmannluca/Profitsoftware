import { createServiceClient } from "@/lib/supabase/service";
import { getRecentOrders, getOrderItems } from "@/lib/sp-api/orders";
import { getFeesEstimateForItem } from "@/lib/sp-api/fees";
import { getMyPriceForASINs } from "@/lib/sp-api/pricing";
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

export function getPerUnitPrice(lineTotal: number, qty: number | null | undefined) {
  return qty && qty > 0 ? lineTotal / qty : lineTotal;
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

    // Find orders stuck with 0 items from previous failed syncs
    const { data: allRecentOrders } = await supabase
      .from("orders")
      .select("amazon_order_id")
      .gte("purchase_date", new Date(Date.now() - 7 * 86400000).toISOString());
    const allRecentIds = (allRecentOrders ?? []).map((o) => o.amazon_order_id);
    const { data: itemCounts } = allRecentIds.length > 0
      ? await supabase
          .from("order_items")
          .select("amazon_order_id")
          .in("amazon_order_id", allRecentIds)
      : { data: [] };
    const idsWithItems = new Set((itemCounts ?? []).map((r) => r.amazon_order_id));
    const stuckOrders = allRecentIds.filter((id) => !idsWithItems.has(id));
    if (stuckOrders.length > 0) {
      console.log(`[orders-sync] Found ${stuckOrders.length} orders with 0 items from previous syncs, will re-fetch`);
    }

    // Merge stuck orders into the fetch list (avoid duplicates)
    const currentIds = new Set(Orders.map((o) => o.AmazonOrderId));
    const extraOrders = stuckOrders
      .filter((id) => !currentIds.has(id))
      .map((id) => ({ AmazonOrderId: id } as SpApiOrder));
    const allOrdersToFetch = [...Orders, ...extraOrders];

    // Fetch items for each order — burst limit: 30, then 0.5 req/sec
    // Use burst for first 25 orders (no throttle), then throttle
    const retryCount = new Map<string, number>();
    for (let i = 0; i < allOrdersToFetch.length; i++) {
      const order = allOrdersToFetch[i];
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
        const attempts = (retryCount.get(order.AmazonOrderId) ?? 0) + 1;
        retryCount.set(order.AmazonOrderId, attempts);
        const isRetryable = msg.includes("429") || msg.includes("QuotaExceeded") || msg.includes("500") || msg.includes("503");
        if (isRetryable && attempts <= 3) {
          const waitSec = msg.includes("429") || msg.includes("QuotaExceeded") ? 30 : 10;
          console.log(`[orders-sync] Retryable error for ${order.AmazonOrderId} (attempt ${attempts}/3), waiting ${waitSec}s...`);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          i--;
          continue;
        }
        console.error(`[orders-sync] Failed to get items for ${order.AmazonOrderId}:`, msg);
      }

      // Only throttle after burst allowance used up
      if (i >= 25) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      if ((i + 1) % 25 === 0) {
        console.log(`[orders-sync] Progress: ${i + 1}/${allOrdersToFetch.length} orders processed, ${itemsWritten} items`);
      }
    }

    // Re-fetch items for orders from this batch that ended up with 0 items
    const batchOrderIds = allOrdersToFetch.map((o) => o.AmazonOrderId);
    const { data: ordersWithItemsCheck } = await supabase
      .from("order_items")
      .select("amazon_order_id")
      .in("amazon_order_id", batchOrderIds);
    const hasItems = new Set((ordersWithItemsCheck ?? []).map((r) => r.amazon_order_id));
    const emptyOrders = allOrdersToFetch.filter((o) => !hasItems.has(o.AmazonOrderId));
    if (emptyOrders.length > 0) {
      console.log(`[orders-sync] Retrying item fetch for ${emptyOrders.length} orders with 0 items`);
      for (const order of emptyOrders) {
        try {
          await new Promise((r) => setTimeout(r, 2000));
          const { OrderItems } = await getOrderItems(order.AmazonOrderId);
          const itemRows = OrderItems.map((item) => mapSpApiItemToRow(item, order.AmazonOrderId));
          if (itemRows.length > 0) {
            const { error: err } = await supabase
              .from("order_items")
              .upsert(itemRows, { onConflict: "order_item_id" });
            if (!err) itemsWritten += itemRows.length;
          }
        } catch {
          console.error(`[orders-sync] Retry also failed for ${order.AmazonOrderId}`);
        }
      }
    }

    // Fill in prices for Pending orders (£0) using last known PER-UNIT price per ASIN
    // Amazon's ItemPrice is the LINE TOTAL (price × qty), so we must normalize to per-unit
    const { data: zeroPriceItems } = await supabase
      .from("order_items")
      .select("order_item_id, asin, qty")
      .eq("item_price_gross", 0)
      .not("asin", "is", null);

    if (zeroPriceItems && zeroPriceItems.length > 0) {
      const uniqueAsins = [...new Set(zeroPriceItems.map((i) => i.asin))];
      const perUnitPriceMap = new Map<string, number>();

      // First try: last known price from previous orders
      for (const asin of uniqueAsins) {
        const { data: lastKnown } = await supabase
          .from("order_items")
          .select("item_price_gross, qty")
          .eq("asin", asin)
          .gt("item_price_gross", 0)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastKnown) {
          const perUnit = parseFloat(String(lastKnown.item_price_gross)) / (lastKnown.qty ?? 1);
          perUnitPriceMap.set(asin, perUnit);
        }
      }

      // Second try: SP-API Product Pricing API for ASINs still missing a price
      const missingAsins = uniqueAsins.filter((a) => !perUnitPriceMap.has(a));
      if (missingAsins.length > 0) {
        console.log(`[orders-sync] Fetching listing prices from SP-API for ${missingAsins.length} ASINs`);
        const apiPrices = await getMyPriceForASINs(missingAsins);
        for (const [asin, price] of apiPrices) {
          perUnitPriceMap.set(asin, price);
        }
      }

      let pricesFilled = 0;
      for (const item of zeroPriceItems) {
        const perUnit = perUnitPriceMap.get(item.asin);
        if (perUnit) {
          const lineTotal = perUnit * (item.qty ?? 1);
          await supabase
            .from("order_items")
            .update({ item_price_gross: lineTotal })
            .eq("order_item_id", item.order_item_id);
          pricesFilled++;
        }
      }
      console.log(`[orders-sync] Filled ${pricesFilled} pending order prices (${missingAsins.length} from SP-API Pricing)`);
    }

    // Estimate fees for new items that don't have them yet
    console.log(`[orders-sync] Estimating fees for new items...`);
    const { data: unfeedItems } = await supabase
      .from("order_items")
      .select("order_item_id, asin, sku, qty, item_price_gross, item_tax, promo_discount")
      .is("estimated_fees", null)
      .not("asin", "is", null)
      .gt("item_price_gross", 0)
      .limit(200);

    // Group by ASIN+price to minimize API calls
    const feeCache = new Map<string, Record<string, number>>();
    let feesEstimated = 0;

    // Load COGS and product VAT rates for profit calculation
    const [{ data: cogsData }, { data: productData }] = await Promise.all([
      supabase.from("cogs_periods").select("asin, total_cogs").is("valid_to", null),
      supabase.from("products").select("sku, asin, vat_rate"),
    ]);
    const cogsMap = new Map((cogsData ?? []).map((c) => [c.asin, parseFloat(c.total_cogs)]));
    const skuToVatRate = new Map((productData ?? []).map((p) => [p.sku, parseFloat(String(p.vat_rate ?? "0.20"))]));

    for (const item of unfeedItems ?? []) {
      const lineTotal = parseFloat(String(item.item_price_gross));
      const qty = item.qty ?? 1;
      const unitPrice = getPerUnitPrice(lineTotal, qty);
      const sku = item.sku ? String(item.sku) : null;
      const cacheKey = `${sku ?? item.asin}:${unitPrice.toFixed(2)}`;

      let fees = feeCache.get(cacheKey);
      if (!fees) {
        try {
          const estimate = await getFeesEstimateForItem({
            asin: item.asin,
            sellerSku: sku,
            price: unitPrice,
          });
          if (estimate) {
            fees = {
              totalFees: estimate.totalFees,
              referralFee: estimate.referralFee,
              fbaFee: estimate.fbaFee,
              closingFee: estimate.closingFee,
              digitalServicesFee: estimate.digitalServicesFee,
              storageFee: estimate.storageFee,
              otherFees: estimate.otherFees,
              ...estimate.feeBreakdown,
            };
            feeCache.set(cacheKey, fees);
          }
          await new Promise((r) => setTimeout(r, 1000));
        } catch {
          continue;
        }
      }

      if (fees) {
        const vatRate = skuToVatRate.get(item.sku) ?? 0.20;
        let tax = parseFloat(String(item.item_tax ?? 0));
        if (tax === 0 && lineTotal > 0) {
          tax = lineTotal * (vatRate / (1 + vatRate));
        }
        const promo = parseFloat(String(item.promo_discount ?? 0));
        const cogs = cogsMap.get(item.asin) ?? 0;
        const feeExVat = fees.totalFees / (1 + vatRate);
        const profit = lineTotal - tax - promo - (feeExVat * qty) - (cogs * qty);

        await supabase
          .from("order_items")
          .update({
            estimated_fees: fees,
            estimated_profit: profit,
            cogs_snapshot: cogs,
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
