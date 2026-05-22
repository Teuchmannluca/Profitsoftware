export interface NotificationSettings {
  enabled: boolean;
  email_enabled: boolean;
  slack_enabled: boolean;
  email_from: string | null;
  recipient_emails: string | null;
  slack_webhook_url: string | null;
  send_hour: number;
  send_minute: number;
  last_sent_date: string | null;
}

export type MetricFormat = "currency" | "number" | "percent";

export interface DigestMetric {
  key: string;
  label: string;
  value: number;
  prevValue: number;
  format: MetricFormat;
  deltaPct: number | null;
}

export interface DigestTopSeller {
  title: string;
  asin: string;
  imageUrl: string | null;
  units: number;
  sales: number;
}

export interface DigestMover {
  label: string;
  deltaPct: number;
}

export interface DailyDigest {
  reportDate: string;
  compareDate: string;
  reportDateLabel: string;
  metrics: DigestMetric[];
  topSellers: DigestTopSeller[];
  bestMover: DigestMover | null;
  worstMover: DigestMover | null;
}

export type NotificationChannel = "email" | "slack";
export type NotificationStatus = "sent" | "failed" | "skipped";
export type NotificationTrigger = "scheduled" | "manual";

export interface NotificationLogEntry {
  id: string;
  sent_at: string;
  report_date: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  trigger: string;
  error: string | null;
}

export interface ChannelResult {
  channel: NotificationChannel;
  status: NotificationStatus;
  error?: string;
}

export interface DeliveryResult {
  ok: boolean;
  reportDate?: string;
  skipped?: string;
  results: ChannelResult[];
}
