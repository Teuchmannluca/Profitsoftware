# Notifications Page — Design Spec

## Overview

Replace the notification section in `/settings` with a dedicated `/notifications` page. Support multiple notification profiles, each with a block-builder for content, independent channel config (email/Slack), and flexible scheduling.

## Page: `/notifications`

### Header
- Title: "Notifications"
- "Create Notification" button (opens create modal)

### Profile Cards
Each profile rendered as a card showing:
- **Name** (user-defined, e.g., "Daily P&L — Luca")
- **Status badge** — active (green) / paused (gray)
- **Schedule** — e.g., "Daily at 08:00", "Weekdays at 09:00"
- **Channels** — email/Slack icons with recipient count
- **Actions** — Edit, Delete, Send Test Now

Max ~5 profiles expected. Simple card grid, no pagination needed.

### Create/Edit Panel (Slide-over or modal)

Three tabs:

#### Tab 1: Content (Block Builder)
Toggleable, reorderable sections:

| Block | Config | Default |
|-------|--------|---------|
| KPI Cards | Pick metrics: Revenue, Profit, Margin, ROI, Orders, Units, Ad Spend, Expenses, COGS, Fees | All on |
| Top Sellers | Toggle on/off, count: 5 or 10 | On, 10 |
| Movers | Best Win / Weakest performer | On |
| Cost Breakdown | Toggle on/off | Off |

Reorder via up/down arrow buttons. Order stored as JSON array.

#### Tab 2: Channels & Recipients
- **Email**: toggle, `email_from` (text), `recipient_emails` (comma-separated)
- **Slack**: toggle, `slack_webhook_url` (text)

Each profile has its own independent channel config.

#### Tab 3: Schedule
- **Time**: hour (0-23) + minute (0-59) picker
- **Frequency**: daily | weekdays | weekly (pick day: Mon-Sun)
- **Active/Paused** toggle

## Database

### New table: `notification_profiles`

```sql
CREATE TABLE notification_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  enabled       boolean DEFAULT true,
  email_enabled boolean DEFAULT false,
  slack_enabled boolean DEFAULT false,
  email_from    text,
  recipient_emails text,
  slack_webhook_url text,
  send_hour     integer NOT NULL DEFAULT 8 CHECK (send_hour BETWEEN 0 AND 23),
  send_minute   integer NOT NULL DEFAULT 0 CHECK (send_minute BETWEEN 0 AND 59),
  frequency     text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekly')),
  weekly_day    integer CHECK (weekly_day BETWEEN 0 AND 6),
  blocks        jsonb NOT NULL DEFAULT '[
    {"key": "kpis", "enabled": true, "metrics": ["revenue", "profit", "margin", "roi", "orders", "units", "adSpend", "expenses", "cogs", "fees"]},
    {"key": "topSellers", "enabled": true, "count": 10},
    {"key": "movers", "enabled": true},
    {"key": "costBreakdown", "enabled": false}
  ]',
  last_sent_date date,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
```

### Alter `notification_log`

Add `profile_id` column (nullable for backwards compat with existing logs):

```sql
ALTER TABLE notification_log
  ADD COLUMN profile_id uuid REFERENCES notification_profiles(id) ON DELETE SET NULL;
```

### Migration of existing data

If `notification_settings` row exists and is enabled, create a `notification_profiles` row from it, then drop `notification_settings`.

## Cron Changes

`runScheduledNotifications()` updated to:
1. Fetch all profiles where `enabled = true`
2. For each profile, check schedule guards:
   - `last_sent_date` is not today
   - Current time >= `send_hour:send_minute`
   - Frequency check: daily = always, weekdays = Mon-Fri, weekly = matches `weekly_day`
3. Build digest per profile using its `blocks` config
4. Deliver via enabled channels
5. Log each attempt with `profile_id`
6. Update `last_sent_date`

Failures in one profile do not block others.

## Email Template

Keep existing LAK & Co. Group branding (gradient purple header, card layout). The block builder controls which sections render — the `renderEmailHtml()` function receives the profile's `blocks` config and conditionally includes each section.

## Slack Template

Same approach — `buildSlackBlocks()` receives the profile's `blocks` config and only includes enabled sections.

## Sidebar

Add "Notifications" nav item (Bell icon) between existing items. Remove notification section from `/settings`.

## Server Actions

- `getNotificationProfiles()` — fetch all profiles
- `createNotificationProfile(data)` — insert new profile
- `updateNotificationProfile(id, patch)` — update profile
- `deleteNotificationProfile(id)` — delete profile
- `sendTestNotification(profileId)` — deliver digest for specific profile immediately
- `getNotificationHistory(profileId?, limit)` — fetch logs, optionally filtered by profile

## Components

- `NotificationProfileCard` — card display for each profile
- `NotificationProfileEditor` — tabbed create/edit panel
- `BlockBuilder` — reorderable toggle list for content blocks
- `ChannelConfig` — email + Slack config fields
- `ScheduleConfig` — time, frequency, day picker
