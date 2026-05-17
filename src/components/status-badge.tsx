"use client";

import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const statusStyles: Record<string, string> = {
  Shipped: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  Unshipped: "bg-sky-50 text-sky-700 ring-sky-600/20",
  Pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  error: "bg-rose-50 text-rose-700 ring-rose-600/20",
  running: "bg-sky-50 text-sky-700 ring-sky-600/20",
  FBA: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  FBM: "bg-amber-50 text-amber-700 ring-amber-600/20",
  "In Stock": "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "Low Stock": "bg-amber-50 text-amber-700 ring-amber-600/20",
  "Out of Stock": "bg-rose-50 text-rose-700 ring-rose-600/20",
  Refunded: "bg-rose-50 text-rose-700 ring-rose-600/20",
  Completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
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
