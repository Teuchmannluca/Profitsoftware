import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, BarChart3 } from "lucide-react";
import { SalesMetrics } from "@/lib/queries/sales";

interface MonthComparisonProps {
  currentMonth: { label: string; metrics: SalesMetrics };
  previousMonth: { label: string; metrics: SalesMetrics };
}

function formatMoney(value: number): string {
  return `£${value.toFixed(2)}`;
}

function PercentChange({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <span className="text-[10px] text-muted-foreground">--</span>;
  }
  const change = ((current - previous) / previous) * 100;
  const isPositive = change >= 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        isPositive ? "text-emerald-500" : "text-rose-500"
      }`}
    >
      {isPositive ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function MetricRow({
  label,
  currentValue,
  previousValue,
  format = "money",
}: {
  label: string;
  currentValue: number;
  previousValue: number;
  format?: "money" | "number" | "percent";
}) {
  const formatValue = (v: number) => {
    switch (format) {
      case "money":
        return formatMoney(v);
      case "percent":
        return `${v.toFixed(1)}%`;
      case "number":
        return String(v);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-mono font-medium text-right w-16">
        {formatValue(currentValue)}
      </span>
      <span className="text-xs font-mono text-muted-foreground text-right w-16">
        {formatValue(previousValue)}
      </span>
      <div className="w-12 text-right">
        <PercentChange current={currentValue} previous={previousValue} />
      </div>
    </div>
  );
}

export function MonthComparison({ currentMonth, previousMonth }: MonthComparisonProps) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          Month Comparison
        </CardTitle>
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pt-2">
          <span />
          <span className="text-[10px] font-medium text-muted-foreground text-right w-16">
            {currentMonth.label}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground text-right w-16">
            {previousMonth.label}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground text-right w-12">
            Change
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-0.5">
        <MetricRow
          label="Gross Sales"
          currentValue={currentMonth.metrics.grossSales}
          previousValue={previousMonth.metrics.grossSales}
          format="money"
        />
        <MetricRow
          label="Units Sold"
          currentValue={currentMonth.metrics.unitsSold}
          previousValue={previousMonth.metrics.unitsSold}
          format="number"
        />
        <MetricRow
          label="Orders"
          currentValue={currentMonth.metrics.orderCount}
          previousValue={previousMonth.metrics.orderCount}
          format="number"
        />
        <MetricRow
          label="Est. Profit"
          currentValue={currentMonth.metrics.estimatedProfit}
          previousValue={previousMonth.metrics.estimatedProfit}
          format="money"
        />
        <MetricRow
          label="Margin"
          currentValue={currentMonth.metrics.margin}
          previousValue={previousMonth.metrics.margin}
          format="percent"
        />
      </CardContent>
    </Card>
  );
}
