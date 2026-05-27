"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import Image from "next/image";

export interface PendingOrderRow {
  amazon_order_id: string;
  purchase_date: string;
  order_status: string;
  items: {
    sku: string;
    title: string | null;
    image_url: string | null;
    qty: number;
    price: number;
  }[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function PendingOrdersCard({ orders }: { orders: PendingOrderRow[] }) {
  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            Pending Orders
            {orders.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-[10px] font-bold min-w-[20px] h-5 px-1.5">
                {orders.length}
              </span>
            )}
          </CardTitle>
          <a href="/orders" className="text-[11px] text-primary font-medium hover:underline">
            All orders →
          </a>
        </div>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 p-4 mb-3">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No pending orders</p>
            <p className="text-xs text-muted-foreground mt-1">
              All orders have been shipped
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.amazon_order_id}
                className="flex items-start gap-3 rounded-xl border border-border/50 bg-muted/30 p-3"
              >
                {order.items[0]?.image_url ? (
                  <Image
                    src={order.items[0].image_url}
                    alt={order.items[0].title ?? order.items[0].sku}
                    width={40}
                    height={40}
                    className="rounded-lg object-cover ring-1 ring-border/50 shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold truncate">
                      {order.items[0]?.title ?? order.items[0]?.sku ?? order.amazon_order_id}
                    </p>
                    <StatusBadge status={order.order_status} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {order.items.length === 1
                        ? `${order.items[0].qty}x`
                        : `${order.items.reduce((s, i) => s + i.qty, 0)} items`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] font-mono font-semibold">
                      £{order.items.reduce((s, i) => s + i.price, 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">
                      {timeAgo(order.purchase_date)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
