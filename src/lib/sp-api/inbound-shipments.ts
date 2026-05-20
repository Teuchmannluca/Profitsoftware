import { spApiFetch } from "./client";
import type {
  InboundShipmentData,
  InboundShipmentItem,
  GetShipmentsResponse,
  GetShipmentItemsResponse,
} from "./types";

export async function getInboundShipments(
  statuses: string[] = ["WORKING", "SHIPPED", "IN_TRANSIT", "RECEIVING", "DELIVERED", "CHECKED_IN"]
): Promise<InboundShipmentData[]> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const all: InboundShipmentData[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set("MarketplaceId", marketplaceId);

    if (nextToken) {
      params.set("QueryType", "NEXT_TOKEN");
      params.set("NextToken", nextToken);
    } else {
      params.set("QueryType", "SHIPMENT");
      for (const s of statuses) {
        params.append("ShipmentStatusList", s);
      }
    }

    const response = await spApiFetch(
      `/fba/inbound/v0/shipments?${params}`
    );
    const data: GetShipmentsResponse = await response.json();

    all.push(...data.payload.ShipmentData);
    nextToken = data.payload.NextToken ?? undefined;

    if (nextToken) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  } while (nextToken);

  return all;
}

export async function getShipmentItems(
  shipmentId: string
): Promise<InboundShipmentItem[]> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const all: InboundShipmentItem[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
      MarketplaceId: marketplaceId,
    });

    if (nextToken) {
      params.set("NextToken", nextToken);
    }

    const response = await spApiFetch(
      `/fba/inbound/v0/shipments/${shipmentId}/items?${params}`
    );
    const data: GetShipmentItemsResponse = await response.json();

    all.push(...data.payload.ItemData);
    nextToken = data.payload.NextToken ?? undefined;

    if (nextToken) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  } while (nextToken);

  return all;
}
