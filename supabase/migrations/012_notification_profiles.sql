-- Notification profiles: multiple notification configs with block builder

CREATE TABLE notification_profiles (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  enabled          boolean DEFAULT true,
  email_enabled    boolean DEFAULT false,
  slack_enabled    boolean DEFAULT false,
  email_from       text,
  recipient_emails text,
  slack_webhook_url text,
  send_hour        integer NOT NULL DEFAULT 8 CHECK (send_hour BETWEEN 0 AND 23),
  send_minute      integer NOT NULL DEFAULT 0 CHECK (send_minute BETWEEN 0 AND 59),
  frequency        text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekdays', 'weekly')),
  weekly_day       integer CHECK (weekly_day BETWEEN 0 AND 6),
  blocks           jsonb NOT NULL DEFAULT '[
    {"key": "kpis", "enabled": true, "metrics": ["revenue", "profit", "margin", "roi", "orders", "units", "adSpend", "expenses", "cogs", "fees"]},
    {"key": "topSellers", "enabled": true, "count": 10},
    {"key": "movers", "enabled": true},
    {"key": "costBreakdown", "enabled": false}
  ]'::jsonb,
  last_sent_date   date,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Add profile_id to notification_log
ALTER TABLE notification_log
  ADD COLUMN profile_id uuid REFERENCES notification_profiles(id) ON DELETE SET NULL;

-- Migrate existing notification_settings into a profile (if enabled)
INSERT INTO notification_profiles (
  name, enabled, email_enabled, slack_enabled,
  email_from, recipient_emails, slack_webhook_url,
  send_hour, send_minute, last_sent_date
)
SELECT
  'Daily Report',
  ns.enabled,
  ns.email_enabled,
  ns.slack_enabled,
  ns.email_from,
  ns.recipient_emails,
  ns.slack_webhook_url,
  ns.send_hour,
  ns.send_minute,
  ns.last_sent_date
FROM notification_settings ns
WHERE ns.id = 1;

-- Drop old single-row table
DROP TABLE notification_settings;
