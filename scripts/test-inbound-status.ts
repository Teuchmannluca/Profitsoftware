import "dotenv/config";
import { spApiFetch } from "../src/lib/sp-api/client";

async function main() {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;

  // Query ALL possible statuses
  const statuses = ["WORKING", "SHIPPED", "IN_TRANSIT", "RECEIVING", "DELIVERED", "CHECKED_IN", "CLOSED"];

  for (const status of statuses) {
    const params = new URLSearchParams({
      MarketplaceId: marketplaceId,
      QueryType: "SHIPMENT",
      ShipmentStatusList: status,
    });

    try {
      const response = await spApiFetch(`/fba/inbound/v0/shipments?${params}`);
      const data = await response.json();
      const shipments = data.payload?.ShipmentData ?? [];

      if (shipments.length > 0) {
        console.log(`\n=== Status: ${status} — ${shipments.length} shipments ===`);
        for (const s of shipments.slice(0, 3)) {
          console.log(`  ${s.ShipmentId} | ${s.ShipmentName} | Status: ${s.ShipmentStatus}`);
        }
      } else {
        console.log(`Status: ${status} — 0 shipments`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`Status: ${status} — ERROR: ${msg}`);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch(console.error);
