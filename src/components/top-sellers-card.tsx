"use client";

import { useState, useTransition, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import Image from "next/image";
import {
  getTopSellers,
  type TopSellerItem,
  type TopSellersSortBy,
  type TopSellersPeriod,
} from "@/actions/top-sellers";

const periods: { key: TopSellersPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_month", label: "This Month" },
  { key: "all_time", label: "All Time" },
];

const sortOptions: { key: TopSellersSortBy; label: string }[] = [
  { key: "units", label: "Quantity" },
  { key: "revenue", label: "Revenue" },
  { key: "profit", label: "Profit" },
];

function fmt(n: number): string {
  return `£${n.toFixed(2)}`;
}

export function TopSellersCard({
  initialData,
}: {
  initialData: TopSellerItem[];
}) {
  const [items, setItems] = useState(initialData);
  const [period, setPeriod] = useState<TopSellersPeriod>("today");
  const [sortBy, setSortBy] = useState<TopSellersSortBy>("units");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await getTopSellers(period, sortBy);
      setItems(data);
    });
  }, [period, sortBy]);

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
              <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            Your Top Selling Items
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5">
              {sortOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortBy(opt.key)}
                  className={`h-6 px-2.5 text-[10px] font-medium rounded-md transition-colors ${
                    sortBy === opt.key
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`h-6 px-2.5 text-[10px] font-medium rounded-md transition-colors ${
                    period === p.key
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className={`transition-opacity duration-150 ${isPending ? "opacity-50" : ""}`}
        >
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No sales data yet
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="text-left py-2.5 pl-6">Product</th>
                  <th className="text-right py-2.5 px-3">Units</th>
                  <th className="text-right py-2.5 px-3">Sales</th>
                  <th className="text-right py-2.5 px-3">Profit</th>
                  <th className="text-right py-2.5 pr-6">ROI %</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const roi =
                    item.sales > 0 ? (item.profit / item.sales) * 100 : 0;
                  return (
                    <tr
                      key={item.asin}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="py-3 pl-6">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.title ?? item.sku}
                              width={40}
                              height={40}
                              className="rounded-lg object-cover ring-1 ring-border/50"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-muted" />
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate max-w-[200px]">
                              {item.title ?? item.sku}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {item.asin}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right px-3 font-mono text-xs font-semibold">
                        {item.units}
                      </td>
                      <td className="text-right px-3 font-mono text-xs">
                        {fmt(item.sales)}
                      </td>
                      <td className="text-right px-3 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        {fmt(item.profit)}
                      </td>
                      <td className="text-right pr-6 font-mono text-xs font-semibold">
                        {roi.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
