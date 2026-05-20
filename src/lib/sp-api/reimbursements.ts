import { spApiFetch } from "./client";
import type {
  AdjustmentEvent,
  SAFETReimbursementEvent,
  FinancialEventsPayload,
} from "./types";

export interface ReimbursementEvents {
  adjustments: AdjustmentEvent[];
  safetClaims: SAFETReimbursementEvent[];
}

export async function getReimbursementEvents(
  postedAfter: Date,
  postedBefore?: Date
): Promise<ReimbursementEvents> {
  const adjustments: AdjustmentEvent[] = [];
  const safetClaims: SAFETReimbursementEvent[] = [];
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

    const adj = payload.FinancialEvents?.AdjustmentEventList ?? [];
    const safet = payload.FinancialEvents?.SAFETReimbursementEventList ?? [];

    adjustments.push(...adj);
    safetClaims.push(...safet);
    nextToken = payload.NextToken ?? undefined;

    console.log(
      `[reimbursements] Page: ${adj.length} adjustments, ${safet.length} SAFE-T claims (total: ${adjustments.length}/${safetClaims.length})`
    );

    if (nextToken) await new Promise((r) => setTimeout(r, 2000));
  } while (nextToken);

  return { adjustments, safetClaims };
}
