import { spApiFetch } from "./client";
import type { ShipmentEvent, FinancialEventsPayload } from "./types";

export async function getRefundEvents(
  postedAfter: Date,
  postedBefore?: Date
): Promise<ShipmentEvent[]> {
  const allRefunds: ShipmentEvent[] = [];
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

    const refunds = payload.FinancialEvents?.RefundEventList ?? [];
    allRefunds.push(...refunds);
    nextToken = payload.NextToken ?? undefined;

    console.log(`[returns-sync] Page: ${refunds.length} refund events (total: ${allRefunds.length})`);

    if (nextToken) await new Promise((r) => setTimeout(r, 2000));
  } while (nextToken);

  return allRefunds;
}
