"use client";

import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Package, TrendingUp } from "lucide-react";

interface OrderItem {
  sku: string;
  asin: string | null;
  title: string | null;
  image_url: string | null;
  qty: number;
  item_price_gross: number;
  item_tax: number;
  promo_discount: number;
  estimated_profit: number | null;
}

interface OrderWithItems {
  amazon_order_id: string;
  purchase_date: string;
  order_status: string;
  fulfillment_channel: string;
  ship_country: string | null;
  items: OrderItem[];
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `£${value.toFixed(2)}`;
}

export function RecentOrders({ orders }: { orders: OrderWithItems[] }) {
  const totalItems = orders.reduce((sum, o) => sum + o.items.length, 0);

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950">
              <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Recent Orders
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {orders.length} orders
            </span>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {totalItems} items
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-indigo-50 dark:bg-indigo-950 p-4 mb-4">
              <Package className="h-6 w-6 text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No orders yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              Click Sync to pull orders from Amazon
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {orders.map((order) => (
              <div key={order.amazon_order_id} className="p-4 hover:bg-muted/20 transition-colors">
                {/* Order header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md">
                      {order.amazon_order_id}
                    </span>
                    <StatusBadge status={order.order_status} />
                    <StatusBadge status={order.fulfillment_channel === "AFN" ? "FBA" : "FBM"} />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(order.purchase_date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Order items */}
                <div className="space-y-2">
                  {order.items.map((item, idx) => {
                    const netPrice =
                      (item.item_price_gross ?? 0) -
                      (item.item_tax ?? 0) -
                      (item.promo_discount ?? 0);
                    const profit = item.estimated_profit ?? netPrice;
                    const isProfitable = profit >= 0;

                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 rounded-xl bg-card p-2.5 ring-1 ring-border/40"
                      >
                        {/* Product image */}
                        <Link href={item.asin ? `/product/${item.asin}` : "#"} className="shrink-0">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.title ?? item.sku}
                              width={48}
                              height={48}
                              className="rounded-lg object-cover ring-1 ring-border/50 hover:ring-indigo-300 transition-all"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center ring-1 ring-border/50 hover:ring-indigo-300 transition-all">
                              <Package className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </Link>

                        {/* Product info */}
                        <div className="flex-1 min-w-0">
                          <Link href={item.asin ? `/product/${item.asin}` : "#"}>
                            <p className="text-xs font-semibold text-foreground truncate hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                              {item.title ?? item.sku}
                            </p>
                          </Link>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {item.asin ?? item.sku}
                          </p>
                        </div>

                        {/* Quantity */}
                        <div className="text-center shrink-0">
                          <p className="text-lg font-bold font-mono text-foreground">
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

                        {/* Net price */}
                        <div className="text-right shrink-0 w-20">
                          <p className="text-sm font-bold font-mono text-foreground">
                            {formatMoney(netPrice)}
                          </p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                            net
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
                            <TrendingUp
                              className={`h-2.5 w-2.5 ${
                                isProfitable ? "text-emerald-500" : "text-rose-500"
                              }`}
                            />
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
