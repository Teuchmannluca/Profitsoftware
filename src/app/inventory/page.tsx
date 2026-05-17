import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { InventoryTable } from "@/components/inventory-table";
import { SyncInventoryButton } from "@/components/sync-inventory-button";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().split("T")[0];

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
    .eq("date", today);

  const skus = (inventoryRows ?? []).map((r) => r.sku);

  const { data: products } = skus.length > 0
    ? await supabase
        .from("products")
        .select("sku, asin, fnsku, title, image_url")
        .in("sku", skus)
    : { data: [] };

  const productMap = new Map(
    (products ?? []).map((p) => [p.sku, p])
  );

  const rows = (inventoryRows ?? []).map((snap) => {
    const product = productMap.get(snap.sku);
    return {
      sku: snap.sku,
      asin: product?.asin ?? snap.asin,
      fnsku: product?.fnsku ?? null,
      title: product?.title ?? null,
      image_url: product?.image_url ?? null,
      afn_fulfillable: snap.afn_fulfillable,
      afn_reserved: snap.afn_reserved,
      afn_inbound: snap.afn_inbound,
      afn_unsellable: snap.afn_unsellable,
      total_quantity: snap.total_quantity,
    };
  });

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[220px]">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex h-14 items-center justify-between px-8">
            <div>
              <h1 className="text-sm font-semibold">Inventory</h1>
              <p className="text-[11px] text-muted-foreground">
                FBA stock levels
              </p>
            </div>
            <SyncInventoryButton />
          </div>
        </div>

        <div className="p-8">
          <InventoryTable rows={rows} />
        </div>
      </main>
    </div>
  );
}
