import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
import { CircleGauge } from "@/components/circle-gauge";
import { StatBox } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { getProductInsight } from "@/lib/queries/product";
import {
  Package,
  CalendarDays,
  ShoppingCart,
  TrendingDown,
  Warehouse,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { asin } = await params;
  const insight = await getProductInsight(asin);

  if (!insight) {
    return (
      <div className="min-h-screen">
        <Sidebar email={user.email ?? ""} />
        <MainContent>
          <PageHeader title="Product Insight" subtitle="Product not found" />
          <div className="p-8">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-rose-50 dark:bg-rose-950 p-4 mb-4">
                <Package className="h-6 w-6 text-rose-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Product not found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                No product exists with ASIN: {asin}
              </p>
            </div>
          </div>
        </MainContent>
      </div>
    );
  }

  const { product, totals, currentStock, currentCogs, monthlyBreakdown, cogsHistory, recentOrders, inventoryTrend } = insight;

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Product Insight"
          subtitle={product.title ?? product.asin}
        />

        <div className="p-8 space-y-8">
          {/* A. Product Header */}
          <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
            <CardContent className="p-6">
              <div className="flex gap-6 items-start">
                <div className="flex-shrink-0 h-[120px] w-[120px] rounded-xl bg-muted/50 overflow-hidden flex items-center justify-center">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.title ?? product.asin}
                      width={120}
                      height={120}
                      className="object-contain"
                    />
                  ) : (
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground truncate">
                      {product.title ?? "Untitled Product"}
                    </h2>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs font-mono text-muted-foreground">
                        ASIN: {product.asin}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        SKU: {product.sku}
                      </span>
                      {product.fnsku && (
                        <span className="text-xs font-mono text-muted-foreground">
                          FNSKU: {product.fnsku}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-950 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-600/15 dark:ring-indigo-400/15">
                      Stock: {currentStock.total}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-600/15 dark:ring-amber-400/15">
                      VAT: {(product.vat_rate * 100).toFixed(0)}%
                    </span>
                    {currentCogs ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-600/15 dark:ring-emerald-400/15">
                        COGS: £{currentCogs.totalCogs.toFixed(2)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                        COGS: Not set
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* B. KPI Gauges */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            <CircleGauge
              value={totals.grossSales}
              max={Math.max(totals.grossSales, 1)}
              label="Total Revenue"
              formattedValue={`£${totals.grossSales.toFixed(2)}`}
              subtitle="gross"
              color="#6366f1"
              gradient="bg-gradient-indigo"
              shadow="shadow-sky-soft"
            />
            <CircleGauge
              value={totals.estimatedProfit}
              max={Math.max(totals.grossSales, 1)}
              label="Total Profit"
              formattedValue={`£${totals.estimatedProfit.toFixed(2)}`}
              subtitle="net"
              color="#10b981"
              gradient="bg-gradient-emerald"
              shadow="shadow-emerald-soft"
            />
            <CircleGauge
              value={totals.unitsSold}
              max={Math.max(totals.unitsSold, 1)}
              label="Units Sold"
              formattedValue={String(totals.unitsSold)}
              subtitle="total"
              color="#8b5cf6"
              gradient="bg-gradient-violet"
              shadow="shadow-violet-soft"
            />
            <CircleGauge
              value={totals.margin}
              max={100}
              label="Margin"
              formattedValue={`${totals.margin.toFixed(1)}%`}
              subtitle="net margin"
              color="#f59e0b"
              gradient="bg-gradient-amber"
              shadow="shadow-amber-soft"
            />
          </div>

          {/* C. Stat Boxes */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox
              label="Total Orders"
              value={totals.orderCount}
              iconName="ShoppingBag"
              gradient="indigo"
            />
            <StatBox
              label="Avg Order Value"
              value={`£${totals.avgOrderValue.toFixed(2)}`}
              iconName="TrendingUp"
              gradient="sky"
            />
            <StatBox
              label="Total Fees"
              value={`£${totals.totalFees.toFixed(2)}`}
              iconName="Receipt"
              gradient="amber"
            />
            <StatBox
              label="Total COGS"
              value={`£${totals.totalCogs.toFixed(2)}`}
              iconName="Wallet"
              gradient="orange"
            />
            <StatBox
              label="Refunds"
              value={totals.refundCount}
              iconName="RotateCcw"
              gradient="rose"
            />
            <StatBox
              label="Days of Stock"
              value={currentStock.daysOfStock === 999 ? "999+" : currentStock.daysOfStock}
              iconName="Package"
              gradient="violet"
            />
          </div>

          {/* D. Monthly Breakdown */}
          <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950">
                    <CalendarDays className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  Monthly Breakdown
                </CardTitle>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {monthlyBreakdown.length} months
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {monthlyBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">No sales data yet</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6">Month</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Units</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Revenue</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Fees</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">COGS</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Profit</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Margin</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right pr-6">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyBreakdown.map((row) => (
                        <TableRow key={row.month} className="group border-border/40 transition-colors">
                          <TableCell className="text-xs font-medium text-foreground pl-6">
                            {row.month}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground text-right">
                            {row.units}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground text-right">
                            £{row.revenue.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground text-right">
                            £{row.fees.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground text-right">
                            £{row.cogs.toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-xs font-mono text-right font-medium ${row.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            £{row.profit.toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-xs font-mono text-right ${row.margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {row.margin.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground text-right pr-6">
                            {row.orders}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* E. COGS History */}
          <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950">
                    <TrendingDown className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  COGS History
                </CardTitle>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {cogsHistory.length} periods
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {cogsHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">No COGS data configured</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6">From</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">To</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Unit Cost</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Prep Cost</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Total COGS</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pr-6">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cogsHistory.map((period, idx) => (
                        <TableRow key={idx} className="group border-border/40 transition-colors">
                          <TableCell className="text-xs text-foreground pl-6">
                            {period.validFrom}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {period.validTo ? (
                              period.validTo
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-600/15 dark:ring-emerald-400/15">
                                Active
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground text-right">
                            £{period.unitCost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground text-right">
                            £{period.prepCost.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground font-medium text-right">
                            £{period.totalCogs.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground pr-6 max-w-[200px] truncate">
                            {period.notes ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* F. Recent Orders */}
          <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950">
                    <ShoppingCart className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  </div>
                  Order History
                </CardTitle>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {recentOrders.length} orders
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">No orders for this product yet</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6">Date</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Qty</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Price</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Fees</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Profit</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pr-6">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOrders.map((order, idx) => (
                        <TableRow key={`${order.amazonOrderId}-${idx}`} className="group border-border/40 transition-colors">
                          <TableCell className="text-xs text-muted-foreground pl-6">
                            {new Date(order.purchaseDate).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground text-right">
                            {order.qty}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground text-right">
                            £{order.priceGross.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground text-right">
                            £{order.fees.toFixed(2)}
                          </TableCell>
                          <TableCell className={`text-xs font-mono text-right font-medium ${order.profit !== null && order.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : order.profit !== null ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                            {order.profit !== null ? `£${order.profit.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="pr-6">
                            <StatusBadge status={order.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* G. Inventory Trend */}
          <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
                    <Warehouse className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  Inventory Trend
                </CardTitle>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  Last 30 days
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {inventoryTrend.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground">No inventory data available</p>
                </div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border/50">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6">Date</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Fulfillable</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right pr-6">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryTrend.map((day) => (
                        <TableRow key={day.date} className="group border-border/40 transition-colors">
                          <TableCell className="text-xs text-muted-foreground pl-6">
                            {new Date(day.date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground text-right">
                            {day.fulfillable}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-foreground text-right pr-6">
                            {day.total}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </MainContent>
    </div>
  );
}
