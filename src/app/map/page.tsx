import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { MainContent } from "@/components/main-content";
import { OrderMapWrapper } from "@/components/order-map-wrapper";

export const revalidate = 0;

export interface ClusterOrderItem {
  title: string;
  qty: number;
  revenue: number;
}

export interface ClusterOrder {
  amazonOrderId: string;
  date: string;
  revenue: number;
  profit: number;
  units: number;
  items: ClusterOrderItem[];
}

export interface PostcodeCluster {
  postcode: string;
  orderCount: number;
  revenue: number;
  profit: number;
  unitsSold: number;
  orders: ClusterOrder[];
}

export default async function MapPage() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createServiceClient();

  // Load VAT settings for profit calculation
  const { data: vatSettings } = await supabase
    .from("business_settings")
    .select("vat_rate")
    .eq("id", 1)
    .single();
  const vatRate = parseFloat(String(vatSettings?.vat_rate ?? "0.20"));

  // Fetch all orders with postcodes (paginated)
  const allOrders: Array<{ amazon_order_id: string; ship_postcode: string; purchase_date: string }> = [];
  let page = 0;
  while (true) {
    const { data: batch } = await supabase
      .from("orders")
      .select("amazon_order_id, ship_postcode, purchase_date")
      .not("ship_postcode", "is", null)
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!batch || batch.length === 0) break;
    allOrders.push(...(batch as typeof allOrders));
    if (batch.length < 1000) break;
    page++;
  }

  const orderIdToPostcode = new Map(
    allOrders.map((o) => [o.amazon_order_id, o.ship_postcode])
  );
  const orderIdToDate = new Map(
    allOrders.map((o) => [o.amazon_order_id, o.purchase_date])
  );
  const orderIds = [...orderIdToPostcode.keys()];

  // Load product titles
  const { data: productData } = await supabase
    .from("products")
    .select("sku, title");
  const skuToTitle = new Map(
    (productData ?? []).map((p) => [p.sku, p.title ?? p.sku])
  );

  // Fetch order items for those orders
  const allItems: Array<{
    amazon_order_id: string;
    sku: string | null;
    qty: number;
    item_price_gross: number;
    item_tax: number;
    promo_discount: number;
    estimated_fees: Record<string, unknown> | null;
    actual_fees: Record<string, unknown> | null;
    asin: string | null;
  }> = [];

  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const { data: items } = await supabase
      .from("order_items")
      .select(
        "amazon_order_id, sku, qty, item_price_gross, item_tax, promo_discount, estimated_fees, actual_fees, asin"
      )
      .in("amazon_order_id", chunk);
    if (items) allItems.push(...(items as typeof allItems));
  }

  // Load COGS
  const { data: cogsData } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs")
    .is("valid_to", null);
  const cogsMap = new Map(
    cogsData?.map((c) => [c.asin, parseFloat(String(c.total_cogs ?? "0"))]) ?? []
  );

  // Aggregate by postcode, then by order within each postcode
  const postcodeMap = new Map<
    string,
    { orderAgg: Map<string, { revenue: number; profit: number; units: number; items: ClusterOrderItem[] }>; revenue: number; profit: number; units: number }
  >();

  for (const item of allItems) {
    const postcode = orderIdToPostcode.get(item.amazon_order_id);
    if (!postcode) continue;

    let entry = postcodeMap.get(postcode);
    if (!entry) {
      entry = { orderAgg: new Map(), revenue: 0, profit: 0, units: 0 };
      postcodeMap.set(postcode, entry);
    }

    let orderEntry = entry.orderAgg.get(item.amazon_order_id);
    if (!orderEntry) {
      orderEntry = { revenue: 0, profit: 0, units: 0, items: [] };
      entry.orderAgg.set(item.amazon_order_id, orderEntry);
    }

    const price = parseFloat(String(item.item_price_gross ?? "0"));
    const tax = parseFloat(String(item.item_tax ?? "0"));
    const promo = parseFloat(String(item.promo_discount ?? "0"));
    const qty = item.qty ?? 0;

    const fees = item.actual_fees ?? item.estimated_fees;
    const feePerUnit = parseFloat(String((fees as Record<string, unknown>)?.totalFees ?? "0")) / (1 + vatRate);
    const cogs = item.asin ? cogsMap.get(item.asin) ?? 0 : 0;
    const itemTax = tax > 0 ? tax : price * (vatRate / (1 + vatRate));
    const itemProfit = price - itemTax - promo - feePerUnit * qty - cogs * qty;

    const title = (item.sku ? skuToTitle.get(item.sku) : null) ?? item.sku ?? item.asin ?? "Unknown";
    orderEntry.items.push({ title, qty, revenue: price });
    orderEntry.revenue += price;
    orderEntry.profit += itemProfit;
    orderEntry.units += qty;

    entry.revenue += price;
    entry.profit += itemProfit;
    entry.units += qty;
  }

  const clusters: PostcodeCluster[] = Array.from(postcodeMap.entries())
    .map(([postcode, data]) => {
      const orders: ClusterOrder[] = Array.from(data.orderAgg.entries())
        .map(([orderId, agg]) => ({
          amazonOrderId: orderId,
          date: orderIdToDate.get(orderId) ?? "",
          revenue: Math.round(agg.revenue * 100) / 100,
          profit: Math.round(agg.profit * 100) / 100,
          units: agg.units,
          items: agg.items,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        postcode,
        orderCount: data.orderAgg.size,
        revenue: Math.round(data.revenue * 100) / 100,
        profit: Math.round(data.profit * 100) / 100,
        unitsSold: data.units,
        orders,
      };
    })
    .sort((a, b) => b.orderCount - a.orderCount);

  const totalOrders = clusters.reduce((s, c) => s + c.orderCount, 0);
  const totalRevenue = clusters.reduce((s, c) => s + c.revenue, 0);
  const topPostcode = clusters[0];

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <MainContent>
        <PageHeader
          title="Order Map"
          subtitle="Geographic distribution of your orders"
        />

        <div className="p-8 space-y-6">
          {/* KPI bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-card p-4 ring-1 ring-border/50 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Locations
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {clusters.length}
              </p>
            </div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-border/50 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Orders Mapped
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {totalOrders.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-border/50 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total Revenue
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                £{totalRevenue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-xl bg-card p-4 ring-1 ring-border/50 shadow-card">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Top Location
              </p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {topPostcode?.postcode ?? "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {topPostcode ? `${topPostcode.orderCount} orders` : ""}
              </p>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-xl overflow-hidden ring-1 ring-border/50 shadow-card bg-card">
            <OrderMapWrapper clusters={clusters} />
          </div>
        </div>
      </MainContent>
    </div>
  );
}
