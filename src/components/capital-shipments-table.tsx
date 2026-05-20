"use client";

import { useState, useMemo, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, ChevronDown, ChevronRight, Search, Package } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import type { CapitalShipmentRow } from "@/actions/capital-overview";

function fmt(n: number): string {
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ProgressBar({ shipped, received }: { shipped: number; received: number }) {
  const pct = shipped > 0 ? Math.round((received / shipped) * 100) : 0;
  const color =
    pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-sky-500" : pct > 0 ? "bg-amber-500" : "bg-muted";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted/60">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-mono">{pct}%</span>
    </div>
  );
}

export function CapitalShipmentsTable({
  shipments,
}: {
  shipments: CapitalShipmentRow[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return shipments;
    const q = search.toLowerCase();
    return shipments.filter(
      (s) =>
        s.shipmentName.toLowerCase().includes(q) ||
        s.shipmentId.toLowerCase().includes(q) ||
        s.destinationFcId.toLowerCase().includes(q) ||
        s.items.some((i) => i.sellerSku.toLowerCase().includes(q))
    );
  }, [shipments, search]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const activeShipments = shipments.filter(
    (s) => s.status !== "CLOSED" && s.status !== "CANCELLED"
  );
  const activeCount = activeShipments.length;
  const totalUnitsInTransit = activeShipments.reduce(
    (sum, s) => sum + s.totalUnitsShipped - s.totalUnitsReceived,
    0
  );
  const totalValue = filtered.reduce((sum, s) => sum + s.totalValue, 0);
  const totalUnitsShipped = filtered.reduce((sum, s) => sum + s.totalUnitsShipped, 0);

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950">
              <Truck className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            Inbound Shipments
            {activeCount > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400 ring-1 ring-sky-600/15 dark:ring-sky-400/15">
                {activeCount} active
              </span>
            )}
            {totalUnitsShipped > 0 && (
              <span className="ml-1 inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-950 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-400 ring-1 ring-violet-600/15 dark:ring-violet-400/15">
                {totalUnitsShipped} units · {fmt(totalValue)}
              </span>
            )}
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search shipments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48 rounded-lg border border-border/80 bg-muted/40 pl-8 pr-3 text-[11px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-sky-50 dark:bg-sky-950 p-4 mb-4">
              <Package className="h-6 w-6 text-sky-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">No shipments found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              Click Sync Shipments to pull inbound data from Amazon
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-6 w-8" />
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Shipment
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    ID
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Destination
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                    Shipped
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                    Received
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Progress
                  </TableHead>
                  <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right pr-6">
                    Value
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((shipment) => {
                  const isOpen = expanded.has(shipment.shipmentId);
                  return (
                    <Fragment key={shipment.shipmentId}>
                      <TableRow
                        className="group border-border/40 transition-colors cursor-pointer hover:bg-muted/30"
                        onClick={() => toggleExpand(shipment.shipmentId)}
                      >
                        <TableCell className="pl-6">
                          {isOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-medium text-foreground truncate max-w-[180px]">
                            {shipment.shipmentName}
                          </p>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">
                          {shipment.shipmentId}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={shipment.status} />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {shipment.destinationFcId}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-foreground">
                          {shipment.totalUnitsShipped}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-foreground">
                          {shipment.totalUnitsReceived}
                        </TableCell>
                        <TableCell>
                          <ProgressBar
                            shipped={shipment.totalUnitsShipped}
                            received={shipment.totalUnitsReceived}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right font-semibold text-foreground pr-6">
                          {fmt(shipment.totalValue)}
                        </TableCell>
                      </TableRow>
                      {isOpen &&
                        shipment.items.map((item) => (
                          <TableRow
                            key={`${shipment.shipmentId}-${item.sellerSku}`}
                            className="border-border/30 bg-muted/20"
                          >
                            <TableCell className="pl-6" />
                            <TableCell colSpan={2}>
                              <div className="pl-4">
                                <p className="text-[11px] text-foreground truncate max-w-[280px]">
                                  {item.title ?? item.sellerSku}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {item.sellerSku}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell />
                            <TableCell className="font-mono text-[10px] text-muted-foreground">
                              {item.cogs > 0 ? fmt(item.cogs) + "/unit" : "No COGS"}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-right text-muted-foreground">
                              {item.quantityShipped}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-right text-muted-foreground">
                              {item.quantityReceived}
                            </TableCell>
                            <TableCell>
                              <ProgressBar
                                shipped={item.quantityShipped}
                                received={item.quantityReceived}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-right text-muted-foreground pr-6">
                              {fmt(item.value)}
                            </TableCell>
                          </TableRow>
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
