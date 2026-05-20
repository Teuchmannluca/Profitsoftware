import { describe, expect, it } from "vitest";
import { parseItemFees } from "@/actions/sync-finances";

describe("parseItemFees", () => {
  it("stores actual finance fees as per-unit values", () => {
    const fees = parseItemFees({
      SellerSKU: "SKU-001",
      OrderItemId: "item-001",
      QuantityShipped: 2,
      ItemChargeList: [],
      ItemFeeList: [
        {
          FeeType: "Commission",
          FeeAmount: { CurrencyCode: "GBP", Amount: -4 },
        },
        {
          FeeType: "FBAPerUnitFulfillmentFee",
          FeeAmount: { CurrencyCode: "GBP", Amount: -6 },
        },
      ],
    });

    expect(fees.totalFees).toBe(5);
    expect(fees.feeBasis).toBe("per_unit");
    expect(fees.referralFee).toBe(2);
    expect(fees.fbaFee).toBe(3);
    expect(fees.Commission).toBe(2);
  });
});
