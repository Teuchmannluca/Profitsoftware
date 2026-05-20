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

async function spApiFetch(path: string): Promise<Response> {
  for (let attempt = 0; attempt <= 3; attempt++) {
    const token = await getAccessToken();
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "x-amz-access-token": token,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 429) {
      const waitSec = attempt === 0 ? 30 : 60;
      console.log(`  429 rate limited — waiting ${waitSec}s (attempt ${attempt + 1}/3)`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!response.ok) {
      const requestId = response.headers.get("x-amzn-RequestId") ?? "unknown";
      throw new Error(`SP-API error ${response.status} [${requestId}]: ${await response.text()}`);
    }

    return response;
  }
  throw new Error("SP-API: max retries exceeded");
}

interface ShipmentItem {
  SellerSKU: string;
  OrderItemId: string;
  QuantityShipped: number;
  ItemChargeList: Array<{ ChargeType: string; ChargeAmount: { Amount: number } }>;
  ItemFeeList: Array<{ FeeType: string; FeeAmount: { Amount: number } }>;
}

interface ShipmentEvent {
  AmazonOrderId: string;
  PostedDate: string;
  ShipmentItemList: ShipmentItem[];
}

function parseItemFees(item: ShipmentItem) {
  const feeBreakdown: Record<string, number> = {};
  const qty = item.QuantityShipped > 0 ? item.QuantityShipped : 1;
  let lineTotalFees = 0;

  for (const fee of item.ItemFeeList ?? []) {
    const amount = Math.abs(fee.FeeAmount.Amount);
    feeBreakdown[fee.FeeType] = amount / qty;
    lineTotalFees += amount;
  }

  return {
    feeBasis: "per_unit" as const,
    totalFees: lineTotalFees / qty,
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
  console.log("\n=== Backfill Actual Fees (per-order approach) ===\n");

  // Load VAT settings
  const { data: vatSettings } = await supabase
    .from("business_settings")
    .select("vat_status, vat_rate")
    .eq("id", 1)
    .single();

  const vatRate = parseFloat(String(vatSettings?.vat_rate ?? "0.20"));
  const isVatRegistered = vatSettings?.vat_status === "standard";
  console.log(`VAT: ${isVatRegistered ? "registered" : "not registered"} (${(vatRate * 100).toFixed(0)}%)`);

  // Load COGS
  const { data: cogsData } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs")
    .is("valid_to", null);
  const cogsMap = new Map(
    cogsData?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
  );
  console.log(`Loaded COGS for ${cogsMap.size} ASINs`);

  // Load SKU → ASIN mapping
  const { data: productData } = await supabase.from("products").select("sku, asin");
  const skuToAsin = new Map(productData?.map((p) => [p.sku, p.asin]) ?? []);
  console.log(`Loaded ${skuToAsin.size} SKU→ASIN mappings`);

  // Get all unique unsettled order IDs (paginate past 1000 limit)
  console.log("\nFetching unsettled order IDs...");
  const unsettledOrderIds = new Set<string>();
  let page = 0;
  while (true) {
    const { data: batch } = await supabase
      .from("order_items")
      .select("amazon_order_id")
      .eq("is_settled", false)
      .range(page * 1000, (page + 1) * 1000 - 1);

    if (!batch || batch.length === 0) break;
    for (const row of batch) unsettledOrderIds.add(row.amazon_order_id);
    if (batch.length < 1000) break;
    page++;
  }

  const orderIds = [...unsettledOrderIds];
  console.log(`Found ${orderIds.length} unsettled orders to check\n`);

  let reconciled = 0;
  let noFinanceData = 0;
  let errors = 0;

  for (let i = 0; i < orderIds.length; i++) {
    const orderId = orderIds[i];

    try {
      const response = await spApiFetch(
        `/finances/v0/orders/${encodeURIComponent(orderId)}/financialEvents`
      );
      const data = await response.json();
      const events: ShipmentEvent[] =
        data.payload?.FinancialEvents?.ShipmentEventList ?? [];

      if (events.length === 0) {
        noFinanceData++;
      } else {
        for (const event of events) {
          for (const item of event.ShipmentItemList ?? []) {
            const actualFees = parseItemFees(item);
            const charges = parseItemCharges(item);

            const principal = charges["Principal"] ?? 0;
            const tax = charges["Tax"] ?? 0;
            const asin = skuToAsin.get(item.SellerSKU);
            const cogs = asin ? cogsMap.get(asin) ?? 0 : 0;
            const qty = item.QuantityShipped;

            const feePerUnit = isVatRegistered
              ? actualFees.totalFees / (1 + vatRate)
              : actualFees.totalFees;
            const actualProfit = principal - feePerUnit * qty - cogs * qty;

            const { data: updated } = await supabase
              .from("order_items")
              .update({
                actual_fees: actualFees,
                actual_profit: Math.round(actualProfit * 100) / 100,
                is_settled: true,
                settled_at: new Date().toISOString(),
                ...(principal > 0 ? { item_price_gross: principal + tax } : {}),
              })
              .eq("amazon_order_id", event.AmazonOrderId)
              .eq("sku", item.SellerSKU)
              .select("order_item_id");

            if (updated && updated.length > 0) {
              reconciled += updated.length;
            }
          }
        }
      }
    } catch (err) {
      errors++;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429")) {
        console.log(`  Rate limited at order ${i + 1}, waiting 60s...`);
        await new Promise((r) => setTimeout(r, 60000));
        i--;
        continue;
      }
      console.error(`  Error for ${orderId}: ${msg}`);
    }

    // Throttle: Finances API allows 30 burst then 0.5/sec
    if (i >= 25) await new Promise((r) => setTimeout(r, 2000));

    if ((i + 1) % 50 === 0 || i === orderIds.length - 1) {
      console.log(
        `Progress: ${i + 1}/${orderIds.length} orders — ${reconciled} items reconciled, ${noFinanceData} no data yet, ${errors} errors`
      );
    }
  }

  // Write sync log
  await supabase.from("sync_log").insert({
    pillar: "finances",
    endpoint: "backfill-actual-fees-per-order",
    status: "success",
    finished_at: new Date().toISOString(),
    rows_written: reconciled,
  });

  console.log(`\n=== Done ===`);
  console.log(`Orders checked: ${orderIds.length}`);
  console.log(`Items reconciled: ${reconciled}`);
  console.log(`Orders with no finance data yet: ${noFinanceData}`);
  console.log(`Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
