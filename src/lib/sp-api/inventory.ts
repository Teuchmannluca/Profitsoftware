import { spApiFetch, NextTokenExpiredError } from "./client";
import { refreshAccessToken } from "./auth";
import type {
  InventorySummary,
  GetInventorySummariesPayload,
  CatalogItemImagesResponse,
} from "./types";

export async function getInventorySummaries(): Promise<InventorySummary[]> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;

  for (let attempt = 0; ; attempt++) {
    try {
      const allSummaries: InventorySummary[] = [];
      let nextToken: string | undefined;

      do {
        const params = new URLSearchParams({
          details: "true",
          granularityType: "Marketplace",
          granularityId: marketplaceId,
          marketplaceIds: marketplaceId,
        });
        if (nextToken) {
          params.set("nextToken", nextToken);
        }

        const response = await spApiFetch(
          `/fba/inventory/v1/summaries?${params}`
        );
        const data: GetInventorySummariesPayload = await response.json();

        allSummaries.push(...data.payload.inventorySummaries);
        nextToken = data.pagination?.nextToken ?? undefined;
      } while (nextToken);

      return allSummaries;
    } catch (e) {
      if (e instanceof NextTokenExpiredError && attempt === 0) {
        console.log(`[inventory] NextToken expired, restarting pagination...`);
        continue;
      }
      throw e;
    }
  }
}

export async function getCatalogItemImage(
  asin: string
): Promise<string | null> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const params = new URLSearchParams({
    marketplaceIds: marketplaceId,
    includedData: "images",
  });

  const token = await refreshAccessToken();

  const response = await fetch(
    `https://sellingpartnerapi-eu.amazon.com/catalog/2022-04-01/items/${asin}?${params}`,
    {
      headers: {
        "x-amz-access-token": token,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const data: CatalogItemImagesResponse = await response.json();

  for (const imageSet of data.images ?? []) {
    const mainImage = imageSet.images?.find((img) => img.variant === "MAIN");
    if (mainImage) {
      return mainImage.link;
    }
  }

  return null;
}
