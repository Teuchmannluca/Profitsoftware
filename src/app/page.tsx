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
    {},
    { data: syncLogs },
    { data: inventorySnaps },
    { data: refundRows },
    { data: reimbursementRows },
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
    Promise.resolve({}),
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
    supabase
      .from("returns")
      .select("refunded_amount")
      .gte("return_request_date", from.toISOString())
      .lte("return_request_date", to.toISOString()),
    supabase
      .from("reimbursements")
      .select("amount")
      .gte("event_date", from.toISOString().slice(0, 10))
      .lte("event_date", to.toISOString().slice(0, 10)),
  ]);

  const lastSyncTime = (syncLogs ?? [])
    .map((l) => l.finished_at)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;

  const totalRefunded = (refundRows ?? []).reduce((sum, r) => sum + (r.refunded_amount ?? 0), 0);
  const totalReimbursed = (reimbursementRows ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const stockMap = new Map<string, { fulfillable: number; reserved: number; inbound: number }>();
  for (const snap of inventorySnaps ?? []) {
    stockMap.set(snap.sku, {
      fulfillable: snap.afn_fulfillable ?? 0,
      reserved: snap.afn_reserved ?? 0,
      inbound: snap.afn_inbound ?? 0,
    });
  }

  // Fetch active COGS
  const { data: cogsData } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs")
    .is("valid_to", null);
  const cogsMap = new Map(
    cogsData?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
  );

  // Fetch absolute latest sale (regardless of period filter)
  const { data: globalLatestOrders } = await supabase
    .from("orders")
    .select("amazon_order_id, purchase_date")
    .order("purchase_date", { ascending: false })
    .limit(5);

  const gOrderIds = globalLatestOrders?.map(o => o.amazon_order_id) ?? [];
  const { data: globalOrderItems } = gOrderIds.length > 0
    ? await supabase
        .from("order_items")
        .select("amazon_order_id, sku, asin, qty, item_price_gross, item_tax, shipping_price, promo_discount, estimated_fees, actual_fees")
        .in("amazon_order_id", gOrderIds)
    : { data: [] };

  const gSkus = [...new Set(globalOrderItems?.map(i => i.sku).filter(Boolean) ?? [])];
  const { data: globalProducts } = gSkus.length > 0
    ? await supabase.from("products").select("sku, title, image_url").in("sku", gSkus)
    : { data: [] };
  const gProductMap = new Map(globalProducts?.map(p => [p.sku, p]) ?? []);

  let latestSaleData: {
    purchaseDate: string;
    sku: string;
    asin: string | null;
    title: string | null;
    imageUrl: string | null;
    qty: number;
    salePrice: number;
    tax: number;
    cogs: number;
    totalFee: number;
    profit: number;
    margin: number;
    stockLeft: number;
    stockInbound: number;
  } | null = null;

  for (const order of globalLatestOrders ?? []) {
    const items = (globalOrderItems ?? []).filter(i => i.amazon_order_id === order.amazon_order_id);
    const pricedItem = items.find(i => parseFloat(String(i.item_price_gross ?? "0")) > 0);
    if (pricedItem) {
      const salePrice = parseFloat(String(pricedItem.item_price_gross ?? "0"));
      const tax = parseFloat(String(pricedItem.item_tax ?? "0"));
      const qty = pricedItem.qty ?? 1;
      const unitCogs = cogsMap.get(pricedItem.asin ?? "") ?? 0;
      const feeData = (pricedItem.actual_fees ?? pricedItem.estimated_fees) as Record<string, unknown> | null;
      const totalFee = feeData ? parseFloat(String(feeData.totalFees ?? 0)) * qty : 0;
      const profit = salePrice - tax - totalFee - (unitCogs * qty);
      const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
      const stock = stockMap.get(pricedItem.sku);

      latestSaleData = {
        purchaseDate: order.purchase_date,
        sku: pricedItem.sku,
        asin: pricedItem.asin,
        title: gProductMap.get(pricedItem.sku)?.title ?? null,
        imageUrl: gProductMap.get(pricedItem.sku)?.image_url ?? null,
        qty,
        salePrice,
        tax,
        cogs: unitCogs,
        totalFee,
        profit,
        margin,
        stockLeft: stock?.fulfillable ?? 0,
        stockInbound: stock?.inbound ?? 0,
      };
      break;
    }
  }

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
              <SyncButton lastSyncTime={lastSyncTime ?? null} />
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
                value: metrics.roi,
                prevValue: prevMetrics.roi,
                max: Math.max(metrics.roi, 100),
                label: "ROI",
                formattedValue: `${metrics.roi.toFixed(2)}%`,
                prevFormatted: `${prevMetrics.roi.toFixed(2)}%`,
                subtitle: "return on investment",
                color: "#f59e0b",
                gradient: "amber",
                shadow: "shadow-amber-soft",
                sparkKey: "profit",
              },
            ]}
            dailyData={dailyData}
            adSpend={metrics.adSpend}
            prevAdSpend={prevMetrics.adSpend}
          />

          {/* Stats strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatBox
              label="Orders"
              value={metrics.totalOrderCount}
              iconName="ShoppingBag"
              gradient="indigo"
            />
            <StatBox
              label="Revenue"
              value={`£${metrics.grossSales.toFixed(2)}`}
              iconName="TrendingUp"
              gradient="sky"
            />
            <StatBox
              label="COGS"
              value={`£${metrics.totalCogs.toFixed(2)}`}
              iconName="Package"
              gradient="orange"
            />
            <StatBox
              label="Fees"
              value={`£${metrics.totalFees.toFixed(2)}`}
              iconName="Receipt"
              gradient="amber"
            />
            <StatBox
              label="Ad Spend"
              value={`£${metrics.adSpend.toFixed(2)}`}
              iconName="TrendingUp"
              gradient="rose"
            />
            <StatBox
              label="Net P&L"
              value={`£${metrics.estimatedProfit.toFixed(2)}`}
              iconName="PiggyBank"
              gradient="emerald"
            />
            <StatBox
              label="Margin"
              value={`${metrics.margin.toFixed(1)}%`}
              iconName="Percent"
              gradient="sky"
            />
            <StatBox
              label="ROI"
              value={`${metrics.roi.toFixed(1)}%`}
              iconName="TrendingUp"
              gradient="emerald"
            />
          </div>

          {/* Latest Sale */}
          {latestSaleData && (() => {
            const timeStr = new Date(latestSaleData.purchaseDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const dateStr = new Date(latestSaleData.purchaseDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

            return (
              <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-5">
                    {latestSaleData.imageUrl ? (
                      <Image
                        src={latestSaleData.imageUrl}
                        alt={latestSaleData.title ?? latestSaleData.sku}
                        width={140}
                        height={140}
                        className="rounded-2xl object-cover ring-1 ring-border/50 shrink-0 w-auto h-auto"
                      />
                    ) : (
                      <div className="h-[140px] w-[140px] rounded-2xl bg-muted shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full ring-1 ring-emerald-600/10 dark:ring-emerald-400/10">
                          Latest Sale · {dateStr} {timeStr}
                        </span>
                        <a href="/orders" className="text-[11px] text-primary font-medium hover:underline">All orders →</a>
                      </div>
                      <p className="text-[13px] font-bold truncate mt-2">{latestSaleData.title ?? "Unknown Product"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        <a href={`https://www.amazon.co.uk/dp/${latestSaleData.asin}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{latestSaleData.asin}</a>
                        {" · "}{latestSaleData.sku}
                      </p>
                      <div className="flex items-center gap-4 mt-3">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Qty</p>
                          <p className="text-lg font-bold font-mono">{latestSaleData.qty}</p>
                        </div>
                        <div className="h-8 w-px bg-border/60" />
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Price</p>
                          <p className="text-lg font-bold font-mono">£{latestSaleData.salePrice.toFixed(2)}</p>
                        </div>
                        <div className="h-8 w-px bg-border/60" />
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Profit</p>
                          <p className={`text-lg font-bold font-mono ${latestSaleData.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>£{latestSaleData.profit.toFixed(2)}</p>
                        </div>
                        <div className="h-8 w-px bg-border/60" />
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Margin</p>
                          <p className={`text-lg font-bold font-mono ${latestSaleData.margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{latestSaleData.margin.toFixed(1)}%</p>
                        </div>
                        <div className="h-8 w-px bg-border/60" />
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">In Stock</p>
                          <p className={`text-lg font-bold font-mono ${latestSaleData.stockLeft <= 0 ? "text-rose-600 dark:text-rose-400" : latestSaleData.stockLeft < 10 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>{latestSaleData.stockLeft}</p>
                          {latestSaleData.stockInbound > 0 && (
                            <p className="text-[9px] text-sky-600 dark:text-sky-400 font-mono">+{latestSaleData.stockInbound} inbound</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
