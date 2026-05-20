import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const apply = process.argv.includes("--apply");
const settledBeforeArg = process.argv.find((arg) => arg.startsWith("--settled-before="));
const settledBefore = settledBeforeArg?.split("=")[1];

type ActualFees = Record<string, unknown> & {
  feeBasis?: string;
  totalFees?: unknown;
};

type OrderItemRow = {
  id: string;
  amazon_order_id: string | null;
  sku: string | null;
  qty: number | null;
  actual_fees: ActualFees | null;
  settled_at: string | null;
};

function roundMoney(value: number) {
  return Math.round(value * 10000) / 10000;
}

function repairFees(actualFees: ActualFees, qty: number) {
  const repaired: ActualFees = { ...actualFees, feeBasis: "per_unit" };

  for (const [key, value] of Object.entries(actualFees)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      repaired[key] = roundMoney(value / qty);
    }
  }

  return repaired;
}

async function main() {
  console.log(`\n=== Repair actual_fees line totals ===`);
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  if (settledBefore) {
    console.log(`Only settled before: ${settledBefore}`);
  }

  const candidates: OrderItemRow[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    let query = supabase
      .from("order_items")
      .select("id, amazon_order_id, sku, qty, actual_fees, settled_at")
      .not("actual_fees", "is", null)
      .eq("is_settled", true)
      .gt("qty", 1)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (settledBefore) {
      query = query.lt("settled_at", settledBefore);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch order_items: ${error.message}`);
    if (!data || data.length === 0) break;

    candidates.push(
      ...(data as OrderItemRow[]).filter(
        (row) => row.actual_fees && row.actual_fees.feeBasis !== "per_unit"
      )
    );

    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Candidates: ${candidates.length}`);
  if (candidates.length === 0) {
    console.log("Nothing to repair.\n");
    return;
  }

  let repaired = 0;
  for (const row of candidates) {
    const qty = row.qty ?? 1;
    if (qty <= 1 || !row.actual_fees) continue;

    const beforeTotal = Number(row.actual_fees.totalFees ?? 0);
    const nextFees = repairFees(row.actual_fees, qty);
    const afterTotal = Number(nextFees.totalFees ?? 0);

    if (repaired < 10) {
      console.log(
        `  ${row.amazon_order_id ?? row.id} ${row.sku ?? ""}: qty ${qty}, totalFees ${beforeTotal.toFixed(4)} -> ${afterTotal.toFixed(4)}`
      );
    }

    if (apply) {
      const { error } = await supabase
        .from("order_items")
        .update({ actual_fees: nextFees })
        .eq("id", row.id);
      if (error) throw new Error(`Failed to update ${row.id}: ${error.message}`);
    }

    repaired++;
  }

  if (candidates.length > 10) {
    console.log(`  ...and ${candidates.length - 10} more`);
  }

  console.log(`\n${apply ? "Repaired" : "Would repair"}: ${repaired} rows`);
  if (!apply) {
    console.log("Run with --apply to write these changes.");
  }
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
