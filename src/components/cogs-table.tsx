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
import { Input } from "@/components/ui/input";
import { Receipt, Search, Warehouse } from "lucide-react";
import { setProductCost, setProductVat } from "@/actions/cogs-action";
import type { ProductCostRow } from "@/app/costs/page";

type FilterMode = "all" | "with_costs" | "missing_costs";

interface EditingCell {
  sku: string;
  field: "unit_cost" | "prep_cost" | "vat";
}

export function CogsTable({ rows }: { rows: ProductCostRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredRows = useMemo(() => {
    let result = rows;

    // Apply search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.asin?.toLowerCase().includes(q)
      );
    }

    // Apply cost filter
    if (filter === "with_costs") {
      result = result.filter((r) => r.unit_cost !== null);
    } else if (filter === "missing_costs") {
      result = result.filter((r) => r.unit_cost === null);
    }

    return result;
  }, [rows, search, filter]);

  function startEdit(sku: string, field: EditingCell["field"], currentValue: string) {
    setEditing({ sku, field });
    setEditValue(currentValue);
  }

  async function saveEdit(row: ProductCostRow) {
    if (!editing || saving) return;
    setSaving(true);

    try {
      if (editing.field === "vat") {
        await setProductVat(row.sku, parseFloat(editValue));
      } else {
        const unitCost =
          editing.field === "unit_cost"
            ? parseFloat(editValue) || 0
            : row.unit_cost ?? 0;
        const prepCost =
          editing.field === "prep_cost"
            ? parseFloat(editValue) || 0
            : row.prep_cost ?? 0;

        if (row.asin) {
          await setProductCost(row.asin, unitCost, prepCost);
        }
      }
      router.refresh();
    } finally {
      setSaving(false);
      setEditing(null);
      setEditValue("");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, row: ProductCostRow) {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit(row);
    } else if (e.key === "Escape") {
      setEditing(null);
      setEditValue("");
    }
  }

  function formatMoney(value: number | null): string {
    if (value === null) return "—";
    return `£${value.toFixed(2)}`;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Cost of Goods Sold
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search and Filter controls */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by product name or ASIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={filter === "all" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "with_costs" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => setFilter("with_costs")}
            >
              With Costs
            </Button>
            <Button
              variant={filter === "missing_costs" ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => setFilter("missing_costs")}
            >
              Missing Costs
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
              {search
                ? "Try adjusting your search query"
                : "No products available"}
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[85px]">Image</TableHead>
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
                    {/* Image */}
                    <TableCell>
                      {row.image_url ? (
                        <Image
                          src={row.image_url}
                          alt={row.title ?? "Product"}
                          width={85}
                          height={85}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-[85px] w-[85px] items-center justify-center rounded bg-muted">
                          <Warehouse className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>

                    {/* Product title */}
                    <TableCell>
                      <p className="text-xs truncate max-w-[220px]">
                        {row.title ?? "Untitled"}
                      </p>
                    </TableCell>

                    {/* ASIN */}
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {row.asin ?? "—"}
                      </span>
                    </TableCell>

                    {/* Unit Cost - inline editable */}
                    <TableCell
                      className={`cursor-pointer ${
                        editing?.sku === row.sku && editing?.field === "unit_cost"
                          ? "ring-1 ring-primary rounded"
                          : ""
                      }`}
                      onClick={() => {
                        if (
                          !(editing?.sku === row.sku && editing?.field === "unit_cost")
                        ) {
                          startEdit(
                            row.sku,
                            "unit_cost",
                            row.unit_cost?.toString() ?? ""
                          );
                        }
                      }}
                    >
                      {editing?.sku === row.sku && editing?.field === "unit_cost" ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, row)}
                          onBlur={() => saveEdit(row)}
                          autoFocus
                          disabled={saving}
                          className="h-7 w-20 font-mono text-xs"
                        />
                      ) : (
                        <span
                          className={`font-mono text-xs ${
                            row.unit_cost === null ? "text-muted-foreground" : ""
                          }`}
                        >
                          {formatMoney(row.unit_cost)}
                        </span>
                      )}
                    </TableCell>

                    {/* Prep Fee - inline editable */}
                    <TableCell
                      className={`cursor-pointer ${
                        editing?.sku === row.sku && editing?.field === "prep_cost"
                          ? "ring-1 ring-primary rounded"
                          : ""
                      }`}
                      onClick={() => {
                        if (
                          !(editing?.sku === row.sku && editing?.field === "prep_cost")
                        ) {
                          startEdit(
                            row.sku,
                            "prep_cost",
                            row.prep_cost?.toString() ?? ""
                          );
                        }
                      }}
                    >
                      {editing?.sku === row.sku && editing?.field === "prep_cost" ? (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, row)}
                          onBlur={() => saveEdit(row)}
                          autoFocus
                          disabled={saving}
                          className="h-7 w-20 font-mono text-xs"
                        />
                      ) : (
                        <span
                          className={`font-mono text-xs ${
                            row.prep_cost === null ? "text-muted-foreground" : ""
                          }`}
                        >
                          {formatMoney(row.prep_cost)}
                        </span>
                      )}
                    </TableCell>

                    {/* Total COGS - not editable */}
                    <TableCell>
                      <span
                        className={`font-mono text-xs font-semibold ${
                          row.total_cogs === null ? "text-muted-foreground font-normal" : ""
                        }`}
                      >
                        {formatMoney(row.total_cogs)}
                      </span>
                    </TableCell>

                    {/* VAT - inline editable select */}
                    <TableCell
                      className={`cursor-pointer ${
                        editing?.sku === row.sku && editing?.field === "vat"
                          ? "ring-1 ring-primary rounded"
                          : ""
                      }`}
                      onClick={() => {
                        if (
                          !(editing?.sku === row.sku && editing?.field === "vat")
                        ) {
                          startEdit(row.sku, "vat", row.vat_rate.toString());
                        }
                      }}
                    >
                      {editing?.sku === row.sku && editing?.field === "vat" ? (
                        <select
                          value={editValue}
                          onChange={(e) => {
                            setEditValue(e.target.value);
                            // Save immediately on change
                            setSaving(true);
                            setProductVat(row.sku, parseFloat(e.target.value))
                              .then(() => {
                                router.refresh();
                              })
                              .finally(() => {
                                setSaving(false);
                                setEditing(null);
                                setEditValue("");
                              });
                          }}
                          onBlur={() => {
                            setEditing(null);
                            setEditValue("");
                          }}
                          autoFocus
                          disabled={saving}
                          className="h-7 w-16 rounded border bg-background px-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="20">20%</option>
                        </select>
                      ) : (
                        <span className="text-xs">{row.vat_rate}%</span>
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
