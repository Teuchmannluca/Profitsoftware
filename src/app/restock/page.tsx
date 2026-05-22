import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
import { StatBox } from "@/components/stat-card";
import { RestockTable, type RestockRow } from "@/components/restock-table";

export const dynamic = "force-dynamic";

export default async function RestockPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("get_restock_overview", {
    p_lead_time_days: 7,
    p_target_stock_days: 60,
  });

  if (error) {
    console.error("[restock] RPC error:", error);
  }

  const rows: RestockRow[] = (data ?? []).map((r: Record<string, unknown>) => ({
    sku: r.sku as string,
    asin: r.asin as string | null,
    title: r.title as string | null,
    image_url: r.image_url as string | null,
    fulfillable: Number(r.fulfillable ?? 0),
    reserved: Number(r.reserved ?? 0),
    inbound: Number(r.inbound ?? 0),
    units_sold_30d: Number(r.units_sold_30d ?? 0),
    daily_velocity: Number(r.daily_velocity ?? 0),
    days_of_stock: Number(r.days_of_stock ?? 0),
    reorder_point: Number(r.reorder_point ?? 0),
    recommended_qty: Number(r.recommended_qty ?? 0),
    unit_cogs: Number(r.unit_cogs ?? 0),
    restock_cost: Number(r.restock_cost ?? 0),
    urgency: r.urgency as string,
  }));

  const criticalCount = rows.filter(r => r.urgency === "critical" || r.urgency === "out_of_stock").length;
  const lowCount = rows.filter(r => r.urgency === "low").length;
  const healthyCount = rows.filter(r => r.urgency === "ok").length;
  const totalRestockCost = rows
    .filter(r => ["out_of_stock", "critical", "low"].includes(r.urgency))
    .reduce((sum, r) => sum + r.restock_cost, 0);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Restock"
          subtitle="Inventory forecasting & reorder recommendations"
        />

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox
              label="Restock Now"
              value={criticalCount}
              iconName="AlertTriangle"
              gradient="rose"
            />
            <StatBox
              label="Order Soon"
              value={lowCount}
              iconName="Package"
              gradient="amber"
            />
            <StatBox
              label="Healthy"
              value={healthyCount}
              iconName="TrendingUp"
              gradient="emerald"
            />
            <StatBox
              label="Restock Cost"
              value={`£${totalRestockCost.toFixed(0)}`}
              iconName="Wallet"
              gradient="violet"
            />
          </div>

          <RestockTable rows={rows} />
        </div>
      </MainContent>
    </div>
  );
}
