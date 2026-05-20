"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Package } from "lucide-react";

interface Order {
  amazon_order_id: string;
  purchase_date: string;
  order_status: string;
  fulfillment_channel: string;
  ship_country: string | null;
  last_updated: string;
}

export function OrdersTable({ orders }: { orders: Order[] }) {
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
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            Last {orders.length}
          </span>
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
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6">Order ID</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Channel</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pr-6">Country</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.amazon_order_id} className="group border-border/40 transition-colors">
                    <TableCell className="font-mono text-xs pl-6 text-foreground font-medium">
                      {order.amazon_order_id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(order.purchase_date).toLocaleDateString(
                        "en-GB",
                        { day: "2-digit", month: "short", year: "numeric" }
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.order_status} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={order.fulfillment_channel === "AFN" ? "FBA" : "FBM"} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground pr-6">
                      {order.ship_country ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
