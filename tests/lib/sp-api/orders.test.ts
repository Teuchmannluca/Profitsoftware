import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRecentOrders, getOrderItems } from "@/lib/sp-api/orders";

vi.mock("@/lib/sp-api/auth", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
}));

describe("getRecentOrders", () => {
  beforeEach(() => {
    vi.stubEnv("SP_API_MARKETPLACE_ID", "A1F83G8C2ARO7P");
  });

  it("fetches orders updated after a given timestamp", async () => {
    const mockOrders = {
      payload: {
        Orders: [
          {
            AmazonOrderId: "204-1234567-8901234",
            PurchaseDate: "2026-05-16T14:30:00Z",
            OrderStatus: "Shipped",
            FulfillmentChannel: "AFN",
            LastUpdateDate: "2026-05-16T15:00:00Z",
          },
        ],
        NextToken: null,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOrders),
    });

    const since = new Date("2026-05-16T00:00:00Z");
    const result = await getRecentOrders(since);

    expect(result.Orders).toHaveLength(1);
    expect(result.Orders[0].AmazonOrderId).toBe("204-1234567-8901234");

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain("sellingpartnerapi-eu.amazon.com");
    expect(fetchCall[0]).toContain("LastUpdatedAfter=");
    expect(fetchCall[1].headers["x-amz-access-token"]).toBe("mock-access-token");
  });

  it("throws on API error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Too Many Requests"),
      headers: new Headers({ "x-amzn-RequestId": "req-123" }),
    });

    const since = new Date("2026-05-16T00:00:00Z");
    await expect(getRecentOrders(since)).rejects.toThrow("SP-API error 429");
  });
});

describe("getOrderItems", () => {
  it("fetches items for a given order", async () => {
    const mockItems = {
      payload: {
        OrderItems: [
          {
            OrderItemId: "item-001",
            ASIN: "B0TEST12345",
            SellerSKU: "LVT-TEA-001",
            QuantityOrdered: 2,
            ItemPrice: { CurrencyCode: "GBP", Amount: "24.99" },
          },
        ],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockItems),
    });

    const result = await getOrderItems("204-1234567-8901234");
    expect(result.OrderItems).toHaveLength(1);
    expect(result.OrderItems[0].SellerSKU).toBe("LVT-TEA-001");
  });
});
