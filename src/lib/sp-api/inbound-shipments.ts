import { spApiFetch, NextTokenExpiredError } from "./client";
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

  for (let attempt = 0; ; attempt++) {
    try {
      const all: InboundShipmentData[] = [];
      const seen = new Set<string>();

      for (const status of statuses) {
        let nextToken: string | undefined;

        do {
          const params = new URLSearchParams();
          params.set("MarketplaceId", marketplaceId);

          if (nextToken) {
            params.set("QueryType", "NEXT_TOKEN");
            params.set("NextToken", nextToken);
          } else {
            params.set("QueryType", "SHIPMENT");
            params.set("ShipmentStatusList", status);
          }

          const response = await spApiFetch(
            `/fba/inbound/v0/shipments?${params}`
          );
          const data: GetShipmentsResponse = await response.json();

          for (const shipment of data.payload.ShipmentData) {
            if (!seen.has(shipment.ShipmentId)) {
              seen.add(shipment.ShipmentId);
              all.push(shipment);
            }
          }
          nextToken = data.payload.NextToken ?? undefined;

          if (nextToken) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        } while (nextToken);

        await new Promise((r) => setTimeout(r, 1000));
      }

      return all;
    } catch (e) {
      if (e instanceof NextTokenExpiredError && attempt === 0) {
        console.log(`[inbound-shipments] NextToken expired, restarting pagination...`);
        continue;
      }
      throw e;
    }
  }
}

export async function getShipmentItems(
  shipmentId: string
): Promise<InboundShipmentItem[]> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;

  for (let attempt = 0; ; attempt++) {
    try {
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
    } catch (e) {
      if (e instanceof NextTokenExpiredError && attempt === 0) {
        console.log(`[inbound-shipments] NextToken expired for ${shipmentId}, restarting pagination...`);
        continue;
      }
      throw e;
    }
  }
}
