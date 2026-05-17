# Phase 0: Skeleton — Amazon Profit Tracker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the end-to-end pipeline: Next.js app authenticates Luca via magic link, calls Amazon SP-API `getOrders`, writes order data to Supabase Postgres, and displays it in the UI.

**Architecture:** Next.js 15 App Router with server components for data display. Supabase handles Postgres + Auth. SP-API auth uses LWA (Login with Amazon) OAuth refresh tokens stored in env vars. A Next.js API route triggers the order pull manually (automated polling comes in Phase 1).

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres + Auth), Amazon SP-API (Orders v0)

---

## File Structure

```
profitsoftware/
├── .env.local                          # Supabase + SP-API credentials
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── vitest.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root layout, font, metadata
│   │   ├── page.tsx                    # Protected dashboard: shows orders
│   │   ├── login/
│   │   │   └── page.tsx               # Magic link login form
│   │   └── auth/
│   │       └── confirm/
│   │           └── route.ts           # Email confirmation callback
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser Supabase client
│   │   │   └── server.ts             # Server-side Supabase client (cookies)
│   │   └── sp-api/
│   │       ├── auth.ts               # LWA token refresh logic
│   │       ├── orders.ts             # getOrders + getOrderItems wrappers
│   │       └── types.ts              # SP-API response types
│   ├── actions/
│   │   └── sync-orders.ts            # Server action: pull orders → DB
│   ├── components/
│   │   ├── orders-table.tsx           # Orders display component
│   │   ├── sync-button.tsx            # Trigger sync manually
│   │   └── ui/                        # shadcn components (added via CLI)
│   └── middleware.ts                   # Auth redirect: unauthenticated → /login
├── supabase/
│   └── migrations/
│       └── 001_phase0_schema.sql      # orders, order_items, products, sync_log
├── tests/
│   ├── lib/
│   │   └── sp-api/
│   │       ├── auth.test.ts           # LWA token refresh tests
│   │       └── orders.test.ts         # Order parsing/mapping tests
│   └── actions/
│       └── sync-orders.test.ts        # Sync action logic tests
└── docs/
    └── superpowers/
        └── plans/
            └── 2026-05-17-phase-0-skeleton.md
```

---

## Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js with TypeScript + Tailwind**

```bash
cd /Users/lucateuchmann/Desktop/profitsoftware
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

When prompted for defaults, accept them. This creates the full scaffold.

- [ ] **Step 2: Install additional dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Add test script to package.json**

Add to `"scripts"` in `package.json`:

```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 5: Create .env.local with placeholder structure**

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Amazon SP-API (LWA)
SP_API_CLIENT_ID=amzn1.application-oa2-client.xxxxx
SP_API_CLIENT_SECRET=your-client-secret
SP_API_REFRESH_TOKEN=your-refresh-token
SP_API_MARKETPLACE_ID=A1F83G8C2ARO7P
SP_API_SELLER_ID=your-seller-id
```

- [ ] **Step 6: Add .env.local to .gitignore**

Verify `.env.local` is already in the `.gitignore` created by `create-next-app`. If not, add it.

- [ ] **Step 7: Verify it runs**

```bash
npm run dev
```

Expected: Next.js dev server starts on http://localhost:3000, shows the default page.

- [ ] **Step 8: Initialize git and commit**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js 15 + Tailwind + vitest"
```

---

## Task 2: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Create auth middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: add Supabase client (browser + server) and auth middleware"
```

---

## Task 3: Auth — Magic Link Login

**Files:**
- Create: `src/app/login/page.tsx`
- Create: `src/app/auth/confirm/route.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Install shadcn/ui and add button + input components**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input card label
```

- [ ] **Step 2: Create login page**

Create `src/app/login/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Magic link sent to <strong>{email}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Amazon Profit Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="hello@lvtdistribution.co.uk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Create auth confirm route**

Create `src/app/auth/confirm/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "email" | "magiclink" | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=invalid_link", request.url));
}
```

