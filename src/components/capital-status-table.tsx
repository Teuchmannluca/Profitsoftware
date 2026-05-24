import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import type { InventoryStatusRow } from "@/actions/capital-overview";

function fmt(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="text-left px-4 md:px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Status</th>
                <th className="text-right px-4 md:px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Units</th>
                <th className="text-right px-4 md:px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Cost</th>
                <th className="text-right px-4 md:px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Resale</th>
                <th className="text-right px-4 md:px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Profit</th>
                <th className="text-right px-4 md:px-6 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">ROI</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isTotal = row.status === "Total";
                return (
                  <tr
                    key={row.status}
                    className={`${isTotal ? "border-t-2 border-border bg-muted/20" : "border-b border-border/30"}`}
                  >
                    <td className={`px-4 md:px-6 py-3 ${isTotal ? "font-bold text-foreground" : "text-foreground font-medium"}`}>
                      {row.status}
                    </td>
                    <td className={`text-right px-4 md:px-6 py-3 font-mono ${isTotal ? "font-bold" : ""}`}>
                      {row.units.toLocaleString("en-GB")}
                    </td>
                    <td className={`text-right px-4 md:px-6 py-3 font-mono ${isTotal ? "font-bold" : ""}`}>
                      {fmt(row.cost)}
                    </td>
                    <td className={`text-right px-4 md:px-6 py-3 font-mono ${isTotal ? "font-bold" : ""}`}>
                      {fmt(row.resale)}
                    </td>
                    <td className={`text-right px-4 md:px-6 py-3 font-mono ${isTotal ? "font-bold" : ""} text-emerald-600 dark:text-emerald-400`}>
                      {fmt(row.profit)}
                    </td>
                    <td className={`text-right px-4 md:px-6 py-3 font-mono ${isTotal ? "font-bold" : ""} text-emerald-600 dark:text-emerald-400`}>
                      {row.roi.toFixed(2)}%
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
