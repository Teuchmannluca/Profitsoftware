import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const apply = process.argv.includes("--apply");

async function main() {
  console.log(`\n=== Repair actual_profit (VAT fix) ===`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}\n`);

  // Load VAT settings
  const { data: vatSettings } = await supabase
    .from("business_settings")
    .select("vat_status, vat_rate")
    .eq("id", 1)
    .single();

  const vatRate = parseFloat(String(vatSettings?.vat_rate ?? "0.20"));
  const isVatRegistered = vatSettings?.vat_status === "standard";
  console.log(`VAT status: ${vatSettings?.vat_status}, rate: ${vatRate}`);

  // Load COGS (current active periods)
  const { data: cogsData } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs")
    .is("valid_to", null);
  const cogsMap = new Map(
    cogsData?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
  );
  console.log(`Loaded ${cogsMap.size} COGS entries\n`);

  // Load all settled order items with actual_fees
  let page = 0;
  const pageSize = 1000;
  let total = 0;
  let updated = 0;
  let errorCount = 0;

  while (true) {
    const { data, error } = await supabase
      .from("order_items")
      .select("id, asin, qty, item_price_gross, item_tax, actual_fees, actual_profit")
      .eq("is_settled", true)
      .not("actual_fees", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw new Error(`Failed to fetch: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      total++;
      const qty = item.qty ?? 1;
      const grossPrice = parseFloat(String(item.item_price_gross ?? "0"));
      const tax = parseFloat(String(item.item_tax ?? "0"));
      const fees = item.actual_fees as Record<string, unknown> | null;
      const feePerUnitRaw = parseFloat(String(fees?.totalFees ?? "0"));

      // Principal = ex-VAT line total
      const principal = grossPrice - tax;

      // Finance API fees are inc-VAT; strip VAT for registered sellers
      const feePerUnit = isVatRegistered
        ? feePerUnitRaw / (1 + vatRate)
        : feePerUnitRaw;

      const cogs = cogsMap.get(item.asin) ?? 0;
      const newProfit = principal - (feePerUnit * qty) - (cogs * qty);
      const oldProfit = item.actual_profit != null
        ? parseFloat(String(item.actual_profit))
        : null;

      if (updated < 10) {
        const diff = oldProfit != null ? newProfit - oldProfit : 0;
        console.log(
          `  ${item.id}: old=${oldProfit?.toFixed(2) ?? "null"} → new=${newProfit.toFixed(2)} (${diff >= 0 ? "+" : ""}${diff.toFixed(2)})`
        );
      }

      if (apply) {
        const { error: updateErr } = await supabase
          .from("order_items")
          .update({ actual_profit: newProfit })
          .eq("id", item.id);
        if (updateErr) {
          errorCount++;
        }
      }

      updated++;
    }

    if (data.length < pageSize) break;
    page++;
  }

  if (updated > 10) {
    console.log(`  ...and ${updated - 10} more`);
  }

  console.log(`\nTotal settled items: ${total}`);
  console.log(`${apply ? "Updated" : "Would update"}: ${updated}`);
  if (errorCount > 0) console.log(`Errors: ${errorCount}`);
  if (!apply) {
    console.log("\nRun with --apply to write these changes.");
  }
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
