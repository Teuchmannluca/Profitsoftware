import { spApiFetch } from "./client";
import type { SpApiOrder, GetOrderItemsResponse } from "./types";

export async function getRecentOrders(
  since: Date
): Promise<{ Orders: SpApiOrder[] }> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const allOrders: SpApiOrder[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
      MarketplaceIds: marketplaceId,
      LastUpdatedAfter: since.toISOString(),
      OrderStatuses: "Shipped,Unshipped,PartiallyShipped",
    });
    if (nextToken) {
      params.set("NextToken", nextToken);
    }

    const response = await spApiFetch(`/orders/v0/orders?${params}`);
    const data = await response.json();

    allOrders.push(...(data.payload?.Orders ?? []));
    nextToken = data.payload?.NextToken ?? undefined;

    console.log(`[orders-sync] Fetched page: ${data.payload?.Orders?.length ?? 0} orders (total so far: ${allOrders.length})`);
  } while (nextToken);

  return { Orders: allOrders };
}

export async function getOrderItems(
  orderId: string
): Promise<GetOrderItemsResponse> {
  const response = await spApiFetch(
    `/orders/v0/orders/${orderId}/orderItems`
  );
  const data = await response.json();
  return data.payload;
}
