import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { StatBox } from "@/components/stat-card";
import { SyncLogCard } from "@/components/sync-log-card";
import { SyncButton } from "@/components/sync-button";
import { CircleGauge } from "@/components/circle-gauge";
import { PageHeader } from "@/components/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { getDateRange, getSalesMetrics } from "@/lib/queries/sales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
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

  // Aggregate top selling items by ASIN
  const asinAgg = new Map<string, { asin: string; sku: string; title: string | null; image_url: string | null; units: number; sales: number; profit: number; cogs: number }>();
  for (const item of orderItems ?? []) {
    const price = parseFloat(String(item.item_price_gross ?? "0"));
    if (price === 0) continue;
    const asin = item.asin ?? item.sku;
    const existing = asinAgg.get(asin) ?? {
      asin,
      sku: item.sku,
      title: productMap.get(item.sku)?.title ?? null,
      image_url: productMap.get(item.sku)?.image_url ?? null,
      units: 0, sales: 0, profit: 0, cogs: 0,
    };
    existing.units += item.qty ?? 0;
    existing.sales += price;
    existing.profit += item.estimated_profit == null ? 0 : parseFloat(String(item.estimated_profit));
    asinAgg.set(asin, existing);
  }
  const topSellers = [...asinAgg.values()]
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[240px]">
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
              value={metrics.roi}
              max={Math.max(metrics.roi, 100)}
              label="ROI"
              formattedValue={`${metrics.roi.toFixed(1)}%`}
              subtitle="return on investment"
              color="#f59e0b"
              gradient="amber"
              shadow="shadow-amber-soft"
            />
            <CircleGauge
              value={metrics.unitsSold}
              max={Math.max(metrics.unitsSold, 1)}
              label="Units Sold"
              formattedValue={String(metrics.unitsSold)}
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
              value={metrics.orderCount}
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
            const feeData = feeItem ? (feeItem as Record<string, unknown>).estimated_fees as Record<string, unknown> | null : null;
            const totalFee = feeData ? parseFloat(String(feeData.totalFees ?? 0)) * latestItem.qty : 0;
            const profit = salePrice - tax - totalFee - (cogs * latestItem.qty);
            const margin = salePrice > 0 ? (profit / salePrice) * 100 : 0;
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
                            width={100}
                            height={100}
                            className="rounded-2xl object-cover ring-1 ring-border/50 shrink-0"
                          />
                        ) : (
                          <div className="h-[100px] w-[100px] rounded-2xl bg-muted shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-600/10">
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
                              <p className={`text-lg font-bold font-mono ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>£{profit.toFixed(2)}</p>
                            </div>
                            <div className="h-8 w-px bg-border/60" />
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Margin</p>
                              <p className={`text-lg font-bold font-mono ${margin >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{margin.toFixed(1)}%</p>
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
                          <span className={`font-mono text-sm font-bold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>£{profit.toFixed(2)}</span>
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
              <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                      <TrendingUp className="h-4 w-4 text-amber-600" />
                    </div>
                    Your Top Selling Items
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {topSellers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          <th className="text-left py-2.5 pl-6">Product</th>
                          <th className="text-right py-2.5 px-3">Units</th>
                          <th className="text-right py-2.5 px-3">Sales</th>
                          <th className="text-right py-2.5 px-3">Profit</th>
                          <th className="text-right py-2.5 pr-6">ROI %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topSellers.map((item) => {
                          const roi = item.sales > 0 ? (item.profit / item.sales) * 100 : 0;
                          return (
                            <tr key={item.asin} className="border-b border-border/30 last:border-0">
                              <td className="py-3 pl-6">
                                <div className="flex items-center gap-3">
                                  {item.image_url ? (
                                    <Image
                                      src={item.image_url}
                                      alt={item.title ?? item.sku}
                                      width={40}
                                      height={40}
                                      className="rounded-lg object-cover ring-1 ring-border/50"
                                    />
                                  ) : (
                                    <div className="h-10 w-10 rounded-lg bg-muted" />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium truncate max-w-[200px]">{item.title ?? item.sku}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{item.asin}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="text-right px-3 font-mono text-xs font-semibold">{item.units}</td>
                              <td className="text-right px-3 font-mono text-xs">£{item.sales.toFixed(2)}</td>
                              <td className="text-right px-3 font-mono text-xs text-emerald-600 font-semibold">£{item.profit.toFixed(2)}</td>
                              <td className="text-right pr-6 font-mono text-xs font-semibold">{roi.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
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
