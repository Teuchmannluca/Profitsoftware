-- Daily notification system: settings (single row) + delivery log

CREATE TABLE notification_settings (
  id                 int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled            boolean DEFAULT false,
  email_enabled      boolean DEFAULT true,
  slack_enabled      boolean DEFAULT false,
  email_from         text,
  recipient_emails   text,
  slack_webhook_url  text,
  send_hour          int DEFAULT 1 CHECK (send_hour BETWEEN 0 AND 23),
  send_minute        int DEFAULT 0 CHECK (send_minute BETWEEN 0 AND 59),
  last_sent_date     date,
  updated_at         timestamptz DEFAULT now()
);

INSERT INTO notification_settings (id) VALUES (1);

CREATE TABLE notification_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at      timestamptz DEFAULT now(),
  report_date  date,
  channel      text NOT NULL CHECK (channel IN ('email', 'slack')),
  status       text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  trigger      text DEFAULT 'scheduled',
  error        text,
  summary      jsonb
);

CREATE INDEX idx_notification_log_sent_at ON notification_log(sent_at DESC);
