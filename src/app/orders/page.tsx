import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { StatBox } from "@/components/stat-card";
import { OrderDetails } from "@/components/order-details";
import { PeriodFilter } from "@/components/period-filter";
import { MonthComparison } from "@/components/month-comparison";
import { PageHeader } from "@/components/page-header";
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

  const metrics = await getSalesMetrics(from, to);

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

  const supabase = createServiceClient();

  // Fetch orders
  const { data: rawOrders } = await supabase
    .from("orders")
    .select(
      "amazon_order_id, purchase_date, order_status, fulfillment_channel, ship_country, ship_postcode, last_updated, raw"
    )
    .gte("purchase_date", from.toISOString())
    .lte("purchase_date", to.toISOString())
    .order("purchase_date", { ascending: false })
    .limit(50);

  // Fetch order items with more details
  const orderIds = rawOrders?.map((o) => o.amazon_order_id) ?? [];

  const { data: orderItems } =
    orderIds.length > 0
      ? await supabase
          .from("order_items")
          .select(
            "amazon_order_id, sku, asin, qty, item_price_gross, item_tax, shipping_price, promo_discount, estimated_profit, cogs_snapshot, refund_status"
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
      is_business_order: (order.raw as Record<string, unknown>)?.IsBusinessOrder === true,
      is_prime: (order.raw as Record<string, unknown>)?.IsPrime === true,
      items:
        itemsByOrder.get(order.amazon_order_id)?.map((item) => ({
          sku: item.sku,
          asin: item.asin,
          title: productMap.get(item.sku)?.title ?? null,
          image_url: productMap.get(item.sku)?.image_url ?? null,
          qty: item.qty ?? 0,
          item_price_gross: parseFloat(String(item.item_price_gross ?? "0")),
          item_tax: parseFloat(String(item.item_tax ?? "0")),
          shipping_price: parseFloat(String(item.shipping_price ?? "0")),
          promo_discount: parseFloat(String(item.promo_discount ?? "0")),
          estimated_profit: item.estimated_profit
            ? parseFloat(String(item.estimated_profit))
            : null,
          cogs_snapshot: item.cogs_snapshot
            ? parseFloat(String(item.cogs_snapshot))
            : null,
          refund_status: item.refund_status ?? "none",
        })) ?? [],
    })) ?? [];

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[240px]">
        <PageHeader
          title="Sales"
          subtitle="Sales Analytics & Order History"
          action={<PeriodFilter />}
        />

        <div className="p-8 space-y-8">
          {/* KPI stat boxes row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatBox
              label="Gross Sales"
              value={`£${metrics.grossSales.toFixed(2)}`}
              iconName="TrendingUp"
              gradient="indigo"
            />
            <StatBox
              label="Net Revenue"
              value={`£${metrics.netRevenue.toFixed(2)}`}
              iconName="Wallet"
              gradient="sky"
            />
            <StatBox
              label="Est. Profit"
              value={`£${metrics.estimatedProfit.toFixed(2)}`}
              iconName="PiggyBank"
              gradient="emerald"
            />
            <StatBox
              label="Units Sold"
              value={metrics.unitsSold}
              iconName="Package"
              gradient="violet"
            />
            <StatBox
              label="Orders"
              value={metrics.orderCount}
              iconName="ShoppingBag"
              gradient="amber"
            />
            <StatBox
              label="Margin"
              value={`${metrics.margin.toFixed(1)}%`}
              iconName="Percent"
              gradient="rose"
            />
          </div>

          {/* Orders details + Month comparison */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <OrderDetails orders={ordersWithItems} />
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
