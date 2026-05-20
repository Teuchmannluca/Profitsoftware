import { spApiFetch } from "./client";

interface PricingOffer {
  BuyingPrice?: {
    ListingPrice?: { Amount: number; CurrencyCode: string };
    LandedPrice?: { Amount: number; CurrencyCode: string };
  };
  RegularPrice?: { Amount: number; CurrencyCode: string };
}

interface PricingProduct {
  ASIN?: string;
  Product?: { Offers?: PricingOffer[] };
  Offers?: PricingOffer[];
  status?: string;
}

interface GetPricingResponse {
  payload?: PricingProduct[];
}

export async function getMyPriceForASINs(
  asins: string[]
): Promise<Map<string, number>> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const priceMap = new Map<string, number>();

  // SP-API allows up to 20 ASINs per request
  for (let i = 0; i < asins.length; i += 20) {
    const chunk = asins.slice(i, i + 20);
    const params = new URLSearchParams({
      MarketplaceId: marketplaceId,
      ItemType: "Asin",
    });
    for (const asin of chunk) {
      params.append("Asins", asin);
    }

    try {
      const response = await spApiFetch(
        `/products/pricing/v0/price?${params}`
      );
      const data: GetPricingResponse = await response.json();

      for (const product of data.payload ?? []) {
        if (!product.ASIN || product.status !== "Success") continue;
        const offer = product.Product?.Offers?.[0] ?? product.Offers?.[0];
        const price =
          offer?.BuyingPrice?.ListingPrice?.Amount ??
          offer?.RegularPrice?.Amount;
        if (price && price > 0) {
          priceMap.set(product.ASIN, price);
        }
      }
    } catch (err) {
      console.error(
        `[pricing] Failed to get prices for batch starting at index ${i}:`,
        err instanceof Error ? err.message : err
      );
    }

    if (i + 20 < asins.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return priceMap;
}
