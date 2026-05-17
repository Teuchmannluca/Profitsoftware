import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OrdersTable } from "@/components/orders-table";
import { SyncButton } from "@/components/sync-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("amazon_order_id, purchase_date, order_status, fulfillment_channel, ship_country, last_updated")
    .order("purchase_date", { ascending: false })
    .limit(50);

  const { data: syncLogs } = await supabase
    .from("sync_log")
    .select("pillar, status, finished_at, rows_written, error")
    .order("started_at", { ascending: false })
    .limit(5);

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Amazon Profit Tracker</h1>
        <span className="text-sm text-muted-foreground">{user.email}</span>
      </div>

      <SyncButton />

      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
        <OrdersTable orders={orders ?? []} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Sync Log</h2>
        <div className="text-sm space-y-1">
          {(syncLogs ?? []).map((log, i) => (
            <div key={i} className="flex gap-4 text-muted-foreground">
              <span className="font-mono">{log.pillar}</span>
              <span>{log.status}</span>
              <span>{log.rows_written} rows</span>
              <span>{log.finished_at ? new Date(log.finished_at).toLocaleString("en-GB") : "running..."}</span>
              {log.error && <span className="text-destructive">{log.error}</span>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
