import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { InventoryTable } from "@/components/inventory-table";
import { SyncInventoryButton } from "@/components/sync-inventory-button";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createServiceClient();

  const { data: latestRow } = await supabase
    .from("inventory_snapshots")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const snapshotDate = latestRow?.date ?? new Date().toISOString().split("T")[0];

  const { data: inventoryRows } = await supabase
    .from("inventory_snapshots")
    .select(
      `
      sku,
      asin,
      afn_fulfillable,
      afn_reserved,
      afn_inbound,
      afn_unsellable,
      total_quantity
    `
    )
    .eq("date", snapshotDate);

  const { data: products } = await supabase
    .from("products")
    .select("sku, asin, fnsku, title, image_url, active");

  const snapshotMap = new Map(
    (inventoryRows ?? []).map((s) => [s.sku, s])
  );

  const rows = (products ?? []).map((product) => {
    const snap = snapshotMap.get(product.sku);
    return {
      sku: product.sku,
      asin: product.asin,
      fnsku: product.fnsku,
      title: product.title,
      image_url: product.image_url,
      active: product.active ?? true,
      afn_fulfillable: snap?.afn_fulfillable ?? 0,
      afn_reserved: snap?.afn_reserved ?? 0,
      afn_inbound: snap?.afn_inbound ?? 0,
      afn_unsellable: snap?.afn_unsellable ?? 0,
      total_quantity: snap?.total_quantity ?? 0,
    };
  });

  const activeRows = rows.filter((r) => r.active);
  const inStockCount = activeRows.filter((r) => r.total_quantity > 0).length;
  const lowStockCount = activeRows.filter((r) => r.afn_fulfillable > 0 && r.afn_fulfillable < 10).length;
  const outOfStockCount = activeRows.filter((r) => r.total_quantity === 0).length;
  const archivedCount = rows.filter((r) => !r.active).length;

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[240px]">
        <PageHeader
          title="Inventory"
          subtitle="FBA stock levels & warehouse management"
          action={<SyncInventoryButton />}
        />

        <div className="p-8 space-y-6">
          {/* Stock summary pills */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-950 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-600/15 dark:ring-emerald-400/15">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {inStockCount} In Stock
            </div>
            {lowStockCount > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-amber-50 dark:bg-amber-950 px-3.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-600/15 dark:ring-amber-400/15">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                {lowStockCount} Low Stock
              </div>
            )}
            {outOfStockCount > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-rose-50 dark:bg-rose-950 px-3.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 ring-1 ring-rose-600/15 dark:ring-rose-400/15">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                {outOfStockCount} Out of Stock
              </div>
            )}
          </div>

          <InventoryTable rows={rows} />
        </div>
      </main>
    </div>
  );
}