- [ ] **Step 4: Update root page to show auth status**

Replace `src/app/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Amazon Profit Tracker</h1>
      <p className="mt-2 text-muted-foreground">
        Logged in as {user.email}
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Test manually**

```bash
npm run dev
```

1. Visit http://localhost:3000 → redirects to /login
2. Enter your email → check inbox for magic link
3. Click link → redirected to dashboard showing your email

- [ ] **Step 6: Commit**

```bash
git add src/app/ src/components/
git commit -m "feat: magic link auth with login page and protected dashboard"
```

---

## Task 4: Database Schema (Migration)

**Files:**
- Create: `supabase/migrations/001_phase0_schema.sql`

- [ ] **Step 1: Create migration file**

Create `supabase/migrations/001_phase0_schema.sql`:

```sql
-- Phase 0 schema: products, orders, order_items, sync_log
-- Minimal viable schema to prove the SP-API → Postgres pipeline

CREATE TABLE products (
  sku             text PRIMARY KEY,
  asin            text,
  parent_asin     text,
  fnsku           text,
  title           text,
  brand           text CHECK (brand IN ('LVT', 'LAK')),
  category        text,
  vat_rate        numeric DEFAULT 0.20 CHECK (vat_rate IN (0.00, 0.05, 0.20)),
  active          boolean DEFAULT true,
  first_seen_at   timestamptz,
  last_synced_at  timestamptz
);

CREATE TABLE orders (
  amazon_order_id     text PRIMARY KEY,
  purchase_date       timestamptz,
  marketplace         text DEFAULT 'AMAZON_UK',
  order_status        text,
  fulfillment_channel text,
  ship_country        text,
  ship_postcode       text,
  last_updated        timestamptz,
  raw                 jsonb
);

CREATE TABLE order_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amazon_order_id      text REFERENCES orders(amazon_order_id),
  order_item_id        text UNIQUE,
  sku                  text,
  asin                 text,
  qty                  int,
  item_price_gross     numeric,
  item_tax             numeric,
  shipping_price       numeric,
  promo_discount       numeric DEFAULT 0,
  estimated_fees       jsonb,
  estimated_profit     numeric,
  actual_fees          jsonb,
  actual_profit        numeric,
  cogs_snapshot        numeric,
  is_settled           boolean DEFAULT false,
  settled_at           timestamptz,
  refund_status        text DEFAULT 'none',
  refund_window_until  date,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(amazon_order_id);
CREATE INDEX idx_order_items_sku ON order_items(sku);
CREATE INDEX idx_orders_purchase_date ON orders(purchase_date);

CREATE TABLE sync_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar        text NOT NULL,
  endpoint      text,
  started_at    timestamptz DEFAULT now(),
  finished_at   timestamptz,
  status        text DEFAULT 'running',
  rows_written  int DEFAULT 0,
  error         text,
  request_id    text
);

CREATE INDEX idx_sync_log_pillar ON sync_log(pillar, started_at DESC);
```

- [ ] **Step 2: Apply migration to Supabase**

Go to your Supabase dashboard → SQL Editor → paste the migration SQL and run it.

Alternatively, if you have the Supabase CLI linked:

```bash
npx supabase db push
```

- [ ] **Step 3: Verify tables exist**

In Supabase dashboard → Table Editor, confirm you see: `products`, `orders`, `order_items`, `sync_log`.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add Phase 0 database schema (orders, products, sync_log)"
```

---

## Task 5: SP-API Auth (LWA Token Refresh)

**Files:**
- Create: `src/lib/sp-api/types.ts`
- Create: `src/lib/sp-api/auth.ts`
- Create: `tests/lib/sp-api/auth.test.ts`

- [ ] **Step 1: Write the SP-API types**

Create `src/lib/sp-api/types.ts`:

```typescript
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
```

- [ ] **Step 2: Write the failing test for token refresh**

