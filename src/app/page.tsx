import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { StatBox } from "@/components/stat-card";
import { RecentOrders } from "@/components/recent-orders";
import { SyncLogCard } from "@/components/sync-log-card";
import { SyncButton } from "@/components/sync-button";
import { CircleGauge } from "@/components/circle-gauge";
import { PageHeader } from "@/components/page-header";
import { PeriodFilterDropdown } from "@/components/period-filter-dropdown";
import { getDateRange, getSalesMetrics } from "@/lib/queries/sales";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
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

  const supabase = createServiceClient();

  // Get metrics for the selected period
  const metrics = await getSalesMetrics(from, to);

  const [
    { count: orderCount },
    { count: itemCount },
    { data: rawOrders },
    { data: syncLogs },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .gte("purchase_date", from.toISOString())
      .lte("purchase_date", to.toISOString()),
    supabase
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .gte("orders.purchase_date", from.toISOString())
      .lte("orders.purchase_date", to.toISOString()),
    supabase
      .from("orders")
      .select(
        "amazon_order_id, purchase_date, order_status, fulfillment_channel, ship_country, last_updated"
      )
      .gte("purchase_date", from.toISOString())
      .lte("purchase_date", to.toISOString())
      .order("purchase_date", { ascending: false })
      .limit(10),
    supabase
      .from("sync_log")
      .select("pillar, status, finished_at, rows_written, error")
      .order("started_at", { ascending: false })
      .limit(8),
  ]);

  // Fetch order items with product details for the recent orders
  const orderIds = rawOrders?.map((o) => o.amazon_order_id) ?? [];

  const { data: orderItems } =
    orderIds.length > 0
      ? await supabase
          .from("order_items")
          .select(
            "amazon_order_id, sku, asin, qty, item_price_gross, item_tax, promo_discount, estimated_profit"
          )
          .in("amazon_order_id", orderIds)
      : { data: [] };

  // Fetch product images/titles
  const skus = [...new Set(orderItems?.map((i) => i.sku).filter(Boolean) ?? [])];
  const { data: products } =
    skus.length > 0
      ? await supabase.from("products").select("sku, title, image_url").in("sku", skus)
      : { data: [] };

  const productMap = new Map(products?.map((p) => [p.sku, p]) ?? []);

  // Group items by order
  const itemsByOrder = new Map<string, typeof orderItems>();
  for (const item of orderItems ?? []) {
    const arr = itemsByOrder.get(item.amazon_order_id) ?? [];
    arr.push(item);
    itemsByOrder.set(item.amazon_order_id, arr);
  }

  const ordersWithItems =
    rawOrders?.map((order) => ({
      ...order,
      items:
        itemsByOrder.get(order.amazon_order_id)?.map((item) => ({
          sku: item.sku,
          asin: item.asin,
          title: productMap.get(item.sku)?.title ?? null,
          image_url: productMap.get(item.sku)?.image_url ?? null,
          qty: item.qty ?? 0,
          item_price_gross: parseFloat(String(item.item_price_gross ?? "0")),
          item_tax: parseFloat(String(item.item_tax ?? "0")),
          promo_discount: parseFloat(String(item.promo_discount ?? "0")),
          estimated_profit: item.estimated_profit
            ? parseFloat(String(item.estimated_profit))
            : null,
        })) ?? [],
    })) ?? [];

  const totalOrders = orderCount ?? 0;
  const totalItems = itemCount ?? 0;

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[240px]">
        <PageHeader
          title="Dashboard"
          subtitle="Your Amazon Business Performance"
          action={
            <div className="flex items-center gap-3">
              <PeriodFilterDropdown />
              <SyncButton />
            </div>
          }
        />

        <div className="p-8 space-y-8">
          {/* Circle gauges row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <CircleGauge
              value={metrics.estimatedProfit}
              max={Math.max(metrics.grossSales, 1)}
              label="Net Profit"
              formattedValue={`£${metrics.estimatedProfit.toFixed(2)}`}
              subtitle="net"
              color="#10b981"
              gradient="emerald"
              shadow="shadow-emerald-soft"
            />
            <CircleGauge
              value={metrics.grossSales}
              max={Math.max(metrics.grossSales, 1)}
              label="Total Sales"
              formattedValue={`£${metrics.grossSales.toFixed(2)}`}
              subtitle="gross"
              color="#0ea5e9"
              gradient="sky"
              shadow="shadow-sky-soft"
            />
            <CircleGauge
              value={metrics.margin}
              max={100}
              label="ROI"
              formattedValue={`${metrics.margin.toFixed(1)}%`}
              subtitle="return"
              color="#f59e0b"
              gradient="amber"
              shadow="shadow-amber-soft"
            />
            <CircleGauge
              value={totalOrders}
              max={Math.max(totalOrders, 1)}
              label="Units Sold"
              formattedValue={String(totalItems)}
              subtitle="sold"
              color="#8b5cf6"
              gradient="violet"
              shadow="shadow-violet-soft"
            />
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox
              label="Orders"
              value={totalOrders}
              iconName="ShoppingBag"
              gradient="indigo"
            />
            <StatBox
              label="Refunds"
              value="£0.00"
              iconName="RotateCcw"
              gradient="rose"
            />
            <StatBox
              label="Fees Paid"
              value={`£${metrics.totalFees.toFixed(2)}`}
              iconName="Receipt"
              gradient="amber"
            />
            <StatBox
              label="Reimbursements"
              value="£0.00"
              iconName="Wallet"
              gradient="emerald"
            />
            <StatBox
              label="Net P&L"
              value={`£${metrics.estimatedProfit.toFixed(2)}`}
              iconName="PiggyBank"
              gradient="violet"
            />
            <StatBox
              label="Margin"
              value={`${metrics.margin.toFixed(1)}%`}
              iconName="Percent"
              gradient="sky"
            />
          </div>

          {/* Orders + Sync Log */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RecentOrders orders={ordersWithItems} />
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
