"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CalendarRange } from "lucide-react";

const periods = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7days", label: "7D" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "90days", label: "90D" },
  { key: "365days", label: "365D" },
  { key: "this_year", label: "This Year" },
];

export function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("period") ?? "today";
  const isCustom = current.startsWith("custom_");

  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  function setPeriod(period: string) {
    setShowCustom(false);
    router.push(`?period=${period}`);
  }

  function applyCustom() {
    if (!customFrom || !customTo) return;
    setPeriod(`custom_${customFrom}_${customTo}`);
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5">
        {periods.map((p) => (
          <Button
            key={p.key}
            variant={current === p.key ? "default" : "ghost"}
            size="sm"
            className="h-7 px-2.5 text-[11px] rounded-lg font-medium"
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          variant={isCustom || showCustom ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2.5 text-[11px] rounded-lg font-medium"
          onClick={() => setShowCustom(!showCustom)}
        >
          <CalendarRange className="h-3 w-3 mr-1" />
          Custom
        </Button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/40 p-1">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-7 rounded-lg border border-border bg-background px-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-[10px] text-muted-foreground">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-7 rounded-lg border border-border bg-background px-2 text-[11px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            size="sm"
            className="h-7 px-3 text-[11px] rounded-lg"
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
          >
            Apply
          </Button>
        </div>
      )}
    </div>
  );
}
