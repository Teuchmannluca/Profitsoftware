"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import {
  Package,
  TrendingUp,
  TrendingDown,
  Truck,
  Receipt,
  PiggyBank,
  Scale,
  Tag,
  Search,
  Briefcase,
  Crown,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
} from "lucide-react";
import { useState, useMemo } from "react";

interface OrderItem {
  sku: string;
  asin: string | null;
  title: string | null;
  image_url: string | null;
  qty: number;
  item_price_gross: number;
  item_tax: number;
  shipping_price: number;
  promo_discount: number;
  estimated_profit: number | null;
  cogs_snapshot: number | null;
  fees_total: number;
  vat_rate: number;
  refund_status: string;
}

interface OrderWithItems {
  amazon_order_id: string;
  purchase_date: string;
  order_status: string;
  fulfillment_channel: string;
  ship_country: string | null;
  ship_postcode: string | null;
  is_business_order?: boolean;
  is_prime?: boolean;
  items: OrderItem[];
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `£${value.toFixed(2)}`;
}

function countryFlag(country: string | null): string {
  if (!country) return "🏳️";
  const flags: Record<string, string> = {
    GB: "🇬🇧",
    UK: "🇬🇧",
    DE: "🇩🇪",
    FR: "🇫🇷",
    IT: "🇮🇹",
    ES: "🇪🇸",
    NL: "🇳🇱",
    BE: "🇧🇪",
    PL: "🇵🇱",
    SE: "🇸🇪",
    IE: "🇮🇪",
    AT: "🇦🇹",
    US: "🇺🇸",
    CA: "🇨🇦",
    AU: "🇦🇺",
    JP: "🇯🇵",
  };
  return flags[country] ?? "🏳️";
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "Pending", label: "Pending" },
  { key: "Shipped", label: "Shipped" },
  { key: "Unshipped", label: "Unshipped" },
  { key: "Cancelled", label: "Cancelled" },
] as const;

