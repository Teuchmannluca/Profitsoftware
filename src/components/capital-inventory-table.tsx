"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, ArrowUpDown, ArrowUp, ArrowDown, Search, AlertTriangle } from "lucide-react";
import type { CapitalProductRow } from "@/actions/capital-overview";

function fmt(n: number): string {
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CapitalInventoryTable({ rows }: { rows: CapitalProductRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<"none" | "asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  const withStockCount = rows.filter(
    (r) => r.fulfillable + r.reserved + r.unsellable + r.inbound > 0
  ).length;

  const filtered = useMemo(() => {
    let base = showAll
      ? rows
      : rows.filter((r) => r.fulfillable + r.reserved + r.unsellable + r.inbound > 0);

    if (search) {
      const q = search.toLowerCase();
      base = base.filter(
        (r) =>
          r.sku.toLowerCase().includes(q) ||
          (r.asin?.toLowerCase().includes(q) ?? false) ||
          (r.title?.toLowerCase().includes(q) ?? false)
      );
    }

    if (sort === "none") return base;
    return [...base].sort((a, b) =>
      sort === "desc" ? b.totalValue - a.totalValue : a.totalValue - b.totalValue
    );
  }, [rows, showAll, sort, search]);

  function cycleSort() {
    setSort((s) => (s === "none" ? "desc" : s === "desc" ? "asc" : "none"));
  }

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950">
              <Coins className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Capital by Product
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-40 rounded-lg border border-border/80 bg-muted/40 pl-8 pr-3 text-[11px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
            <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5">
              <Button
                variant={showAll ? "ghost" : "default"}
                size="sm"
                onClick={() => setShowAll(false)}
                className="h-7 px-3 text-[11px] rounded-lg font-medium"
              >
                With Stock ({withStockCount})
              </Button>
              <Button
                variant={showAll ? "default" : "ghost"}
                size="sm"
                onClick={() => setShowAll(true)}
                className="h-7 px-3 text-[11px] rounded-lg font-medium"
              >
                All ({rows.length})
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6 w-[60px]">
                  Image
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Product
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  SKU
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                  Fulfillable
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                  Reserved
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                  Unsellable
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                  Inbound
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                  COGS/unit
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right pr-6">
                  <button
                    onClick={cycleSort}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                  >
                    Total Value
                    {sort === "none" && <ArrowUpDown className="h-3 w-3" />}
                    {sort === "desc" && <ArrowDown className="h-3 w-3" />}
                    {sort === "asc" && <ArrowUp className="h-3 w-3" />}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow
                  key={row.sku}
                  className={`group border-border/40 transition-colors ${
                    row.cogs === 0 ? "bg-amber-50/50 dark:bg-amber-950/50" : ""
                  }`}
                >
                  <TableCell className="pl-6">
                    {row.image_url ? (
                      <Image
                        src={row.image_url}
                        alt={row.title ?? row.sku}
                        width={40}
                        height={40}
                        className="rounded-lg object-cover ring-1 ring-border/50"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center ring-1 ring-border/50">
                        <Coins className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="text-xs font-medium text-foreground max-w-[200px] truncate">
                      {row.title ?? "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {row.asin ?? "—"}
                    </p>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.sku}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-foreground">
                    {row.fulfillable}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground">
                    {row.reserved}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground">
                    {row.unsellable}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right text-muted-foreground">
                    {row.inbound}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.cogs > 0 ? (
                      <span className="font-mono text-xs text-foreground">
                        {fmt(row.cogs)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        Missing
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-right font-semibold text-foreground pr-6">
                    {fmt(row.totalValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
