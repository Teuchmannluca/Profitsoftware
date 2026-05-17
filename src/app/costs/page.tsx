import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { CogsTable } from "@/components/cogs-table";

export const dynamic = "force-dynamic";

export interface ProductCostRow {
  sku: string;
  asin: string | null;
  title: string | null;
  image_url: string | null;
  vat_rate: number;
  unit_cost: number | null;
  prep_cost: number | null;
  total_cogs: number | null;
}

export default async function CostsPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createServiceClient();

  // Fetch all products
  const { data: products } = await supabase
    .from("products")
    .select("sku, asin, title, image_url, vat_rate");

  // Fetch active cogs_periods (where valid_to is null)
  const { data: cogsPeriods } = await supabase
    .from("cogs_periods")
    .select("asin, unit_cost, prep_cost, total_cogs, valid_from")
    .is("valid_to", null);

  // Build a map of ASIN -> current cost
  const costMap = new Map<
    string,
    { unit_cost: number; prep_cost: number; total_cogs: number }
  >();
  for (const period of cogsPeriods ?? []) {
    // If multiple active periods for same ASIN, keep the latest valid_from
    const existing = costMap.get(period.asin);
    if (!existing) {
      costMap.set(period.asin, {
        unit_cost: parseFloat(period.unit_cost),
        prep_cost: parseFloat(period.prep_cost),
        total_cogs: parseFloat(period.total_cogs),
      });
    }
  }

  // Join products with cost data
  const rows: ProductCostRow[] = (products ?? []).map((product) => {
    const cost = product.asin ? costMap.get(product.asin) : undefined;
    return {
      sku: product.sku,
      asin: product.asin,
      title: product.title,
      image_url: product.image_url,
      vat_rate: product.vat_rate ?? 20,
      unit_cost: cost?.unit_cost ?? null,
      prep_cost: cost?.prep_cost ?? null,
      total_cogs: cost?.total_cogs ?? null,
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
          </div>
        </div>

        <div className="p-8">
          <CogsTable rows={rows} />
        </div>
      </main>
    </div>
  );
}
