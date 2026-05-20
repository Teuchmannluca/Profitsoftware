import { describe, it, expect } from "vitest";
import {
  getPerUnitPrice,
  mapSpApiOrderToRow,
  mapSpApiItemToRow,
} from "@/actions/sync-orders";

describe("mapSpApiOrderToRow", () => {
  it("maps SP-API order to database row", () => {
    const spOrder = {
      AmazonOrderId: "204-1234567-8901234",
      PurchaseDate: "2026-05-16T14:30:00Z",
      OrderStatus: "Shipped",
      FulfillmentChannel: "AFN",
      ShipmentServiceLevelCategory: "Standard",
      OrderTotal: { CurrencyCode: "GBP", Amount: "24.99" },
      ShippingAddress: { CountryCode: "GB", PostalCode: "SW1A 1AA" },
      LastUpdateDate: "2026-05-16T15:00:00Z",
    };

    const row = mapSpApiOrderToRow(spOrder);

    expect(row.amazon_order_id).toBe("204-1234567-8901234");
    expect(row.purchase_date).toBe("2026-05-16T14:30:00Z");
    expect(row.order_status).toBe("Shipped");
    expect(row.fulfillment_channel).toBe("AFN");
    expect(row.ship_country).toBe("GB");
    expect(row.ship_postcode).toBe("SW1A 1AA");
    expect(row.raw).toEqual(spOrder);
  });
});

describe("mapSpApiItemToRow", () => {
  it("maps SP-API order item to database row", () => {
    const spItem = {
      OrderItemId: "item-001",
      ASIN: "B0TEST12345",
      SellerSKU: "LVT-TEA-001",
      QuantityOrdered: 2,
      ItemPrice: { CurrencyCode: "GBP", Amount: "24.99" },
      ItemTax: { CurrencyCode: "GBP", Amount: "4.17" },
      ShippingPrice: { CurrencyCode: "GBP", Amount: "0.00" },
      PromotionDiscount: { CurrencyCode: "GBP", Amount: "2.00" },
    };

    const row = mapSpApiItemToRow(spItem, "204-1234567-8901234");

    expect(row.amazon_order_id).toBe("204-1234567-8901234");
    expect(row.order_item_id).toBe("item-001");
    expect(row.asin).toBe("B0TEST12345");
    expect(row.sku).toBe("LVT-TEA-001");
    expect(row.qty).toBe(2);
    expect(row.item_price_gross).toBe(24.99);
    expect(row.item_tax).toBe(4.17);
    expect(row.shipping_price).toBe(0.0);
    expect(row.promo_discount).toBe(2.0);
  });

  it("handles missing optional price fields", () => {
    const spItem = {
      OrderItemId: "item-002",
      ASIN: "B0TEST99999",
      SellerSKU: "LAK-CHOC-001",
      QuantityOrdered: 1,
    };

    const row = mapSpApiItemToRow(spItem, "204-9999999-0000000");

    expect(row.item_price_gross).toBe(0);
    expect(row.item_tax).toBe(0);
    expect(row.shipping_price).toBe(0);
    expect(row.promo_discount).toBe(0);
  });
});

describe("getPerUnitPrice", () => {
  it("normalizes Amazon order item line totals to per-unit prices for fee estimates", () => {
    expect(getPerUnitPrice(24.99, 2)).toBeCloseTo(12.495);
    expect(getPerUnitPrice(19.99, 1)).toBeCloseTo(19.99);
  });

  it("falls back to the line total when quantity is missing or invalid", () => {
    expect(getPerUnitPrice(19.99, null)).toBe(19.99);
    expect(getPerUnitPrice(19.99, 0)).toBe(19.99);
  });
});
