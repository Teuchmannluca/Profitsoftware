"use client";

import { cn } from "@/lib/utils";

interface StockBarProps {
  value: number;
  max?: number;
  size?: "sm" | "md";
}

export function StockBar({ value, max = 100, size = "sm" }: StockBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  let colorClass = "bg-emerald-500";
  if (pct < 20) colorClass = "bg-rose-500";
  else if (pct < 50) colorClass = "bg-amber-500";

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-full overflow-hidden rounded-full bg-muted",
          size === "sm" ? "h-1.5" : "h-2"
        )}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono font-medium text-muted-foreground w-8 text-right">
        {value}
      </span>
    </div>
  );
}
