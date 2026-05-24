interface CircleGaugeProps {
  value: number;
  max: number;
  label: string;
  formattedValue: string;
  subtitle?: string;
  color: string;
  gradient: string;
  shadow: string;
  size?: number;
}

export function CircleGauge({
  value,
  max,
  label,
  formattedValue,
  subtitle,
  color,
  shadow,
}: CircleGaugeProps) {
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div
      className={`relative flex flex-col items-center gap-2 md:gap-4 rounded-3xl bg-card p-4 md:p-8 ${shadow} ring-1 ring-border/50`}
    >
      <div className="relative w-[120px] h-[120px] md:w-[220px] md:h-[220px]">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 12px ${color}50)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl md:text-4xl font-bold tracking-tight font-mono text-foreground">
            {formattedValue}
          </span>
          {subtitle && (
            <span className="text-[9px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 font-semibold uppercase tracking-widest">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <span className="text-[10px] md:text-sm font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}
