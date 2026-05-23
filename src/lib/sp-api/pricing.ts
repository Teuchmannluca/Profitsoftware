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
  SellerSKU?: string;
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
  return getMyPrices("Asin", asins);
}

export async function getMyPriceForSKUs(
  skus: string[]
): Promise<Map<string, number>> {
  return getMyPrices("Sku", skus);
}

async function getMyPrices(
  itemType: "Asin" | "Sku",
  itemIds: string[]
): Promise<Map<string, number>> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const priceMap = new Map<string, number>();
  const uniqueItemIds = [...new Set(itemIds.filter(Boolean))];

  // SP-API allows up to 20 ASINs/SKUs per request
  for (let i = 0; i < uniqueItemIds.length; i += 20) {
    const chunk = uniqueItemIds.slice(i, i + 20);
    const params = new URLSearchParams({
      MarketplaceId: marketplaceId,
      ItemType: itemType,
    });
    params.set(itemType === "Asin" ? "Asins" : "Skus", chunk.join(","));

    try {
      const response = await spApiFetch(
        `/products/pricing/v0/price?${params}`
      );
      const data: GetPricingResponse = await response.json();

      for (const product of data.payload ?? []) {
        const key = itemType === "Sku" ? product.SellerSKU : product.ASIN;
        if (!key || product.status !== "Success") continue;
        const offer = product.Product?.Offers?.[0] ?? product.Offers?.[0];
        const price =
          offer?.BuyingPrice?.ListingPrice?.Amount ??
          offer?.BuyingPrice?.LandedPrice?.Amount ??
          offer?.RegularPrice?.Amount;
        if (price && price > 0) {
          priceMap.set(key, price);
        }
      }
    } catch (err) {
      console.error(
        `[pricing] Failed to get ${itemType} prices for batch starting at index ${i}:`,
        err instanceof Error ? err.message : err
      );
    }

    if (i + 20 < uniqueItemIds.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return priceMap;
}
