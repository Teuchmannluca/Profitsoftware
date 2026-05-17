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
