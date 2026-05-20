import { refreshAccessToken } from "./auth";
import type { FeesEstimateResult, FeeEstimateParsed } from "./types";

const BASE_URL = "https://sellingpartnerapi-eu.amazon.com";

const KNOWN_FEE_TYPES: Record<string, string> = {
  ReferralFee: "referralFee",
  FBAFees: "fbaFee",
  FBAPerUnitFulfillmentFee: "fbaFee",
  VariableClosingFee: "closingFee",
  DigitalServicesFee: "digitalServicesFee",
  FBAStorageFee: "storageFee",
  BubblewrapFee: "otherFees",
  FBATransportationFee: "otherFees",
  FBAInboundTransportationFee: "otherFees",
  GiftwrapChargeback: "otherFees",
};

export async function getFeesEstimateForASIN(
  asin: string,
  price: number
): Promise<FeeEstimateParsed | null> {
  return getFeesEstimateForItem({ asin, price });
}

export async function getFeesEstimateForSKU(
  sellerSku: string,
  asin: string,
  price: number
): Promise<FeeEstimateParsed | null> {
  return getFeesEstimateForItem({ sellerSku, asin, price });
}

export async function getFeesEstimateForItem({
  sellerSku,
  asin,
  price,
}: {
  sellerSku?: string | null;
  asin: string;
  price: number;
}): Promise<FeeEstimateParsed | null> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const token = await refreshAccessToken();
  const useSku = Boolean(sellerSku);
  const idType = useSku ? "SellerSKU" : "ASIN";
  const idValue = useSku ? sellerSku! : asin;
  const path = useSku
    ? `listings/${encodeURIComponent(sellerSku!)}/feesEstimate`
    : `items/${asin}/feesEstimate`;

  const body = {
    FeesEstimateRequest: {
      MarketplaceId: marketplaceId,
      IdType: idType,
      IdValue: idValue,
      IsAmazonFulfilled: true,
      Identifier: idValue,
      PriceToEstimateFees: {
        ListingPrice: {
          CurrencyCode: "GBP",
          Amount: price,
        },
      },
    },
  };

  const response = await fetch(
    `${BASE_URL}/products/fees/v0/${path}`,
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

  const feeBreakdown: Record<string, number> = {};
  let referralFee = 0;
  let fbaFee = 0;
  let closingFee = 0;
  let digitalServicesFee = 0;
  let storageFee = 0;
  let otherFees = 0;

  for (const detail of fees.FeeDetailList) {
    const amount = detail.FinalFee.Amount;
    feeBreakdown[detail.FeeType] = amount;

    const mapped = KNOWN_FEE_TYPES[detail.FeeType];
    if (mapped === "referralFee") referralFee += amount;
    else if (mapped === "fbaFee") fbaFee += amount;
    else if (mapped === "closingFee") closingFee += amount;
    else if (mapped === "digitalServicesFee") digitalServicesFee += amount;
    else if (mapped === "storageFee") storageFee += amount;
    else if (mapped === "otherFees") otherFees += amount;
    else otherFees += amount;
  }

  return {
    asin,
    price,
    totalFees: fees.TotalFeesEstimate.Amount,
    referralFee,
    fbaFee,
    closingFee,
    digitalServicesFee,
    storageFee,
    otherFees,
    feeBreakdown,
    currency: fees.TotalFeesEstimate.CurrencyCode,
  };
}
