# Inventory Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pull all products and FBA stock levels from Amazon SP-API (Inventory Summaries + Catalog Items for images), store in Supabase, and display in a new Inventory page.

**Architecture:** Extends the existing SP-API client (`spApiFetch` from `src/lib/sp-api/orders.ts`) with new inventory and catalog endpoints. A `syncInventory` server action upserts products and daily snapshots, then fetches images for new products. The Inventory page is a server component using the existing sidebar layout.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Amazon SP-API (FBA Inventory v1 + Catalog Items 2022-04-01), shadcn/ui, Tailwind CSS v4

---

## File Structure

```
src/
├── lib/sp-api/
│   ├── types.ts              # MODIFY: add InventorySummary, CatalogImage types
│   ├── client.ts             # CREATE: extract shared spApiFetch (currently private in orders.ts)
│   ├── orders.ts             # MODIFY: import spApiFetch from client.ts
│   └── inventory.ts          # CREATE: getInventorySummaries, getCatalogItemImage
├── actions/
│   ├── sync-inventory.ts     # CREATE: syncInventory server action + mapping functions
│   └── sync-inventory-action.ts  # CREATE: "use server" wrapper (same pattern as sync-orders-action.ts)
├── components/
│   ├── inventory-table.tsx   # CREATE: product/stock table with images
│   ├── sync-inventory-button.tsx # CREATE: sync trigger for inventory page
│   └── sidebar.tsx           # MODIFY: remove "soon" from Inventory nav item
├── app/
│   └── inventory/
│       └── page.tsx          # CREATE: inventory page
supabase/
└── migrations/
    └── 002_inventory.sql     # CREATE: add image_url to products, create inventory_snapshots
next.config.ts                # MODIFY: add Amazon image domains
tests/
├── lib/sp-api/
│   └── inventory.test.ts     # CREATE: tests for inventory + catalog API
└── actions/
    └── sync-inventory.test.ts # CREATE: tests for mapping functions
```

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/002_inventory.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/002_inventory.sql`:

```sql
-- Add image_url to products, remove brand constraint, create inventory_snapshots

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_brand_check;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;

CREATE TABLE IF NOT EXISTS inventory_snapshots (
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

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_date
  ON inventory_snapshots(date DESC);
```

- [ ] **Step 2: Apply migration**

Run this SQL in the Supabase Dashboard → SQL Editor. Or if Supabase CLI is linked:

```bash
npx supabase db push
```

- [ ] **Step 3: Verify tables**

In Supabase Dashboard → Table Editor, confirm:
- `products` table now has an `image_url` column
- `inventory_snapshots` table exists with the correct columns
- The brand constraint on `products` is removed

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/002_inventory.sql
git commit -m "feat: add inventory_snapshots table and image_url to products"
```

---

### Task 2: Extract Shared SP-API Client

**Files:**
- Create: `src/lib/sp-api/client.ts`
- Modify: `src/lib/sp-api/orders.ts`

- [ ] **Step 1: Create shared client**

Create `src/lib/sp-api/client.ts`:

```typescript
import { refreshAccessToken } from "./auth";

const BASE_URL = "https://sellingpartnerapi-eu.amazon.com";

export async function spApiFetch(path: string): Promise<Response> {
  const token = await refreshAccessToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-amz-access-token": token,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const requestId = response.headers.get("x-amzn-RequestId") ?? "unknown";
    throw new Error(
      `SP-API error ${response.status} [${requestId}]: ${await response.text()}`
    );
  }

  return response;
}
```

- [ ] **Step 2: Update orders.ts to import from client.ts**

Replace `src/lib/sp-api/orders.ts` with:

```typescript
import { spApiFetch } from "./client";
import type { GetOrdersResponse, GetOrderItemsResponse } from "./types";

export async function getRecentOrders(
  since: Date
): Promise<GetOrdersResponse> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const params = new URLSearchParams({
    MarketplaceIds: marketplaceId,
    LastUpdatedAfter: since.toISOString(),
    OrderStatuses: "Shipped,Unshipped,PartiallyShipped",
  });

  const response = await spApiFetch(`/orders/v0/orders?${params}`);
  const data = await response.json();
  return data.payload;
}

export async function getOrderItems(
  orderId: string
): Promise<GetOrderItemsResponse> {
  const response = await spApiFetch(
    `/orders/v0/orders/${orderId}/orderItems`
  );
  const data = await response.json();
  return data.payload;
}
```

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
npm run test:run
```

Expected: All 8 tests pass (the mock on `@/lib/sp-api/auth` in orders.test.ts still intercepts `refreshAccessToken` which is called by `client.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/sp-api/client.ts src/lib/sp-api/orders.ts
git commit -m "refactor: extract shared spApiFetch to client.ts"
```

---

### Task 3: SP-API Inventory Types

**Files:**
- Modify: `src/lib/sp-api/types.ts`

- [ ] **Step 1: Add inventory and catalog types**

Append to `src/lib/sp-api/types.ts`:

```typescript
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
    };
    unfulfillableQuantity?: {
      totalUnfulfillableQuantity?: number;
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/sp-api/types.ts
git commit -m "feat: add inventory and catalog item types"
```

---

### Task 4: SP-API Inventory Client

**Files:**
- Create: `src/lib/sp-api/inventory.ts`
- Create: `tests/lib/sp-api/inventory.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/sp-api/inventory.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInventorySummaries, getCatalogItemImage } from "@/lib/sp-api/inventory";

