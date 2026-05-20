import {
  PoundSterling,
  TrendingUp,
  TrendingDown,
  Percent,
  Package,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  PoundSterling,
  TrendingUp,
  Percent,
  Package,
};

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  iconName: "PoundSterling" | "TrendingUp" | "Percent" | "Package";
  gradient: "indigo" | "emerald" | "sky" | "amber" | "violet" | "rose" | "orange";
  shadow: string;
  trend?: { value: number; label: string };
}

const gradientMap = {
  indigo: "bg-gradient-indigo",
  emerald: "bg-gradient-emerald",
  sky: "bg-gradient-sky",
  amber: "bg-gradient-amber",
  violet: "bg-gradient-violet",
  rose: "bg-gradient-rose",
  orange: "bg-gradient-orange",
};

export function MetricCard({
  label,
  value,
  subtitle,
  iconName,
  gradient,
  shadow,
  trend,
}: MetricCardProps) {
  const Icon = iconMap[iconName];
  const isPositive = trend ? trend.value >= 0 : true;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 ${shadow} hover:shadow-card-hover ring-1 ring-border/50`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {trend && (
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  isPositive
                    ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400"
                    : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {isPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-[11px] text-muted-foreground">
                {trend.label}
              </span>
            </div>
          )}
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${gradientMap[gradient]} shadow-lg`}
        >
          {Icon && <Icon className="h-5 w-5 text-white" />}
        </div>
      </div>
    </div>
  );
}
