"use client";

import { useState, useEffect } from "react";
import { CircleGauge } from "@/components/circle-gauge";
import { Circle, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import {
  AreaChart,
  Area,
  YAxis,
} from "recharts";
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

function SparklineCard({
  item,
  sparkData,
}: {
  item: KpiItem;
  sparkData: Array<{ v: number }>;
}) {
  const changePct =
    item.prevValue !== 0
      ? ((item.value - item.prevValue) / Math.abs(item.prevValue)) * 100
      : item.value > 0
        ? 100
        : 0;
  const isUp = changePct >= 0;

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
      <div className="mt-2 overflow-hidden">
        {sparkData.length > 1 ? (
          <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-[60px] block">
            <defs>
              <linearGradient id={`spark-${item.label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={item.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={item.color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            {(() => {
              const values = sparkData.map((d) => d.v);
              const min = Math.min(...values);
              const max = Math.max(...values);
              const range = max - min || 1;
              const points = values.map((v, i) => {
                const x = (i / (values.length - 1)) * 200;
                const y = 48 - ((v - min) / range) * 44;
                return `${x},${y}`;
              });
              const linePath = `M${points.join(" L")}`;
              const areaPath = `${linePath} L200,50 L0,50 Z`;
              return (
                <>
                  <path d={areaPath} fill={`url(#spark-${item.label})`} />
                  <path d={linePath} fill="none" stroke={item.color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                </>
              );
            })()}
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
}: {
  items: KpiItem[];
  dailyData: DailyDataPoint[];
}) {
  const [mode, setMode] = useState<"chart" | "circle">("chart");

  useEffect(() => {
    const saved = localStorage.getItem("kpi-mode");
    if (saved === "circle" || saved === "chart") setMode(saved);
  }, []);

  function setAndSave(m: "chart" | "circle") {
    setMode(m);
    localStorage.setItem("kpi-mode", m);
  }

  return (
    <div>
      <div className="flex justify-end mb-3">
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
        {items.map((item) => {
          if (mode === "circle") {
            return <CircleGauge key={item.label} {...item} />;
          }
          const sparkData = dailyData.map((d) => ({
            v: d[item.sparkKey] as number,
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
