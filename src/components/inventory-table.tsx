"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Warehouse, ArrowUpDown, ArrowUp, ArrowDown, Archive, ArchiveRestore } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { StockBar } from "@/components/stock-bar";
import { setProductActive, setProductsActive } from "@/actions/cogs-action";

interface InventoryRow {
  sku: string;
  asin: string | null;
  fnsku: string | null;
  title: string | null;
  image_url: string | null;
  active: boolean;
  afn_fulfillable: number;
  afn_reserved: number;
  afn_inbound: number;
  afn_unsellable: number;
  total_quantity: number;
}

type ViewMode = "in_stock" | "all" | "archived";

function getStockStatus(row: InventoryRow): string {
  if (row.total_quantity === 0) return "Out of Stock";
  if (row.afn_fulfillable < 10) return "Low Stock";
  return "In Stock";
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("in_stock");
  const [sort, setSort] = useState<"none" | "asc" | "desc">("desc");
  const [archiving, setArchiving] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const activeRows = rows.filter((r) => r.active);
  const inStockCount = activeRows.filter((r) => r.total_quantity > 0).length;
  const archivedCount = rows.filter((r) => !r.active).length;

  const filtered = useMemo(() => {
    let base: InventoryRow[];
    if (view === "archived") {
      base = rows.filter((r) => !r.active);
    } else if (view === "all") {
      base = activeRows;
    } else {
      base = activeRows.filter((r) => r.total_quantity > 0);
    }
    if (sort === "none") return base;
    return [...base].sort((a, b) =>
      sort === "asc"
        ? a.afn_fulfillable - b.afn_fulfillable
        : b.afn_fulfillable - a.afn_fulfillable
    );
  }, [rows, activeRows, view, sort]);

  async function handleArchive(sku: string, active: boolean) {
    setArchiving(sku);
    await setProductActive(sku, active);
    setArchiving(null);
    router.refresh();
  }

  function toggleSelect(sku: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((r) => r.sku)));
    }
  }

  async function handleBulkArchive(active: boolean) {
    const skus = [...selected];
    if (skus.length === 0) return;
    setBulkBusy(true);
    await setProductsActive(skus, active);
    setSelected(new Set());
    setBulkBusy(false);
    router.refresh();
  }

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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950">
              <Warehouse className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            Product Inventory
          </CardTitle>
          <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5">
            <Button
              variant={view === "in_stock" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("in_stock")}
              className="h-7 px-3 text-[11px] rounded-lg font-medium"
            >
              In Stock ({inStockCount})
            </Button>
            <Button
              variant={view === "all" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("all")}
              className="h-7 px-3 text-[11px] rounded-lg font-medium"
            >
              All ({activeRows.length})
            </Button>
            {archivedCount > 0 && (
              <Button
                variant={view === "archived" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("archived")}
                className="h-7 px-3 text-[11px] rounded-lg font-medium"
              >
                <Archive className="h-3 w-3 mr-1" />
                Archived ({archivedCount})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-6 py-2.5 bg-violet-50 dark:bg-violet-950 border-b border-violet-100 dark:border-violet-900">
            <span className="text-xs font-semibold text-violet-700 dark:text-violet-400">
              {selected.size} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkArchive(view === "archived")}
              disabled={bulkBusy}
              className="h-7 text-[11px] rounded-lg"
            >
              {view === "archived" ? (
                <><ArchiveRestore className="h-3 w-3 mr-1" />{bulkBusy ? "Unarchiving..." : "Unarchive Selected"}</>
              ) : (
                <><Archive className="h-3 w-3 mr-1" />{bulkBusy ? "Archiving..." : "Archive Selected"}</>
              )}
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-[11px] text-muted-foreground hover:text-foreground ml-auto"
            >
              Clear selection
            </button>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-violet-50 dark:bg-violet-950 p-4 mb-4">
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
                  <TableHead className="pl-6 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-border accent-violet-600 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-[100px]">Image</TableHead>
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
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pr-6 w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.sku} className={`group border-border/40 transition-colors ${!row.active ? "opacity-50" : ""}`}>
                    <TableCell className="pl-6">
                      <input
                        type="checkbox"
                        checked={selected.has(row.sku)}
                        onChange={() => toggleSelect(row.sku)}
                        className="h-3.5 w-3.5 rounded border-border accent-violet-600 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
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
                    <TableCell>
                      <StatusBadge status={row.active ? getStockStatus(row) : "Archived"} />
                    </TableCell>
                    <TableCell className="pr-6">
                      <button
                        onClick={() => handleArchive(row.sku, !row.active)}
                        disabled={archiving === row.sku}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                        title={row.active ? "Archive product" : "Unarchive product"}
                      >
                        {row.active ? (
                          <Archive className="h-3.5 w-3.5" />
                        ) : (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        )}
                      </button>
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
