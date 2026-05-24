import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
import { PeriodFilter } from "@/components/period-filter";
import { StatBox } from "@/components/stat-card";
import { PpcTable } from "@/components/ppc-table";
import { getPpcOverview } from "@/lib/queries/ppc";
import { getDateRange } from "@/lib/queries/sales";
import { SyncAdsButton } from "@/components/sync-ads-button";

export const dynamic = "force-dynamic";

export default async function PpcPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const { from, to } = getDateRange(params.period ?? "today");
  const rows = await getPpcOverview(from, to);

  const totals = rows.reduce(
    (acc, r) => ({
      adSpend: acc.adSpend + r.adSpend,
      adSales: acc.adSales + r.adSales,
      totalSales: acc.totalSales + r.totalSales,
      organicSales: acc.organicSales + r.organicSales,
      profit: acc.profit + r.profit,
    }),
    { adSpend: 0, adSales: 0, totalSales: 0, organicSales: 0, profit: 0 }
  );

  const acos = totals.adSales > 0 ? (totals.adSpend / totals.adSales) * 100 : 0;
  const tacos = totals.totalSales > 0 ? (totals.adSpend / totals.totalSales) * 100 : 0;
  const roas = totals.adSpend > 0 ? totals.adSales / totals.adSpend : 0;
  const organicPct = totals.totalSales > 0 ? (totals.organicSales / totals.totalSales) * 100 : 0;

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="PPC / Ads"
          subtitle="Per-product ad performance, organic vs. paid split, and profitability"
          action={
            <div className="flex items-center gap-3">
              <SyncAdsButton />
              <PeriodFilter />
            </div>
          }
        />

        <div className="p-4 md:p-8 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox
              label="Ad Spend"
              value={`£${totals.adSpend.toFixed(2)}`}
              iconName="Receipt"
              gradient="rose"
            />
            <StatBox
              label="Ad Sales"
              value={`£${totals.adSales.toFixed(2)}`}
              iconName="ShoppingBag"
              gradient="sky"
            />
            <StatBox
              label="ACoS"
              value={`${acos.toFixed(1)}%`}
              iconName="Percent"
              gradient="amber"
            />
            <StatBox
              label="TACoS"
              value={`${tacos.toFixed(1)}%`}
              iconName="Percent"
              gradient="orange"
            />
            <StatBox
              label="ROAS"
              value={`${roas.toFixed(2)}x`}
              iconName="TrendingUp"
              gradient="indigo"
            />
            <StatBox
              label="Net Profit"
              value={`£${totals.profit.toFixed(2)}`}
              iconName="PiggyBank"
              gradient={totals.profit >= 0 ? "emerald" : "rose"}
            />
          </div>

          <PpcTable
            rows={rows}
            from={from.toISOString()}
            to={to.toISOString()}
          />
        </div>
      </MainContent>
    </div>
  );
}