vi.mock("@/lib/sp-api/auth", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
}));

describe("getInventorySummaries", () => {
  beforeEach(() => {
    vi.stubEnv("SP_API_MARKETPLACE_ID", "A1F83G8C2ARO7P");
  });

  it("fetches all inventory summaries across pages", async () => {
    const page1 = {
      payload: {
        granularity: { granularityType: "Marketplace", granularityId: "A1F83G8C2ARO7P" },
        inventorySummaries: [
          {
            asin: "B0TEST001",
            fnSku: "X00TEST001",
            sellerSku: "SKU-001",
            productName: "Test Product 1",
            condition: "NewItem",
            totalQuantity: 50,
            inventoryDetails: {
              fulfillableQuantity: 40,
              reservedQuantity: { totalReservedQuantity: 5 },
              unfulfillableQuantity: { totalUnfulfillableQuantity: 5 },
            },
          },
        ],
      },
      pagination: { nextToken: "token-page-2" },
    };

    const page2 = {
      payload: {
        granularity: { granularityType: "Marketplace", granularityId: "A1F83G8C2ARO7P" },
        inventorySummaries: [
          {
            asin: "B0TEST002",
            fnSku: "X00TEST002",
            sellerSku: "SKU-002",
            productName: "Test Product 2",
            condition: "NewItem",
            totalQuantity: 25,
          },
        ],
      },
      pagination: {},
    };

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(callCount === 1 ? page1 : page2),
        headers: new Headers(),
      });
    });

    const result = await getInventorySummaries();

    expect(result).toHaveLength(2);
    expect(result[0].sellerSku).toBe("SKU-001");
    expect(result[0].totalQuantity).toBe(50);
    expect(result[1].sellerSku).toBe("SKU-002");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe("getCatalogItemImage", () => {
  it("returns the MAIN image URL", async () => {
    const mockResponse = {
      images: [
        {
          marketplaceId: "A1F83G8C2ARO7P",
          images: [
            { link: "https://m.media-amazon.com/images/I/main.jpg", variant: "MAIN", height: 500, width: 500 },
            { link: "https://m.media-amazon.com/images/I/pt01.jpg", variant: "PT01", height: 500, width: 500 },
          ],
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      headers: new Headers(),
    });

    const url = await getCatalogItemImage("B0TEST001");
    expect(url).toBe("https://m.media-amazon.com/images/I/main.jpg");
  });

  it("returns null when no MAIN image exists", async () => {
    const mockResponse = { images: [] };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
      headers: new Headers(),
    });

    const url = await getCatalogItemImage("B0NOIMAGES");
    expect(url).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- tests/lib/sp-api/inventory.test.ts
```

Expected: FAIL — `getInventorySummaries` is not defined.

- [ ] **Step 3: Implement inventory client**

Create `src/lib/sp-api/inventory.ts`:

```typescript
import { spApiFetch } from "./client";
import type {
  InventorySummary,
  GetInventorySummariesPayload,
  CatalogItemImagesResponse,
} from "./types";

export async function getInventorySummaries(): Promise<InventorySummary[]> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const allSummaries: InventorySummary[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
      granularityType: "Marketplace",
      granularityId: marketplaceId,
      marketplaceIds: marketplaceId,
    });
    if (nextToken) {
      params.set("nextToken", nextToken);
    }

    const response = await spApiFetch(
      `/fba/inventory/v1/summaries?${params}`
    );
    const data: GetInventorySummariesPayload = await response.json();

    allSummaries.push(...data.payload.inventorySummaries);
    nextToken = data.pagination?.nextToken ?? undefined;
  } while (nextToken);

  return allSummaries;
}

