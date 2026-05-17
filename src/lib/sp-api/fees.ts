import { refreshAccessToken } from "./auth";
import type { FeesEstimateResult, FeeEstimateParsed } from "./types";

const BASE_URL = "https://sellingpartnerapi-eu.amazon.com";

export async function getFeesEstimateForASIN(
  asin: string,
  price: number
): Promise<FeeEstimateParsed | null> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const token = await refreshAccessToken();

  const body = {
    FeesEstimateRequest: {
      MarketplaceId: marketplaceId,
      IdType: "ASIN",
      IdValue: asin,
      IsAmazonFulfilled: true,
      Identifier: asin,
      PriceToEstimateFees: {
        ListingPrice: {
          CurrencyCode: "GBP",
          Amount: price,
        },
      },
    },
  };

  const response = await fetch(
    `${BASE_URL}/products/fees/v0/items/${asin}/feesEstimate`,
    {
      method: "POST",
      headers: {
        "x-amz-access-token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) return null;

  const data = await response.json();
  const result: FeesEstimateResult = data.payload?.FeesEstimateResult;

  if (!result?.FeesEstimate) return null;

  const fees = result.FeesEstimate;
  const feeMap = new Map(
    fees.FeeDetailList.map((f) => [f.FeeType, f.FinalFee.Amount])
  );

  return {
    asin,
    price,
    totalFees: fees.TotalFeesEstimate.Amount,
    referralFee: feeMap.get("ReferralFee") ?? 0,
    fbaFee: feeMap.get("FBAFees") ?? feeMap.get("FBAPerUnitFulfillmentFee") ?? 0,
    closingFee: feeMap.get("VariableClosingFee") ?? 0,
    currency: fees.TotalFeesEstimate.CurrencyCode,
  };
}
