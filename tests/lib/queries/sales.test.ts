import { describe, expect, it } from "vitest";
import { getCogsForDate } from "@/lib/queries/sales";

describe("getCogsForDate", () => {
  const periods = [
    { totalCogs: 8, validFrom: "2026-04-01", validTo: null },
    { totalCogs: 6, validFrom: "2026-01-01", validTo: "2026-03-31" },
  ];

  it("uses the COGS period active on the purchase date", () => {
    expect(getCogsForDate(periods, "2026-02-10T12:00:00Z")).toBe(6);
    expect(getCogsForDate(periods, "2026-05-01T12:00:00Z")).toBe(8);
  });

  it("returns zero when no COGS period covers the purchase date", () => {
    expect(getCogsForDate(periods, "2025-12-31T23:59:59Z")).toBe(0);
  });
});
