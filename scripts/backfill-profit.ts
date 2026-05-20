import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("[backfill] Loading COGS, products, and order items...");

  const [{ data: cogsData }, { data: productData }] = await Promise.all([
    supabase.from("cogs_periods").select("asin, total_cogs").is("valid_to", null),
    supabase.from("products").select("sku, asin, vat_rate"),
  ]);

  const cogsMap = new Map(
    (cogsData ?? []).map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))])
  );
  const skuToAsin = new Map(
    (productData ?? []).map((p) => [p.sku, p.asin])
  );
  const skuToVatRate = new Map(
    (productData ?? []).map((p) => [
      p.sku,
      parseFloat(String(p.vat_rate ?? "0.20")),
    ])
  );

  let page = 0;
  let updated = 0;
  const pageSize = 500;

  while (true) {
    const { data: items } = await supabase
      .from("order_items")
      .select(
        "order_item_id, sku, asin, qty, item_price_gross, item_tax, promo_discount, estimated_fees, cogs_snapshot"
      )
      .not("estimated_fees", "is", null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (!items || items.length === 0) break;

    for (const item of items) {
      const lineTotal = parseFloat(String(item.item_price_gross ?? "0"));
      if (lineTotal === 0) continue;

      const qty = item.qty ?? 1;
      const asin = item.asin ?? skuToAsin.get(item.sku);
      const cogs = asin ? cogsMap.get(asin) ?? 0 : 0;

      let tax = parseFloat(String(item.item_tax ?? 0));
      if (tax === 0 && lineTotal > 0) {
        const vatRate = skuToVatRate.get(item.sku) ?? 0.20;
        tax = lineTotal * (vatRate / (1 + vatRate));
      }

      const promo = parseFloat(String(item.promo_discount ?? 0));
      const fees = item.estimated_fees as Record<string, unknown> | null;
      const totalFeesRaw = parseFloat(String(fees?.totalFees ?? "0"));
      const vatRate = skuToVatRate.get(item.sku) ?? 0.20;
      const feeExVat = totalFeesRaw / (1 + vatRate);
      const profit = lineTotal - tax - promo - feeExVat * qty - cogs * qty;

      const { error } = await supabase
        .from("order_items")
        .update({
          cogs_snapshot: cogs,
          estimated_profit: profit,
        })
        .eq("order_item_id", item.order_item_id);

      if (!error) updated++;
    }

    console.log(
      `[backfill] Processed page ${page + 1} (${items.length} items, ${updated} updated so far)`
    );

    if (items.length < pageSize) break;
    page++;
  }

  console.log(`[backfill] Done: ${updated} items updated with cogs_snapshot and corrected profit`);
}

main().catch(console.error);
