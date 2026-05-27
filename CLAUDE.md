# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Next.js dev server on :3000
npm run build        # Production build (also runs type checking)
npm run lint         # ESLint
npm test             # Vitest in watch mode
npx vitest run       # Single test run
npx vitest run tests/lib/notifications/digest.test.ts  # Run specific test file
npx tsc --noEmit     # Type check without building
```

## Architecture

Amazon FBA seller dashboard — tracks P&L, orders, inventory, ads, and finances. Next.js 16 App Router + Supabase + Amazon SP-API + Amazon Ads API. Single-tenant (one seller account). Styling: Tailwind CSS 4 + shadcn/ui. Path alias: `@/*` → `./src/*`.

### Three Supabase clients

- **`lib/supabase/client.ts`** — browser, anon key, used in client components
- **`lib/supabase/server.ts`** — server components/actions, anon key with cookie-based sessions
- **`lib/supabase/service.ts`** — service role key, bypasses RLS, used by sync/cron operations

### Auth flow

Middleware (`middleware.ts`) redirects unauthenticated users to `/login`. API routes `/api/cron`, `/api/sync-ads`, `/api/deploy` are excluded — they use Bearer token auth via `CRON_SECRET`. All UI-facing server actions call `requireAuth()` from `lib/auth-guard.ts`.

### Sync pipeline

The cron endpoint (`/api/cron`) runs every 5 min and executes sequentially:
`syncOrders → syncFinances → syncInventory → syncInboundShipments → syncReimbursements → syncReturns → syncAds → runScheduledNotifications`

Each sync writes progress to the `sync_log` table. Finance sync reconciles real sale prices and fees from Amazon's Finance API onto `order_items` (sets `is_settled=true`, writes `actual_fees`, `actual_profit`).

### Server action pattern

Two-file split: `actions/sync-orders-action.ts` (UI wrapper with `requireAuth()`) calls `actions/sync-orders.ts` (implementation, also called directly from cron without auth). The cron route imports the implementation files directly.

### Pending order pricing

Amazon never returns `ItemPrice` for Pending orders. The sync handles this with 4 fallback layers:
1. Seller listing price (`getPricing` by SKU)
2. Seller listing price (`getPricing` by ASIN)
3. Buy Box price (`getCompetitivePricing`)
4. Last known sale price from `order_items` DB

Pending orders that already have items in DB are **skipped** during item re-fetch to avoid overwriting estimated prices with £0.

### Key database tables

- `orders` / `order_items` — core order data with P&L fields
- `products` — SKU→ASIN mapping, titles, images, VAT rate
- `cogs_periods` — cost of goods with date ranges per ASIN
- `inventory_snapshots` — daily stock levels
- `ad_spend_daily` / `ad_product_daily` — PPC campaign metrics
- `returns` — refund events from Finance API (unique on `amazon_order_id,sku,return_request_date`)
- `reimbursements` — adjustment + SAFE-T claims (unique on `source_type,source_id`)
- `notification_profiles` — multi-recipient notification configs with block builder
- `sync_log` — sync status tracking
- `expenses` — recurring business costs (monthly/weekly/yearly/one-off), pro-rated by day in P&L

### P&L calculation

The `get_sales_metrics` RPC function (defined in `supabase/migrations/011_expenses.sql`) computes all metrics server-side in PostgreSQL. It handles VAT-registered vs non-registered sellers, adjusts fees for VAT reclaim, and includes ad spend + expenses.

### Notifications

Multiple profiles, each with independent email/Slack channels, schedules (daily/weekdays/weekly), and a block builder (toggle KPIs, top sellers, movers). Uses Resend for email, Slack webhooks for Slack. Templates are built programmatically in `lib/notifications/email.ts` and `lib/notifications/slack.ts`.

### Deployment

Hetzner VPS, PM2 + Nginx reverse proxy. GitHub webhook at `/api/deploy` auto-deploys on push to main (HMAC-SHA256 signature verification). Cron runs via system crontab calling `/home/app/sync.sh` every 5 min.

### Mobile

Sidebar is hidden on mobile with a hamburger overlay. Content uses full width. Order table hides Tax/Shipping/Net/COGS columns on small screens. All pages use responsive padding (`p-4 md:p-8`).

### Security

- RLS enabled on all tables (migration `013_row_level_security.sql`). Authenticated users get full access; service role bypasses RLS.
- All UI-facing server actions call `requireAuth()` from `lib/auth-guard.ts`.
- API routes use Bearer token auth via `CRON_SECRET` env var.
- Security headers configured in `next.config.ts` (HSTS, X-Frame-Options, CSP).

### SP-API gotchas

- Amazon SP-API uses American spelling `Canceled` not `Cancelled` in OrderStatuses enum.
- The SP-API client (`lib/sp-api/client.ts`) retries on 429 with 30s/60s backoff (3 attempts). Expired pagination tokens (400 InvalidInput) trigger a full pagination restart (once).
- Order item fetching throttles after the first 25 requests (burst allowance).
- Array parameters use `params.append()` not comma-separated strings.
