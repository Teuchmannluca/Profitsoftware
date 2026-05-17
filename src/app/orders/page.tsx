import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { StatBox } from "@/components/stat-card";
import { OrdersTable } from "@/components/orders-table";
import { PeriodFilter } from "@/components/period-filter";
import { MonthComparison } from "@/components/month-comparison";
import { getSalesMetrics, getDateRange } from "@/lib/queries/sales";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
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
  const period = params.period ?? "today";
  const { from, to } = getDateRange(period);

  // Current period metrics
  const metrics = await getSalesMetrics(from, to);

  // Month comparison
  const now = new Date();
  const currentMonthRange = getDateRange("this_month");
  const previousMonthRange = getDateRange("last_month");

  const [currentMonthMetrics, previousMonthMetrics] = await Promise.all([
    getSalesMetrics(currentMonthRange.from, currentMonthRange.to),
    getSalesMetrics(previousMonthRange.from, previousMonthRange.to),
  ]);

  const currentMonthLabel = now.toLocaleDateString("en-GB", { month: "short" });
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthLabel = prevMonth.toLocaleDateString("en-GB", {
    month: "short",
  });

  // Fetch recent orders for the selected period
  const supabase = createServiceClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "amazon_order_id, purchase_date, order_status, fulfillment_channel, ship_country, last_updated"
    )
    .gte("purchase_date", from.toISOString())
    .lte("purchase_date", to.toISOString())
    .order("purchase_date", { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[220px]">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex h-14 items-center justify-between px-8">
            <div>
              <h1 className="text-sm font-semibold">Sales</h1>
              <p className="text-[11px] text-muted-foreground">
                Sales Analytics & Order History
              </p>
            </div>
            <PeriodFilter />
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* KPI stat boxes row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBox
              label="Gross Sales"
              value={`£${metrics.grossSales.toFixed(2)}`}
              accentColor="bg-indigo-500"
            />
            <StatBox
              label="Net Revenue"
              value={`£${metrics.netRevenue.toFixed(2)}`}
              accentColor="bg-sky-500"
            />
            <StatBox
              label="Est. Profit"
              value={`£${metrics.estimatedProfit.toFixed(2)}`}
              accentColor="bg-emerald-500"
            />
            <StatBox
              label="Units Sold"
              value={metrics.unitsSold}
              accentColor="bg-purple-500"
            />
            <StatBox
              label="Orders"
              value={metrics.orderCount}
              accentColor="bg-amber-500"
            />
            <StatBox
              label="Margin"
              value={`${metrics.margin.toFixed(1)}%`}
              accentColor="bg-rose-500"
            />
          </div>

          {/* Orders table + Month comparison */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <OrdersTable orders={orders ?? []} />
            </div>
            <div>
              <MonthComparison
                currentMonth={{
                  label: currentMonthLabel,
                  metrics: currentMonthMetrics,
                }}
                previousMonth={{
                  label: previousMonthLabel,
                  metrics: previousMonthMetrics,
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
