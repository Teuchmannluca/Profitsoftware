"use client";

import { useState, useMemo, useRef, Fragment } from "react";
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
import { Receipt, Search, Warehouse, Check, X, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { setProductCost, setProductVat, addCogsPeriod } from "@/actions/cogs-action";
import type { ProductCostRow, CogsPeriodRow } from "@/app/costs/page";

type FilterMode = "all" | "with_costs" | "missing_costs";

function formatVat(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function formatMoney(value: number | null): string {
  if (value === null) return "—";
  return `£${value.toFixed(2)}`;
}

function vatColor(rate: number): string {
  if (rate === 0) return "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400 ring-slate-600/20 dark:ring-slate-400/20";
  if (rate <= 0.05) return "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 ring-sky-600/20 dark:ring-sky-400/20";
  return "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 ring-indigo-600/20 dark:ring-indigo-400/20";
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
      className={`font-mono text-xs text-left cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg px-2 py-1 -mx-1 transition-colors ${
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

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CogsPeriodPanel({
  row,
  history,
  onSaved,
}: {
  row: ProductCostRow;
  history: CogsPeriodRow[];
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [validFrom, setValidFrom] = useState(today);
  const [unitCost, setUnitCost] = useState(row.unit_cost?.toString() ?? "");
  const [prepCost, setPrepCost] = useState(row.prep_cost?.toString() ?? "0");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!row.asin) return;
    const uc = parseFloat(unitCost);
    const pc = parseFloat(prepCost);
    if (isNaN(uc) || uc < 0 || isNaN(pc) || pc < 0) return;
    setSaving(true);
    await addCogsPeriod({ asin: row.asin, unitCost: uc, prepCost: pc, validFrom });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="px-6 py-4 space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            Effective from
          </label>
          <Input
            type="date"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
            className="h-8 w-40 text-xs font-mono rounded-lg"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            Unit Cost
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">£</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className="h-8 w-24 font-mono text-xs px-2 rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
            Prep Fee
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">£</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={prepCost}
              onChange={(e) => setPrepCost(e.target.value)}
              className="h-8 w-24 font-mono text-xs px-2 rounded-lg"
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !row.asin}
          className="h-8 text-xs rounded-lg"
        >
          <Plus className="h-3 w-3 mr-1" />
          {saving ? "Saving..." : "New Cost Period"}
        </Button>
      </div>

      {history.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Cost History
          </p>
          <div className="space-y-1">
            {history.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 text-xs font-mono py-1"
              >
                <span className="font-semibold w-16 text-right">
                  £{p.total_cogs.toFixed(2)}
                </span>
                <span className="text-muted-foreground text-[10px]">
                  (£{p.unit_cost.toFixed(2)} + £{p.prep_cost.toFixed(2)})
                </span>
                <span className="text-muted-foreground">
                  {formatDate(p.valid_from)} → {p.valid_to ? formatDate(p.valid_to) : "current"}
                </span>
                {!p.valid_to && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-600/15 dark:ring-emerald-400/15">
                    active
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CogsTable({ rows, historyByAsin }: { rows: ProductCostRow[]; historyByAsin: Record<string, CogsPeriodRow[]> }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpand(sku: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
              <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
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
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-950 p-4 mb-4">
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
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-4 w-8" />
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-[120px]">Image</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Product</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ASIN</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Unit Cost</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Prep Fee</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total COGS</TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pr-6">VAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const isOpen = expanded.has(row.sku);
                  const history = row.asin ? (historyByAsin[row.asin] ?? []) : [];
                  return (
                  <Fragment key={row.sku}>
                  <TableRow className="group border-border/40 transition-colors">
                    <TableCell className="pl-4">
                      <button
                        onClick={() => toggleExpand(row.sku)}
                        className="p-1 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {isOpen ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      {row.image_url ? (
                        <Image
                          src={row.image_url}
                          alt={row.title ?? row.sku}
                          width={96}
                          height={96}
                          className="rounded-xl object-cover ring-1 ring-border/50 w-auto h-auto"
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
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-400 hover:underline transition-colors"
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
                  {isOpen && (
                    <TableRow className="border-border/30 bg-muted/20 hover:bg-muted/20">
                      <TableCell colSpan={8} className="p-0">
                        <CogsPeriodPanel
                          row={row}
                          history={history}
                          onSaved={() => router.refresh()}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
