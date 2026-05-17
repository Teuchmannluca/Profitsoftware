import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SP_API_CLIENT_ID = process.env.SP_API_CLIENT_ID!;
const SP_API_CLIENT_SECRET = process.env.SP_API_CLIENT_SECRET!;
const SP_API_REFRESH_TOKEN = process.env.SP_API_REFRESH_TOKEN!;

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

interface ChargeAmount {
  CurrencyCode: string;
  Amount: number;
}

interface ShipmentItem {
  SellerSKU: string;
  OrderItemId: string;
  QuantityShipped: number;
  ItemChargeList: Array<{
    ChargeType: string;
    ChargeAmount: ChargeAmount;
  }>;
  ItemFeeList: Array<{
    FeeType: string;
    FeeAmount: ChargeAmount;
  }>;
}

interface RefundEvent {
  AmazonOrderId: string;
  SellerOrderId: string;
  PostedDate: string;
  MarketplaceName: string;
  ShipmentItemList: ShipmentItem[];
}

async function fetchRefundEvents(
  postedAfter: Date,
  postedBefore: Date
): Promise<RefundEvent[]> {
  const allRefunds: RefundEvent[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
      PostedAfter: postedAfter.toISOString(),
      PostedBefore: postedBefore.toISOString(),
    });
    if (nextToken) params.set("NextToken", nextToken);

    const res = await spApiFetch(`/finances/v0/financialEvents?${params}`);
    const data = await res.json();
    const payload = data.payload ?? data;

    const refunds = payload.FinancialEvents?.RefundEventList ?? [];
    allRefunds.push(...refunds);
    nextToken = payload.NextToken ?? undefined;

    console.log(`  Page: ${refunds.length} refund events (total: ${allRefunds.length})`);

    if (nextToken) await sleep(2000);
  } while (nextToken);

  return allRefunds;
}

function mapRefundToRow(event: RefundEvent) {
  return event.ShipmentItemList.map((item) => {
    const charges = item.ItemChargeList ?? [];
    const totalRefund = charges.reduce(
      (sum, c) => sum + Math.abs(c.ChargeAmount.Amount),
      0
    );

    return {
      amazon_order_id: event.AmazonOrderId,
      sku: item.SellerSKU,
      return_quantity: item.QuantityShipped,
      return_request_date: event.PostedDate,
      refunded_amount: totalRefund,
      return_status: "Refunded",
      resolution: "Refund",
    };
  });
}

async function main() {
  console.log(`\n=== Backfill Returns ===\n`);

  // Finances API has a 180-day max range for PostedAfter/PostedBefore.
  // Split Jan 1 2026 -> now into chunks of at most 180 days.
  const startDate = new Date("2026-01-01T00:00:00Z");
  const endDate = new Date();
  const maxRangeMs = 180 * 24 * 60 * 60 * 1000;

  const dateRanges: Array<{ from: Date; to: Date }> = [];
  let rangeStart = new Date(startDate);

  while (rangeStart < endDate) {
    const rangeEnd = new Date(
      Math.min(rangeStart.getTime() + maxRangeMs, endDate.getTime())
    );
    dateRanges.push({ from: new Date(rangeStart), to: rangeEnd });
    rangeStart = new Date(rangeEnd);
  }

  console.log(`Date ranges to fetch: ${dateRanges.length}`);
  for (const range of dateRanges) {
    console.log(`  ${range.from.toISOString()} -> ${range.to.toISOString()}`);
  }
  console.log("");

  // Fetch all refund events across date ranges
  const allRefundEvents: RefundEvent[] = [];

  for (let i = 0; i < dateRanges.length; i++) {
    const range = dateRanges[i];
    console.log(
      `Chunk ${i + 1}/${dateRanges.length}: ${range.from.toISOString()} -> ${range.to.toISOString()}`
    );
    const events = await fetchRefundEvents(range.from, range.to);
    allRefundEvents.push(...events);
    console.log(`  Chunk total: ${events.length} events\n`);
  }

  console.log(`Total refund events: ${allRefundEvents.length}\n`);

  // Map to return rows
  const returnRows = allRefundEvents.flatMap(mapRefundToRow);
  console.log(`Mapped to ${returnRows.length} return rows\n`);

  // Upsert into returns table in batches
  console.log("Upserting returns into database...");
  let returnsWritten = 0;
  let returnsFailed = 0;

  for (let i = 0; i < returnRows.length; i += 100) {
    const chunk = returnRows.slice(i, i + 100);
    const { error } = await supabase
      .from("returns")
      .upsert(chunk, { onConflict: "amazon_order_id,sku" });
    if (error) {
      console.error(`  Batch error at ${i}:`, error.message);
      returnsFailed += chunk.length;
    } else {
      returnsWritten += chunk.length;
    }
  }

  // Update order_items refund_status where matching orders exist
  const orderIds = [...new Set(returnRows.map((r) => r.amazon_order_id))];
  console.log(`\nUpdating refund_status for ${orderIds.length} orders...`);

  for (let i = 0; i < orderIds.length; i += 100) {
    const chunk = orderIds.slice(i, i + 100);
    await supabase
      .from("order_items")
      .update({ refund_status: "refunded" })
      .in("amazon_order_id", chunk);
  }

  // Write sync log
  await supabase.from("sync_log").insert({
    pillar: "returns",
    endpoint: "backfill-returns-script",
    status: "success",
    finished_at: new Date().toISOString(),
    rows_written: returnsWritten,
  });

  console.log(`\n=== Done ===`);
  console.log(`Returns written: ${returnsWritten}`);
  console.log(`Returns failed: ${returnsFailed}`);
  console.log(`Orders updated: ${orderIds.length}`);
  console.log(`\nRun with: npx tsx --env-file=.env.local scripts/backfill-returns.ts\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
