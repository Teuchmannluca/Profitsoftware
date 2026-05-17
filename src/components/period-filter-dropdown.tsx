"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarDays, Check } from "lucide-react";

const periods = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7days", label: "Last 7 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
];

export function PeriodFilterDropdown() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("period") ?? "today";
  const currentLabel = periods.find((p) => p.key === current)?.label ?? "Today";

  function setPeriod(period: string) {
    router.push(`?period=${period}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center justify-center h-9 gap-2 text-xs font-semibold rounded-xl border border-border/80 bg-card px-3 hover:bg-accent hover:border-indigo-200 transition-all duration-200 cursor-pointer"
      >
        <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
        {currentLabel}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-xl">
        {periods.map((p) => (
          <DropdownMenuItem
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="rounded-lg text-sm cursor-pointer"
          >
            <span className="flex-1">{p.label}</span>
            {current === p.key && (
              <Check className="h-3.5 w-3.5 text-indigo-500" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
