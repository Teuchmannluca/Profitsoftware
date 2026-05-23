import { createServiceClient } from "@/lib/supabase/service";
import type {
  BlockConfig,
  NotificationChannel,
  NotificationLogEntry,
  NotificationProfile,
  NotificationStatus,
} from "./types";

export const DEFAULT_BLOCKS: BlockConfig[] = [
  { key: "kpis", enabled: true, metrics: ["revenue", "profit", "margin", "roi", "orders", "units", "adSpend", "expenses", "cogs", "fees"] },
  { key: "topSellers", enabled: true, count: 10 },
  { key: "movers", enabled: true },
  { key: "costBreakdown", enabled: false },
];

function rowToProfile(row: Record<string, unknown>): NotificationProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    enabled: (row.enabled as boolean) ?? true,
    email_enabled: (row.email_enabled as boolean) ?? false,
    slack_enabled: (row.slack_enabled as boolean) ?? false,
    email_from: (row.email_from as string) ?? null,
    recipient_emails: (row.recipient_emails as string) ?? null,
    slack_webhook_url: (row.slack_webhook_url as string) ?? null,
    send_hour: (row.send_hour as number) ?? 8,
    send_minute: (row.send_minute as number) ?? 0,
    frequency: (row.frequency as NotificationProfile["frequency"]) ?? "daily",
    weekly_day: (row.weekly_day as number) ?? null,
    blocks: (row.blocks as BlockConfig[]) ?? DEFAULT_BLOCKS,
    last_sent_date: (row.last_sent_date as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getNotificationProfiles(): Promise<NotificationProfile[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_profiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data.map(rowToProfile);
}

export async function getNotificationProfile(id: string): Promise<NotificationProfile | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return rowToProfile(data);
}

export async function createNotificationProfile(
  profile: Omit<NotificationProfile, "id" | "created_at" | "updated_at" | "last_sent_date">
): Promise<{ id: string | null; error?: string }> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("notification_profiles")
    .insert({
      name: profile.name,
      enabled: profile.enabled,
      email_enabled: profile.email_enabled,
      slack_enabled: profile.slack_enabled,
      email_from: profile.email_from,
      recipient_emails: profile.recipient_emails,
      slack_webhook_url: profile.slack_webhook_url,
      send_hour: profile.send_hour,
      send_minute: profile.send_minute,
      frequency: profile.frequency,
      weekly_day: profile.weekly_day,
      blocks: profile.blocks,
    })
    .select("id")
    .single();

  if (error) return { id: null, error: error.message };
  return { id: data.id };
}

export async function updateNotificationProfile(
  id: string,
  patch: Partial<Omit<NotificationProfile, "id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("notification_profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteNotificationProfile(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("notification_profiles")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function markProfileSent(id: string, dateStr: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("notification_profiles")
    .update({ last_sent_date: dateStr, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function logNotification(entry: {
  profile_id?: string | null;
  report_date: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  trigger: string;
  error?: string | null;
  summary?: unknown;
}): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("notification_log").insert({
    profile_id: entry.profile_id ?? null,
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
  limit = 20,
  profileId?: string
): Promise<NotificationLogEntry[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from("notification_log")
    .select("id, sent_at, report_date, channel, status, trigger, error, profile_id")
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (profileId) {
    query = query.eq("profile_id", profileId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as NotificationLogEntry[];
}
