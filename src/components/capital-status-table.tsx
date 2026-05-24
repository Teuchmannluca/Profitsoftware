"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Package, ShoppingCart, Truck, AlertTriangle } from "lucide-react";
import type { InventoryStatusRow } from "@/actions/capital-overview";

function fmt(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_CONFIG: Record<string, { icon: typeof Package; color: string; bg: string }> = {
  Available: { icon: Package, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950" },
  Reserved: { icon: ShoppingCart, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950" },
  Inbound: { icon: Truck, color: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-950" },
  Unsellable: { icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950" },
};

export function CapitalStatusTable({ rows }: { rows: InventoryStatusRow[] }) {
  if (rows.length === 0) return null;

  return (
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
                const profitColor = row.profit >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400";

                return (
                  <tr
                    key={row.status}
                    className={
                      isTotal
                        ? "border-t-2 border-border bg-muted/30"
                        : "border-b border-border/20 hover:bg-muted/10 transition-colors"
                    }
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
  );
}
