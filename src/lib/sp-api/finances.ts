import { spApiFetch, NextTokenExpiredError } from "./client";
import type { ShipmentEvent, FinancialEventsPayload } from "./types";

export async function getShipmentEvents(
  postedAfter: Date,
  postedBefore?: Date
): Promise<ShipmentEvent[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const allEvents: ShipmentEvent[] = [];
      let nextToken: string | undefined;

      do {
        const params = new URLSearchParams({
          PostedAfter: postedAfter.toISOString(),
        });
        if (postedBefore) params.set("PostedBefore", postedBefore.toISOString());
        if (nextToken) params.set("NextToken", nextToken);

        const response = await spApiFetch(`/finances/v0/financialEvents?${params}`);
        const data = await response.json();
        const payload: FinancialEventsPayload = data.payload ?? data;

        const events = payload.FinancialEvents?.ShipmentEventList ?? [];
        allEvents.push(...events);
        nextToken = payload.NextToken ?? undefined;

        console.log(`[finances] Page: ${events.length} shipment events (total: ${allEvents.length})`);

        if (nextToken) await new Promise((r) => setTimeout(r, 2000));
      } while (nextToken);

      return allEvents;
    } catch (e) {
      if (e instanceof NextTokenExpiredError && attempt === 0) {
        console.log(`[finances] NextToken expired, restarting pagination...`);
        continue;
      }
      throw e;
    }
  }
}