Create `tests/lib/sp-api/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { refreshAccessToken } from "@/lib/sp-api/auth";

describe("refreshAccessToken", () => {
  beforeEach(() => {
    vi.stubEnv("SP_API_CLIENT_ID", "test-client-id");
    vi.stubEnv("SP_API_CLIENT_SECRET", "test-client-secret");
    vi.stubEnv("SP_API_REFRESH_TOKEN", "test-refresh-token");
  });

  it("returns access token on successful refresh", async () => {
    const mockResponse = {
      access_token: "Atza|new-access-token",
      refresh_token: "Atzr|new-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const token = await refreshAccessToken();
    expect(token).toBe("Atza|new-access-token");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.amazon.com/auth/o2/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
    );
  });

  it("throws on failed refresh", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    });

    await expect(refreshAccessToken()).rejects.toThrow(
      "LWA token refresh failed: 401"
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:run -- tests/lib/sp-api/auth.test.ts
```

Expected: FAIL — `refreshAccessToken` is not defined.

- [ ] **Step 4: Implement token refresh**

Create `src/lib/sp-api/auth.ts`:

```typescript
import type { LwaTokenResponse } from "./types";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function refreshAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.SP_API_REFRESH_TOKEN!,
    client_id: process.env.SP_API_CLIENT_ID!,
    client_secret: process.env.SP_API_CLIENT_SECRET!,
  });

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`LWA token refresh failed: ${response.status}`);
  }

  const data: LwaTokenResponse = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test:run -- tests/lib/sp-api/auth.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/sp-api/types.ts src/lib/sp-api/auth.ts tests/lib/sp-api/auth.test.ts
git commit -m "feat: SP-API LWA token refresh with in-memory cache"
```

---

## Task 6: SP-API Orders Client

**Files:**
- Create: `src/lib/sp-api/orders.ts`
- Create: `tests/lib/sp-api/orders.test.ts`

- [ ] **Step 1: Write failing test for getOrders**

Create `tests/lib/sp-api/orders.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getRecentOrders, getOrderItems } from "@/lib/sp-api/orders";

vi.mock("@/lib/sp-api/auth", () => ({
  refreshAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
}));

describe("getRecentOrders", () => {
  beforeEach(() => {
    vi.stubEnv("SP_API_MARKETPLACE_ID", "A1F83G8C2ARO7P");
  });

  it("fetches orders updated after a given timestamp", async () => {
    const mockOrders = {
      payload: {
        Orders: [
          {
            AmazonOrderId: "204-1234567-8901234",
            PurchaseDate: "2026-05-16T14:30:00Z",
            OrderStatus: "Shipped",
            FulfillmentChannel: "AFN",
            LastUpdateDate: "2026-05-16T15:00:00Z",
          },
        ],
        NextToken: null,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOrders),
    });

    const since = new Date("2026-05-16T00:00:00Z");
    const result = await getRecentOrders(since);

    expect(result.Orders).toHaveLength(1);
    expect(result.Orders[0].AmazonOrderId).toBe("204-1234567-8901234");

    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall[0]).toContain("sellingpartnerapi-eu.amazon.com");
    expect(fetchCall[0]).toContain("LastUpdatedAfter=");
    expect(fetchCall[1].headers["x-amz-access-token"]).toBe("mock-access-token");
  });

  it("throws on API error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve("Too Many Requests"),
      headers: new Headers({ "x-amzn-RequestId": "req-123" }),
    });

    const since = new Date("2026-05-16T00:00:00Z");
    await expect(getRecentOrders(since)).rejects.toThrow("SP-API error 429");
  });
});

describe("getOrderItems", () => {
  it("fetches items for a given order", async () => {
    const mockItems = {
      payload: {
        OrderItems: [
          {
            OrderItemId: "item-001",
            ASIN: "B0TEST12345",
            SellerSKU: "LVT-TEA-001",
            QuantityOrdered: 2,
            ItemPrice: { CurrencyCode: "GBP", Amount: "24.99" },
          },
        ],
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockItems),
    });

    const result = await getOrderItems("204-1234567-8901234");
    expect(result.OrderItems).toHaveLength(1);
    expect(result.OrderItems[0].SellerSKU).toBe("LVT-TEA-001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- tests/lib/sp-api/orders.test.ts
```

