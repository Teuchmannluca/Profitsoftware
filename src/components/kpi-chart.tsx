"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { DailyDataPoint } from "@/actions/daily-metrics";

const LINES = [
  { key: "revenue", label: "Revenue", color: "#0ea5e9", darkColor: "#38bdf8" },
  { key: "profit", label: "Profit", color: "#10b981", darkColor: "#34d399" },
  { key: "fees", label: "Fees", color: "#f59e0b", darkColor: "#fbbf24" },
  { key: "units", label: "Units", color: "#8b5cf6", darkColor: "#a78bfa" },
] as const;

function formatDate(d: string): string {
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg ring-1 ring-border/50">
      <p className="text-[11px] font-bold text-muted-foreground mb-2">
        {formatDate(label)}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[11px] text-muted-foreground">
                {entry.name}
              </span>
            </div>
            <span className="text-[11px] font-bold font-mono text-foreground">
              {entry.name === "Units"
                ? entry.value
                : `£${entry.value.toFixed(2)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KpiChart({ data }: { data: DailyDataPoint[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  function toggleLine(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (data.length === 0) {
    return (
      <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">
            No data for this period
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950">
              <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Performance
          </CardTitle>
          <div className="flex items-center gap-1">
            {LINES.map((line) => (
              <button
                key={line.key}
                onClick={() => toggleLine(line.key)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-medium transition-colors ${
                  hidden.has(line.key)
                    ? "text-muted-foreground/40"
                    : "text-foreground"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full transition-opacity"
                  style={{
                    backgroundColor: line.color,
                    opacity: hidden.has(line.key) ? 0.2 : 1,
                  }}
                />
                {line.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pl-0 pr-4 pb-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              {LINES.map((line) => (
                <linearGradient
                  key={line.key}
                  id={`gradient-${line.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={line.color}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor={line.color}
                    stopOpacity={0}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-border/40"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`
              }
              width={55}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "currentColor",
                strokeWidth: 1,
                strokeDasharray: "4 4",
                className: "text-muted-foreground/40",
              }}
            />
            {LINES.map((line) =>
              hidden.has(line.key) ? null : (
                <Area
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.label}
                  stroke={line.color}
                  strokeWidth={2}
                  fill={`url(#gradient-${line.key})`}
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: line.color,
                    stroke: "var(--card)",
                    strokeWidth: 2,
                  }}
                />
              )
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
