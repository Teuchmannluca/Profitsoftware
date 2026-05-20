"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RotateCcw, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReturnRow {
  id: string;
  amazon_order_id: string;
  asin: string | null;
  sku: string | null;
  item_name: string | null;
  return_quantity: number;
  return_reason: string | null;
  return_request_date: string;
  refunded_amount: number | null;
  return_status: string | null;
  resolution: string | null;
  in_policy: boolean | null;
}

const statusStyles: Record<string, string> = {
  Refunded: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-rose-600/20 dark:ring-rose-400/20",
  Pending: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 ring-amber-600/20 dark:ring-amber-400/20",
  Completed: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 dark:ring-emerald-400/20",
};

const defaultStatusStyle = "bg-muted text-muted-foreground ring-border";

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset",
        statusStyles[status] ?? defaultStatusStyle
      )}
    >
      {status}
    </span>
  );
}

export function ReturnsTable({ rows }: { rows: ReturnRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.amazon_order_id.toLowerCase().includes(q) ||
        (r.asin?.toLowerCase().includes(q) ?? false) ||
        (r.sku?.toLowerCase().includes(q) ?? false) ||
        (r.return_reason?.toLowerCase().includes(q) ?? false) ||
        (r.item_name?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort(
      (a, b) =>
        new Date(b.return_request_date).getTime() -
        new Date(a.return_request_date).getTime()
    );
  }, [filtered]);

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950">
              <RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            Returns
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              placeholder="Search orders, ASINs, reasons..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[260px] pl-8 text-xs rounded-lg border-border/80"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950 p-4 mb-4">
              <RotateCcw className="h-6 w-6 text-rose-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No returns found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Click Sync Returns to pull refund data from Amazon
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6">
                    Date
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Product
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ASIN
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Order ID
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Reason
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                    Qty
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                    Refunded
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pr-6 text-center">
                    In Policy
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow
                    key={row.id}
                    className="group border-border/40 transition-colors"
                  >
                    <TableCell className="text-xs text-muted-foreground pl-6">
                      {new Date(row.return_request_date).toLocaleDateString(
                        "en-GB",
                        { day: "2-digit", month: "short", year: "numeric" }
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground max-w-[180px] truncate">
                        {row.item_name ?? row.sku ?? "---"}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.asin ?? "---"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground font-medium">
                      {row.amazon_order_id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      {row.return_reason ?? "---"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-muted-foreground">
                      {row.return_quantity}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right text-foreground font-medium">
                      {row.refunded_amount != null
                        ? `£${row.refunded_amount.toFixed(2)}`
                        : "---"}
                    </TableCell>
                    <TableCell>
                      {row.return_status ? (
                        <StatusBadge status={row.return_status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">---</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-center">
                      {row.in_policy === true ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : row.in_policy === false ? (
                        <X className="h-4 w-4 text-rose-500 mx-auto" />
                      ) : (
                        <span className="text-xs text-muted-foreground">---</span>
                      )}
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
