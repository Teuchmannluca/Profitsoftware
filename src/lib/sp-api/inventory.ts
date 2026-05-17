import { spApiFetch } from "./client";
import type {
  InventorySummary,
  GetInventorySummariesPayload,
  CatalogItemImagesResponse,
} from "./types";

export async function getInventorySummaries(): Promise<InventorySummary[]> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const allSummaries: InventorySummary[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
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
}

export async function getCatalogItemImage(
  asin: string
): Promise<string | null> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const params = new URLSearchParams({
    marketplaceIds: marketplaceId,
    includedData: "images",
  });

  const response = await spApiFetch(
    `/catalog/2022-04-01/items/${asin}?${params}`
  );
  const data: CatalogItemImagesResponse = await response.json();

  for (const imageSet of data.images ?? []) {
    const mainImage = imageSet.images?.find((img) => img.variant === "MAIN");
    if (mainImage) {
      return mainImage.link;
    }
  }

  return null;
}
