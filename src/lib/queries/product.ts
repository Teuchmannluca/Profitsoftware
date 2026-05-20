import { createServiceClient } from "@/lib/supabase/service";

export interface ProductInsight {
  product: {
    sku: string;
    asin: string;
    title: string | null;
    image_url: string | null;
    vat_rate: number;
    fnsku: string | null;
  };
  totals: {
    grossSales: number;
    netRevenue: number;
    totalFees: number;
    totalCogs: number;
    estimatedProfit: number;
    unitsSold: number;
    orderCount: number;
    refundCount: number;
    margin: number;
    avgOrderValue: number;
  };
  currentStock: {
    fulfillable: number;
    reserved: number;
    inbound: number;
    unsellable: number;
    total: number;
    daysOfStock: number;
  };
  currentCogs: {
    unitCost: number;
    prepCost: number;
    totalCogs: number;
  } | null;
  monthlyBreakdown: Array<{
    month: string;
    units: number;
    revenue: number;
    fees: number;
    cogs: number;
    profit: number;
    margin: number;
    orders: number;
  }>;
  cogsHistory: Array<{
    validFrom: string;
    validTo: string | null;
    unitCost: number;
    prepCost: number;
    totalCogs: number;
    notes: string | null;
  }>;
  recentOrders: Array<{
    amazonOrderId: string;
    purchaseDate: string;
    qty: number;
    priceGross: number;
    tax: number;
    fees: number;
    profit: number | null;
    status: string;
  }>;
  inventoryTrend: Array<{
    date: string;
    fulfillable: number;
    total: number;
  }>;
}

