import { refreshAccessToken } from "./auth";
import type { GetOrdersResponse, GetOrderItemsResponse } from "./types";

const BASE_URL = "https://sellingpartnerapi-eu.amazon.com";

async function spApiFetch(path: string): Promise<Response> {
  const token = await refreshAccessToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-amzn-RequestId") ?? "unknown";
    throw new Error(
      `SP-API error ${response.status} [${requestId}]: ${await response.text()}`
    );
  }

  return response;
}

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
