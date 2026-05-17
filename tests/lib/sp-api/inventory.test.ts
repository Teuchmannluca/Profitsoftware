import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInventorySummaries, getCatalogItemImage } from "@/lib/sp-api/inventory";

vi.mock("@/lib/sp-api/auth", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
}));

describe("getInventorySummaries", () => {
  beforeEach(() => {
    vi.stubEnv("SP_API_MARKETPLACE_ID", "A1F83G8C2ARO7P");
  });

  it("fetches all inventory summaries across pages", async () => {
    const page1 = {
      payload: {
        granularity: { granularityType: "Marketplace", granularityId: "A1F83G8C2ARO7P" },
        inventorySummaries: [
          {
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
          },
        ],
      },
      pagination: { nextToken: "token-page-2" },
    };

    const page2 = {
      payload: {
        granularity: { granularityType: "Marketplace", granularityId: "A1F83G8C2ARO7P" },
        inventorySummaries: [
          {
            asin: "B0TEST002",
            fnSku: "X00TEST002",
            sellerSku: "SKU-002",
            productName: "Test Product 2",
            condition: "NewItem",
            totalQuantity: 25,
          },
        ],
      },
      pagination: {},
    };

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(callCount === 1 ? page1 : page2),
        headers: new Headers(),
      });
    });

    const result = await getInventorySummaries();

    expect(result).toHaveLength(2);
    expect(result[0].sellerSku).toBe("SKU-001");
    expect(result[0].totalQuantity).toBe(50);
    expect(result[1].sellerSku).toBe("SKU-002");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("getCatalogItemImage", () => {
  it("returns the MAIN image URL", async () => {
    const mockResponse = {
      images: [
        {
          marketplaceId: "A1F83G8C2ARO7P",
          images: [
            { link: "https://m.media-amazon.com/images/I/main.jpg", variant: "MAIN", height: 500, width: 500 },
            { link: "https://m.media-amazon.com/images/I/pt01.jpg", variant: "PT01", height: 500, width: 500 },
          ],
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      headers: new Headers(),
    });

    const url = await getCatalogItemImage("B0TEST001");
    expect(url).toBe("https://m.media-amazon.com/images/I/main.jpg");
  });

  it("returns null when no MAIN image exists", async () => {
    const mockResponse = { images: [] };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      headers: new Headers(),
    });

    const url = await getCatalogItemImage("B0NOIMAGES");
    expect(url).toBeNull();
  });
});
