import { createServiceClient } from "@/lib/supabase/service";
import type {
  NotificationChannel,
  NotificationLogEntry,
  NotificationSettings,
  NotificationStatus,
} from "./types";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  enabled: false,
  email_enabled: true,
  slack_enabled: false,
  email_from: null,
  recipient_emails: null,
  slack_webhook_url: null,
  send_hour: 1,
  send_minute: 0,
  last_sent_date: null,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }

  return {
    enabled: data.enabled ?? false,
    email_enabled: data.email_enabled ?? true,
    slack_enabled: data.slack_enabled ?? false,
    email_from: data.email_from ?? null,
    recipient_emails: data.recipient_emails ?? null,
    slack_webhook_url: data.slack_webhook_url ?? null,
    send_hour: data.send_hour ?? 1,
    send_minute: data.send_minute ?? 0,
    last_sent_date: data.last_sent_date ?? null,
  };
}

export async function saveNotificationSettings(
  patch: Partial<NotificationSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase.from("notification_settings").upsert({
    id: 1,
    ...patch,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[notifications] saveNotificationSettings:", error.message);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function markNotificationSent(dateStr: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("notification_settings").upsert({
    id: 1,
    last_sent_date: dateStr,
    updated_at: new Date().toISOString(),
  });
}

export async function logNotification(entry: {
  report_date: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  trigger: string;
  error?: string | null;
  summary?: unknown;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("notification_log").insert({
    report_date: entry.report_date,
    channel: entry.channel,
    status: entry.status,
    trigger: entry.trigger,
    error: entry.error ?? null,
    summary: entry.summary ?? null,
  });
  if (error) {
    console.error("[notifications] logNotification:", error.message);
  }
}

export async function getNotificationHistory(
  limit = 20
): Promise<NotificationLogEntry[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("notification_log")
    .select("id, sent_at, report_date, channel, status, trigger, error")
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as NotificationLogEntry[];
}
