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
        <span className="text-xs text-muted-foreground">£</span>
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
          className="h-7 w-20 font-mono text-xs px-1.5"
        />
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className={`font-mono text-xs text-left cursor-pointer hover:bg-muted/50 rounded px-1.5 py-1 -mx-1.5 transition-colors ${
        value === null ? "text-muted-foreground/50 italic" : ""
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
      className="h-7 w-16 rounded border bg-background px-1.5 text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Cost of Goods Sold
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {withCostsCount} of {rows.length} products have costs
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by product, ASIN, or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
          <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2.5 text-[11px] rounded-md"
              onClick={() => setFilter("all")}
            >
              All ({rows.length})
            </Button>
            <Button
              variant={filter === "with_costs" ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2.5 text-[11px] rounded-md"
              onClick={() => setFilter("with_costs")}
            >
              <Check className="h-3 w-3 mr-1" />
              With Costs ({withCostsCount})
            </Button>
            <Button
              variant={filter === "missing_costs" ? "default" : "ghost"}
              size="sm"
              className="h-6 px-2.5 text-[11px] rounded-md"
              onClick={() => setFilter("missing_costs")}
            >
              <X className="h-3 w-3 mr-1" />
              Missing ({missingCostsCount})
            </Button>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No products found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? "Try adjusting your search" : "Sync inventory first to load products"}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[70px]">Image</TableHead>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs">ASIN</TableHead>
                  <TableHead className="text-xs">Unit Cost</TableHead>
                  <TableHead className="text-xs">Prep Fee</TableHead>
                  <TableHead className="text-xs">Total COGS</TableHead>
                  <TableHead className="text-xs">VAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.sku}>
                    <TableCell>
                      {row.image_url ? (
                        <Image
                          src={row.image_url}
                          alt={row.title ?? row.sku}
                          width={50}
                          height={50}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="h-[50px] w-[50px] rounded bg-muted flex items-center justify-center">
                          <Warehouse className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs truncate max-w-[220px]">
                        {row.title ?? "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {row.sku}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.asin ?? "—"}
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
                          row.total_cogs === null ? "text-muted-foreground/50 font-normal italic" : ""
                        }`}
                      >
                        {formatMoney(row.total_cogs)}
                      </span>
                    </TableCell>
                    <TableCell>
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
