import { createServiceClient } from "@/lib/supabase/service";
import { getRecentOrders, getOrderItems } from "@/lib/sp-api/orders";
import { getFeesEstimateForItem } from "@/lib/sp-api/fees";
import { getMyPriceForASINs, getMyPriceForSKUs, getCompetitivePriceForASINs } from "@/lib/sp-api/pricing";
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

export interface ZeroPriceOrderRef {
  amazon_order_id: string;
}

export interface PendingEstimatePriceItem {
  order_item_id: string;
  asin: string | null;
  sku: string | null;
  qty: number | null;
}

export function getUniqueOrderIdsForPriceRefresh(items: ZeroPriceOrderRef[]) {
  return [...new Set(items.map((item) => item.amazon_order_id).filter(Boolean))];
}

export function buildPendingEstimatePriceUpdates(
  items: PendingEstimatePriceItem[],
  skuPrices: Map<string, number>,
  asinPrices: Map<string, number>
) {
  return items.flatMap((item) => {
    const unitPrice =
      (item.sku ? skuPrices.get(item.sku) : undefined) ??
      (item.asin ? asinPrices.get(item.asin) : undefined);
    if (!unitPrice || unitPrice <= 0) return [];

    return [{
      orderItemId: item.order_item_id,
      itemPriceGross: unitPrice * (item.qty ?? 1),
    }];
  });
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

    const priceRefreshSince = new Date(Date.now() - 14 * 86400000).toISOString();

    // Fix prices for orders that transitioned from Pending → Shipped/Unshipped.
    // When Amazon moves an order out of Pending, getOrderItems now returns real prices.
    // Find non-Pending orders in this batch that still have £0 items and re-fetch.
    const nonPendingIds = Orders
      .filter((o) => o.OrderStatus !== "Pending")
      .map((o) => o.AmazonOrderId);

    if (nonPendingIds.length > 0) {
      const { data: zeroPriceTransitioned } = await supabase
        .from("order_items")
        .select("amazon_order_id")
        .in("amazon_order_id", nonPendingIds)
        .eq("item_price_gross", 0);

      const transitionedIds = [...new Set((zeroPriceTransitioned ?? []).map((r) => r.amazon_order_id))];

      if (transitionedIds.length > 0) {
        console.log(`[orders-sync] Re-fetching items for ${transitionedIds.length} orders that left Pending with £0 prices`);
        let transitionPricesFixed = 0;

        for (const [index, orderId] of transitionedIds.entries()) {
          try {
            const { OrderItems } = await getOrderItems(orderId);
            const pricedRows = OrderItems
              .filter((item) => parseFloat(item.ItemPrice?.Amount ?? "0") > 0)
              .map((item) => mapSpApiItemToRow(item, orderId));

            if (pricedRows.length > 0) {
              const { error: err } = await supabase
                .from("order_items")
                .upsert(pricedRows, { onConflict: "order_item_id" });
              if (!err) transitionPricesFixed += pricedRows.length;
            }
          } catch (err: unknown) {
            console.error(`[orders-sync] Transition price fix failed for ${orderId}:`,
              err instanceof Error ? err.message : String(err));
          }
          if (index < transitionedIds.length - 1) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        if (transitionPricesFixed > 0) {
          console.log(`[orders-sync] Fixed ${transitionPricesFixed} prices from Pending→Shipped transition`);
        }
      }
    }

    // While Amazon keeps an order Pending, no SP-API endpoint exposes the buyer's actual paid price.
    // To avoid showing £0.00, use the seller's current listing price as a temporary estimate.
    // Orders/Finances syncs above overwrite this with real ItemPrice/Principal as soon as Amazon releases it.
    const { data: pendingEstimateItems } = await supabase
      .from("order_items")
      .select("order_item_id, asin, sku, qty, orders!inner(purchase_date)")
      .eq("item_price_gross", 0)
      .not("asin", "is", null)
      .gte("orders.purchase_date", priceRefreshSince);

    if (pendingEstimateItems && pendingEstimateItems.length > 0) {
      const estimateItems = pendingEstimateItems as PendingEstimatePriceItem[];
      const uniqueSkus = [...new Set(estimateItems.map((item) => item.sku).filter((sku): sku is string => Boolean(sku)))];
      const uniqueAsins = [...new Set(estimateItems.map((item) => item.asin).filter((asin): asin is string => Boolean(asin)))];

      console.log(`[orders-sync] Estimating pending prices from SP-API Pricing for ${uniqueSkus.length} SKUs / ${uniqueAsins.length} ASINs`);

      // Try seller's own listing price first
      const skuPrices = await getMyPriceForSKUs(uniqueSkus);
      const missingAfterSku = estimateItems.filter((item) => !item.sku || !skuPrices.has(item.sku));
      const missingAsins = [...new Set(missingAfterSku.map((item) => item.asin).filter((asin): asin is string => Boolean(asin)))];

      let asinPrices = new Map<string, number>();
      if (missingAsins.length > 0) {
        await new Promise((r) => setTimeout(r, 2000));
        asinPrices = await getMyPriceForASINs(missingAsins);
      }

      // For any still missing, try competitive pricing (Buy Box price)
      const stillMissing = estimateItems.filter((item) => {
        if (item.sku && skuPrices.has(item.sku)) return false;
        if (item.asin && asinPrices.has(item.asin)) return false;
        return true;
      });
      const stillMissingAsins = [...new Set(stillMissing.map((item) => item.asin).filter((asin): asin is string => Boolean(asin)))];

      if (stillMissingAsins.length > 0) {
        console.log(`[orders-sync] Trying competitive pricing for ${stillMissingAsins.length} ASINs still missing prices`);
        await new Promise((r) => setTimeout(r, 2000));
        const competitivePrices = await getCompetitivePriceForASINs(stillMissingAsins);
        for (const [asin, price] of competitivePrices) {
          if (!asinPrices.has(asin)) {
            asinPrices.set(asin, price);
          }
        }
      }

      const estimateUpdates = buildPendingEstimatePriceUpdates(estimateItems, skuPrices, asinPrices);

      let estimatedPricesFilled = 0;
      for (const update of estimateUpdates) {
        const { error: estimateErr } = await supabase
          .from("order_items")
          .update({ item_price_gross: update.itemPriceGross })
          .eq("order_item_id", update.orderItemId);
        if (!estimateErr) estimatedPricesFilled++;
      }

      console.log(`[orders-sync] Filled ${estimatedPricesFilled} pending prices with listing/competitive price estimates`);
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
