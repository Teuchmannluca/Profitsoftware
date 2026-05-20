"use client";

import { useEffect, useState } from "react";
import { Coins, AlertTriangle } from "lucide-react";
import { getCapitalOverview } from "@/actions/capital-overview-action";
import type { CapitalOverviewData } from "@/actions/capital-overview";

const DOT_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-400",
};

const BAR_COLORS: Record<string, string> = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  rose: "bg-rose-400",
};

function fmt(n: number): string {
  return n.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-14 rounded bg-muted" />
        <div className="h-5 w-20 rounded bg-muted" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-2.5 w-16 rounded bg-muted" />
            <div className="h-2.5 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CapitalOverview() {
  const [data, setData] = useState<CapitalOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCapitalOverview()
      .then((result) => setData(result))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-3 py-4 border-b border-sidebar-border">
        <Skeleton />
      </div>
    );
  }

  if (!data) return null;

  const nonZeroBuckets = data.buckets.filter((b) => b.units > 0);

  return (
    <div className="px-3 py-4 border-b border-sidebar-border space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Coins className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Capital
          </span>
        </div>
        <span className="text-sm font-bold font-mono text-sidebar-foreground">
          {fmt(data.totalCapital)}
        </span>
      </div>

      <p className="text-[10px] text-muted-foreground -mt-1.5">
        {data.totalUnits.toLocaleString("en-GB")} units in inventory
      </p>

      {/* Stacked bar */}
      {data.totalUnits > 0 && (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          {data.buckets.map((bucket) => {
            const pct = data.totalCapital > 0
              ? (bucket.value / data.totalCapital) * 100
              : data.totalUnits > 0
                ? (bucket.units / data.totalUnits) * 100
                : 0;
            if (pct === 0) return null;
            return (
              <div
                key={bucket.label}
                className={`${BAR_COLORS[bucket.color]} transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
      )}

      {/* Legend rows */}
      <div className="space-y-1.5">
        {nonZeroBuckets.map((bucket) => (
          <div key={bucket.label} className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${DOT_COLORS[bucket.color]} shrink-0`} />
            <span className="text-[11px] text-sidebar-foreground/70 flex-1 truncate">
              {bucket.label}
            </span>
            <div className="text-right">
              <span className="text-[11px] font-mono font-semibold text-sidebar-foreground">
                {fmt(bucket.value)}
              </span>
              <span className="text-[9px] text-muted-foreground ml-1">
                {bucket.units.toLocaleString("en-GB")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Missing COGS warning */}
      {data.skusWithoutCogs > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" />
          <span className="text-[10px] text-amber-600 dark:text-amber-400">
            {data.skusWithoutCogs} product{data.skusWithoutCogs > 1 ? "s" : ""} missing costs
          </span>
        </div>
      )}
    </div>
  );
}
