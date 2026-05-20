import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFeesEstimateForItem } from "@/lib/sp-api/fees";

vi.mock("@/lib/sp-api/auth", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue("access-token"),
}));

describe("getFeesEstimateForItem", () => {
  beforeEach(() => {
    process.env.SP_API_MARKETPLACE_ID = "A1F83G8C2ARO7P";
    vi.restoreAllMocks();
  });

  it("uses the SellerSKU fees endpoint when a SKU is available", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payload: {
          FeesEstimateResult: {
            FeesEstimate: {
              TotalFeesEstimate: { CurrencyCode: "GBP", Amount: 3.25 },
              FeeDetailList: [],
            },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getFeesEstimateForItem({
      asin: "B0TEST12345",
      sellerSku: "SKU / 1",
      price: 12.49,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sellingpartnerapi-eu.amazon.com/products/fees/v0/listings/SKU%20%2F%201/feesEstimate",
      expect.objectContaining({ method: "POST" })
    );

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.FeesEstimateRequest).toMatchObject({
      MarketplaceId: "A1F83G8C2ARO7P",
      IdType: "SellerSKU",
      IdValue: "SKU / 1",
      Identifier: "SKU / 1",
      PriceToEstimateFees: {
        ListingPrice: { CurrencyCode: "GBP", Amount: 12.49 },
      },
    });
  });

  it("falls back to the ASIN fees endpoint when no SKU is available", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payload: {
          FeesEstimateResult: {
            FeesEstimate: {
              TotalFeesEstimate: { CurrencyCode: "GBP", Amount: 3.25 },
              FeeDetailList: [],
            },
          },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getFeesEstimateForItem({
      asin: "B0TEST12345",
      price: 12.49,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sellingpartnerapi-eu.amazon.com/products/fees/v0/items/B0TEST12345/feesEstimate",
      expect.objectContaining({ method: "POST" })
    );

    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.FeesEstimateRequest).toMatchObject({
      IdType: "ASIN",
      IdValue: "B0TEST12345",
      Identifier: "B0TEST12345",
    });
  });
});