export async function getCatalogItemImage(
  asin: string
): Promise<string | null> {
  const marketplaceId = process.env.SP_API_MARKETPLACE_ID!;
  const params = new URLSearchParams({
    marketplaceIds: marketplaceId,
    includedData: "images",
  });

  const response = await spApiFetch(
    `/catalog/2022-04-01/items/${asin}?${params}`
  );
  const data: CatalogItemImagesResponse = await response.json();

  for (const imageSet of data.images ?? []) {
    const mainImage = imageSet.images?.find((img) => img.variant === "MAIN");
    if (mainImage) {
      return mainImage.link;
    }
  }

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- tests/lib/sp-api/inventory.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sp-api/inventory.ts tests/lib/sp-api/inventory.test.ts
git commit -m "feat: SP-API inventory client (getInventorySummaries + getCatalogItemImage)"
```

---

### Task 5: Sync Inventory Action

**Files:**
- Create: `src/actions/sync-inventory.ts`
- Create: `src/actions/sync-inventory-action.ts`
- Create: `tests/actions/sync-inventory.test.ts`

- [ ] **Step 1: Write failing tests for mapping functions**

Create `tests/actions/sync-inventory.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  mapSummaryToProduct,
  mapSummaryToSnapshot,
} from "@/actions/sync-inventory";

describe("mapSummaryToProduct", () => {
  it("maps an inventory summary to a products row", () => {
    const summary = {
      asin: "B0TEST001",
      fnSku: "X00TEST001",
      sellerSku: "SKU-001",
      productName: "Test Product 1",
      condition: "NewItem",
      totalQuantity: 50,
      inventoryDetails: {
        fulfillableQuantity: 40,
        reservedQuantity: { totalReservedQuantity: 5 },
        unfulfillableQuantity: { totalUnfulfillableQuantity: 5 },
      },
    };

    const row = mapSummaryToProduct(summary);

    expect(row.sku).toBe("SKU-001");
    expect(row.asin).toBe("B0TEST001");
    expect(row.fnsku).toBe("X00TEST001");
    expect(row.title).toBe("Test Product 1");
    expect(row.active).toBe(true);
  });
});