export function OrderDetails({ orders }: { orders: OrderWithItems[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    for (const o of orders) {
      counts[o.order_status] = (counts[o.order_status] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      result = result.filter((o) => o.order_status === statusFilter);
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (q) {
        result = result.filter(
          (o) =>
            o.amazon_order_id.toLowerCase().includes(q) ||
            o.items.some(
              (i) =>
                (i.title ?? "").toLowerCase().includes(q) ||
                (i.asin ?? "").toLowerCase().includes(q) ||
                (i.sku ?? "").toLowerCase().includes(q)
            )
        );
      }
    }
    return result;
  }, [orders, search, statusFilter]);

  const totalItems = filtered.reduce((sum, o) => sum + o.items.length, 0);

  // Grand totals
  const grandGross = filtered.reduce(
    (sum, o) => sum + o.items.reduce((is, i) => is + i.item_price_gross, 0),
    0
  );
  function deriveTax(i: OrderItem) {
    return i.item_tax > 0 ? i.item_tax : i.item_price_gross * (i.vat_rate / (1 + i.vat_rate));
  }
  function liveProfit(i: OrderItem) {
    const tax = deriveTax(i);
    const feeExVat = i.fees_total / (1 + i.vat_rate);
    const cogs = i.cogs_snapshot ?? 0;
    return i.item_price_gross - tax - i.promo_discount - feeExVat * i.qty - cogs * i.qty;
  }
  const grandNet = filtered.reduce(
    (sum, o) =>
      sum +
      o.items.reduce(
        (is, i) => is + i.item_price_gross - deriveTax(i) - i.promo_discount,
        0
      ),
    0
  );
  const grandProfit = filtered.reduce(
    (sum, o) => sum + o.items.reduce((is, i) => is + liveProfit(i), 0),
    0
  );
  const grandCogs = filtered.reduce(
    (sum, o) => sum + o.items.reduce((is, i) => is + (i.cogs_snapshot ?? 0) * i.qty, 0),
    0
  );
  const grandRoi = grandCogs > 0 ? (grandProfit / grandCogs) * 100 : null;

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950">
              <Package className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            Order History
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {filtered.length} orders
            </span>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {totalItems} items
            </span>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order ID, product name, ASIN, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9 rounded-xl border-border/80"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => {
            const count = statusCounts[f.key] ?? 0;
            if (f.key !== "all" && count === 0) return null;
            const isActive = statusFilter === f.key;
            const colorMap: Record<string, string> = {
              all: isActive ? "bg-foreground text-background" : "",
              Pending: isActive ? "bg-amber-600 text-white dark:bg-amber-500" : "text-amber-700 dark:text-amber-400",
              Shipped: isActive ? "bg-emerald-600 text-white dark:bg-emerald-500" : "text-emerald-700 dark:text-emerald-400",
              Unshipped: isActive ? "bg-sky-600 text-white dark:bg-sky-500" : "text-sky-700 dark:text-sky-400",
              Cancelled: isActive ? "bg-rose-600 text-white dark:bg-rose-500" : "text-rose-700 dark:text-rose-400",
            };
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`inline-flex items-center gap-1.5 h-7 px-3 text-[11px] font-semibold rounded-lg transition-all duration-150 ${
                  isActive
                    ? `${colorMap[f.key]} shadow-sm`
                    : `${colorMap[f.key]} bg-muted/60 hover:bg-muted`
                }`}
              >
                {f.label}
                <span className={`text-[10px] font-mono ${isActive ? "opacity-80" : "opacity-60"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Grand totals bar */}
        {orders.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-xs text-muted-foreground">Gross:</span>
              <span className="text-xs font-bold font-mono text-foreground">
                {formatMoney(grandGross)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-indigo-500" />
              <span className="text-xs text-muted-foreground">Net:</span>
              <span className="text-xs font-bold font-mono text-foreground">
                {formatMoney(grandNet)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <PiggyBank className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Profit:</span>
              <span
                className={`text-xs font-bold font-mono ${
                  grandProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {formatMoney(grandProfit)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-muted-foreground">ROI:</span>
              <span
                className={`text-xs font-bold font-mono ${
                  grandRoi !== null && grandRoi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {grandRoi !== null ? `${grandRoi.toFixed(1)}%` : "—"}
              </span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-sky-50 dark:bg-sky-950 p-4 mb-4">
              <Package className="h-6 w-6 text-sky-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No orders found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Try a different date range or sync new orders
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((order) => {
              const orderGross = order.items.reduce(
                (sum, i) => sum + i.item_price_gross,
                0
              );
              const orderNet = order.items.reduce(
                (sum, i) => sum + i.item_price_gross - deriveTax(i) - i.promo_discount,
                0
              );
              const orderProfit = order.items.reduce(
                (sum, i) => sum + liveProfit(i),
                0
              );
              const orderCogs = order.items.reduce(
                (sum, i) => sum + (i.cogs_snapshot ?? 0) * i.qty,
                0
              );
              const orderRoi = orderCogs > 0 ? (orderProfit / orderCogs) * 100 : null;
              const orderQty = order.items.reduce((sum, i) => sum + i.qty, 0);

              const isPending = order.order_status === "Pending";
              const isShipped = order.order_status === "Shipped";
              const isCancelled = order.order_status === "Cancelled";
              const borderColor = isPending
                ? "border-l-amber-500"
                : isShipped
                  ? "border-l-emerald-500"
                  : isCancelled
                    ? "border-l-rose-500"
                    : "border-l-sky-500";

              return (
                <div
                  key={order.amazon_order_id}
                  className={`p-4 hover:bg-muted/20 transition-all duration-200 border-l-[3px] ${borderColor}`}
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
                        {order.amazon_order_id}
                      </span>
                      {isPending ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded-full ring-1 ring-amber-600/20 dark:ring-amber-400/20">
                          <Clock className="h-3 w-3 animate-pulse" />
                          Pending
                        </span>
                      ) : isShipped ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 rounded-full ring-1 ring-emerald-600/20 dark:ring-emerald-400/20">
                          <CheckCircle2 className="h-3 w-3" />
                          Shipped
                        </span>
                      ) : isCancelled ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2.5 py-1 rounded-full ring-1 ring-rose-600/20 dark:ring-rose-400/20">
                          <XCircle className="h-3 w-3" />
                          Cancelled
                        </span>
                      ) : (
                        <StatusBadge status={order.order_status} />
                      )}
                      <StatusBadge
                        status={order.fulfillment_channel === "AFN" ? "FBA" : "FBM"}
                      />
                      {order.is_business_order && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full ring-1 ring-blue-600/15 dark:ring-blue-400/15">
                          <Briefcase className="h-2.5 w-2.5" />
                          B2B
                        </span>
                      )}
                      {order.is_prime && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950 px-2 py-0.5 rounded-full ring-1 ring-sky-600/15 dark:ring-sky-400/15">
                          <Crown className="h-2.5 w-2.5" />
                          Prime
                        </span>
                      )}
                      {isPending && orderGross > 0 && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-amber-600 dark:text-amber-500">
                          <Timer className="h-2.5 w-2.5" />
                          Estimated
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {countryFlag(order.ship_country)} {order.ship_country ?? "—"}
                        {order.ship_postcode && ` · ${order.ship_postcode}`}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {new Date(order.purchase_date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Order summary mini bar */}
                  <div className="flex flex-wrap items-center gap-3 md:gap-4 mb-3 px-2">
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3 text-sky-500" />
                      <span className={`text-[11px] font-mono font-semibold ${isPending && orderGross === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                        {orderGross === 0 && isPending ? "Awaiting" : formatMoney(orderGross)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">gross</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Scale className="h-3 w-3 text-indigo-500" />
                      <span className={`text-[11px] font-mono font-semibold ${isPending && orderNet === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                        {orderNet === 0 && isPending ? "Awaiting" : formatMoney(orderNet)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">net</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <PiggyBank className="h-3 w-3 text-emerald-500" />
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          isPending && orderProfit === 0
                            ? "text-muted-foreground"
                            : orderProfit >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {orderProfit === 0 && isPending ? "Awaiting" : formatMoney(orderProfit)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">profit</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-amber-500" />
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          isPending && orderRoi === null
                            ? "text-muted-foreground"
                            : orderRoi !== null && orderRoi >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {orderRoi !== null ? `${orderRoi.toFixed(1)}%` : "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">ROI</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-violet-500" />
                      <span className={`text-[11px] font-mono font-semibold ${isPending && orderQty === 0 ? "text-muted-foreground" : "text-foreground"}`}>
                        {orderQty === 0 && isPending ? "—" : orderQty}
                      </span>
                      <span className="text-[10px] text-muted-foreground">units</span>
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="space-y-2">
                    {order.items.map((item, idx) => {
                      const displayTax = item.item_tax > 0
                        ? item.item_tax
                        : item.item_price_gross * (item.vat_rate / (1 + item.vat_rate));
                      const netPrice =
                        item.item_price_gross - displayTax - item.promo_discount;
                      const profit = liveProfit(item);
                      const isProfitable = profit >= 0;
                      const hasRefund = item.refund_status !== "none";

                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ${
                            hasRefund ? "ring-rose-200 dark:ring-rose-900 bg-rose-50/30 dark:bg-rose-950/30" : "ring-border/40"
                          }`}
                        >
                          {/* Product image */}
                          <Link href={item.asin ? `/product/${item.asin}` : "#"} className="shrink-0">
                            {item.image_url ? (
                              <Image
                                src={item.image_url}
                                alt={item.title ?? item.sku}
                                width={64}
                                height={64}
                                className="rounded-xl object-cover ring-1 ring-border/50 hover:ring-indigo-300 transition-all h-10 w-10 md:h-16 md:w-16"
                              />
                            ) : (
                              <div className="h-10 w-10 md:h-16 md:w-16 rounded-xl bg-muted flex items-center justify-center ring-1 ring-border/50 hover:ring-indigo-300 transition-all">
                                <Package className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground/40" />
                              </div>
                            )}
                          </Link>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <Link href={item.asin ? `/product/${item.asin}` : "#"} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                              <p className="text-sm font-semibold text-foreground truncate hover:text-indigo-600 dark:hover:text-indigo-400">
                                {item.title ?? item.sku}
                              </p>
                            </Link>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {item.asin ?? item.sku}
                              {item.vat_rate != null && (
                                <span className="ml-2 inline-flex text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-1.5 py-0.5 rounded-md ring-1 ring-amber-600/15 dark:ring-amber-400/15">
                                  {Math.round(item.vat_rate * 100)}% VAT
                                </span>
                              )}
                            </p>
                            {hasRefund && (
                              <span className="inline-flex mt-1 text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded-md ring-1 ring-rose-600/15 dark:ring-rose-400/15">
                                Refunded
                              </span>
                            )}
                          </div>

                          {/* Quantity */}
                          <div className="text-center shrink-0 w-14">
                            <p className="text-xl font-bold font-mono text-foreground">
                              {item.qty}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              units
                            </p>
                          </div>

                          {/* Price */}
                          <div className="text-right shrink-0 w-20">
                            <p className="text-sm font-bold font-mono text-foreground">
                              {formatMoney(item.item_price_gross)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              gross
                            </p>
                          </div>

                          {/* Tax — hidden on mobile */}
                          <div className="text-right shrink-0 w-16 hidden lg:block">
                            <p className="text-sm font-bold font-mono text-foreground">
                              {formatMoney(displayTax)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              tax
                            </p>
                          </div>

                          {/* Shipping — hidden on mobile */}
                          <div className="text-right shrink-0 w-16 hidden lg:block">
                            <p className="text-sm font-bold font-mono text-foreground">
                              {formatMoney(item.shipping_price)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              ship
                            </p>
                          </div>

                          {/* Net price — hidden on mobile */}
                          <div className="text-right shrink-0 w-20 hidden md:block">
                            <p className="text-sm font-bold font-mono text-foreground">
                              {formatMoney(netPrice)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              net
                            </p>
                          </div>

                          {/* COGS — hidden on mobile */}
                          <div className="text-right shrink-0 w-16 hidden lg:block">
                            <p className="text-sm font-bold font-mono text-muted-foreground">
                              {formatMoney((item.cogs_snapshot ?? 0) * item.qty)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              cogs
                            </p>
                          </div>

                          {/* Profit */}
                          <div className="text-right shrink-0 w-20">
                            <p
                              className={`text-sm font-bold font-mono ${
                                isProfitable ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {formatMoney(profit)}
                            </p>
                            <div className="flex items-center justify-end gap-0.5">
                              {isProfitable ? (
                                <TrendingUp className="h-2.5 w-2.5 text-emerald-500" />
                              ) : (
                                <TrendingDown className="h-2.5 w-2.5 text-rose-500" />
                              )}
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                                profit
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
