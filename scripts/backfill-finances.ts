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

interface ShipmentEvent {
  AmazonOrderId: string;
  SellerOrderId: string;
  PostedDate: string;
  MarketplaceName: string;
  ShipmentItemList: ShipmentItem[];
}

async function fetchShipmentEvents(
  postedAfter: Date,
  postedBefore: Date
): Promise<ShipmentEvent[]> {
  const allEvents: ShipmentEvent[] = [];
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

    const events = payload.FinancialEvents?.ShipmentEventList ?? [];
    allEvents.push(...events);
    nextToken = payload.NextToken ?? undefined;

    console.log(`  Page: ${events.length} shipment events (total: ${allEvents.length})`);

    if (nextToken) await sleep(2000);
  } while (nextToken);

  return allEvents;
}

function parseItemFees(item: ShipmentItem) {
  const feeBreakdown: Record<string, number> = {};
  let totalFees = 0;

  for (const fee of item.ItemFeeList ?? []) {
    const amount = Math.abs(fee.FeeAmount.Amount);
    feeBreakdown[fee.FeeType] = amount;
    totalFees += amount;
  }

  return {
    totalFees,
    referralFee: feeBreakdown["Commission"] ?? feeBreakdown["ReferralFee"] ?? 0,
    fbaFee: feeBreakdown["FBAPerUnitFulfillmentFee"] ?? feeBreakdown["FBAFees"] ?? 0,
    closingFee: feeBreakdown["VariableClosingFee"] ?? 0,
    digitalServicesFee: feeBreakdown["DigitalServicesFee"] ?? 0,
    ...feeBreakdown,
  };
}

function parseItemCharges(item: ShipmentItem) {
  const charges: Record<string, number> = {};
  for (const charge of item.ItemChargeList ?? []) {
    charges[charge.ChargeType] = charge.ChargeAmount.Amount;
  }
  return charges;
}

async function main() {
  console.log(`\n=== Backfill Finances ===\n`);

  // Load SKU -> ASIN mapping from products table
  console.log("Loading product SKU -> ASIN mapping...");
  const { data: productData, error: productErr } = await supabase
    .from("products")
    .select("sku, asin");
  if (productErr) {
    console.error("Failed to load products:", productErr.message);
    process.exit(1);
  }
  const skuToAsin = new Map(productData?.map((p) => [p.sku, p.asin]) ?? []);
  console.log(`  Loaded ${skuToAsin.size} SKU -> ASIN mappings\n`);

  // Load COGS for profit calculation
  console.log("Loading COGS data...");
  const { data: cogsData } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs")
    .is("valid_to", null);
  const cogsMap = new Map(
    cogsData?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
  );
  console.log(`  Loaded ${cogsMap.size} COGS entries\n`);

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

  // Fetch all shipment events across date ranges
  const allShipmentEvents: ShipmentEvent[] = [];

  for (let i = 0; i < dateRanges.length; i++) {
    const range = dateRanges[i];
    console.log(
      `Chunk ${i + 1}/${dateRanges.length}: ${range.from.toISOString()} -> ${range.to.toISOString()}`
    );
    const events = await fetchShipmentEvents(range.from, range.to);
    allShipmentEvents.push(...events);
    console.log(`  Chunk total: ${events.length} events\n`);
  }

  console.log(`Total shipment events: ${allShipmentEvents.length}\n`);

  // Process each event and reconcile order_items
  console.log("Reconciling order items with actual fees...");
  let reconciled = 0;
  let failed = 0;
  let totalItems = 0;

  for (let i = 0; i < allShipmentEvents.length; i++) {
    const event = allShipmentEvents[i];

    for (const item of event.ShipmentItemList ?? []) {
      totalItems++;
      const actualFees = parseItemFees(item);
      const charges = parseItemCharges(item);

      const principal = charges["Principal"] ?? 0;
      const tax = charges["Tax"] ?? 0;
      const asin = skuToAsin.get(item.SellerSKU);
      const cogs = asin ? cogsMap.get(asin) ?? 0 : 0;

      const actualProfit = principal - tax - actualFees.totalFees - (cogs * item.QuantityShipped);

      const { error: updateErr } = await supabase
        .from("order_items")
        .update({
          actual_fees: actualFees,
          actual_profit: actualProfit,
          is_settled: true,
          settled_at: new Date().toISOString(),
          ...(principal > 0 ? { item_price_gross: principal + tax } : {}),
        })
        .eq("amazon_order_id", event.AmazonOrderId)
        .eq("sku", item.SellerSKU);

      if (updateErr) {
        failed++;
      } else {
        reconciled++;
      }
    }

    // Progress logging every 50 events
    if ((i + 1) % 50 === 0 || i === allShipmentEvents.length - 1) {
      const pct = (((i + 1) / allShipmentEvents.length) * 100).toFixed(1);
      console.log(
        `  Progress: ${i + 1}/${allShipmentEvents.length} events (${pct}%) — ${reconciled} reconciled, ${failed} failed`
      );
    }
  }

  // Write sync log
  await supabase.from("sync_log").insert({
    pillar: "finances",
    endpoint: "backfill-finances-script",
    status: "success",
    finished_at: new Date().toISOString(),
    rows_written: reconciled,
  });

  console.log(`\n=== Done ===`);
  console.log(`Total shipment events: ${allShipmentEvents.length}`);
  console.log(`Total items processed: ${totalItems}`);
  console.log(`Items reconciled: ${reconciled}`);
  console.log(`Items failed: ${failed}`);
  console.log(`\nRun with: npx tsx --env-file=.env.local scripts/backfill-finances.ts\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
