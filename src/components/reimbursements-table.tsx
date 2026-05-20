"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Search, Coins } from "lucide-react";

interface ReimbursementRow {
  id: string;
  reason: string | null;
  asin: string | null;
  sku: string | null;
  quantity: number;
  amount: number;
  currency: string;
  status: string;
  claim_id: string | null;
  event_date: string | null;
  source_type: string | null;
}

function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

function reasonLabel(reason: string | null): { text: string; color: string } {
  if (!reason) return { text: "Unknown", color: "bg-muted text-muted-foreground" };
  const r = reason.toLowerCase();
  if (r.includes("lost") || r.includes("warehouse"))
    return { text: reason, color: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-1 ring-rose-600/15 dark:ring-rose-400/15" };
  if (r.includes("damaged") || r.includes("customer_return"))
    return { text: reason, color: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 ring-1 ring-amber-600/15 dark:ring-amber-400/15" };
  if (r.includes("fee") || r.includes("correction"))
    return { text: reason, color: "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 ring-1 ring-sky-600/15 dark:ring-sky-400/15" };
  if (r.includes("reversal") || r.includes("clawback"))
    return { text: reason, color: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-1 ring-rose-600/15 dark:ring-rose-400/15" };
  if (r.includes("safe"))
    return { text: reason, color: "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-600/15 dark:ring-indigo-400/15" };
  return { text: reason, color: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-600/15 dark:ring-emerald-400/15" };
}

export function ReimbursementsTable({ rows }: { rows: ReimbursementRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.reason ?? "").toLowerCase().includes(q) ||
        (r.sku ?? "").toLowerCase().includes(q) ||
        (r.asin ?? "").toLowerCase().includes(q) ||
        (r.claim_id ?? "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalAmount = filtered.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            Reimbursements
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filtered.length} events · {formatMoney(totalAmount)}
            </span>
          </CardTitle>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by reason, SKU, ASIN, or claim ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs h-9 rounded-xl border-border/80"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-4 mb-4">
              <Coins className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No reimbursements found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click Sync to pull reimbursement data from Amazon
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="text-left py-2.5 pl-6">Date</th>
                <th className="text-left py-2.5 px-3">Reason</th>
                <th className="text-left py-2.5 px-3">SKU / ASIN</th>
                <th className="text-right py-2.5 px-3">Qty</th>
                <th className="text-right py-2.5 px-3">Amount</th>
                <th className="text-left py-2.5 px-3">Status</th>
                <th className="text-left py-2.5 pr-6">Claim ID</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const rl = reasonLabel(row.reason);
                return (
                  <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-3 pl-6 text-xs text-muted-foreground whitespace-nowrap">
                      {row.event_date
                        ? new Date(row.event_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full ${rl.color}`}>
                        {rl.text}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs font-mono">
                        {row.sku && <span className="text-foreground">{row.sku}</span>}
                        {row.asin && (
                          <span className="text-muted-foreground ml-1">
                            {row.sku ? `· ${row.asin}` : row.asin}
                          </span>
                        )}
                        {!row.sku && !row.asin && <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-xs font-mono font-semibold">
                      {row.quantity}
                    </td>
                    <td className={`py-3 px-3 text-right text-xs font-mono font-semibold ${row.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                      {formatMoney(row.amount)}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={row.status === "completed" ? "Completed" : "Pending"} />
                    </td>
                    <td className="py-3 pr-6 text-xs font-mono text-muted-foreground">
                      {row.claim_id ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
