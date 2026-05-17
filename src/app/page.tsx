import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { CircleGauge } from "@/components/circle-gauge";
import { StatBox } from "@/components/stat-card";
import { OrdersTable } from "@/components/orders-table";
import { SyncLogCard } from "@/components/sync-log-card";
import { SyncButton } from "@/components/sync-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { getSalesMetrics, getDateRange } from "@/lib/queries/sales";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createServiceClient();

  const todayRange = getDateRange("today");
  const todayMetrics = await getSalesMetrics(todayRange.from, todayRange.to);

  const [
    { data: orders },
    { data: syncLogs },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "amazon_order_id, purchase_date, order_status, fulfillment_channel, ship_country, last_updated"
      )
      .order("purchase_date", { ascending: false })
      .limit(15),
    supabase
      .from("sync_log")
      .select("pillar, status, finished_at, rows_written, error")
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[220px]">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex h-14 items-center justify-between px-8">
            <div>
              <h1 className="text-sm font-semibold">Dashboard</h1>
              <p className="text-[11px] text-muted-foreground">
                Your Sales Performance — Today
              </p>
            </div>
            <SyncButton />
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Circle gauges row */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 py-4">
                <CircleGauge
                  value={todayMetrics.estimatedProfit}
                  max={Math.max(todayMetrics.estimatedProfit, 1)}
                  label="Profit"
                  formattedValue={`£${todayMetrics.estimatedProfit.toFixed(2)}`}
                  subtitle="net"
                  color="#22c55e"
                />
                <CircleGauge
                  value={todayMetrics.grossSales}
                  max={Math.max(todayMetrics.grossSales, 1)}
                  label="Sales"
                  formattedValue={`£${todayMetrics.grossSales.toFixed(2)}`}
                  subtitle="gross"
                  color="#6366f1"
                />
                <CircleGauge
                  value={todayMetrics.margin}
                  max={100}
                  label="ROI"
                  formattedValue={`${todayMetrics.margin.toFixed(1)}%`}
                  subtitle="return"
                  color="#f97316"
                />
                <CircleGauge
                  value={todayMetrics.unitsSold}
                  max={Math.max(todayMetrics.unitsSold, 1)}
                  label="Units"
                  formattedValue={String(todayMetrics.unitsSold)}
                  subtitle="sold"
                  color="#a855f7"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stat boxes row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBox
              label="Orders"
              value={todayMetrics.orderCount}
              accentColor="bg-indigo-500"
            />
            <StatBox
              label="Refunds"
              value={0}
              accentColor="bg-rose-500"
            />
            <StatBox
              label="Fees Paid"
              value="£0.00"
              accentColor="bg-amber-500"
            />
            <StatBox
              label="Reimbursements"
              value="£0.00"
              accentColor="bg-teal-500"
            />
            <StatBox
              label="Net P&L"
              value={`£${todayMetrics.estimatedProfit.toFixed(2)}`}
              accentColor="bg-emerald-500"
            />
            <StatBox
              label="Margin"
              value={`${todayMetrics.margin.toFixed(1)}%`}
              accentColor="bg-purple-500"
            />
          </div>

          {/* Orders + Sync Log */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <OrdersTable orders={orders ?? []} />
            </div>
            <div>
              <SyncLogCard logs={syncLogs ?? []} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