Expected: FAIL — `getRecentOrders` not defined.

- [ ] **Step 3: Implement orders client**

Create `src/lib/sp-api/orders.ts`:

```typescript
import { refreshAccessToken } from "./auth";
import type { GetOrdersResponse, GetOrderItemsResponse } from "./types";

const BASE_URL = "https://sellingpartnerapi-eu.amazon.com";

async function spApiFetch(path: string): Promise<Response> {
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

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- tests/lib/sp-api/orders.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sp-api/orders.ts tests/lib/sp-api/orders.test.ts
git commit -m "feat: SP-API orders client (getRecentOrders + getOrderItems)"
```

---

## Task 7: Sync Orders Action (SP-API → Supabase)

**Files:**
- Create: `src/actions/sync-orders.ts`
- Create: `tests/actions/sync-orders.test.ts`

- [ ] **Step 1: Write failing test for order mapping logic**

Create `tests/actions/sync-orders.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapSpApiOrderToRow, mapSpApiItemToRow } from "@/actions/sync-orders";

describe("mapSpApiOrderToRow", () => {
  it("maps SP-API order to database row", () => {
    const spOrder = {
      AmazonOrderId: "204-1234567-8901234",
      PurchaseDate: "2026-05-16T14:30:00Z",
      OrderStatus: "Shipped",
      FulfillmentChannel: "AFN",
      ShipmentServiceLevelCategory: "Standard",
      OrderTotal: { CurrencyCode: "GBP", Amount: "24.99" },
      ShippingAddress: { CountryCode: "GB", PostalCode: "SW1A 1AA" },
      LastUpdateDate: "2026-05-16T15:00:00Z",
    };

    const row = mapSpApiOrderToRow(spOrder);

    expect(row.amazon_order_id).toBe("204-1234567-8901234");
    expect(row.purchase_date).toBe("2026-05-16T14:30:00Z");
    expect(row.order_status).toBe("Shipped");
    expect(row.fulfillment_channel).toBe("AFN");
    expect(row.ship_country).toBe("GB");
    expect(row.ship_postcode).toBe("SW1A 1AA");
    expect(row.raw).toEqual(spOrder);
  });
});

describe("mapSpApiItemToRow", () => {
  it("maps SP-API order item to database row", () => {
    const spItem = {
      OrderItemId: "item-001",
      ASIN: "B0TEST12345",
      SellerSKU: "LVT-TEA-001",
      QuantityOrdered: 2,
      ItemPrice: { CurrencyCode: "GBP", Amount: "24.99" },
      ItemTax: { CurrencyCode: "GBP", Amount: "4.17" },
      ShippingPrice: { CurrencyCode: "GBP", Amount: "0.00" },
      PromotionDiscount: { CurrencyCode: "GBP", Amount: "2.00" },
    };

    const row = mapSpApiItemToRow(spItem, "204-1234567-8901234");

    expect(row.amazon_order_id).toBe("204-1234567-8901234");
    expect(row.order_item_id).toBe("item-001");
    expect(row.asin).toBe("B0TEST12345");
    expect(row.sku).toBe("LVT-TEA-001");
    expect(row.qty).toBe(2);
    expect(row.item_price_gross).toBe(24.99);
    expect(row.item_tax).toBe(4.17);
    expect(row.shipping_price).toBe(0.0);
    expect(row.promo_discount).toBe(2.0);
  });

  it("handles missing optional price fields", () => {
    const spItem = {
      OrderItemId: "item-002",
      ASIN: "B0TEST99999",
      SellerSKU: "LAK-CHOC-001",
      QuantityOrdered: 1,
    };

    const row = mapSpApiItemToRow(spItem, "204-9999999-0000000");

    expect(row.item_price_gross).toBe(0);
    expect(row.item_tax).toBe(0);
    expect(row.shipping_price).toBe(0);
    expect(row.promo_discount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- tests/actions/sync-orders.test.ts
```

