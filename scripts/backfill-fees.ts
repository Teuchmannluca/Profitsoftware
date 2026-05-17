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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface FeeEstimate {
  totalFees: number;
  referralFee: number;
  fbaFee: number;
  closingFee: number;
  perUnit: boolean;
}

async function getFeesEstimate(
  asin: string,
  price: number
): Promise<FeeEstimate | null> {
  const token = await getAccessToken();

  const body = {
    FeesEstimateRequest: {
      MarketplaceId: MARKETPLACE_ID,
      IdType: "ASIN",
      IdValue: asin,
      IsAmazonFulfilled: true,
      Identifier: asin,
      PriceToEstimateFees: {
        ListingPrice: {
          CurrencyCode: "GBP",
          Amount: price,
        },
      },
    },
  };

  const res = await fetch(
    `${BASE_URL}/products/fees/v0/items/${asin}/feesEstimate`,
    {
      method: "POST",
      headers: {
        "x-amz-access-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (res.status === 429) {
    console.log(`  Rate limited on ${asin}. Waiting 60s...`);
    await sleep(60000);
    return getFeesEstimate(asin, price);
  }

  if (!res.ok) {
    console.error(`  Fees API error ${res.status} for ${asin} @ £${price}`);
    return null;
  }

  const data = await res.json();
  const result = data.payload?.FeesEstimateResult;

  if (!result?.FeesEstimate) {
    console.error(`  No fee estimate returned for ${asin} @ £${price}`);
    return null;
  }

  const fees = result.FeesEstimate;
  const feeMap = new Map<string, number>(
    fees.FeeDetailList.map(
      (f: { FeeType: string; FinalFee: { Amount: number } }) =>
        [f.FeeType, f.FinalFee.Amount] as [string, number]
    )
  );

  return {
    totalFees: fees.TotalFeesEstimate.Amount,
    referralFee: feeMap.get("ReferralFee") ?? 0,
    fbaFee: feeMap.get("FBAFees") ?? feeMap.get("FBAPerUnitFulfillmentFee") ?? 0,
    closingFee: feeMap.get("VariableClosingFee") ?? 0,
    perUnit: true,
  };
}

async function main() {
  console.log(`\n=== Backfill Fees ===`);
  console.log(`Marketplace: ${MARKETPLACE_ID}\n`);

  // Step 1: Query order_items where estimated_fees IS NULL
  console.log("Step 1: Fetching order items without fee estimates...");
  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select(
      "order_item_id, amazon_order_id, asin, qty, item_price_gross, item_tax, promo_discount, orders!inner(purchase_date)"
    )
    .is("estimated_fees", null);

  if (itemsErr) {
    throw new Error(`Failed to fetch order items: ${itemsErr.message}`);
  }

  if (!items || items.length === 0) {
    console.log("  No order items need fee estimates. Done!");
    return;
  }

  console.log(`  Found ${items.length} order items without fee estimates\n`);

  // Step 2: Group by ASIN + price to minimize API calls
  console.log("Step 2: Grouping by ASIN + price...");
  const groupKey = (asin: string, price: number) =>
    `${asin}|${(Math.round(price * 100) / 100).toFixed(2)}`;

  const groups = new Map<string, { asin: string; price: number }>();
  for (const item of items) {
    const price = parseFloat(String(item.item_price_gross ?? "0"));
    const qty = item.qty ?? 1;
    // Price is total for qty, so per-unit price for fee estimate
    const unitPrice = qty > 0 ? price / qty : price;
    const key = groupKey(item.asin, unitPrice);
    if (!groups.has(key)) {
      groups.set(key, { asin: item.asin, price: unitPrice });
    }
  }

  console.log(`  ${groups.size} unique ASIN+price combos\n`);

  // Step 3: Fetch COGS data
  console.log("Step 3: Loading COGS data...");
  const { data: cogsData } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs, valid_from, valid_to");

  // Build COGS lookup: array of periods per ASIN sorted by valid_from desc
  const cogsMap = new Map<
    string,
    Array<{ totalCogs: number; validFrom: string; validTo: string | null }>
  >();
  for (const c of cogsData ?? []) {
    const arr = cogsMap.get(c.asin) ?? [];
    arr.push({
      totalCogs: parseFloat(String(c.total_cogs ?? "0")),
      validFrom: c.valid_from,
      validTo: c.valid_to,
    });
    cogsMap.set(c.asin, arr);
  }
  // Sort each ASIN's periods by valid_from descending
  for (const [, periods] of cogsMap) {
    periods.sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  }
  console.log(`  Loaded COGS for ${cogsMap.size} ASINs\n`);

  // Step 4: Fetch fee estimates for each unique ASIN+price
  console.log("Step 4: Fetching fee estimates from SP-API...");
  const feeCache = new Map<string, FeeEstimate>();
  let apiCalls = 0;
  let apiFailed = 0;

  const groupEntries = Array.from(groups.entries());
  for (let i = 0; i < groupEntries.length; i++) {
    const [key, { asin, price }] = groupEntries[i];

    const estimate = await getFeesEstimate(asin, price);
    if (estimate) {
      feeCache.set(key, estimate);
    } else {
      apiFailed++;
    }
    apiCalls++;

    // Throttle: 1 second between API calls
    await sleep(1000);

    // Progress logging every 25 combos
    if ((i + 1) % 25 === 0 || i === groupEntries.length - 1) {
      const pct = (((i + 1) / groupEntries.length) * 100).toFixed(1);
      const eta = Math.round(((groupEntries.length - i - 1) * 1) / 60);
      console.log(
        `  Progress: ${i + 1}/${groupEntries.length} (${pct}%) — ${apiFailed} failed — ~${eta}min remaining`
      );
    }
  }

  console.log(`\n  API calls: ${apiCalls}, cached: ${feeCache.size}, failed: ${apiFailed}\n`);

  // Step 5: Update order_items with fee estimates and calculated profit
  console.log("Step 5: Updating order items...");
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const price = parseFloat(String(item.item_price_gross ?? "0"));
    const qty = item.qty ?? 1;
    const unitPrice = qty > 0 ? price / qty : price;
    const key = groupKey(item.asin, unitPrice);

    const feeEstimate = feeCache.get(key);
    if (!feeEstimate) {
      skipped++;
      continue;
    }

    // Look up COGS for this ASIN at the order's purchase date
    const ordersData = item.orders as unknown as
      | { purchase_date: string }
      | Array<{ purchase_date: string }>;
    const purchaseDate = Array.isArray(ordersData)
      ? ordersData[0]?.purchase_date
      : ordersData?.purchase_date;
    let unitCogs = 0;
    const periods = cogsMap.get(item.asin);
    if (periods && purchaseDate) {
      // Find the most recent period where valid_from <= purchase_date
      for (const p of periods) {
        if (p.validFrom <= purchaseDate) {
          unitCogs = p.totalCogs;
          break;
        }
      }
    }

    // Calculate profit: (gross - tax - promo) - (fees_per_unit * qty) - (cogs * qty)
    const itemTax = parseFloat(String(item.item_tax ?? "0"));
    const promoDiscount = parseFloat(String(item.promo_discount ?? "0"));
    const estimatedProfit =
      price - itemTax - promoDiscount - feeEstimate.totalFees * qty - unitCogs * qty;

    const { error: updateErr } = await supabase
      .from("order_items")
      .update({
        estimated_fees: feeEstimate,
        estimated_profit: Math.round(estimatedProfit * 100) / 100,
      })
      .eq("order_item_id", item.order_item_id);

    if (updateErr) {
      console.error(`  Update error for ${item.order_item_id}: ${updateErr.message}`);
      skipped++;
    } else {
      updated++;
    }

    if ((updated + skipped) % 100 === 0) {
      console.log(`  Updated ${updated}/${items.length} items...`);
    }
  }

  // Step 6: Write sync log
  await supabase.from("sync_log").insert({
    pillar: "fees",
    endpoint: "backfill-fees-script",
    status: "success",
    finished_at: new Date().toISOString(),
    rows_written: updated,
  });

  console.log(`\n=== Done ===`);
  console.log(`API calls: ${apiCalls}`);
  console.log(`Fee estimates cached: ${feeCache.size}`);
  console.log(`Items updated: ${updated}`);
  console.log(`Items skipped: ${skipped}`);
  console.log(`\nRun with: npx tsx --env-file=.env.local scripts/backfill-fees.ts\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
