import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { CogsTable } from "@/components/cogs-table";
import { PageHeader } from "@/components/page-header";
import { Receipt } from "lucide-react";

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

export interface CogsPeriodRow {
  id: string;
  asin: string;
  unit_cost: number;
  prep_cost: number;
  total_cogs: number;
  valid_from: string;
  valid_to: string | null;
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

  const { data: products } = await supabase
    .from("products")
    .select("sku, asin, title, image_url, vat_rate");

  const [{ data: cogsPeriods }, { data: allCogsPeriods }] = await Promise.all([
    supabase
      .from("cogs_periods")
      .select("asin, unit_cost, prep_cost, total_cogs, valid_from")
      .is("valid_to", null),
    supabase
      .from("cogs_periods")
      .select("id, asin, unit_cost, prep_cost, total_cogs, valid_from, valid_to")
      .order("valid_from", { ascending: false }),
  ]);

  const costMap = new Map<
    string,
    { unit_cost: number; prep_cost: number; total_cogs: number }
  >();
  for (const period of cogsPeriods ?? []) {
    const existing = costMap.get(period.asin);
    if (!existing) {
      costMap.set(period.asin, {
        unit_cost: parseFloat(period.unit_cost),
        prep_cost: parseFloat(period.prep_cost),
        total_cogs: parseFloat(period.total_cogs),
      });
    }
  }

  const historyByAsin = new Map<string, CogsPeriodRow[]>();
  for (const p of allCogsPeriods ?? []) {
    const arr = historyByAsin.get(p.asin) ?? [];
    arr.push({
      id: p.id,
      asin: p.asin,
      unit_cost: parseFloat(p.unit_cost),
      prep_cost: parseFloat(p.prep_cost),
      total_cogs: parseFloat(p.total_cogs),
      valid_from: p.valid_from,
      valid_to: p.valid_to,
    });
    historyByAsin.set(p.asin, arr);
  }

  const rows: ProductCostRow[] = (products ?? []).map((product) => {
    const cost = product.asin ? costMap.get(product.asin) : undefined;
    return {
      sku: product.sku,
      asin: product.asin,
      title: product.title,
      image_url: product.image_url,
      vat_rate: product.vat_rate ?? 0.20,
      unit_cost: cost?.unit_cost ?? null,
      prep_cost: cost?.prep_cost ?? null,
      total_cogs: cost?.total_cogs ?? null,
    };
  });

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[240px]">
        <PageHeader
          title="Costs"
          subtitle="Product cost management & COGS tracking"
        />

        <div className="p-8">
          <CogsTable rows={rows} historyByAsin={Object.fromEntries(historyByAsin)} />
        </div>
      </main>
    </div>
  );
}
