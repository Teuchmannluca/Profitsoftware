import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/auth-guard";

export interface CapitalBucket {
  label: string;
  value: number;
  units: number;
  color: string;
}

export interface CapitalOverviewData {
  totalCapital: number;
  totalUnits: number;
  buckets: CapitalBucket[];
  skusWithoutCogs: number;
}

export async function getCapitalOverview(): Promise<CapitalOverviewData | null> {
  await requireAuth();
  const supabase = createServiceClient();

  const { data: latestRow } = await supabase
    .from("inventory_snapshots")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (!latestRow?.date) return null;

  const [inventoryRes, productsRes, cogsRes] = await Promise.all([
    supabase
      .from("inventory_snapshots")
      .select("sku, asin, afn_fulfillable, afn_reserved, afn_inbound, afn_unsellable")
      .eq("date", latestRow.date),
    supabase.from("products").select("sku, asin"),
    supabase
      .from("cogs_periods")
      .select("asin, total_cogs")
      .is("valid_to", null),
  ]);

  const snapshots = inventoryRes.data;
  if (!snapshots || snapshots.length === 0) return null;

  const skuToAsin = new Map<string, string>();
  for (const p of productsRes.data ?? []) {
    if (p.asin) skuToAsin.set(p.sku, p.asin);
  }
  for (const snap of snapshots) {
    if (snap.asin && !skuToAsin.has(snap.sku)) {
      skuToAsin.set(snap.sku, snap.asin);
    }
  }

  const asinToCogs = new Map<string, number>();
  for (const c of cogsRes.data ?? []) {
    asinToCogs.set(c.asin, parseFloat(String(c.total_cogs ?? "0")));
  }

  let fulfillableUnits = 0;
  let fulfillableValue = 0;
  let reservedUnits = 0;
  let reservedValue = 0;
  let inboundUnits = 0;
  let inboundValue = 0;
  let unsellableUnits = 0;
  let unsellableValue = 0;
  let skusWithoutCogs = 0;

  for (const snap of snapshots) {
    const asin = skuToAsin.get(snap.sku);
    const cogs = asin ? (asinToCogs.get(asin) ?? 0) : 0;
    const totalQty =
      (snap.afn_fulfillable ?? 0) +
      (snap.afn_reserved ?? 0) +
      (snap.afn_inbound ?? 0) +
      (snap.afn_unsellable ?? 0);

    if (totalQty > 0 && cogs === 0) skusWithoutCogs++;

    fulfillableUnits += snap.afn_fulfillable ?? 0;
    fulfillableValue += (snap.afn_fulfillable ?? 0) * cogs;
    reservedUnits += snap.afn_reserved ?? 0;
    reservedValue += (snap.afn_reserved ?? 0) * cogs;
    inboundUnits += snap.afn_inbound ?? 0;
    inboundValue += (snap.afn_inbound ?? 0) * cogs;
    unsellableUnits += snap.afn_unsellable ?? 0;
    unsellableValue += (snap.afn_unsellable ?? 0) * cogs;
  }

  const buckets: CapitalBucket[] = [
    { label: "At Amazon", value: fulfillableValue, units: fulfillableUnits, color: "emerald" },
    { label: "Reserved", value: reservedValue, units: reservedUnits, color: "amber" },
    { label: "Inbound", value: inboundValue, units: inboundUnits, color: "sky" },
    { label: "Unsellable", value: unsellableValue, units: unsellableUnits, color: "rose" },
  ];

  const totalCapital = fulfillableValue + reservedValue + inboundValue + unsellableValue;
  const totalUnits = fulfillableUnits + reservedUnits + inboundUnits + unsellableUnits;

  return { totalCapital, totalUnits, buckets, skusWithoutCogs };
}

// --- Inventory status breakdown table ---

export interface InventoryStatusRow {
  status: string;
  units: number;
  cost: number;
  resale: number;
  profit: number;
  roi: number;
}