describe("mapSummaryToSnapshot", () => {
  it("maps an inventory summary to a snapshot row with today's date", () => {
    const summary = {
      asin: "B0TEST001",
      fnSku: "X00TEST001",
      sellerSku: "SKU-001",
      productName: "Test Product 1",
      condition: "NewItem",
      totalQuantity: 50,
      inventoryDetails: {
        fulfillableQuantity: 40,
        reservedQuantity: { totalReservedQuantity: 5 },
        unfulfillableQuantity: { totalUnfulfillableQuantity: 5 },
      },
    };

    const today = "2026-05-17";
    const row = mapSummaryToSnapshot(summary, today);

    expect(row.date).toBe("2026-05-17");
    expect(row.sku).toBe("SKU-001");
    expect(row.asin).toBe("B0TEST001");
    expect(row.afn_fulfillable).toBe(40);
    expect(row.afn_reserved).toBe(5);
    expect(row.afn_unsellable).toBe(5);
    expect(row.total_quantity).toBe(50);
  });

  it("handles missing inventoryDetails gracefully", () => {
    const summary = {
      asin: "B0TEST002",
      fnSku: "X00TEST002",
      sellerSku: "SKU-002",
      productName: "Test Product 2",
      condition: "NewItem",
      totalQuantity: 25,
    };

    const row = mapSummaryToSnapshot(summary, "2026-05-17");

    expect(row.afn_fulfillable).toBe(0);
    expect(row.afn_reserved).toBe(0);
    expect(row.afn_unsellable).toBe(0);
    expect(row.total_quantity).toBe(25);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- tests/actions/sync-inventory.test.ts
```

Expected: FAIL — `mapSummaryToProduct` not defined.

- [ ] **Step 3: Implement the sync action**

Create `src/actions/sync-inventory.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import {
  getInventorySummaries,
  getCatalogItemImage,
} from "@/lib/sp-api/inventory";
import type { InventorySummary } from "@/lib/sp-api/types";

export function mapSummaryToProduct(summary: InventorySummary) {
  return {
    sku: summary.sellerSku,
    asin: summary.asin,
    fnsku: summary.fnSku,
    title: summary.productName,
    active: true,
    last_synced_at: new Date().toISOString(),
  };
}

export function mapSummaryToSnapshot(summary: InventorySummary, date: string) {
  return {
    date,
    sku: summary.sellerSku,
    asin: summary.asin,
    afn_fulfillable: summary.inventoryDetails?.fulfillableQuantity ?? 0,
    afn_reserved:
      summary.inventoryDetails?.reservedQuantity?.totalReservedQuantity ?? 0,
    afn_unsellable:
      summary.inventoryDetails?.unfulfillableQuantity
        ?.totalUnfulfillableQuantity ?? 0,
    afn_inbound: 0,
    mfn_quantity: 0,
    total_quantity: summary.totalQuantity,
  };
}

export async function syncInventory(): Promise<{
  productsWritten: number;
  snapshotsWritten: number;
  imagesUpdated: number;
  error?: string;
}> {
  "use server";

  const supabase = await createClient();

  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({
      pillar: "inventory",
      endpoint: "getInventorySummaries",
      status: "running",
    })
    .select("id")
    .single();

  const logId = logEntry!.id;

  try {
    const summaries = await getInventorySummaries();
    const today = new Date().toISOString().split("T")[0];

    let productsWritten = 0;
    let snapshotsWritten = 0;

    for (const summary of summaries) {
      const productRow = mapSummaryToProduct(summary);
      await supabase
        .from("products")
        .upsert(productRow, { onConflict: "sku" });
      productsWritten++;

      const snapshotRow = mapSummaryToSnapshot(summary, today);
      await supabase
        .from("inventory_snapshots")
        .upsert(snapshotRow, { onConflict: "date,sku" });
      snapshotsWritten++;
    }

    const { data: missingImages } = await supabase
      .from("products")
      .select("asin")
      .is("image_url", null)
      .not("asin", "is", null);

    let imagesUpdated = 0;

    for (const { asin } of missingImages ?? []) {
      const imageUrl = await getCatalogItemImage(asin);
      if (imageUrl) {
        await supabase
          .from("products")
          .update({ image_url: imageUrl })
          .eq("asin", asin);
        imagesUpdated++;
      }
    }

    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_written: productsWritten + snapshotsWritten,
      })
      .eq("id", logId);

    return { productsWritten, snapshotsWritten, imagesUpdated };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await supabase
      .from("sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", logId);

    return {
      productsWritten: 0,
      snapshotsWritten: 0,
      imagesUpdated: 0,
      error: message,
    };
  }
}
```

- [ ] **Step 4: Create the server action wrapper**

Create `src/actions/sync-inventory-action.ts`:

```typescript
"use server";

import { syncInventory as _syncInventory } from "./sync-inventory";

export async function syncInventory() {
  return _syncInventory();
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- tests/actions/sync-inventory.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/actions/sync-inventory.ts src/actions/sync-inventory-action.ts tests/actions/sync-inventory.test.ts
git commit -m "feat: sync-inventory action (products + snapshots + images)"
```

---

### Task 6: Next.js Image Domain Config

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Add Amazon image domains**

Replace `next.config.ts` with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "images-na.ssl-images-amazon.com",
      },
    ],
  },
};

export default nextConfig;
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat: allow Amazon image domains in Next.js config"
```

---

### Task 7: Inventory Table Component

**Files:**
- Create: `src/components/inventory-table.tsx`
- Create: `src/components/sync-inventory-button.tsx`

- [ ] **Step 1: Create inventory table component**

Create `src/components/inventory-table.tsx`:

```typescript
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse } from "lucide-react";

interface InventoryRow {
  sku: string;
  asin: string | null;
  fnsku: string | null;
  title: string | null;
  image_url: string | null;
  afn_fulfillable: number;
  afn_reserved: number;
  afn_inbound: number;
  afn_unsellable: number;
  total_quantity: number;
}

export function InventoryTable({ rows }: { rows: InventoryRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            Product Inventory
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {rows.length} products
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Warehouse className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No products synced</p>
            <p className="text-xs text-muted-foreground mt-1">
              Click Sync Inventory to pull products from Amazon
            </p>
          </div>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs w-[50px]">Image</TableHead>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs">SKU</TableHead>
                  <TableHead className="text-xs">ASIN</TableHead>
                  <TableHead className="text-xs text-right">Fulfillable</TableHead>
                  <TableHead className="text-xs text-right">Reserved</TableHead>
                  <TableHead className="text-xs text-right">Inbound</TableHead>
                  <TableHead className="text-xs text-right">Unsellable</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.sku}>
                    <TableCell>
                      {row.image_url ? (
                        <Image
                          src={row.image_url}
                          alt={row.title ?? row.sku}
                          width={40}
                          height={40}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                          <Warehouse className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {row.title ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.sku}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.asin ?? "—"}
                    </TableCell>
                    <TableCell
                      className={`font-mono text-xs text-right ${
                        row.afn_fulfillable < 10
                          ? "text-destructive font-semibold"
                          : ""
                      }`}
                    >
                      {row.afn_fulfillable}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right">
                      {row.afn_reserved}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right">
                      {row.afn_inbound}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right">
                      {row.afn_unsellable}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-right font-semibold">
                      {row.total_quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create sync inventory button**

Create `src/components/sync-inventory-button.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { syncInventory } from "@/actions/sync-inventory-action";

export function SyncInventoryButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSync() {
    setLoading(true);
    await syncInventory();
    setLoading(false);
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={loading}
      className="h-8 gap-1.5 text-xs"
    >
      <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing..." : "Sync Inventory"}
    </Button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/inventory-table.tsx src/components/sync-inventory-button.tsx
git commit -m "feat: inventory table and sync button components"
```

---

### Task 8: Inventory Page + Sidebar Update

**Files:**
- Create: `src/app/inventory/page.tsx`
- Modify: `src/components/sidebar.tsx`

- [ ] **Step 1: Create inventory page**

Create `src/app/inventory/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { InventoryTable } from "@/components/inventory-table";
import { SyncInventoryButton } from "@/components/sync-inventory-button";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().split("T")[0];

  const { data: inventoryRows } = await supabase
    .from("inventory_snapshots")
    .select(
      `
      sku,
      asin,
      afn_fulfillable,
      afn_reserved,
      afn_inbound,
      afn_unsellable,
      total_quantity
    `
    )
    .eq("date", today);

  const skus = (inventoryRows ?? []).map((r) => r.sku);

  const { data: products } = skus.length > 0
    ? await supabase
        .from("products")
        .select("sku, asin, fnsku, title, image_url")
        .in("sku", skus)
    : { data: [] };

  const productMap = new Map(
    (products ?? []).map((p) => [p.sku, p])
  );

  const rows = (inventoryRows ?? []).map((snap) => {
    const product = productMap.get(snap.sku);
    return {
      sku: snap.sku,
      asin: product?.asin ?? snap.asin,
      fnsku: product?.fnsku ?? null,
      title: product?.title ?? null,
      image_url: product?.image_url ?? null,
      afn_fulfillable: snap.afn_fulfillable,
      afn_reserved: snap.afn_reserved,
      afn_inbound: snap.afn_inbound,
      afn_unsellable: snap.afn_unsellable,
      total_quantity: snap.total_quantity,
    };
  });

  return (
    <div className="min-h-screen">
      <Sidebar email={user.email ?? ""} />

      <main className="pl-[220px]">
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex h-14 items-center justify-between px-8">
            <div>
              <h1 className="text-sm font-semibold">Inventory</h1>
              <p className="text-[11px] text-muted-foreground">
                FBA stock levels
              </p>
            </div>
            <SyncInventoryButton />
          </div>
        </div>

        <div className="p-8">
          <InventoryTable rows={rows} />
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Remove "Soon" from Inventory in sidebar**

In `src/components/sidebar.tsx`, change the Inventory nav item from:

```typescript
  { label: "Inventory", href: "/inventory", icon: Warehouse, soon: true },
```

to:

```typescript
  { label: "Inventory", href: "/inventory", icon: Warehouse },
```

- [ ] **Step 3: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass (existing 8 + 5 new = 13 total).

- [ ] **Step 4: Build to verify no type errors**

```bash
npx next build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/inventory/ src/components/sidebar.tsx
git commit -m "feat: inventory page with product table and stock levels"
```

---

## Verification Checklist

- [ ] Migration applied: `products` has `image_url` column, `inventory_snapshots` table exists
- [ ] `npm run test:run` — all tests pass (13 total)
- [ ] `npx next build` — no type errors
- [ ] `npm run dev` — visit /inventory, see empty state
- [ ] Click "Sync Inventory" — products and stock levels appear with images
- [ ] Sidebar shows "Inventory" without "Soon" tag, links to /inventory
- [ ] Low stock items (fulfillable < 10) show in red
- [ ] Product images display correctly (40x40 thumbnails)
