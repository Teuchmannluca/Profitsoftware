"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusStyles: Record<string, string> = {
  Shipped: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 dark:ring-emerald-400/20",
  Unshipped: "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 ring-sky-600/20 dark:ring-sky-400/20",
  Pending: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 ring-amber-600/20 dark:ring-amber-400/20",
  Cancelled: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-rose-600/20 dark:ring-rose-400/20",
  success: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 dark:ring-emerald-400/20",
  error: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-rose-600/20 dark:ring-rose-400/20",
  running: "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 ring-sky-600/20 dark:ring-sky-400/20",
  FBA: "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 ring-indigo-600/20 dark:ring-indigo-400/20",
  FBM: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 ring-amber-600/20 dark:ring-amber-400/20",
  "In Stock": "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 dark:ring-emerald-400/20",
  "Low Stock": "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 ring-amber-600/20 dark:ring-amber-400/20",
  "Out of Stock": "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-rose-600/20 dark:ring-rose-400/20",
  Refunded: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-rose-600/20 dark:ring-rose-400/20",
  Completed: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 dark:ring-emerald-400/20",
  WORKING: "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 ring-amber-600/20 dark:ring-amber-400/20",
  SHIPPED: "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 ring-sky-600/20 dark:ring-sky-400/20",
  RECEIVING: "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 ring-indigo-600/20 dark:ring-indigo-400/20",
  CLOSED: "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 dark:ring-emerald-400/20",
  CANCELLED: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-rose-600/20 dark:ring-rose-400/20",
  ERROR: "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-rose-600/20 dark:ring-rose-400/20",
  Archived: "bg-slate-50 dark:bg-slate-950 text-slate-500 ring-slate-400/20",
};

const defaultStyle = "bg-muted text-muted-foreground ring-border";

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-medium ring-1 ring-inset",
        size === "sm" ? "text-[10px]" : "text-xs",
        statusStyles[status] ?? defaultStyle
      )}
    >
      {status}
    </span>
  );
}
