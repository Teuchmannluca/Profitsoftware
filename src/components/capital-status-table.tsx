"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Package,
  ShoppingCart,
  Truck,
  AlertTriangle,
  X,
  ChevronRight,
} from "lucide-react";
import type { InventoryStatusRow, CapitalProductRow } from "@/actions/capital-overview";

function fmt(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Package; color: string; bg: string; field: keyof CapitalProductRow }
> = {
  Available: { icon: Package, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950", field: "fulfillable" },
  Reserved: { icon: ShoppingCart, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950", field: "reserved" },
  Inbound: { icon: Truck, color: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-950", field: "inbound" },
  Unsellable: { icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950", field: "unsellable" },
};

function StatusDrilldown({
  status,
  products,
  onClose,
}: {
  status: string;
  products: CapitalProductRow[];
  onClose: () => void;
}) {
  const config = STATUS_CONFIG[status];
  const field = config?.field ?? "fulfillable";
  const Icon = config?.icon ?? Package;

  const filtered = products
    .filter((p) => (p[field] as number) > 0)
    .sort((a, b) => ((b[field] as number) * b.cogs) - ((a[field] as number) * a.cogs));

  const totalUnits = filtered.reduce((s, p) => s + (p[field] as number), 0);
  const totalValue = filtered.reduce((s, p) => s + (p[field] as number) * p.cogs, 0);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col bg-card border-l border-border shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${config?.bg}`}>
              <Icon className={`h-4 w-4 ${config?.color}`} />
            </div>
            <div>
              <h2 className="text-sm font-bold">{status} Inventory</h2>
              <p className="text-[11px] text-muted-foreground">
                {totalUnits.toLocaleString("en-GB")} units · {fmt(totalValue)} cost
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              No products in this status
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filtered.map((product) => {
                const units = product[field] as number;
                const value = units * product.cogs;

                return (
                  <Link
                    key={product.sku}
                    href={product.asin ? `/product/${product.asin}` : "#"}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {product.image_url ? (
                      <Image
                        src={product.image_url}
                        alt={product.title ?? product.sku}
                        width={40}
                        height={40}
                        className="rounded-lg object-cover ring-1 ring-border/50 shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center ring-1 ring-border/50 shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {product.title ?? product.sku}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {product.asin ?? product.sku}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono">{units}</p>
                      <p className="text-[10px] text-muted-foreground">units</p>
                    </div>
                    <div className="text-right shrink-0 w-20">
                      <p className="text-sm font-semibold font-mono">{fmt(value)}</p>
                      <p className="text-[10px] text-muted-foreground">cost</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function CapitalStatusTable({
  rows,
  products,
}: {
  rows: InventoryStatusRow[];
  products: CapitalProductRow[];
}) {
  const [drilldown, setDrilldown] = useState<string | null>(null);

  if (rows.length === 0) return null;

  return (
    <>
      <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950">
              <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Inventory by Status
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left px-4 md:px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 md:px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Units</th>
                  <th className="text-right px-4 md:px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Cost</th>
                  <th className="text-right px-4 md:px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Resale</th>
                  <th className="text-right px-4 md:px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Profit</th>
                  <th className="text-right px-4 md:px-6 py-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ROI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isTotal = row.status === "Total";
                  const config = STATUS_CONFIG[row.status];
                  const Icon = config?.icon;
                  const isClickable = !isTotal && row.units > 0;
                  const profitColor = row.profit >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400";

                  return (
                    <tr
                      key={row.status}
                      onClick={() => isClickable && setDrilldown(row.status)}
                      className={`${
                        isTotal
                          ? "border-t-2 border-border bg-muted/30"
                          : "border-b border-border/20 hover:bg-muted/10 transition-colors"
                      } ${isClickable ? "cursor-pointer" : ""}`}
                    >
                      <td className={`px-4 md:px-6 py-3.5 ${isTotal ? "font-bold" : ""}`}>
                        {isTotal ? (
                          <span className="text-sm font-bold text-foreground">Total</span>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            {Icon && (
                              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bg}`}>
                                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                              </div>
                            )}
                            <span className="text-sm font-medium text-foreground">{row.status}</span>
                            {isClickable && (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                            )}
                          </div>
                        )}
                      </td>
                      <td className={`text-right px-4 md:px-6 py-3.5 text-sm font-mono ${isTotal ? "font-bold" : "font-semibold"}`}>
                        {row.units.toLocaleString("en-GB")}
                      </td>
                      <td className={`text-right px-4 md:px-6 py-3.5 text-sm font-mono ${isTotal ? "font-bold" : ""}`}>
                        {fmt(row.cost)}
                      </td>
                      <td className={`text-right px-4 md:px-6 py-3.5 text-sm font-mono ${isTotal ? "font-bold" : ""}`}>
                        {fmt(row.resale)}
                      </td>
                      <td className={`text-right px-4 md:px-6 py-3.5 text-sm font-mono ${isTotal ? "font-bold" : "font-semibold"} ${profitColor}`}>
                        {fmt(row.profit)}
                      </td>
                      <td className={`text-right px-4 md:px-6 py-3.5 text-sm font-mono ${isTotal ? "font-bold" : "font-semibold"} ${profitColor}`}>
                        {row.roi.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {drilldown && (
        <StatusDrilldown
          status={drilldown}
          products={products}
          onClose={() => setDrilldown(null)}
        />
      )}
    </>
  );
}
