export interface LwaTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface SpApiOrder {
  AmazonOrderId: string;
  PurchaseDate: string;
  OrderStatus: string;
  FulfillmentChannel: string;
  ShipmentServiceLevelCategory: string;
  OrderTotal?: { CurrencyCode: string; Amount: string };
  ShippingAddress?: { CountryCode: string; PostalCode: string };
  LastUpdateDate: string;
}

export interface SpApiOrderItem {
  OrderItemId: string;
  ASIN: string;
  SellerSKU: string;
  QuantityOrdered: number;
  ItemPrice?: { CurrencyCode: string; Amount: string };
  ItemTax?: { CurrencyCode: string; Amount: string };
  ShippingPrice?: { CurrencyCode: string; Amount: string };
  PromotionDiscount?: { CurrencyCode: string; Amount: string };
}

export interface GetOrdersResponse {
  Orders: SpApiOrder[];
  NextToken?: string;
}

export interface GetOrderItemsResponse {
  OrderItems: SpApiOrderItem[];
  NextToken?: string;
}

export interface InventorySummary {
  asin: string;
  fnSku: string;
  sellerSku: string;
  productName: string;
  condition: string;
  totalQuantity: number;
  inventoryDetails?: {
    fulfillableQuantity?: number;
    reservedQuantity?: {
      totalReservedQuantity?: number;
      pendingCustomerOrderQuantity?: number;
      pendingTransshipmentQuantity?: number;
      fcProcessingQuantity?: number;
    };
    researchingQuantity?: {
      totalResearchingQuantity?: number;
    };
    unfulfillableQuantity?: {
      totalUnfulfillableQuantity?: number;
      customerDamagedQuantity?: number;
      warehouseDamagedQuantity?: number;
      distributorDamagedQuantity?: number;
      carrierDamagedQuantity?: number;
      defectiveQuantity?: number;
      expiredQuantity?: number;
    };
  };
}

export interface GetInventorySummariesResponse {
  granularity: { granularityType: string; granularityId: string };
  inventorySummaries: InventorySummary[];
}

export interface GetInventorySummariesPayload {
  payload: GetInventorySummariesResponse;
  pagination?: { nextToken?: string };
}

export interface CatalogImage {
  link: string;
  variant: string;
  height: number;
  width: number;
}

export interface CatalogItemImagesResponse {
  asin: string;
  images: Array<{
    marketplaceId: string;
    images: CatalogImage[];
  }>;
}

// Product Fees API types
export interface FeeEstimateRequest {
  MarketplaceId: string;
  IdType: "ASIN" | "SellerSKU";
  IdValue: string;
  IsAmazonFulfilled: boolean;
  PriceToEstimateFees: {
    ListingPrice: { CurrencyCode: string; Amount: number };
  };
  Identifier: string;
}

export interface FeeDetail {
  FeeType: string;
  FeeAmount: { CurrencyCode: string; Amount: number };
  FinalFee: { CurrencyCode: string; Amount: number };
}

export interface FeesEstimateResult {
  Status: string;
  FeesEstimateIdentifier: {
    MarketplaceId: string;
    IdType: string;
    IdValue: string;
    IsAmazonFulfilled: boolean;
    PriceToEstimateFees: {
      ListingPrice: { CurrencyCode: string; Amount: number };
    };
    SellerInputIdentifier: string;
  };
  FeesEstimate?: {
    TimeOfFeesEstimation: string;
    TotalFeesEstimate: { CurrencyCode: string; Amount: number };
    FeeDetailList: FeeDetail[];
  };
  Error?: { Type: string; Code: string; Message: string };
}

export interface FeeEstimateParsed {
  asin: string;
  price: number;
  totalFees: number;
  referralFee: number;
  fbaFee: number;
  closingFee: number;
  digitalServicesFee: number;
  storageFee: number;
  otherFees: number;
  feeBreakdown: Record<string, number>;
  currency: string;
}

// Finances API types
export interface FinancialShipmentItem {
  SellerSKU: string;
  OrderItemId: string;
  QuantityShipped: number;
  ItemChargeList: Array<{
    ChargeType: string;
    ChargeAmount: { CurrencyCode: string; Amount: number };
  }>;
  ItemFeeList: Array<{
    FeeType: string;
    FeeAmount: { CurrencyCode: string; Amount: number };
  }>;
  PromotionList?: Array<{
    PromotionType: string;
    PromotionAmount: { CurrencyCode: string; Amount: number };
  }>;
}

export interface ShipmentEvent {
  AmazonOrderId: string;
  SellerOrderId: string;
  PostedDate: string;
  MarketplaceName: string;
  ShipmentItemList: FinancialShipmentItem[];
}

// Adjustment events (FBA reimbursements, fee corrections)
export interface AdjustmentItem {
  Quantity: number;
  PerUnitAmount: { CurrencyCode: string; Amount: number };
  TotalAmount: { CurrencyCode: string; Amount: number };
  SellerSKU: string;
  FnSKU?: string;
  ASIN?: string;
  ProductDescription?: string;
}

export interface AdjustmentEvent {
  AdjustmentType: string;
  PostedDate: string;
  AdjustmentAmount: { CurrencyCode: string; Amount: number };
  AdjustmentItemList?: AdjustmentItem[];
}

// SAFE-T reimbursement events
export interface SAFETReimbursementEvent {
  PostedDate: string;
  SAFETClaimId: string;
  ReimbursedAmount: { CurrencyCode: string; Amount: number };
  ReasonCode?: string;
  SAFETReimbursementItemList?: Array<{
    ItemChargeList?: Array<{ ChargeType: string; ChargeAmount: { CurrencyCode: string; Amount: number } }>;
  }>;
}

export interface FinancialEventsPayload {
  FinancialEvents: {
    ShipmentEventList?: ShipmentEvent[];
    RefundEventList?: ShipmentEvent[];
    AdjustmentEventList?: AdjustmentEvent[];
    SAFETReimbursementEventList?: SAFETReimbursementEvent[];
  };
  NextToken?: string;
}

// FBA Inbound Shipments API types
export interface InboundShipmentData {
  ShipmentId: string;
  ShipmentName: string;
  ShipmentStatus: string;
  DestinationFulfillmentCenterId: string;
  AreCasesRequired: boolean;
  LabelPrepType?: string;
  ConfirmedNeedByDate?: string;
  BoxContentsSource?: string;
}

export interface InboundShipmentItem {
  ShipmentId?: string;
  SellerSKU: string;
  FulfillmentNetworkSKU: string;
  QuantityShipped: number;
  QuantityReceived: number;
  QuantityInCase?: number;
}

export interface GetShipmentsResponse {
  payload: {
    ShipmentData: InboundShipmentData[];
    NextToken?: string;
  };
}

export interface GetShipmentItemsResponse {
  payload: {
    ItemData: InboundShipmentItem[];
    NextToken?: string;
  };
}