export async function getProductInsight(asin: string): Promise<ProductInsight | null> {
  const supabase = createServiceClient();

  // 1. Get product(s) for this ASIN
  const { data: products } = await supabase
    .from("products")
    .select("sku, asin, title, image_url, vat_rate, fnsku")
    .eq("asin", asin);

  if (!products || products.length === 0) return null;

  // Use the first product for display info
  const primaryProduct = products[0];
  const allSkus = products.map((p) => p.sku);

  // 2. Get ALL order items for this ASIN (paginate past 1000 limit)
  const items: Array<Record<string, unknown>> = [];
  let itemPage = 0;
  while (true) {
    const { data: batch } = await supabase
      .from("order_items")
      .select(
        "amazon_order_id, order_item_id, sku, qty, item_price_gross, item_tax, promo_discount, estimated_fees, actual_fees, estimated_profit, actual_profit, refund_status, orders!inner(amazon_order_id, purchase_date, order_status)"
      )
      .eq("asin", asin)
      .range(itemPage * 1000, (itemPage + 1) * 1000 - 1);
    if (!batch || batch.length === 0) break;
    items.push(...batch);
    if (batch.length < 1000) break;
    itemPage++;
  }

  // 3. Get active COGS
  const { data: activeCogs } = await supabase
    .from("cogs_periods")
    .select("unit_cost, prep_cost, total_cogs")
    .eq("asin", asin)
    .is("valid_to", null)
    .limit(1);

  // 4. Get COGS history
  const { data: cogsHistory } = await supabase
    .from("cogs_periods")
    .select("valid_from, valid_to, unit_cost, prep_cost, total_cogs, notes")
    .eq("asin", asin)
    .order("valid_from", { ascending: false });

  // 5. Get latest inventory snapshot
  const today = new Date().toISOString().split("T")[0];
  const { data: latestInventory } = await supabase
    .from("inventory_snapshots")
    .select("afn_fulfillable, afn_reserved, afn_inbound, afn_unsellable, total_quantity")
    .in("sku", allSkus)
    .eq("date", today);

  // 6. Get inventory trend (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  const { data: inventoryTrend } = await supabase
    .from("inventory_snapshots")
    .select("date, afn_fulfillable, total_quantity")
    .in("sku", allSkus)
    .gte("date", fromDate)
    .order("date", { ascending: true });

  // Load VAT settings for fee normalisation
  const { data: vatSettings } = await supabase
    .from("business_settings")
    .select("vat_rate")
    .eq("id", 1)
    .single();
  const vatRate = parseFloat(String(vatSettings?.vat_rate ?? "0.20"));

  // Aggregate totals
  let grossSales = 0;
  let vatCollected = 0;
  let promoDiscount = 0;
  let totalFees = 0;
  let unitsSold = 0;
  let refundCount = 0;
  const orderIds = new Set<string>();

  const unitCogs = activeCogs?.[0]
    ? parseFloat(String(activeCogs[0].total_cogs ?? "0"))
    : 0;

  for (const item of items ?? []) {
    grossSales += parseFloat(String(item.item_price_gross ?? "0"));
    vatCollected += parseFloat(String(item.item_tax ?? "0"));
    promoDiscount += parseFloat(String(item.promo_discount ?? "0"));
    unitsSold += Number(item.qty ?? 0);
    orderIds.add(String(item.amazon_order_id));

    if (item.refund_status && item.refund_status !== "none") {
      refundCount++;
    }

    const fees =
      (item.actual_fees as Record<string, unknown>) ??
      (item.estimated_fees as Record<string, unknown>);
    const perUnitFeeRaw = parseFloat(String(fees?.totalFees ?? "0"));
    // Finance API actual_fees are inc-VAT; normalise to ex-VAT
    const isActualFee = item.actual_fees != null;
    const perUnitFee = isActualFee ? perUnitFeeRaw / (1 + vatRate) : perUnitFeeRaw;
    totalFees += perUnitFee * Number(item.qty ?? 0);
  }

  const totalCogs = unitCogs * unitsSold;
  const netRevenue = grossSales - vatCollected - promoDiscount;
  const estimatedProfit = netRevenue - totalFees - totalCogs;
  const margin = netRevenue > 0 ? (estimatedProfit / netRevenue) * 100 : 0;
  const orderCount = orderIds.size;
  const avgOrderValue = orderCount > 0 ? grossSales / orderCount : 0;

  // Monthly breakdown
  const monthlyMap = new Map<
    string,
    { units: number; revenue: number; fees: number; cogs: number; orders: Set<string> }
  >();

  for (const item of items ?? []) {
    const order = item.orders as unknown as { purchase_date: string };
    const purchaseDate = new Date(order.purchase_date);
    const monthKey = `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, "0")}`;

    let entry = monthlyMap.get(monthKey);
    if (!entry) {
      entry = { units: 0, revenue: 0, fees: 0, cogs: 0, orders: new Set() };
      monthlyMap.set(monthKey, entry);
    }

    const qty = Number(item.qty ?? 0);
    entry.units += qty;
    entry.revenue += parseFloat(String(item.item_price_gross ?? "0")) -
      parseFloat(String(item.item_tax ?? "0")) -
      parseFloat(String(item.promo_discount ?? "0"));
    entry.orders.add(String(item.amazon_order_id));

    const mFees =
      (item.actual_fees as Record<string, unknown>) ??
      (item.estimated_fees as Record<string, unknown>);
    const mFeeRaw = parseFloat(String(mFees?.totalFees ?? "0"));
    const mIsActual = item.actual_fees != null;
    const mFeeExVat = mIsActual ? mFeeRaw / (1 + vatRate) : mFeeRaw;
    entry.fees += mFeeExVat * qty;
    entry.cogs += unitCogs * qty;
  }

  const monthlyBreakdown = Array.from(monthlyMap.entries())
    .map(([month, data]) => {
      const profit = data.revenue - data.fees - data.cogs;
      return {
        month,
        units: data.units,
        revenue: data.revenue,
        fees: data.fees,
        cogs: data.cogs,
        profit,
        margin: data.revenue > 0 ? (profit / data.revenue) * 100 : 0,
        orders: data.orders.size,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));

  // Units sold in last 30 days for daysOfStock
  const thirtyDaysAgoDate = new Date();
  thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);

  let unitsLast30 = 0;
  for (const item of items ?? []) {
    const order = item.orders as unknown as { purchase_date: string };
    if (new Date(order.purchase_date) >= thirtyDaysAgoDate) {
      unitsLast30 += Number(item.qty ?? 0);
    }
  }
  const dailyRate = unitsLast30 / 30;

  // Aggregate inventory across SKUs
  let fulfillable = 0;
  let reserved = 0;
  let inbound = 0;
  let unsellable = 0;
  let totalStock = 0;

  for (const snap of latestInventory ?? []) {
    fulfillable += snap.afn_fulfillable ?? 0;
    reserved += snap.afn_reserved ?? 0;
    inbound += snap.afn_inbound ?? 0;
    unsellable += snap.afn_unsellable ?? 0;
    totalStock += snap.total_quantity ?? 0;
  }

  const daysOfStock = dailyRate > 0 ? Math.round(fulfillable / dailyRate) : fulfillable > 0 ? 999 : 0;

  // Recent orders (last 20)
  const recentOrders: ProductInsight["recentOrders"] = [];
  const sortedItems = [...(items ?? [])].sort((a, b) => {
    const aDate = (a.orders as unknown as { purchase_date: string }).purchase_date;
    const bDate = (b.orders as unknown as { purchase_date: string }).purchase_date;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  for (const item of sortedItems) {
    const order = item.orders as unknown as { purchase_date: string; order_status: string };
    const rFees =
      (item.actual_fees as Record<string, unknown>) ??
      (item.estimated_fees as Record<string, unknown>);
    const rFeeRaw = parseFloat(String(rFees?.totalFees ?? "0"));
    const rIsActual = item.actual_fees != null;
    const rFeeExVat = rIsActual ? rFeeRaw / (1 + vatRate) : rFeeRaw;
    const feesTotal = rFeeExVat * Number(item.qty ?? 0);

    recentOrders.push({
      amazonOrderId: String(item.amazon_order_id),
      purchaseDate: order.purchase_date,
      qty: Number(item.qty ?? 0),
      priceGross: parseFloat(String(item.item_price_gross ?? "0")),
      tax: parseFloat(String(item.item_tax ?? "0")),
      fees: feesTotal,
      profit: item.actual_profit
        ? parseFloat(String(item.actual_profit))
        : item.estimated_profit
          ? parseFloat(String(item.estimated_profit))
          : null,
      status: order.order_status,
    });
  }

  // Aggregate inventory trend by date (across SKUs)
  const trendMap = new Map<string, { fulfillable: number; total: number }>();
  for (const snap of inventoryTrend ?? []) {
    const existing = trendMap.get(snap.date) ?? { fulfillable: 0, total: 0 };
    existing.fulfillable += snap.afn_fulfillable ?? 0;
    existing.total += snap.total_quantity ?? 0;
    trendMap.set(snap.date, existing);
  }

  return {
    product: {
      sku: primaryProduct.sku,
      asin: primaryProduct.asin,
      title: primaryProduct.title,
      image_url: primaryProduct.image_url,
      vat_rate: primaryProduct.vat_rate ?? 0.2,
      fnsku: primaryProduct.fnsku,
    },
    totals: {
      grossSales,
      netRevenue,
      totalFees,
      totalCogs,
      estimatedProfit,
      unitsSold,
      orderCount,
      refundCount,
      margin,
      avgOrderValue,
    },
    currentStock: {
      fulfillable,
      reserved,
      inbound,
      unsellable,
      total: totalStock,
      daysOfStock,
    },
    currentCogs: activeCogs?.[0]
      ? {
          unitCost: parseFloat(String(activeCogs[0].unit_cost ?? "0")),
          prepCost: parseFloat(String(activeCogs[0].prep_cost ?? "0")),
          totalCogs: parseFloat(String(activeCogs[0].total_cogs ?? "0")),
        }
      : null,
    monthlyBreakdown,
    cogsHistory: (cogsHistory ?? []).map((c) => ({
      validFrom: c.valid_from,
      validTo: c.valid_to,
      unitCost: parseFloat(String(c.unit_cost ?? "0")),
      prepCost: parseFloat(String(c.prep_cost ?? "0")),
      totalCogs: parseFloat(String(c.total_cogs ?? "0")),
      notes: c.notes,
    })),
    recentOrders,
    inventoryTrend: Array.from(trendMap.entries())
      .map(([date, data]) => ({
        date,
        fulfillable: data.fulfillable,
        total: data.total,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export interface ProductCard {
  asin: string;
  title: string | null;
  image_url: string | null;
  sku: string;
  totalRevenue: number;
  totalUnits: number;
  currentStock: number;
}

export async function getProductCards(): Promise<ProductCard[]> {
  const supabase = createServiceClient();

  // Get all products
  const { data: products } = await supabase
    .from("products")
    .select("sku, asin, title, image_url");

  if (!products || products.length === 0) return [];

  // Get all order items for revenue/units
  const { data: items } = await supabase
    .from("order_items")
    .select("asin, qty, item_price_gross");

  // Get latest inventory
  const today = new Date().toISOString().split("T")[0];
  const { data: inventory } = await supabase
    .from("inventory_snapshots")
    .select("sku, total_quantity")
    .eq("date", today);

  // Build inventory map by SKU
  const inventoryMap = new Map<string, number>();
  for (const snap of inventory ?? []) {
    inventoryMap.set(snap.sku, (inventoryMap.get(snap.sku) ?? 0) + (snap.total_quantity ?? 0));
  }

  // Build aggregates by ASIN
  const asinAgg = new Map<string, { revenue: number; units: number }>();
  for (const item of items ?? []) {
    const existing = asinAgg.get(item.asin) ?? { revenue: 0, units: 0 };
    existing.revenue += parseFloat(String(item.item_price_gross ?? "0"));
    existing.units += item.qty ?? 0;
    asinAgg.set(item.asin, existing);
  }

  // Group products by ASIN — pick first product per ASIN for display
  const asinMap = new Map<string, typeof products[0]>();
  const asinSkus = new Map<string, string[]>();
  for (const product of products) {
    if (!product.asin) continue;
    if (!asinMap.has(product.asin)) {
      asinMap.set(product.asin, product);
    }
    const skus = asinSkus.get(product.asin) ?? [];
    skus.push(product.sku);
    asinSkus.set(product.asin, skus);
  }

  const cards: ProductCard[] = [];
  for (const [asin, product] of asinMap.entries()) {
    const agg = asinAgg.get(asin) ?? { revenue: 0, units: 0 };
    const skus = asinSkus.get(asin) ?? [];
    let stock = 0;
    for (const sku of skus) {
      stock += inventoryMap.get(sku) ?? 0;
    }

    cards.push({
      asin,
      title: product.title,
      image_url: product.image_url,
      sku: product.sku,
      totalRevenue: agg.revenue,
      totalUnits: agg.units,
      currentStock: stock,
    });
  }

  // Sort by revenue descending
  cards.sort((a, b) => b.totalRevenue - a.totalRevenue);

  return cards;
}
