"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const periods = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7days", label: "Last 7 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
];

export function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("period") ?? "today";

  function setPeriod(period: string) {
    router.push(`?period=${period}`);
  }

  return (
    <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
      {periods.map((p) => (
        <Button
          key={p.key}
          variant={current === p.key ? "default" : "ghost"}
          size="sm"
          className="h-7 px-3 text-[11px] rounded-md"
          onClick={() => setPeriod(p.key)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