export async function getInventoryStatusBreakdown(): Promise<InventoryStatusRow[]> {
  await requireAuth();
  const supabase = createServiceClient();

  const { data: latestRow } = await supabase
    .from("inventory_snapshots")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (!latestRow?.date) return [];

  const [inventoryRes, productsRes, cogsRes, inboundRes] = await Promise.all([
    supabase
      .from("inventory_snapshots")
      .select("sku, asin, afn_fulfillable, afn_reserved, afn_inbound, afn_unsellable")
      .eq("date", latestRow.date),
    supabase.from("products").select("sku, asin"),
    supabase.from("cogs_periods").select("asin, total_cogs").is("valid_to", null),
    supabase
      .from("inbound_shipment_items")
      .select("seller_sku, quantity_shipped, quantity_received, inbound_shipments!inner(shipment_status)")
      .in("inbound_shipments.shipment_status", ["SHIPPED", "IN_TRANSIT", "RECEIVING", "CHECKED_IN"]),
  ]);

  const skuToAsin = new Map<string, string>();
  for (const p of productsRes.data ?? []) {
    if (p.asin) skuToAsin.set(p.sku, p.asin);
  }
  for (const snap of inventoryRes.data ?? []) {
    if (snap.asin && !skuToAsin.has(snap.sku)) skuToAsin.set(snap.sku, snap.asin);
  }

  const asinToCogs = new Map<string, number>();
  for (const c of cogsRes.data ?? []) {
    asinToCogs.set(c.asin, parseFloat(String(c.total_cogs ?? "0")));
  }

  // Average sale price per SKU from last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: recentSales } = await supabase
    .from("order_items")
    .select("sku, item_price_gross, qty, item_tax")
    .gt("item_price_gross", 0)
    .gt("qty", 0)
    .gte("created_at", thirtyDaysAgo);

  const skuSaleTotals = new Map<string, { revenue: number; units: number }>();
  for (const sale of recentSales ?? []) {
    const existing = skuSaleTotals.get(sale.sku) ?? { revenue: 0, units: 0 };
    const exVat = parseFloat(String(sale.item_price_gross)) - parseFloat(String(sale.item_tax ?? 0));
    existing.revenue += Math.max(exVat, 0);
    existing.units += sale.qty ?? 1;
    skuSaleTotals.set(sale.sku, existing);
  }
  const skuToResalePrice = new Map<string, number>();
  for (const [sku, totals] of skuSaleTotals) {
    if (totals.units > 0) skuToResalePrice.set(sku, totals.revenue / totals.units);
  }

  function cogsForSku(sku: string): number {
    const asin = skuToAsin.get(sku);
    return asin ? (asinToCogs.get(asin) ?? 0) : 0;
  }

  function resaleForSku(sku: string): number {
    return skuToResalePrice.get(sku) ?? 0;
  }

  let availableUnits = 0, availableCost = 0, availableResale = 0;
  let reservedUnits = 0, reservedCost = 0, reservedResale = 0;
  let unsellableUnits = 0, unsellableCost = 0, unsellableResale = 0;

  for (const snap of inventoryRes.data ?? []) {
    const cogs = cogsForSku(snap.sku);
    const resale = resaleForSku(snap.sku);

    const f = snap.afn_fulfillable ?? 0;
    availableUnits += f;
    availableCost += f * cogs;
    availableResale += f * resale;

    const r = snap.afn_reserved ?? 0;
    reservedUnits += r;
    reservedCost += r * cogs;
    reservedResale += r * resale;

    const u = snap.afn_unsellable ?? 0;
    unsellableUnits += u;
    unsellableCost += u * cogs;
    unsellableResale += u * resale;
  }

  // Inbound from shipment items
  let inboundUnits = 0, inboundCost = 0, inboundResale = 0;
  for (const item of inboundRes.data ?? []) {
    const pending = (item.quantity_shipped ?? 0) - (item.quantity_received ?? 0);
    if (pending <= 0) continue;
    const cogs = cogsForSku(item.seller_sku);
    const resale = resaleForSku(item.seller_sku);
    inboundUnits += pending;
    inboundCost += pending * cogs;
    inboundResale += pending * resale;
  }

  function buildRow(status: string, units: number, cost: number, resale: number): InventoryStatusRow {
    const profit = resale - cost;
    const roi = cost > 0 ? (profit / cost) * 100 : 0;
    return { status, units, cost, resale, profit, roi };
  }

  const rows = [
    buildRow("Available", availableUnits, availableCost, availableResale),
    buildRow("Reserved", reservedUnits, reservedCost, reservedResale),
    buildRow("Inbound", inboundUnits, inboundCost, inboundResale),
    buildRow("Unsellable", unsellableUnits, unsellableCost, unsellableResale),
  ];

  const totalUnits = rows.reduce((s, r) => s + r.units, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalResale = rows.reduce((s, r) => s + r.resale, 0);
  rows.push(buildRow("Total", totalUnits, totalCost, totalResale));

  return rows;
}

// --- Detailed capital data for the /capital page ---

export interface CapitalProductRow {
  sku: string;
  asin: string | null;
  title: string | null;
  image_url: string | null;
  fulfillable: number;
  reserved: number;
  unsellable: number;
  inbound: number;
  cogs: number;
  totalValue: number;
}

export interface CapitalShipmentItemRow {
  sellerSku: string;
  title: string | null;
  quantityShipped: number;
  quantityReceived: number;
  cogs: number;
  value: number;
}

export interface CapitalShipmentRow {
  shipmentId: string;
  shipmentName: string;
  status: string;
  destinationFcId: string;
  items: CapitalShipmentItemRow[];
  totalUnitsShipped: number;
  totalUnitsReceived: number;
  totalValue: number;
}

export interface CapitalDetailData {
  overview: CapitalOverviewData;
  products: CapitalProductRow[];
  shipments: CapitalShipmentRow[];
  grandTotalCapital: number;
}

export async function getCapitalDetail(): Promise<CapitalDetailData | null> {
  await requireAuth();
  const supabase = createServiceClient();

  const { data: latestRow } = await supabase
    .from("inventory_snapshots")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const snapshotDate = latestRow?.date;

  const [inventoryRes, productsRes, cogsRes, shipmentsRes] = await Promise.all([
    snapshotDate
      ? supabase
          .from("inventory_snapshots")
          .select("sku, asin, afn_fulfillable, afn_reserved, afn_inbound, afn_unsellable")
          .eq("date", snapshotDate)
      : Promise.resolve({ data: [] as { sku: string; asin: string | null; afn_fulfillable: number; afn_reserved: number; afn_inbound: number; afn_unsellable: number }[] }),
    supabase.from("products").select("sku, asin, title, image_url"),
    supabase
      .from("cogs_periods")
      .select("asin, total_cogs")
      .is("valid_to", null),
    supabase
      .from("inbound_shipments")
      .select("shipment_id, shipment_name, shipment_status, destination_fc_id")
      .in("shipment_status", ["WORKING", "SHIPPED", "IN_TRANSIT", "RECEIVING", "DELIVERED", "CHECKED_IN", "CLOSED"]),
  ]);

  const products = productsRes.data ?? [];
  const snapshots = (Array.isArray(inventoryRes.data) ? inventoryRes.data : []) as {
    sku: string;
    asin: string | null;
    afn_fulfillable: number;
    afn_reserved: number;
    afn_inbound: number;
    afn_unsellable: number;
  }[];

  const skuToProduct = new Map<string, { asin: string | null; title: string | null; image_url: string | null }>();
  const skuToAsin = new Map<string, string>();
  for (const p of products) {
    skuToProduct.set(p.sku, { asin: p.asin, title: p.title, image_url: p.image_url });
    if (p.asin) skuToAsin.set(p.sku, p.asin);
  }
  for (const snap of snapshots) {
    if (snap.asin && !skuToAsin.has(snap.sku)) {
      skuToAsin.set(snap.sku, snap.asin);
      skuToProduct.set(snap.sku, { asin: snap.asin, title: null, image_url: null });
    }
  }

  const asinToCogs = new Map<string, number>();
  for (const c of cogsRes.data ?? []) {
    asinToCogs.set(c.asin, parseFloat(String(c.total_cogs ?? "0")));
  }

  function cogsForSku(sku: string): number {
    const asin = skuToAsin.get(sku);
    return asin ? (asinToCogs.get(asin) ?? 0) : 0;
  }

  // Build per-product rows from inventory snapshots
  let skusWithoutCogs = 0;
  const productRows: CapitalProductRow[] = [];

  for (const snap of snapshots) {
    const prod = skuToProduct.get(snap.sku);
    const cogs = cogsForSku(snap.sku);
    const f = snap.afn_fulfillable ?? 0;
    const r = snap.afn_reserved ?? 0;
    const u = snap.afn_unsellable ?? 0;
    const ib = snap.afn_inbound ?? 0;
    const total = f + r + u + ib;

    if (total > 0 && cogs === 0) skusWithoutCogs++;
    if (total === 0) continue;

    productRows.push({
      sku: snap.sku,
      asin: prod?.asin ?? null,
      title: prod?.title ?? null,
      image_url: prod?.image_url ?? null,
      fulfillable: f,
      reserved: r,
      unsellable: u,
      inbound: ib,
      cogs,
      totalValue: total * cogs,
    });
  }

  productRows.sort((a, b) => b.totalValue - a.totalValue);

  // Build shipment rows
  const shipmentIds = (shipmentsRes.data ?? []).map((s) => s.shipment_id);
  let allShipmentItems: { shipment_id: string; seller_sku: string; quantity_shipped: number; quantity_received: number }[] = [];

  if (shipmentIds.length > 0) {
    const { data: items } = await supabase
      .from("inbound_shipment_items")
      .select("shipment_id, seller_sku, quantity_shipped, quantity_received")
      .in("shipment_id", shipmentIds);
    allShipmentItems = items ?? [];
  }

  const itemsByShipment = new Map<string, typeof allShipmentItems>();
  for (const item of allShipmentItems) {
    const arr = itemsByShipment.get(item.shipment_id) ?? [];
    arr.push(item);
    itemsByShipment.set(item.shipment_id, arr);
  }

  const shipmentRows: CapitalShipmentRow[] = [];
  for (const s of shipmentsRes.data ?? []) {
    const items = itemsByShipment.get(s.shipment_id) ?? [];
    let totalShipped = 0;
    let totalReceived = 0;
    let totalValue = 0;

    const itemRows: CapitalShipmentItemRow[] = items.map((item) => {
      const cogs = cogsForSku(item.seller_sku);
      const shipped = item.quantity_shipped ?? 0;
      const received = item.quantity_received ?? 0;
      totalShipped += shipped;
      totalReceived += received;
      const value = shipped * cogs;
      totalValue += value;

      const prod = skuToProduct.get(item.seller_sku);
      return {
        sellerSku: item.seller_sku,
        title: prod?.title ?? null,
        quantityShipped: shipped,
        quantityReceived: received,
        cogs,
        value,
      };
    });

    shipmentRows.push({
      shipmentId: s.shipment_id,
      shipmentName: s.shipment_name,
      status: s.shipment_status,
      destinationFcId: s.destination_fc_id,
      items: itemRows,
      totalUnitsShipped: totalShipped,
      totalUnitsReceived: totalReceived,
      totalValue,
    });
  }

  shipmentRows.sort((a, b) => {
    const order: Record<string, number> = { RECEIVING: 0, IN_TRANSIT: 1, SHIPPED: 2, WORKING: 3, CLOSED: 4 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9);
  });

  // Build overview buckets
  let fulfillableValue = 0, reservedValue = 0, unsellableValue = 0;
  let fulfillableUnits = 0, reservedUnits = 0, unsellableUnits = 0;

  for (const p of productRows) {
    fulfillableValue += p.fulfillable * p.cogs;
    reservedValue += p.reserved * p.cogs;
    unsellableValue += p.unsellable * p.cogs;
    fulfillableUnits += p.fulfillable;
    reservedUnits += p.reserved;
    unsellableUnits += p.unsellable;
  }

  const inboundValue = shipmentRows.reduce((sum, s) => sum + s.totalValue, 0);
  const inboundUnits = shipmentRows
    .filter((s) => s.status !== "CLOSED")
    .reduce((sum, s) => sum + (s.totalUnitsShipped - s.totalUnitsReceived), 0);

  const totalCapital = fulfillableValue + reservedValue + unsellableValue + inboundValue;
  const totalUnits = fulfillableUnits + reservedUnits + unsellableUnits + Math.max(inboundUnits, 0);

  const overview: CapitalOverviewData = {
    totalCapital,
    totalUnits,
    buckets: [
      { label: "At Amazon", value: fulfillableValue, units: fulfillableUnits, color: "emerald" },
      { label: "Reserved", value: reservedValue, units: reservedUnits, color: "amber" },
      { label: "In Transit", value: inboundValue, units: Math.max(inboundUnits, 0), color: "sky" },
      { label: "Unsellable", value: unsellableValue, units: unsellableUnits, color: "rose" },
    ],
    skusWithoutCogs,
  };

  return {
    overview,
    products: productRows,
    shipments: shipmentRows,
    grandTotalCapital: totalCapital,
  };
}
