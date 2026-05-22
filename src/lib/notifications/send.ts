import { buildDailyDigest, toLocalDateStr } from "./digest";
import { sendDigestEmail } from "./email";
import { sendDigestSlack } from "./slack";
import {
  getNotificationSettings,
  logNotification,
  markNotificationSent,
} from "./store";
import type {
  ChannelResult,
  DeliveryResult,
  NotificationSettings,
  NotificationTrigger,
} from "./types";

/**
 * Builds the digest and delivers it over every channel the caller has enabled.
 * Each channel attempt is logged to notification_log; a failure on one channel
 * never blocks the other.
 */
export async function deliverDailyDigest(
  settings: NotificationSettings,
  trigger: NotificationTrigger
): Promise<DeliveryResult> {
  const digest = await buildDailyDigest();
  const results: ChannelResult[] = [];

  if (settings.email_enabled) {
    const r = await sendDigestEmail(digest, settings);
    const status = r.ok ? "sent" : "failed";
    results.push({ channel: "email", status, error: r.error });
    await logNotification({
      report_date: digest.reportDate,
      channel: "email",
      status,
      trigger,
      error: r.error ?? null,
      summary: digest,
    });
  }

  if (settings.slack_enabled) {
    const r = await sendDigestSlack(digest, settings);
    const status = r.ok ? "sent" : "failed";
    results.push({ channel: "slack", status, error: r.error });
    await logNotification({
      report_date: digest.reportDate,
      channel: "slack",
      status,
      trigger,
      error: r.error ?? null,
      summary: digest,
    });
  }

  return {
    ok: results.some((r) => r.status === "sent"),
    reportDate: digest.reportDate,
    results,
  };
}

/**
 * Cron entry point. Sends the daily digest once per day, on the first run at or
 * after the configured send time. `last_sent_date` is stamped after the attempt
 * (even on failure) so a misconfiguration cannot trigger a send loop every
 * 5 minutes — failures stay visible in the notification history instead.
 */
export async function runScheduledNotifications(): Promise<DeliveryResult> {
  const settings = await getNotificationSettings();

  if (!settings.enabled) {
    return { ok: false, skipped: "disabled", results: [] };
  }
  if (!settings.email_enabled && !settings.slack_enabled) {
    return { ok: false, skipped: "no_channels", results: [] };
  }

  const now = new Date();
  const todayStr = toLocalDateStr(now);

  if (settings.last_sent_date === todayStr) {
    return { ok: false, skipped: "already_sent_today", results: [] };
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sendMinutes = settings.send_hour * 60 + settings.send_minute;
  if (nowMinutes < sendMinutes) {
    return { ok: false, skipped: "before_send_time", results: [] };
  }

  const result = await deliverDailyDigest(settings, "scheduled");
  await markNotificationSent(todayStr);
  return result;
}
