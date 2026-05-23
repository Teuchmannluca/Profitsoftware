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

interface CompetitivePriceProduct {
  ASIN?: string;
  SellerSKU?: string;
  Product?: {
    CompetitivePricing?: {
      CompetitivePrices?: Array<{
        CompetitivePriceId?: string;
        Price?: {
          ListedPrice?: { Amount: number; CurrencyCode: string };
          LandedPrice?: { Amount: number; CurrencyCode: string };
          ListingPrice?: { Amount: number; CurrencyCode: string };
        };
        condition?: string;
        belongsToRequester?: boolean;
      }>;
    };
  };
  status?: string;
}

interface GetCompetitivePricingResponse {
  payload?: CompetitivePriceProduct[];
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

  for (let i = 0; i < uniqueItemIds.length; i += 20) {
    const chunk = uniqueItemIds.slice(i, i + 20);
    const paramKey = itemType === "Asin" ? "Asins" : "Skus";
    const params = new URLSearchParams();
    params.set("MarketplaceId", marketplaceId);
    params.set("ItemType", itemType);
    for (const id of chunk) {
      params.append(paramKey, id);
    }

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
          offer?.BuyingPrice?.LandedPrice?.Amount ??
          offer?.BuyingPrice?.ListingPrice?.Amount ??
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

export async function getCompetitivePriceForASINs(
  asins: string[]
): Promise<Map<string, number>> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const priceMap = new Map<string, number>();
  const uniqueAsins = [...new Set(asins.filter(Boolean))];

  for (let i = 0; i < uniqueAsins.length; i += 20) {
    const chunk = uniqueAsins.slice(i, i + 20);
    const params = new URLSearchParams();
    params.set("MarketplaceId", marketplaceId);
    params.set("ItemType", "Asin");
    for (const asin of chunk) {
      params.append("Asins", asin);
    }

    try {
      const response = await spApiFetch(
        `/products/pricing/v0/competitivePrice?${params}`
      );
      const data: GetCompetitivePricingResponse = await response.json();

      for (const product of data.payload ?? []) {
        if (!product.ASIN || product.status !== "Success") continue;
        const prices = product.Product?.CompetitivePricing?.CompetitivePrices ?? [];
        const ownPrice = prices.find((p) => p.belongsToRequester);
        const anyPrice = prices[0];
        const best = ownPrice ?? anyPrice;
        const amount =
          best?.Price?.LandedPrice?.Amount ??
          best?.Price?.ListingPrice?.Amount ??
          best?.Price?.ListedPrice?.Amount;
        if (amount && amount > 0) {
          priceMap.set(product.ASIN, amount);
        }
      }
    } catch (err) {
      console.error(
        `[pricing] Failed to get competitive prices for batch starting at index ${i}:`,
        err instanceof Error ? err.message : err
      );
    }

    if (i + 20 < uniqueAsins.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return priceMap;
}
