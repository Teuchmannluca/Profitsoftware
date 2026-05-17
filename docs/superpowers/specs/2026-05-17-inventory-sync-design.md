# Inventory Sync — Design Spec

## Goal

Pull the full product catalog and current FBA stock levels from Amazon SP-API, store in Supabase, and display in an Inventory page with product images.

## Data Sources

### 1. FBA Inventory Summaries API
- **Endpoint:** `GET /fba/inventory/v1/summaries`
- **Params:** `granularityType=Marketplace`, `granularityId=A1F83G8C2ARO7P` (UK), `marketplaceIds=A1F83G8C2ARO7P`
- **Pagination:** `nextToken`, returns up to 50 items per page
- **Rate limit:** 2 requests per second
- **Returns per SKU:** asin, fnSku, sellerSku, productName, condition, fulfillableQuantity, reservedQuantity, inboundWorkingQuantity, inboundShippedQuantity, inboundReceivingQuantity, unfulfillableQuantity, totalQuantity

### 2. Catalog Items API (for images)
- **Endpoint:** `GET /catalog/2022-04-01/items/{asin}`
- **Params:** `marketplaceIds=A1F83G8C2ARO7P`, `includedData=images`
- **Rate limit:** 2 requests per second
- **Returns:** array of image objects with `link`, `variant` (MAIN, PT01, etc.), `height`, `width`
- **We want:** the `MAIN` variant image URL
- **Optimization:** only fetch images for products that don't have one yet (new products)

## Database Changes

### Migration: `002_inventory.sql`

**Modify `products` table** (add `image_url`, remove brand constraint):

```sql
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_brand_check;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
```

**Create `inventory_snapshots` table:**

```sql
CREATE TABLE inventory_snapshots (
  date              date,
  sku               text,
  asin              text,
  afn_fulfillable   int DEFAULT 0,
  afn_reserved      int DEFAULT 0,
  afn_inbound       int DEFAULT 0,
  afn_unsellable    int DEFAULT 0,
  mfn_quantity      int DEFAULT 0,
  total_quantity    int DEFAULT 0,
  PRIMARY KEY (date, sku)
);
```

## Sync Flow

```
syncInventory():
  1. Create sync_log entry (pillar: "inventory", status: "running")
  2. Paginate through getInventorySummaries() — collect all items
  3. For each item:
     a. Upsert into products (sku, asin, fnsku, title)
     b. Upsert into inventory_snapshots (today's date, stock levels)
  4. Collect ASINs of products missing image_url
  5. For each missing ASIN: call Catalog Items API, get MAIN image URL
  6. Batch update products with image_url
  7. Update sync_log (status: "success", rows_written)
```

## SP-API Client Additions

**New file: `src/lib/sp-api/inventory.ts`**

```typescript
getInventorySummaries(): Promise<InventorySummary[]>
// Paginated — follows all nextTokens, returns flat array

getCatalogItemImage(asin: string): Promise<string | null>
// Returns MAIN image URL or null
```

**New types in `src/lib/sp-api/types.ts`:**

```typescript
interface InventorySummary {
  asin: string;
  fnSku: string;
  sellerSku: string;
  productName: string;
  condition: string;
  inventoryDetails?: {
    fulfillableQuantity: number;
    reservedQuantity: { totalReservedQuantity: number };
    unfulfillableQuantity: { totalUnfulfillableQuantity: number };
  };
  totalQuantity: number;
}
```

## Sync Action

**New file: `src/actions/sync-inventory.ts`**

- `syncInventory()` server action — follows the same pattern as `syncOrders()`
- Returns `{ productsWritten, snapshotsWritten, imagesUpdated, error? }`
- Pure mapping functions exported for testing

## UI

### Inventory Page (`src/app/inventory/page.tsx`)

- Remove "Soon" tag from Inventory nav item in sidebar
- Server component that fetches products + latest inventory snapshot
- Query: join products with today's inventory_snapshots
- Display table with columns: Image, Title, SKU, ASIN, Fulfillable, Reserved, Inbound, Unsellable, Total
- Product images shown as small thumbnails (40x40)
- Sync Inventory button at top
- Empty state if no products synced yet

### Inventory Table Component (`src/components/inventory-table.tsx`)

- Accepts array of products with stock data
- Wraps in Card like the orders table
- Stock quantities in monospace font
- Low stock visual indicator (red text if fulfillable < 10)

## Not In Scope

- Sales velocity / days of cover (needs order history analysis)
- Reorder point alerts
- Inbound shipment tracking
- Inventory aging / LTSF
- MFN inventory (FBA only for now)
- Brand tagging (not needed)
