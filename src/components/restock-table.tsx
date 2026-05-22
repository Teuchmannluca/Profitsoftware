"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

export interface RestockRow {
  sku: string;
  asin: string | null;
  title: string | null;
  image_url: string | null;
  fulfillable: number;
  reserved: number;
  inbound: number;
  units_sold_30d: number;
  daily_velocity: number;
  days_of_stock: number;
  reorder_point: number;
  recommended_qty: number;
  unit_cogs: number;
  restock_cost: number;
  urgency: string;
}

type Filter = "all" | "restock" | "ok" | "overstock" | "no_sales";

const urgencyConfig: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  out_of_stock: { label: "Out of Stock", bg: "bg-rose-50 dark:bg-rose-950", text: "text-rose-700 dark:text-rose-400", ring: "ring-rose-600/15 dark:ring-rose-400/15" },
  critical: { label: "Critical", bg: "bg-rose-50 dark:bg-rose-950", text: "text-rose-700 dark:text-rose-400", ring: "ring-rose-600/15 dark:ring-rose-400/15" },
  low: { label: "Low Stock", bg: "bg-amber-50 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-400", ring: "ring-amber-600/15 dark:ring-amber-400/15" },
  ok: { label: "Healthy", bg: "bg-emerald-50 dark:bg-emerald-950", text: "text-emerald-700 dark:text-emerald-400", ring: "ring-emerald-600/15 dark:ring-emerald-400/15" },
  overstock: { label: "Overstock", bg: "bg-sky-50 dark:bg-sky-950", text: "text-sky-700 dark:text-sky-400", ring: "ring-sky-600/15 dark:ring-sky-400/15" },
  no_sales: { label: "No Sales", bg: "bg-zinc-100 dark:bg-zinc-900", text: "text-zinc-500 dark:text-zinc-500", ring: "ring-zinc-300/30 dark:ring-zinc-600/30" },
};

function UrgencyBadge({ urgency }: { urgency: string }) {
  const cfg = urgencyConfig[urgency] ?? urgencyConfig.no_sales;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${cfg.bg} ${cfg.text} px-2.5 py-1 rounded-full ring-1 ${cfg.ring}`}>
      {cfg.label}
    </span>
  );
}

export function RestockTable({ rows }: { rows: RestockRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sortCol, setSortCol] = useState<"days_of_stock" | "daily_velocity" | "recommended_qty" | "restock_cost">("days_of_stock");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let base = rows;
    if (filter === "restock") base = rows.filter(r => ["out_of_stock", "critical", "low"].includes(r.urgency));
    else if (filter === "ok") base = rows.filter(r => r.urgency === "ok");
    else if (filter === "overstock") base = rows.filter(r => r.urgency === "overstock");
    else if (filter === "no_sales") base = rows.filter(r => r.urgency === "no_sales");

    return [...base].sort((a, b) => {
      const av = a[sortCol] ?? 0;
      const bv = b[sortCol] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [rows, filter, sortCol, sortDir]);

  const restockCount = rows.filter(r => ["out_of_stock", "critical", "low"].includes(r.urgency)).length;
  const okCount = rows.filter(r => r.urgency === "ok").length;
  const overstockCount = rows.filter(r => r.urgency === "overstock").length;
  const noSalesCount = rows.filter(r => r.urgency === "no_sales").length;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: "All", count: rows.length },
    { key: "restock", label: "Restock Now", count: restockCount },
    { key: "ok", label: "Healthy", count: okCount },
    { key: "overstock", label: "Overstock", count: overstockCount },
    { key: "no_sales", label: "No Sales", count: noSalesCount },
  ];

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  const sortArrow = (col: typeof sortCol) =>
    sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ring-1 ${
              filter === f.key
                ? "bg-primary text-primary-foreground ring-primary"
                : "bg-card text-muted-foreground ring-border/50 hover:bg-muted"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[350px]">Product</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Inbound</TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("daily_velocity")}>
                    Velocity{sortArrow("daily_velocity")}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("days_of_stock")}>
                    Days Left{sortArrow("days_of_stock")}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("recommended_qty")}>
                    Order Qty{sortArrow("recommended_qty")}
                  </TableHead>
                  <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort("restock_cost")}>
                    Cost{sortArrow("restock_cost")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      No products in this category
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map(row => (
                  <TableRow key={row.sku} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {row.image_url ? (
                          <Image
                            src={row.image_url}
                            alt={row.title ?? row.sku}
                            width={40}
                            height={40}
                            className="rounded-lg object-cover ring-1 ring-border/50 shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate max-w-[260px]">
                            {row.asin ? (
                              <Link href={`/product/${row.asin}`} className="hover:underline">{row.title ?? "Unknown"}</Link>
                            ) : (row.title ?? "Unknown")}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">{row.asin} · {row.sku}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <UrgencyBadge urgency={row.urgency} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span className={row.fulfillable <= 0 ? "text-rose-600 dark:text-rose-400 font-bold" : row.fulfillable < 10 ? "text-amber-600 dark:text-amber-400" : ""}>
                        {row.fulfillable}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.inbound > 0 ? (
                        <span className="text-sky-600 dark:text-sky-400">+{row.inbound}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.daily_velocity > 0 ? (
                        <span>{row.daily_velocity}/day</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.units_sold_30d === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : row.days_of_stock >= 999 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">999+</span>
                      ) : (
                        <span className={
                          row.days_of_stock <= 7 ? "text-rose-600 dark:text-rose-400 font-bold" :
                          row.days_of_stock <= 21 ? "text-amber-600 dark:text-amber-400" :
                          ""
                        }>
                          {row.days_of_stock}d
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.recommended_qty > 0 ? (
                        <span className="font-semibold">{row.recommended_qty}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {row.restock_cost > 0 ? (
                        <span>£{row.restock_cost.toFixed(0)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
