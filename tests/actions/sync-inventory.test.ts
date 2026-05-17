import { describe, it, expect } from "vitest";
import {
  mapSummaryToProduct,
  mapSummaryToSnapshot,
} from "@/actions/sync-inventory";

describe("mapSummaryToProduct", () => {
  it("maps an inventory summary to a products row", () => {
    const summary = {
      asin: "B0TEST001",
      fnSku: "X00TEST001",
      sellerSku: "SKU-001",
      productName: "Test Product 1",
      condition: "NewItem",
      totalQuantity: 50,
      inventoryDetails: {
        fulfillableQuantity: 40,
        reservedQuantity: { totalReservedQuantity: 5 },
        unfulfillableQuantity: { totalUnfulfillableQuantity: 5 },
      },
    };

    const row = mapSummaryToProduct(summary);

    expect(row.sku).toBe("SKU-001");
    expect(row.asin).toBe("B0TEST001");
    expect(row.fnsku).toBe("X00TEST001");
    expect(row.title).toBe("Test Product 1");
    expect(row.active).toBe(true);
  });
});

describe("mapSummaryToSnapshot", () => {
  it("maps an inventory summary to a snapshot row with today's date", () => {
    const summary = {
      asin: "B0TEST001",
      fnSku: "X00TEST001",
      sellerSku: "SKU-001",
      productName: "Test Product 1",
      condition: "NewItem",
      totalQuantity: 50,
      inventoryDetails: {
        fulfillableQuantity: 40,
        reservedQuantity: { totalReservedQuantity: 5 },
        unfulfillableQuantity: { totalUnfulfillableQuantity: 5 },
      },
    };

    const today = "2026-05-17";
    const row = mapSummaryToSnapshot(summary, today);

    expect(row.date).toBe("2026-05-17");
    expect(row.sku).toBe("SKU-001");
    expect(row.asin).toBe("B0TEST001");
    expect(row.afn_fulfillable).toBe(40);
    expect(row.afn_reserved).toBe(5);
    expect(row.afn_unsellable).toBe(5);
    expect(row.total_quantity).toBe(50);
  });

  it("handles missing inventoryDetails gracefully", () => {
    const summary = {
      asin: "B0TEST002",
      fnSku: "X00TEST002",
      sellerSku: "SKU-002",
      productName: "Test Product 2",
      condition: "NewItem",
      totalQuantity: 25,
    };

    const row = mapSummaryToSnapshot(summary, "2026-05-17");

    expect(row.afn_fulfillable).toBe(0);
    expect(row.afn_reserved).toBe(0);
    expect(row.afn_unsellable).toBe(0);
    expect(row.total_quantity).toBe(25);
  });
});
