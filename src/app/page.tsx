import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { StatBox } from "@/components/stat-card";
import { SyncLogCard } from "@/components/sync-log-card";
import { SyncButton } from "@/components/sync-button";
import { KpiSection } from "@/components/kpi-section";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { getDateRange, getSalesMetrics } from "@/lib/queries/sales";
import { Card, CardContent } from "@/components/ui/card";
import { TopSellersCard } from "@/components/top-sellers-card";
import { MainContent } from "@/components/main-content";
import Image from "next/image";

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

  const { data: latestSnapshotRow } = await supabase
    .from("inventory_snapshots")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const [
    { count: orderCount },
    { count: itemCount },
    { data: rawOrders },
    { data: syncLogs },
    { data: inventorySnaps },
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
    latestSnapshotRow?.date
      ? supabase
          .from("inventory_snapshots")
          .select("sku, afn_fulfillable, afn_reserved, afn_inbound")
          .eq("date", latestSnapshotRow.date)
      : Promise.resolve({ data: [] as { sku: string; afn_fulfillable: number; afn_reserved: number; afn_inbound: number }[] }),
  ]);

  const stockMap = new Map<string, { fulfillable: number; reserved: number; inbound: number }>();
  for (const snap of inventorySnaps ?? []) {
    stockMap.set(snap.sku, {
      fulfillable: snap.afn_fulfillable ?? 0,
      reserved: snap.afn_reserved ?? 0,
      inbound: snap.afn_inbound ?? 0,
    });
  }

  // Fetch order items with product details for the recent orders
  const orderIds = rawOrders?.map((o) => o.amazon_order_id) ?? [];

  const { data: orderItems } =
    orderIds.length > 0
      ? await supabase
          .from("order_items")
          .select(
            "amazon_order_id, sku, asin, qty, item_price_gross, item_tax, promo_discount, estimated_profit, estimated_fees, actual_fees, actual_profit"
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

  // Fetch active COGS
  const { data: cogsData } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs")
    .is("valid_to", null);
  const cogsMap = new Map(
    cogsData?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
  );

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
          estimated_profit: item.estimated_profit == null
            ? null
            : parseFloat(String(item.estimated_profit)),
        })) ?? [],
    })) ?? [];

  // Previous period for comparison
  const periodMs = to.getTime() - from.getTime();
  const prevFrom = new Date(from.getTime() - periodMs - 1);
  const prevTo = new Date(from.getTime() - 1);
  const [prevMetrics, { getTopSellers }, { getDailyMetrics }] = await Promise.all([
    getSalesMetrics(prevFrom, prevTo),
    import("@/actions/top-sellers"),
    import("@/actions/daily-metrics"),
  ]);
  const sparkFrom = new Date(to.getTime() - 6 * 86400000);
  const [topSellers, dailyData] = await Promise.all([
    getTopSellers("today", "units"),
    getDailyMetrics(sparkFrom < from ? sparkFrom : from, to),
  ]);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Dashboard"
          subtitle="Your Amazon Business Performance"
          action={
            <div className="flex items-center gap-3">
              <PeriodFilter />
              <SyncButton />
            </div>
          }
        />

        <div className="p-8 space-y-8">
          {/* KPI gauges row */}
          <KpiSection
            items={[
              {
                value: metrics.estimatedProfit,
                prevValue: prevMetrics.estimatedProfit,
                max: Math.max(metrics.grossSales, 1),
                label: "Profit",
                formattedValue: `£${metrics.estimatedProfit.toFixed(2)}`,
                prevFormatted: `£${prevMetrics.estimatedProfit.toFixed(2)}`,
                subtitle: "net",
                color: "#10b981",
                gradient: "emerald",
                shadow: "shadow-emerald-soft",
                sparkKey: "profit",
              },
              {
                value: metrics.grossSales,
                prevValue: prevMetrics.grossSales,
                max: Math.max(metrics.grossSales, 1),
                label: "Revenue",
                formattedValue: `£${metrics.grossSales.toFixed(2)}`,
                prevFormatted: `£${prevMetrics.grossSales.toFixed(2)}`,
                subtitle: "gross",
                color: "#0ea5e9",
                gradient: "sky",
                shadow: "shadow-sky-soft",
                sparkKey: "revenue",
              },
              {
                value: metrics.totalOrderCount,
                prevValue: prevMetrics.totalOrderCount,
                max: Math.max(metrics.totalOrderCount, 1),
                label: "Orders",
                formattedValue: String(metrics.totalOrderCount),
                prevFormatted: String(prevMetrics.totalOrderCount),
                subtitle: "total",
                color: "#8b5cf6",
                gradient: "violet",
                shadow: "shadow-violet-soft",
                sparkKey: "units",
              },
              {
                value: metrics.margin,
                prevValue: prevMetrics.margin,
                max: 100,
                label: "Profit Margin",
                formattedValue: `${metrics.margin.toFixed(2)}%`,
                prevFormatted: `${prevMetrics.margin.toFixed(2)}%`,
                subtitle: "margin",
                color: "#f59e0b",
                gradient: "amber",
                shadow: "shadow-amber-soft",
                sparkKey: "profit",
              },
            ]}
            dailyData={dailyData}
          />

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox
              label="Orders"
              value={metrics.totalOrderCount}
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

          {/* Latest Sale */}
          {ordersWithItems.length > 0 && (() => {
            const orderWithItem = ordersWithItems.find(o => o.items.length > 0 && o.items[0].item_price_gross > 0);
            if (!orderWithItem) return null;
            const latestOrder = orderWithItem;
            const latestItem = latestOrder.items[0];
            const salePrice = latestItem.item_price_gross;
            const tax = latestItem.item_tax;
            const cogs = cogsMap.get(latestItem.asin ?? "") ?? 0;
            const feeItem = (orderItems ?? []).find(i => i.amazon_order_id === latestOrder.amazon_order_id);
            const feeRaw = feeItem as Record<string, unknown> | undefined;
            const feeData = (feeRaw?.actual_fees ?? feeRaw?.estimated_fees) as Record<string, unknown> | null;
            const totalFee = feeData ? parseFloat(String(feeData.totalFees ?? 0)) * latestItem.qty : 0;
            const profit = salePrice - tax - totalFee - (cogs * latestItem.qty);
            const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
            const stock = stockMap.get(latestItem.sku);
            const stockLeft = stock?.fulfillable ?? 0;
            const stockInbound = stock?.inbound ?? 0;
            const timeStr = new Date(latestOrder.purchase_date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

            return (
              <div className="grid gap-6 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <Card className="overflow-hidden shadow-card ring-1 ring-border/50 h-full">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-5">
                        {latestItem.image_url ? (
                          <Image
                            src={latestItem.image_url}
                            alt={latestItem.title ?? latestItem.sku}
                            width={140}
                            height={140}
                            className="rounded-2xl object-cover ring-1 ring-border/50 shrink-0"
                          />
                        ) : (
                          <div className="h-[140px] w-[140px] rounded-2xl bg-muted shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full ring-1 ring-emerald-600/10 dark:ring-emerald-400/10">
                              New Sale · {timeStr}
                            </span>
                            <a href="/orders" className="text-[11px] text-primary font-medium hover:underline">All orders →</a>
                          </div>
                          <p className="text-[13px] font-bold truncate mt-2">{latestItem.title ?? "Unknown Product"}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            <a href={`https://www.amazon.co.uk/dp/${latestItem.asin}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{latestItem.asin}</a>
                            {" · "}{latestItem.sku}
                          </p>
                          <div className="flex items-center gap-4 mt-3">
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Qty</p>
                              <p className="text-lg font-bold font-mono">{latestItem.qty}</p>
                            </div>
                            <div className="h-8 w-px bg-border/60" />
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Price</p>
                              <p className="text-lg font-bold font-mono">£{salePrice.toFixed(2)}</p>
                            </div>
                            <div className="h-8 w-px bg-border/60" />
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Profit</p>
                              <p className={`text-lg font-bold font-mono ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>£{profit.toFixed(2)}</p>
                            </div>
                            <div className="h-8 w-px bg-border/60" />
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Margin</p>
                              <p className={`text-lg font-bold font-mono ${margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{margin.toFixed(1)}%</p>
                            </div>
                            <div className="h-8 w-px bg-border/60" />
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">In Stock</p>
                              <p className={`text-lg font-bold font-mono ${stockLeft <= 0 ? "text-rose-600 dark:text-rose-400" : stockLeft < 10 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{stockLeft}</p>
                              {stockInbound > 0 && (
                                <p className="text-[9px] text-sky-600 dark:text-sky-400 font-mono">+{stockInbound} inbound</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-2">
                  <Card className="overflow-hidden shadow-card ring-1 ring-border/50 h-full">
                    <CardContent className="p-6">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Cost Breakdown</p>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">COGS &amp; Prep</span>
                          <span className="font-mono text-xs font-semibold">£{(cogs * latestItem.qty).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Amazon Fees</span>
                          <span className="font-mono text-xs font-semibold">£{totalFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">VAT</span>
                          <span className="font-mono text-xs font-semibold">£{tax.toFixed(2)}</span>
                        </div>
                        <div className="border-t border-border/50 pt-3 flex justify-between items-center">
                          <span className="text-xs font-semibold">Net Profit</span>
                          <span className={`font-mono text-sm font-bold ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>£{profit.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold">ROI</span>
                          <span className="font-mono text-xs font-bold">{cogs > 0 ? ((profit / (cogs * latestItem.qty)) * 100).toFixed(1) : "—"}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            );
          })()}

          {/* Top Sellers + Sync Log */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TopSellersCard initialData={topSellers} />
            </div>
            <div>
              <SyncLogCard logs={syncLogs ?? []} />
            </div>
          </div>
        </div>
      </MainContent>
    </div>
  );
}
