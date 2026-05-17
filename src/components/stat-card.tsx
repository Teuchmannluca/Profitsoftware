import {
  ShoppingBag,
  RotateCcw,
  Receipt,
  Wallet,
  PiggyBank,
  Percent,
  TrendingUp,
  Package,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  ShoppingBag,
  RotateCcw,
  Receipt,
  Wallet,
  PiggyBank,
  Percent,
  TrendingUp,
  Package,
};

interface StatBoxProps {
  label: string;
  value: string | number;
  iconName?: "ShoppingBag" | "RotateCcw" | "Receipt" | "Wallet" | "PiggyBank" | "Percent" | "TrendingUp" | "Package";
  gradient?: "indigo" | "emerald" | "sky" | "amber" | "violet" | "rose" | "orange";
}

const gradientMap = {
  indigo: "from-indigo-500 to-violet-500",
  emerald: "from-emerald-500 to-teal-500",
  sky: "from-sky-500 to-cyan-500",
  amber: "from-amber-500 to-orange-500",
  violet: "from-violet-500 to-purple-500",
  rose: "from-rose-500 to-pink-500",
  orange: "from-orange-500 to-amber-500",
};

const bgTintMap = {
  indigo: "bg-indigo-50",
  emerald: "bg-emerald-50",
  sky: "bg-sky-50",
  amber: "bg-amber-50",
  violet: "bg-violet-50",
  rose: "bg-rose-50",
  orange: "bg-orange-50",
};

const iconColorMap: Record<string, string> = {
  indigo: "#6366f1",
  emerald: "#10b981",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  rose: "#f43f5e",
  orange: "#f97316",
};

export function StatBox({ label, value, iconName, gradient = "indigo" }: StatBoxProps) {
  const Icon = iconName ? iconMap[iconName] : null;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-card hover:shadow-card-hover ring-1 ring-border/50">
      <div className={`absolute left-0 top-0 right-0 h-1 bg-gradient-to-r ${gradientMap[gradient]}`} />
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <p className="text-lg font-bold tracking-tight font-mono text-foreground">
            {value}
          </p>
        </div>
        {Icon && (
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgTintMap[gradient]}`}>
            <Icon className="h-4 w-4" style={{ color: iconColorMap[gradient] }} />
          </div>
        )}
      </div>
    </div>
  );
}
