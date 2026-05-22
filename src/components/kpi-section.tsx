"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CircleGauge } from "@/components/circle-gauge";
import { Circle, BarChart3, TrendingUp, TrendingDown, Megaphone } from "lucide-react";
import type { DailyDataPoint } from "@/actions/daily-metrics";

interface KpiItem {
  value: number;
  prevValue: number;
  max: number;
  label: string;
  formattedValue: string;
  prevFormatted: string;
  subtitle: string;
  color: string;
  gradient: string;
  shadow: string;
  sparkKey: keyof DailyDataPoint;
}

function formatSparkValue(value: number, key: string): string {
  if (key === "units") return String(value);
  return `£${value.toFixed(2)}`;
}

function formatSparkDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function SparklineCard({
  item,
  sparkData,
}: {
  item: KpiItem;
  sparkData: Array<{ v: number; date: string }>;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const changePct =
    item.prevValue !== 0
      ? ((item.value - item.prevValue) / Math.abs(item.prevValue)) * 100
      : item.value > 0
        ? 100
        : 0;
  const isUp = changePct >= 0;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || sparkData.length < 2) return;
      const rect = svg.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width;
      const idx = Math.round(relX * (sparkData.length - 1));
      setHoverIdx(Math.max(0, Math.min(idx, sparkData.length - 1)));
    },
    [sparkData.length]
  );

  const values = sparkData.map((d) => d.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * 200,
    y: 48 - ((v - min) / range) * 44,
  }));

  const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L200,50 L0,50 Z`;

  const hovered = hoverIdx !== null ? sparkData[hoverIdx] : null;
  const hoveredCoord = hoverIdx !== null ? coords[hoverIdx] : null;

  return (
    <div
      className={`relative flex flex-col rounded-2xl bg-card ${item.shadow} ring-1 ring-border/50 overflow-hidden`}
    >
      <div className="px-5 pt-5 pb-0 flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            {item.label}
          </span>
        </div>
        <p className="text-2xl font-bold tracking-tight font-mono text-foreground">
          {item.formattedValue}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {isUp ? (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-rose-500" />
          )}
          <span
            className={`text-[11px] font-semibold ${isUp ? "text-emerald-500" : "text-rose-500"}`}
          >
            {isUp ? "+" : ""}
            {changePct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-muted-foreground">
            vs {item.prevFormatted} prev
          </span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && hoveredCoord && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: `${(hoveredCoord.x / 200) * 100}%`,
            bottom: 64,
            transform: "translateX(-50%)",
          }}
        >
          <div className="bg-popover text-popover-foreground rounded-lg px-2.5 py-1.5 shadow-lg ring-1 ring-border/50 text-center whitespace-nowrap">
            <p className="text-[10px] text-muted-foreground font-medium">{formatSparkDate(hovered.date)}</p>
            <p className="text-xs font-bold font-mono" style={{ color: item.color }}>
              {formatSparkValue(hovered.v, item.sparkKey)}
            </p>
          </div>
        </div>
      )}

      <div className="mt-2 overflow-hidden">
        {sparkData.length > 1 ? (
          <svg
            ref={svgRef}
            viewBox="0 0 200 50"
            preserveAspectRatio="none"
            className="w-full h-[60px] block cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <defs>
              <linearGradient id={`spark-${item.label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={item.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <path d={areaPath} fill={`url(#spark-${item.label})`} />
            <path d={linePath} fill="none" stroke={item.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            {/* Hover indicator dot + vertical line */}
            {hoveredCoord && (
              <>
                <line
                  x1={hoveredCoord.x} y1={0}
                  x2={hoveredCoord.x} y2={50}
                  stroke={item.color}
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                  vectorEffect="non-scaling-stroke"
                  opacity={0.5}
                />
                <circle
                  cx={hoveredCoord.x}
                  cy={hoveredCoord.y}
                  r="3"
                  fill={item.color}
                  stroke="var(--card)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </svg>
        ) : (
          <div className="h-[60px]" />
        )}
      </div>
    </div>
  );
}

export function KpiSection({
  items,
  dailyData,
  adSpend = 0,
  prevAdSpend = 0,
}: {
  items: KpiItem[];
  dailyData: DailyDataPoint[];
  adSpend?: number;
  prevAdSpend?: number;
}) {
  const [mode, setMode] = useState<"chart" | "circle">("chart");
  const [inclPpc, setInclPpc] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("kpi-mode");
    if (saved === "circle" || saved === "chart") setMode(saved);
    const savedPpc = localStorage.getItem("kpi-incl-ppc");
    if (savedPpc === "true" || savedPpc === "false") setInclPpc(savedPpc === "true");
  }, []);

  function setAndSave(m: "chart" | "circle") {
    setMode(m);
    localStorage.setItem("kpi-mode", m);
  }

  function togglePpc() {
    setInclPpc((v) => {
      localStorage.setItem("kpi-incl-ppc", String(!v));
      return !v;
    });
  }

  const displayItems = items.map((item) => {
    if (!inclPpc || adSpend === 0) return item;
    if (item.label === "Profit") {
      const profitWithAds = item.value;
      const profitWithoutAds = item.value + adSpend;
      const prevWithAds = item.prevValue;
      const prevWithoutAds = item.prevValue + prevAdSpend;
      return inclPpc
        ? { ...item, value: profitWithAds, formattedValue: `£${profitWithAds.toFixed(2)}`, prevValue: prevWithAds, prevFormatted: `£${prevWithAds.toFixed(2)}` }
        : item;
    }
    if (item.label === "Profit Margin") {
      return item;
    }
    return item;
  });

  const displayItemsFinal = !inclPpc
    ? items.map((item) => {
        if (item.label === "Profit") {
          const val = item.value + adSpend;
          const prev = item.prevValue + prevAdSpend;
          return { ...item, value: val, formattedValue: `£${val.toFixed(2)}`, prevValue: prev, prevFormatted: `£${prev.toFixed(2)}` };
        }
        if (item.label === "Profit Margin") {
          const revenue = items.find((i) => i.label === "Revenue")?.value ?? 0;
          const profit = (items.find((i) => i.label === "Profit")?.value ?? 0) + adSpend;
          const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
          const prevRevenue = items.find((i) => i.label === "Revenue")?.prevValue ?? 0;
          const prevProfit = (items.find((i) => i.label === "Profit")?.prevValue ?? 0) + prevAdSpend;
          const prevMargin = prevRevenue > 0 ? (prevProfit / prevRevenue) * 100 : 0;
          return { ...item, value: margin, formattedValue: `${margin.toFixed(2)}%`, prevValue: prevMargin, prevFormatted: `${prevMargin.toFixed(2)}%` };
        }
        return item;
      })
    : displayItems;

  return (
    <div>
      <div className="flex justify-end mb-3 gap-2">
        {adSpend > 0 && (
          <button
            onClick={togglePpc}
            className={`flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors ring-1 ${
              inclPpc
                ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 ring-rose-600/15 dark:ring-rose-400/15"
                : "bg-muted/40 text-muted-foreground ring-border/80 hover:text-foreground"
            }`}
            title={inclPpc ? "Profit includes PPC spend — click to exclude" : "Profit excludes PPC spend — click to include"}
          >
            <Megaphone className="h-3 w-3" />
            {inclPpc ? "Incl. PPC" : "Excl. PPC"}
          </button>
        )}
        <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5">
          <button
            onClick={() => setAndSave("chart")}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
              mode === "chart"
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Chart cards"
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setAndSave("circle")}
            className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
              mode === "circle"
                ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Circle gauges"
          >
            <Circle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {displayItemsFinal.map((item) => {
          if (mode === "circle") {
            return <CircleGauge key={item.label} {...item} />;
          }
          const sparkData = dailyData.map((d) => ({
            v: d[item.sparkKey] as number,
            date: d.date,
          }));
          return (
            <SparklineCard
              key={item.label}
              item={item}
              sparkData={sparkData}
            />
          );
        })}
      </div>
    </div>
  );
}
