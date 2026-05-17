import { spApiFetch } from "./client";
import type { GetOrdersResponse, GetOrderItemsResponse } from "./types";

export async function getRecentOrders(
  since: Date
): Promise<GetOrdersResponse> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const params = new URLSearchParams({
    MarketplaceIds: marketplaceId,
    LastUpdatedAfter: since.toISOString(),
    OrderStatuses: "Shipped,Unshipped,PartiallyShipped",
  });

  const response = await spApiFetch(`/orders/v0/orders?${params}`);
  const data = await response.json();
  return data.payload;
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
