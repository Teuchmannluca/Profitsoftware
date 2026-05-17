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
import { Warehouse, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { StockBar } from "@/components/stock-bar";

interface InventoryRow {
  sku: string;
  asin: string | null;
  fnsku: string | null;
  title: string | null;
  image_url: string | null;
  afn_fulfillable: number;
  afn_reserved: number;
  afn_inbound: number;
  afn_unsellable: number;
  total_quantity: number;
}

function getStockStatus(row: InventoryRow): string {
  if (row.total_quantity === 0) return "Out of Stock";
  if (row.afn_fulfillable < 10) return "Low Stock";
  return "In Stock";
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<"none" | "asc" | "desc">("desc");

  const inStockCount = rows.filter((r) => r.total_quantity > 0).length;

  const filtered = useMemo(() => {
    const base = showAll ? rows : rows.filter((r) => r.total_quantity > 0);
    if (sort === "none") return base;
    return [...base].sort((a, b) =>
      sort === "asc"
        ? a.afn_fulfillable - b.afn_fulfillable
        : b.afn_fulfillable - a.afn_fulfillable
    );
  }, [rows, showAll, sort]);

  function cycleSort() {
    setSort((s) => (s === "none" ? "desc" : s === "desc" ? "asc" : "none"));
  }

  const maxQty = useMemo(() => {
    return Math.max(...rows.map((r) => r.total_quantity), 1);
  }, [rows]);

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
              <Warehouse className="h-4 w-4 text-violet-600" />
            </div>
            Product Inventory
          </CardTitle>
          <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5">
            <Button
              variant={showAll ? "ghost" : "default"}
              size="sm"
              onClick={() => setShowAll(false)}
              className="h-7 px-3 text-[11px] rounded-lg font-medium"
            >
              In Stock ({inStockCount})
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
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-violet-50 p-4 mb-4">
              <Warehouse className="h-6 w-6 text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No products synced</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Click Sync Inventory to pull products from Amazon
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6 w-[100px]">Image</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">SKU</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ASIN</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <button onClick={cycleSort} className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer">
                      Fulfillable
                      {sort === "none" && <ArrowUpDown className="h-3 w-3" />}
                      {sort === "desc" && <ArrowDown className="h-3 w-3" />}
                      {sort === "asc" && <ArrowUp className="h-3 w-3" />}
                    </button>
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Reserved</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Inbound</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">Unsellable</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.sku} className="group border-border/40 transition-colors">
                    <TableCell className="pl-6">
                      {row.image_url ? (
                        <Image
                          src={row.image_url}
                          alt={row.title ?? row.sku}
                          width={60}
                          height={60}
                          className="rounded-xl object-cover ring-1 ring-border/50"
                        />
                      ) : (
                        <div className="h-[60px] w-[60px] rounded-xl bg-muted flex items-center justify-center ring-1 ring-border/50">
                          <Warehouse className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground max-w-[200px] truncate">
                        {row.title ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.sku}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.asin ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StockBar value={row.afn_fulfillable} max={maxQty} />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {row.afn_reserved}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {row.afn_inbound}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {row.afn_unsellable}
                    </TableCell>
                    <TableCell className="pr-6">
                      <StatusBadge status={getStockStatus(row)} />
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
