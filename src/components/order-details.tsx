"use client";

import Image from "next/image";
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

export function OrderDetails({ orders }: { orders: OrderWithItems[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return orders;
    const q = search.toLowerCase();
    return orders.filter(
      (o) =>
        o.amazon_order_id.toLowerCase().includes(q) ||
        o.items.some(
          (i) =>
            i.title?.toLowerCase().includes(q) ||
            i.asin?.toLowerCase().includes(q) ||
            i.sku?.toLowerCase().includes(q)
        )
    );
  }, [orders, search]);

  const totalItems = filtered.reduce((sum, o) => sum + o.items.length, 0);

  // Grand totals
  const grandGross = filtered.reduce(
    (sum, o) => sum + o.items.reduce((is, i) => is + i.item_price_gross, 0),
    0
  );
  const grandNet = filtered.reduce(
    (sum, o) =>
      sum +
      o.items.reduce(
        (is, i) => is + i.item_price_gross - i.item_tax - i.promo_discount,
        0
      ),
    0
  );
  const grandProfit = filtered.reduce(
    (sum, o) => sum + o.items.reduce((is, i) => is + (i.estimated_profit ?? 0), 0),
    0
  );

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50">
              <Package className="h-4 w-4 text-sky-600" />
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

        {/* Grand totals bar */}
        {orders.length > 0 && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/40">
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
                  grandProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatMoney(grandProfit)}
              </span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-sky-50 p-4 mb-4">
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
                (sum, i) => sum + i.item_price_gross - i.item_tax - i.promo_discount,
                0
              );
              const orderProfit = order.items.reduce(
                (sum, i) => sum + (i.estimated_profit ?? 0),
                0
              );
              const orderQty = order.items.reduce((sum, i) => sum + i.qty, 0);

              return (
                <div
                  key={order.amazon_order_id}
                  className="p-4 hover:bg-muted/20 transition-colors"
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
                        {order.amazon_order_id}
                      </span>
                      <StatusBadge status={order.order_status} />
                      <StatusBadge
                        status={order.fulfillment_channel === "AFN" ? "FBA" : "FBM"}
                      />
                      {order.is_business_order && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full ring-1 ring-blue-600/15">
                          <Briefcase className="h-2.5 w-2.5" />
                          B2B
                        </span>
                      )}
                      {order.is_prime && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full ring-1 ring-sky-600/15">
                          <Crown className="h-2.5 w-2.5" />
                          Prime
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
                  <div className="flex items-center gap-4 mb-3 px-2">
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3 text-sky-500" />
                      <span className="text-[11px] font-mono font-semibold text-foreground">
                        {formatMoney(orderGross)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">gross</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Scale className="h-3 w-3 text-indigo-500" />
                      <span className="text-[11px] font-mono font-semibold text-foreground">
                        {formatMoney(orderNet)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">net</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <PiggyBank className="h-3 w-3 text-emerald-500" />
                      <span
                        className={`text-[11px] font-mono font-semibold ${
                          orderProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {formatMoney(orderProfit)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">profit</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="h-3 w-3 text-violet-500" />
                      <span className="text-[11px] font-mono font-semibold text-foreground">
                        {orderQty}
                      </span>
                      <span className="text-[10px] text-muted-foreground">units</span>
                    </div>
                  </div>

                  {/* Order items */}
                  <div className="space-y-2">
                    {order.items.map((item, idx) => {
                      const netPrice =
                        item.item_price_gross - item.item_tax - item.promo_discount;
                      const profit = item.estimated_profit ?? 0;
                      const isProfitable = profit >= 0;
                      const hasRefund = item.refund_status !== "none";

                      return (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ${
                            hasRefund ? "ring-rose-200 bg-rose-50/30" : "ring-border/40"
                          }`}
                        >
                          {/* Product image */}
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.title ?? item.sku}
                              width={64}
                              height={64}
                              className="rounded-xl object-cover ring-1 ring-border/50 shrink-0"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center ring-1 ring-border/50 shrink-0">
                              <Package className="h-5 w-5 text-muted-foreground/40" />
                            </div>
                          )}

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {item.title ?? item.sku}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {item.asin ?? item.sku}
                            </p>
                            {hasRefund && (
                              <span className="inline-flex mt-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-md ring-1 ring-rose-600/15">
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

                          {/* Tax */}
                          <div className="text-right shrink-0 w-16">
                            <p className="text-sm font-bold font-mono text-foreground">
                              {formatMoney(item.item_tax)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              tax
                            </p>
                          </div>

                          {/* Shipping */}
                          <div className="text-right shrink-0 w-16">
                            <p className="text-sm font-bold font-mono text-foreground">
                              {formatMoney(item.shipping_price)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              ship
                            </p>
                          </div>

                          {/* Net price */}
                          <div className="text-right shrink-0 w-20">
                            <p className="text-sm font-bold font-mono text-foreground">
                              {formatMoney(netPrice)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              net
                            </p>
                          </div>

                          {/* COGS */}
                          <div className="text-right shrink-0 w-16">
                            <p className="text-sm font-bold font-mono text-muted-foreground">
                              {formatMoney(item.cogs_snapshot)}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                              cogs
                            </p>
                          </div>

                          {/* Profit */}
                          <div className="text-right shrink-0 w-20">
                            <p
                              className={`text-sm font-bold font-mono ${
                                isProfitable ? "text-emerald-600" : "text-rose-600"
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
