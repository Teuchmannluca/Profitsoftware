"use client";

import { Fragment, useState } from "react";
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
import { Receipt, ChevronDown, ChevronRight, Pencil, Trash2, Check, X, Warehouse } from "lucide-react";
import { updateCogsPeriod, deleteCogsPeriod } from "@/actions/cogs-action";

export interface CogsPeriodRow {
  id: string;
  asin: string;
  unit_cost: number;
  prep_cost: number;
  total_cogs: number;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  currency: string;
  created_at: string;
  title: string | null;
  image_url: string | null;
}

function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

function EditRow({
  period,
  onCancel,
  onSaved,
}: {
  period: CogsPeriodRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [unitCost, setUnitCost] = useState(period.unit_cost.toString());
  const [prepCost, setPrepCost] = useState(period.prep_cost.toString());
  const [notes, setNotes] = useState(period.notes ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setLoading(true);
    await updateCogsPeriod(period.id, {
      unitCost: parseFloat(unitCost),
      prepCost: parseFloat(prepCost || "0"),
      notes: notes || undefined,
    });
    setLoading(false);
    onSaved();
  }

  return (
    <TableRow className="bg-muted/30">
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
          className="h-7 w-20 font-mono text-xs"
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.01"
          value={prepCost}
          onChange={(e) => setPrepCost(e.target.value)}
          className="h-7 w-20 font-mono text-xs"
        />
      </TableCell>
      <TableCell className="font-mono text-xs">
        {formatMoney(parseFloat(unitCost || "0") + parseFloat(prepCost || "0"))}
      </TableCell>
      <TableCell className="text-xs">{period.valid_from}</TableCell>
      <TableCell>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-7 w-32 text-xs"
          placeholder="Notes"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleSave}
            disabled={loading}
          >
            <Check className="h-3.5 w-3.5 text-green-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function HistoryRow({
  period,
  onRefresh,
}: {
  period: CogsPeriodRow;
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await deleteCogsPeriod(period.id);
    setDeleting(false);
    onRefresh();
  }

  if (editing) {
    return (
      <EditRow
        period={period}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onRefresh();
        }}
      />
    );
  }

  return (
    <TableRow className="bg-muted/20">
      <TableCell />
      <TableCell />
      <TableCell />
      <TableCell className="font-mono text-xs">
        {formatMoney(period.unit_cost)}
      </TableCell>
      <TableCell className="font-mono text-xs">
        {formatMoney(period.prep_cost)}
      </TableCell>
      <TableCell className="font-mono text-xs font-semibold">
        {formatMoney(period.total_cogs)}
      </TableCell>
      <TableCell className="text-xs">
        {period.valid_from}
        {period.valid_to && (
          <span className="text-muted-foreground"> to {period.valid_to}</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
        {period.notes ?? "—"}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CogsTable({ rows }: { rows: CogsPeriodRow[] }) {
  const router = useRouter();
  const [expandedAsins, setExpandedAsins] = useState<Set<string>>(new Set());

  // Group rows by ASIN
  const grouped = rows.reduce<Record<string, CogsPeriodRow[]>>((acc, row) => {
    if (!acc[row.asin]) acc[row.asin] = [];
    acc[row.asin].push(row);
    return acc;
  }, {});

  // Sort periods within each group by valid_from desc
  for (const asin of Object.keys(grouped)) {
    grouped[asin].sort(
      (a, b) => new Date(b.valid_from).getTime() - new Date(a.valid_from).getTime()
    );
  }

  // Sort groups by latest period's valid_from desc
  const sortedAsins = Object.keys(grouped).sort((a, b) => {
    const latestA = grouped[a][0].valid_from;
    const latestB = grouped[b][0].valid_from;
    return new Date(latestB).getTime() - new Date(latestA).getTime();
  });

  function toggleExpand(asin: string) {
    setExpandedAsins((prev) => {
      const next = new Set(prev);
      if (next.has(asin)) {
        next.delete(asin);
      } else {
        next.add(asin);
      }
      return next;
    });
  }

  function handleRefresh() {
    router.refresh();
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
        {sortedAsins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Receipt className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No cost data yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Add Cost&quot; to add your first cost period
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-8" />
                  <TableHead className="text-xs w-[60px]">Image</TableHead>
                  <TableHead className="text-xs">Product / ASIN</TableHead>
                  <TableHead className="text-xs">Unit Cost</TableHead>
                  <TableHead className="text-xs">Prep Fee</TableHead>
                  <TableHead className="text-xs">Total COGS</TableHead>
                  <TableHead className="text-xs">Valid From</TableHead>
                  <TableHead className="text-xs">Notes</TableHead>
                  <TableHead className="text-xs w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAsins.map((asin) => {
                  const periods = grouped[asin];
                  const latest = periods[0];
                  const isExpanded = expandedAsins.has(asin);
                  const hasHistory = periods.length > 1;

                  return (
                    <Fragment key={asin}>
                      {/* Main row - latest period */}
                      <TableRow
                        className={`cursor-pointer ${hasHistory ? "hover:bg-muted/40" : ""}`}
                        onClick={() => hasHistory && toggleExpand(asin)}
                      >
                        <TableCell className="w-8">
                          {hasHistory && (
                            isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )
                          )}
                        </TableCell>
                        <TableCell>
                          {latest.image_url ? (
                            <Image
                              src={latest.image_url}
                              alt={latest.title ?? asin}
                              width={40}
                              height={40}
                              className="rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                              <Warehouse className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-xs truncate max-w-[200px]">
                              {latest.title ?? "Untitled"}
                            </p>
                            <p className="text-[11px] font-mono text-muted-foreground">
                              {asin}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatMoney(latest.unit_cost)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {formatMoney(latest.prep_cost)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                          {formatMoney(latest.total_cogs)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {latest.valid_from}
                          {!latest.valid_to && (
                            <span className="ml-1.5 text-[10px] text-green-500 font-medium">
                              Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {latest.notes ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => toggleExpand(asin)}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Expanded history rows */}
                      {isExpanded &&
                        periods.map((period) => (
                          <HistoryRow
                            key={period.id}
                            period={period}
                            onRefresh={handleRefresh}
                          />
                        ))}
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

