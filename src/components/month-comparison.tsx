import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, BarChart3 } from "lucide-react";
import { SalesMetrics } from "@/lib/queries/sales";

interface MonthComparisonProps {
  currentMonth: { label: string; metrics: SalesMetrics };
  previousMonth: { label: string; metrics: SalesMetrics };
}

function formatMoney(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-GB");
}

interface MetricBlockProps {
  label: string;
  current: number;
  previous: number;
  format: "money" | "number" | "percent";
  currentLabel: string;
  previousLabel: string;
}

function MetricBlock({ label, current, previous, format, currentLabel, previousLabel }: MetricBlockProps) {
  let change = 0;
  let isPositive = true;
  if (previous > 0) {
    change = ((current - previous) / previous) * 100;
    isPositive = change >= 0;
  } else if (current > 0) {
    change = 100;
    isPositive = true;
  }

  const isGood = label === "Fees" || label === "Refunds" ? !isPositive : isPositive;
  const changeColor = isGood ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  const changeBg = isGood ? "bg-emerald-50 dark:bg-emerald-950" : "bg-rose-50 dark:bg-rose-950";
  const changeBorder = isGood ? "border-emerald-200 dark:border-emerald-900" : "border-rose-200 dark:border-rose-900";

  const fmt = (v: number) => {
    if (format === "money") return formatMoney(v);
    if (format === "percent") return `${v.toFixed(1)}%`;
    return formatNumber(v);
  };

  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${changeBg} ${changeColor} ${changeBorder}`}>
          {isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {previous > 0 ? `${Math.abs(change).toFixed(0)}%` : "New"}
        </div>
      </div>

      <p className="text-2xl font-bold tracking-tight font-mono text-foreground">
        {fmt(current)}
      </p>

      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
          {previousLabel}
        </span>
        <span className="text-xs font-mono text-muted-foreground">
          {fmt(previous)}
        </span>
      </div>

      {/* Mini bar */}
      <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${isGood ? "bg-emerald-500" : "bg-rose-500"} transition-all duration-700`}
          style={{ width: `${Math.min((current / Math.max(previous, current, 1)) * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function MonthComparison({ currentMonth, previousMonth }: MonthComparisonProps) {
  return (
    <Card className="h-full overflow-hidden shadow-card ring-1 ring-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2.5 text-sm font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
            <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          Month vs Month
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricBlock
          label="Gross Sales"
          current={currentMonth.metrics.grossSales}
          previous={previousMonth.metrics.grossSales}
          format="money"
          currentLabel={currentMonth.label}
          previousLabel={previousMonth.label}
        />
        <MetricBlock
          label="Est. Profit"
          current={currentMonth.metrics.estimatedProfit}
          previous={previousMonth.metrics.estimatedProfit}
          format="money"
          currentLabel={currentMonth.label}
          previousLabel={previousMonth.label}
        />
        <MetricBlock
          label="Units Sold"
          current={currentMonth.metrics.unitsSold}
          previous={previousMonth.metrics.unitsSold}
          format="number"
          currentLabel={currentMonth.label}
          previousLabel={previousMonth.label}
        />
        <MetricBlock
          label="Orders"
          current={currentMonth.metrics.orderCount}
          previous={previousMonth.metrics.orderCount}
          format="number"
          currentLabel={currentMonth.label}
          previousLabel={previousMonth.label}
        />
        <MetricBlock
          label="Margin"
          current={currentMonth.metrics.margin}
          previous={previousMonth.metrics.margin}
          format="percent"
          currentLabel={currentMonth.label}
          previousLabel={previousMonth.label}
        />
      </CardContent>
    </Card>
  );
}
