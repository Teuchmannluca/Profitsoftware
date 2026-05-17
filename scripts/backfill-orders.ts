import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SP_API_CLIENT_ID = process.env.SP_API_CLIENT_ID!;
const SP_API_CLIENT_SECRET = process.env.SP_API_CLIENT_SECRET!;
const SP_API_REFRESH_TOKEN = process.env.SP_API_REFRESH_TOKEN!;
const MARKETPLACE_ID = process.env.SP_API_MARKETPLACE_ID!;

const BASE_URL = "https://sellingpartnerapi-eu.amazon.com";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let accessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  if (accessToken && Date.now() < tokenExpiresAt) return accessToken;

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: SP_API_REFRESH_TOKEN,
    client_id: SP_API_CLIENT_ID,
    client_secret: SP_API_CLIENT_SECRET,
  });

  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json();
  accessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken!;
}

async function spApiFetch(path: string): Promise<Response> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get("x-amzn-RateLimit-Limit");
    console.log(`  Rate limited. Waiting 60s... (limit: ${retryAfter})`);
    await sleep(60000);
    return spApiFetch(path);
  }

  if (!res.ok) {
    const requestId = res.headers.get("x-amzn-RequestId") ?? "unknown";
    const body = await res.text();
    throw new Error(`SP-API ${res.status} [${requestId}]: ${body}`);
  }

  return res;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchAllOrders(since: Date): Promise<Array<Record<string, unknown>>> {
  const allOrders: Array<Record<string, unknown>> = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
      MarketplaceIds: MARKETPLACE_ID,
      LastUpdatedAfter: since.toISOString(),
      OrderStatuses: "Shipped,Unshipped,PartiallyShipped",
    });
    if (nextToken) params.set("NextToken", nextToken);

    const res = await spApiFetch(`/orders/v0/orders?${params}`);
    const data = await res.json();
    const orders = data.payload?.Orders ?? [];

    allOrders.push(...orders);
    nextToken = data.payload?.NextToken ?? undefined;

    console.log(`  Page fetched: ${orders.length} orders (total: ${allOrders.length})`);

    if (nextToken) await sleep(3000);
  } while (nextToken);

  return allOrders;
}

async function fetchOrderItems(orderId: string): Promise<Array<Record<string, unknown>>> {
  const res = await spApiFetch(`/orders/v0/orders/${orderId}/orderItems`);
  const data = await res.json();
  return data.payload?.OrderItems ?? [];
}

async function main() {
  const since = new Date("2026-01-01T00:00:00Z");
  console.log(`\n=== Backfill Orders ===`);
  console.log(`Since: ${since.toISOString()}`);
  console.log(`Marketplace: ${MARKETPLACE_ID}\n`);

  // Step 1: Fetch all orders
  console.log("Step 1: Fetching all orders...");
  const orders = await fetchAllOrders(since);
  console.log(`\nTotal orders: ${orders.length}\n`);

  // Step 2: Upsert orders in batches
  console.log("Step 2: Saving orders to database...");
  let ordersWritten = 0;
  for (let i = 0; i < orders.length; i += 100) {
    const chunk = orders.slice(i, i + 100);
    const rows = chunk.map((o: Record<string, unknown>) => ({
      amazon_order_id: o.AmazonOrderId as string,
      purchase_date: o.PurchaseDate as string,
      order_status: o.OrderStatus as string,
      fulfillment_channel: o.FulfillmentChannel as string,
      ship_country: (o.ShippingAddress as Record<string, unknown>)?.CountryCode ?? null,
      ship_postcode: (o.ShippingAddress as Record<string, unknown>)?.PostalCode ?? null,
      last_updated: o.LastUpdateDate as string,
      raw: o,
    }));

    const { error } = await supabase.from("orders").upsert(rows, { onConflict: "amazon_order_id" });
    if (error) {
      console.error(`  Batch error at ${i}:`, error.message);
    } else {
      ordersWritten += chunk.length;
    }
  }
  console.log(`  Saved ${ordersWritten} orders\n`);

  // Step 3: Fetch items for each order
  console.log("Step 3: Fetching order items (this takes a while — 2s per order)...");
  let itemsWritten = 0;
  let failed = 0;

  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    const orderId = order.AmazonOrderId as string;

    try {
      const items = await fetchOrderItems(orderId);
      const rows = items.map((item: Record<string, unknown>) => ({
        amazon_order_id: orderId,
        order_item_id: item.OrderItemId as string,
        sku: item.SellerSKU as string,
        asin: item.ASIN as string,
        qty: item.QuantityOrdered as number,
        item_price_gross: parseFloat((item.ItemPrice as Record<string, string>)?.Amount ?? "0"),
        item_tax: parseFloat((item.ItemTax as Record<string, string>)?.Amount ?? "0"),
        shipping_price: parseFloat((item.ShippingPrice as Record<string, string>)?.Amount ?? "0"),
        promo_discount: parseFloat((item.PromotionDiscount as Record<string, string>)?.Amount ?? "0"),
      }));

      if (rows.length > 0) {
        const { error } = await supabase.from("order_items").upsert(rows, { onConflict: "order_item_id" });
        if (error) {
          console.error(`  Item upsert error for ${orderId}:`, error.message);
        } else {
          itemsWritten += rows.length;
        }
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  Failed ${orderId}: ${msg.slice(0, 100)}`);
    }

    // Throttle: 2s between getOrderItems calls
    await sleep(2000);

    if ((i + 1) % 25 === 0 || i === orders.length - 1) {
      const pct = ((i + 1) / orders.length * 100).toFixed(1);
      const eta = Math.round((orders.length - i - 1) * 2 / 60);
      console.log(`  Progress: ${i + 1}/${orders.length} (${pct}%) — ${itemsWritten} items — ~${eta}min remaining`);
    }
  }

  // Step 4: Write sync log
  await supabase.from("sync_log").insert({
    pillar: "orders",
    endpoint: "backfill-script",
    status: "success",
    finished_at: new Date().toISOString(),
    rows_written: ordersWritten + itemsWritten,
  });

  console.log(`\n=== Done ===`);
  console.log(`Orders: ${ordersWritten}`);
  console.log(`Items: ${itemsWritten}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total rows: ${ordersWritten + itemsWritten}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
