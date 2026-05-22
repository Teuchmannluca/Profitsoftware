import { describe, expect, it } from "vitest";
import {
  metricDeltaPct,
  pickMovers,
  formatMetricValue,
  formatDeltaPct,
  toLocalDateStr,
} from "@/lib/notifications/digest";
import type { DigestMetric } from "@/lib/notifications/types";

function metric(
  label: string,
  deltaPct: number | null
): DigestMetric {
  return {
    key: label.toLowerCase(),
    label,
    value: 0,
    prevValue: 0,
    format: "number",
    deltaPct,
  };
}

describe("metricDeltaPct", () => {
  it("computes percentage change against the previous day", () => {
    expect(metricDeltaPct(150, 100)).toBe(50);
    expect(metricDeltaPct(80, 100)).toBe(-20);
  });

  it("returns null when the previous day has no baseline", () => {
    expect(metricDeltaPct(100, 0)).toBeNull();
  });

  it("uses an absolute denominator for negative previous values", () => {
    expect(metricDeltaPct(-50, -100)).toBe(50);
  });
});

describe("pickMovers", () => {
  it("finds the strongest gain and the steepest drop", () => {
    const { best, worst } = pickMovers([
      metric("Revenue", 10),
      metric("Profit", -30),
      metric("Units", 5),
      metric("Orders", null),
    ]);
    expect(best?.label).toBe("Revenue");
    expect(worst?.label).toBe("Profit");
  });

  it("returns nulls when nothing is comparable", () => {
    const { best, worst } = pickMovers([metric("Orders", null)]);
    expect(best).toBeNull();
    expect(worst).toBeNull();
  });
});

describe("formatMetricValue", () => {
  it("formats currency, percent and number values", () => {
    expect(formatMetricValue(12.5, "currency")).toBe("£12.50");
    expect(formatMetricValue(33.333, "percent")).toBe("33.3%");
    expect(formatMetricValue(7.6, "number")).toBe("8");
  });
});

describe("formatDeltaPct", () => {
  it("adds a sign and renders a dash for null", () => {
    expect(formatDeltaPct(12.34)).toBe("+12.3%");
    expect(formatDeltaPct(-5)).toBe("-5.0%");
    expect(formatDeltaPct(null)).toBe("—");
  });
});

describe("toLocalDateStr", () => {
  it("formats a date as local YYYY-MM-DD", () => {
    expect(toLocalDateStr(new Date(2026, 4, 9))).toBe("2026-05-09");
  });
});