Expected: FAIL — `mapSpApiOrderToRow` not defined.

- [ ] **Step 3: Implement the sync action**

Create `src/actions/sync-orders.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { getRecentOrders, getOrderItems } from "@/lib/sp-api/orders";
import type { SpApiOrder, SpApiOrderItem } from "@/lib/sp-api/types";

export function mapSpApiOrderToRow(order: SpApiOrder) {
  return {
    amazon_order_id: order.AmazonOrderId,
    purchase_date: order.PurchaseDate,
    order_status: order.OrderStatus,
    fulfillment_channel: order.FulfillmentChannel,
    ship_country: order.ShippingAddress?.CountryCode ?? null,
    ship_postcode: order.ShippingAddress?.PostalCode ?? null,
    last_updated: order.LastUpdateDate,
    raw: order,
  };
}

export function mapSpApiItemToRow(item: SpApiOrderItem, orderId: string) {
  return {
    amazon_order_id: orderId,
    order_item_id: item.OrderItemId,
    sku: item.SellerSKU,
    asin: item.ASIN,
    qty: item.QuantityOrdered,
    item_price_gross: parseFloat(item.ItemPrice?.Amount ?? "0"),
    item_tax: parseFloat(item.ItemTax?.Amount ?? "0"),
    shipping_price: parseFloat(item.ShippingPrice?.Amount ?? "0"),
    promo_discount: parseFloat(item.PromotionDiscount?.Amount ?? "0"),
  };
}

export async function syncOrders(): Promise<{
  ordersWritten: number;
  itemsWritten: number;
  error?: string;
}> {
  const supabase = await createClient();

  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("finished_at")
    .eq("pillar", "orders")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1)
    .single();

  const since = lastSync?.finished_at
    ? new Date(lastSync.finished_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);

  const { data: logEntry } = await supabase
    .from("sync_log")
    .insert({ pillar: "orders", endpoint: "getOrders", status: "running" })
    .select("id")
    .single();

  const logId = logEntry!.id;

  try {
    const { Orders } = await getRecentOrders(since);

    let ordersWritten = 0;
    let itemsWritten = 0;

    for (const order of Orders) {
      const row = mapSpApiOrderToRow(order);
      await supabase.from("orders").upsert(row, { onConflict: "amazon_order_id" });
      ordersWritten++;

      const { OrderItems } = await getOrderItems(order.AmazonOrderId);
      for (const item of OrderItems) {
        const itemRow = mapSpApiItemToRow(item, order.AmazonOrderId);
        await supabase
          .from("order_items")
          .upsert(itemRow, { onConflict: "order_item_id" });
        itemsWritten++;
      }
    }

    await supabase
      .from("sync_log")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        rows_written: ordersWritten + itemsWritten,
      })
      .eq("id", logId);

    return { ordersWritten, itemsWritten };
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

    return { ordersWritten: 0, itemsWritten: 0, error: message };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- tests/actions/sync-orders.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/actions/sync-orders.ts tests/actions/sync-orders.test.ts
git commit -m "feat: sync-orders action (SP-API → Supabase with sync_log)"
```

---

## Task 8: Dashboard UI — Orders Table + Sync Button

