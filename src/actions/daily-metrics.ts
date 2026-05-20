"use server";

import { createServiceClient } from "@/lib/supabase/service";
import { getCogsForDate } from "@/lib/queries/sales";

export interface DailyDataPoint {
  date: string;
  revenue: number;
  profit: number;
  fees: number;
  units: number;
}

export async function getDailyMetrics(
  from: Date,
  to: Date
): Promise<DailyDataPoint[]> {
  const supabase = createServiceClient();

  const orderIds: string[] = [];
  let page = 0;
  while (true) {
    const { data: batch } = await supabase
      .from("orders")
      .select("amazon_order_id")
      .gte("purchase_date", from.toISOString())
      .lte("purchase_date", to.toISOString())
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!batch || batch.length === 0) break;
    orderIds.push(...batch.map((o) => o.amazon_order_id));
    if (batch.length < 1000) break;
    page++;
  }

  if (orderIds.length === 0) return [];

  const allItems: Array<Record<string, unknown>> = [];
  for (let i = 0; i < orderIds.length; i += 200) {
    const chunk = orderIds.slice(i, i + 200);
    const { data: items } = await supabase
      .from("order_items")
      .select(
        "asin, qty, item_price_gross, item_tax, promo_discount, estimated_fees, actual_fees, orders!inner(purchase_date)"
      )
      .in("amazon_order_id", chunk);
    allItems.push(...(items ?? []));
  }

  const { data: cogs } = await supabase
    .from("cogs_periods")
    .select("asin, total_cogs, valid_from, valid_to")
    .lte("valid_from", to.toISOString().slice(0, 10))
    .or(
      `valid_to.is.null,valid_to.gte.${from.toISOString().slice(0, 10)}`
    )
    .order("valid_from", { ascending: false });

  type CogsPeriod = {
    asin: string;
    total_cogs: string;
    valid_from: string;
    valid_to: string | null;
  };

  const cogsMap = new Map<
    string,
    Array<{ totalCogs: number; validFrom: string; validTo: string | null }>
  >();
  for (const c of (cogs ?? []) as CogsPeriod[]) {
    const periods = cogsMap.get(c.asin) ?? [];
    periods.push({
      totalCogs: parseFloat(String(c.total_cogs ?? "0")),
      validFrom: c.valid_from,
      validTo: c.valid_to,
    });
    cogsMap.set(c.asin, periods);
  }

  const { data: settings } = await supabase
    .from("business_settings")
    .select("vat_status, vat_rate")
    .eq("id", 1)
    .single();

  const vatStatus = settings?.vat_status ?? "standard";
  const vatRate = parseFloat(String(settings?.vat_rate ?? "0.20"));

  const dayMap = new Map<
    string,
    { revenue: number; profit: number; fees: number; units: number }
  >();

  for (const item of allItems) {
    const price = parseFloat(String(item.item_price_gross ?? "0"));
    if (price === 0) continue;

    const qty = (item.qty as number) ?? 0;
    const tax = parseFloat(String(item.item_tax ?? "0"));
    const promo = parseFloat(String(item.promo_discount ?? "0"));

    const ordersData = item.orders as unknown as
      | { purchase_date: string }
      | Array<{ purchase_date: string }>
      | null;
    const purchaseDate = Array.isArray(ordersData)
      ? ordersData[0]?.purchase_date
      : ordersData?.purchase_date;
    if (!purchaseDate) continue;

    const day = purchaseDate.slice(0, 10);
    const unitCogs = getCogsForDate(
      cogsMap.get(item.asin as string) ?? [],
      purchaseDate
    );

    const fees = (item.actual_fees ?? item.estimated_fees) as Record<
      string,
      unknown
    > | null;
    const perUnitFeeRaw = parseFloat(String(fees?.totalFees ?? "0"));
    const isActualFee = item.actual_fees != null;
    const perUnitFee = isActualFee
      ? perUnitFeeRaw / (1 + vatRate)
      : perUnitFeeRaw;

    const itemRevenue =
      vatStatus === "not_registered"
        ? price - promo
        : price - tax - promo;
    const itemFees =
      vatStatus === "not_registered"
        ? perUnitFee * (1 + vatRate) * qty
        : perUnitFee * qty;
    const itemProfit = itemRevenue - itemFees - unitCogs * qty;

    const existing = dayMap.get(day) ?? {
      revenue: 0,
      profit: 0,
      fees: 0,
      units: 0,
    };
    existing.revenue += itemRevenue;
    existing.profit += itemProfit;
    existing.fees += itemFees;
    existing.units += qty;
    dayMap.set(day, existing);
  }

  return [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      revenue: Math.round(data.revenue * 100) / 100,
      profit: Math.round(data.profit * 100) / 100,
      fees: Math.round(data.fees * 100) / 100,
      units: data.units,
    }));
}
