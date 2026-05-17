"use client";

import { useState, useMemo, useRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Receipt, Search, Warehouse, Check, X } from "lucide-react";
import { setProductCost, setProductVat } from "@/actions/cogs-action";
import type { ProductCostRow } from "@/app/costs/page";

type FilterMode = "all" | "with_costs" | "missing_costs";

function formatVat(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `£${value.toFixed(2)}`;
}

function vatColor(rate: number): string {
  if (rate === 0) return "bg-slate-50 text-slate-700 ring-slate-600/20";
  if (rate <= 0.05) return "bg-sky-50 text-sky-700 ring-sky-600/20";
  return "bg-indigo-50 text-indigo-700 ring-indigo-600/20";
}

function EditableMoneyCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (val: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setInputVal(value?.toString() ?? "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function save() {
    const num = parseFloat(inputVal);
    if (isNaN(num) || num < 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(num);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground font-medium">£</span>
        <Input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={save}
          autoFocus
          disabled={saving}
          className="h-8 w-24 font-mono text-xs px-2 rounded-lg border-indigo-200 focus-visible:ring-indigo-500"
        />
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className={`font-mono text-xs text-left cursor-pointer hover:bg-indigo-50 rounded-lg px-2 py-1 -mx-1 transition-colors ${
        value === null ? "text-muted-foreground/40 italic" : "text-foreground font-medium"
      }`}
    >
      {formatMoney(value)}
    </button>
  );
}

function VatCell({
  sku,
  rate,
  onSave,
}: {
  sku: string;
  rate: number;
  onSave: (sku: string, rate: number) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRate = parseFloat(e.target.value);
    setSaving(true);
    await onSave(sku, newRate);
    setSaving(false);
  }

  return (
    <select
      value={rate.toString()}
      onChange={handleChange}
      disabled={saving}
      className="h-8 w-20 rounded-lg border border-border bg-card px-2 text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 disabled:opacity-50 transition-all"
    >
      <option value="0">0%</option>
      <option value="0.05">5%</option>
      <option value="0.2">20%</option>
    </select>
  );
}

export function CogsTable({ rows }: { rows: ProductCostRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");

  const withCostsCount = rows.filter((r) => r.unit_cost !== null).length;
  const missingCostsCount = rows.length - withCostsCount;
  const progressPct = rows.length > 0 ? (withCostsCount / rows.length) * 100 : 0;

  const filteredRows = useMemo(() => {
    let result = rows;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.asin?.toLowerCase().includes(q) ||
          r.sku?.toLowerCase().includes(q)
      );
    }

    if (filter === "with_costs") {
      result = result.filter((r) => r.unit_cost !== null);
    } else if (filter === "missing_costs") {
      result = result.filter((r) => r.unit_cost === null);
    }

    return result;
  }, [rows, search, filter]);

  async function handleCostSave(
    row: ProductCostRow,
    field: "unit_cost" | "prep_cost",
    value: number
  ) {
    if (!row.asin) return;
    const unitCost = field === "unit_cost" ? value : row.unit_cost ?? 0;
    const prepCost = field === "prep_cost" ? value : row.prep_cost ?? 0;
    await setProductCost(row.asin, unitCost, prepCost);
    router.refresh();
  }

  async function handleVatSave(sku: string, rate: number) {
    await setProductVat(sku, rate);
    router.refresh();
  }

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
              <Receipt className="h-4 w-4 text-emerald-600" />
            </div>
            Cost of Goods Sold
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {withCostsCount} of {rows.length}
            </span>
            <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-emerald transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by product, ASIN, or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9 rounded-xl border-border/80 focus-visible:ring-indigo-500/20"
            />
          </div>
          <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-[11px] rounded-lg font-medium"
              onClick={() => setFilter("all")}
            >
              All ({rows.length})
            </Button>
            <Button
              variant={filter === "with_costs" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-[11px] rounded-lg font-medium"
              onClick={() => setFilter("with_costs")}
            >
              <Check className="h-3 w-3 mr-1" />
              With Costs ({withCostsCount})
            </Button>
            <Button
              variant={filter === "missing_costs" ? "default" : "ghost"}
              size="sm"
              className="h-7 px-3 text-[11px] rounded-lg font-medium"
              onClick={() => setFilter("missing_costs")}
            >
              <X className="h-3 w-3 mr-1" />
              Missing ({missingCostsCount})
            </Button>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-emerald-50 p-4 mb-4">
              <Receipt className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No products found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              {search ? "Try adjusting your search" : "Sync inventory first to load products"}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6 w-[120px]">Image</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ASIN</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Unit Cost</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prep Fee</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total COGS</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pr-6">VAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.sku} className="group border-border/40 transition-colors">
                    <TableCell className="pl-6">
                      {row.image_url ? (
                        <Image
                          src={row.image_url}
                          alt={row.title ?? row.sku}
                          width={96}
                          height={96}
                          className="rounded-xl object-cover ring-1 ring-border/50"
                        />
                      ) : (
                        <div className="h-[96px] w-[96px] rounded-xl bg-muted flex items-center justify-center ring-1 ring-border/50">
                          <Warehouse className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground max-w-[240px] truncate">
                        {row.title ?? "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {row.sku}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.asin ? (
                        <a
                          href={`https://www.amazon.co.uk/dp/${row.asin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                        >
                          {row.asin}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <EditableMoneyCell
                        value={row.unit_cost}
                        onSave={(val) => handleCostSave(row, "unit_cost", val)}
                      />
                    </TableCell>
                    <TableCell>
                      <EditableMoneyCell
                        value={row.prep_cost}
                        onSave={(val) => handleCostSave(row, "prep_cost", val)}
                      />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-mono text-xs font-semibold ${
                          row.total_cogs === null ? "text-muted-foreground/40 font-normal italic" : "text-foreground"
                        }`}
                      >
                        {formatMoney(row.total_cogs)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6">
                      <VatCell
                        sku={row.sku}
                        rate={row.vat_rate}
                        onSave={handleVatSave}
                      />
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
