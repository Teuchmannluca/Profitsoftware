import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { StatCard } from "@/components/stat-card";
import { OrdersTable } from "@/components/orders-table";
import { SyncLogCard } from "@/components/sync-log-card";
import { ShoppingCart, PackageCheck, Clock, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [
    { count: orderCount },
    { count: itemCount },
    { data: orders },
    { data: syncLogs },
  ] = await Promise.all([
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("order_items").select("*", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select(
        "amazon_order_id, purchase_date, order_status, fulfillment_channel, ship_country, last_updated"
      )
      .order("purchase_date", { ascending: false })
      .limit(20),
    supabase
      .from("sync_log")
      .select("pillar, status, finished_at, rows_written, error")
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  const lastSuccessSync = syncLogs?.find((l) => l.status === "success");
  const lastSyncTime = lastSuccessSync?.finished_at
    ? timeAgo(lastSuccessSync.finished_at)
    : "never";
  const hasErrors = syncLogs?.some((l) => l.status === "error") ?? false;

  return (
    <div className="min-h-screen">
      <Header email={user.email ?? ""} />

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Amazon UK performance overview
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Total Orders"
            value={orderCount ?? 0}
            subtitle="All time"
            icon={ShoppingCart}
          />
          <StatCard
            title="Items Synced"
            value={itemCount ?? 0}
            subtitle="Order line items"
            icon={PackageCheck}
          />
          <StatCard
            title="Last Sync"
            value={lastSyncTime}
            subtitle="Most recent successful sync"
            icon={Clock}
          />
          <StatCard
            title="System Status"
            value={hasErrors ? "Attention" : "Healthy"}
            subtitle={hasErrors ? "Check sync log for errors" : "All systems operational"}
            icon={Zap}
            iconColor={hasErrors ? "text-destructive" : "text-success"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <OrdersTable orders={orders ?? []} />
          </div>
          <div>
            <SyncLogCard logs={syncLogs ?? []} />
          </div>
        </div>
      </main>
    </div>
  );
}
