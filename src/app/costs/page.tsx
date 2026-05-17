import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AddCostForm } from "@/components/add-cost-form";
import { CogsTable, type CogsPeriodRow } from "@/components/cogs-table";

export const dynamic = "force-dynamic";

export default async function CostsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createServiceClient();

  // Fetch all COGS periods
  const { data: cogsPeriods } = await supabase
    .from("cogs_periods")
    .select("*")
    .order("valid_from", { ascending: false });

  // Fetch all products for ASIN selector and joining
  const { data: products } = await supabase
    .from("products")
    .select("sku, asin, title, image_url");

  // Build a map of ASIN -> product info
  const productMap = new Map<string, { title: string | null; image_url: string | null }>();
  for (const p of products ?? []) {
    if (p.asin && !productMap.has(p.asin)) {
      productMap.set(p.asin, { title: p.title, image_url: p.image_url });
    }
  }

  // Join COGS periods with product info
  const rows: CogsPeriodRow[] = (cogsPeriods ?? []).map((period) => {
    const product = productMap.get(period.asin);
    return {
      id: period.id,
      asin: period.asin,
      unit_cost: parseFloat(period.unit_cost),
      prep_cost: parseFloat(period.prep_cost),
      total_cogs: parseFloat(period.total_cogs),
      valid_from: period.valid_from,
      valid_to: period.valid_to,
      notes: period.notes,
      currency: period.currency,
      created_at: period.created_at,
      title: product?.title ?? null,
      image_url: product?.image_url ?? null,
    };
  });

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[220px]">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex h-14 items-center justify-between px-8">
            <div>
              <h1 className="text-sm font-semibold">Costs</h1>
              <p className="text-[11px] text-muted-foreground">
                Product cost management
              </p>
            </div>
            <AddCostForm products={products ?? []} />
          </div>
        </div>

        <div className="p-8">
          <CogsTable rows={rows} />
        </div>
      </main>
    </div>
  );
}