**Files:**
- Create: `src/components/orders-table.tsx`
- Create: `src/components/sync-button.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Install shadcn table component**

```bash
npx shadcn@latest add table badge
```

- [ ] **Step 2: Create orders table component**

Create `src/components/orders-table.tsx`:

```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Order {
  amazon_order_id: string;
  purchase_date: string;
  order_status: string;
  fulfillment_channel: string;
  ship_country: string | null;
  last_updated: string;
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No orders yet. Click &quot;Sync Orders&quot; to pull from Amazon.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order ID</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Country</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.amazon_order_id}>
            <TableCell className="font-mono text-xs">
              {order.amazon_order_id}
            </TableCell>
            <TableCell>
              {new Date(order.purchase_date).toLocaleDateString("en-GB")}
            </TableCell>
            <TableCell>
              <Badge variant={order.order_status === "Shipped" ? "default" : "secondary"}>
                {order.order_status}
              </Badge>
            </TableCell>
            <TableCell>{order.fulfillment_channel}</TableCell>
            <TableCell>{order.ship_country ?? "—"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Create sync button component**

Create `src/components/sync-button.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { syncOrders } from "@/actions/sync-orders";

export function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);

    const res = await syncOrders();

    if (res.error) {
      setResult(`Error: ${res.error}`);
    } else {
      setResult(`Synced ${res.ordersWritten} orders, ${res.itemsWritten} items`);
    }
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-4">
      <Button onClick={handleSync} disabled={loading}>
        {loading ? "Syncing..." : "Sync Orders"}
      </Button>
      {result && (
        <span className="text-sm text-muted-foreground">{result}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update dashboard page to show orders**

Replace `src/app/page.tsx`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OrdersTable } from "@/components/orders-table";
import { SyncButton } from "@/components/sync-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("amazon_order_id, purchase_date, order_status, fulfillment_channel, ship_country, last_updated")
    .order("purchase_date", { ascending: false })
    .limit(50);

  const { data: syncLogs } = await supabase
    .from("sync_log")
    .select("pillar, status, finished_at, rows_written, error")
    .order("started_at", { ascending: false })
    .limit(5);

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Amazon Profit Tracker</h1>
        <span className="text-sm text-muted-foreground">{user.email}</span>
      </div>

      <SyncButton />

      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Orders</h2>
        <OrdersTable orders={orders ?? []} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Sync Log</h2>
        <div className="text-sm space-y-1">
          {(syncLogs ?? []).map((log, i) => (
            <div key={i} className="flex gap-4 text-muted-foreground">
              <span className="font-mono">{log.pillar}</span>
              <span>{log.status}</span>
              <span>{log.rows_written} rows</span>
              <span>{log.finished_at ? new Date(log.finished_at).toLocaleString("en-GB") : "running..."}</span>
              {log.error && <span className="text-destructive">{log.error}</span>}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ src/app/page.tsx
git commit -m "feat: dashboard with orders table and manual sync button"
```

---

## Task 9: End-to-End Verification

**Files:** None (manual testing)

- [ ] **Step 1: Fill in real credentials**

Edit `.env.local` with your actual Supabase URL/keys and SP-API credentials.

- [ ] **Step 2: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Log in via magic link**

1. Visit http://localhost:3000 → redirected to /login
2. Enter `hello@lvtdistribution.co.uk`
3. Check email, click magic link
4. Should land on dashboard showing "No orders yet"

- [ ] **Step 4: Trigger a sync**

Click "Sync Orders" button.

Expected outcomes:
- Button shows "Syncing..."
- After a few seconds, shows "Synced X orders, Y items" (or an error message if credentials are wrong)
- Page refresh shows orders in the table
- Sync log section shows the run

- [ ] **Step 5: Verify data in Supabase**

Go to Supabase dashboard → Table Editor:
- `orders` table has rows with real Amazon order IDs
- `order_items` table has items linked to those orders
- `sync_log` has one row with status "success"

- [ ] **Step 6: Run all tests**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: Phase 0 complete — end-to-end SP-API → Supabase → UI proven"
```

---

## Verification Checklist

- [ ] `npm run dev` starts without errors
- [ ] Magic link login works end-to-end
- [ ] Unauthenticated users are redirected to /login
- [ ] "Sync Orders" pulls real orders from SP-API
- [ ] Orders appear in Supabase `orders` and `order_items` tables
- [ ] Sync log records each run with status and row count
- [ ] All unit tests pass (`npm run test:run`)
- [ ] No credentials committed to git (`.env.local` in `.gitignore`)
