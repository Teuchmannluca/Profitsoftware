import { buildDailyDigest, toLocalDateStr } from "./digest";
import { sendDigestEmail } from "./email";
import { sendDigestSlack } from "./slack";
import {
  getNotificationProfiles,
  logNotification,
  markProfileSent,
} from "./store";
import type {
  ChannelResult,
  DeliveryResult,
  NotificationProfile,
  NotificationTrigger,
} from "./types";

export async function deliverProfileDigest(
  profile: NotificationProfile,
  trigger: NotificationTrigger
): Promise<DeliveryResult> {
  const digest = await buildDailyDigest(new Date(), profile.blocks);
  const results: ChannelResult[] = [];

  const profileSettings = {
    enabled: profile.enabled,
    email_enabled: profile.email_enabled,
    slack_enabled: profile.slack_enabled,
    email_from: profile.email_from,
    recipient_emails: profile.recipient_emails,
    slack_webhook_url: profile.slack_webhook_url,
    send_hour: profile.send_hour,
    send_minute: profile.send_minute,
    last_sent_date: profile.last_sent_date,
  };

  if (profile.email_enabled) {
    const r = await sendDigestEmail(digest, profileSettings);
    const status = r.ok ? "sent" : "failed";
    results.push({ channel: "email", status, error: r.error });
    await logNotification({
      profile_id: profile.id,
      report_date: digest.reportDate,
      channel: "email",
      status,
      trigger,
      error: r.error ?? null,
      summary: digest,
    });
  }

  if (profile.slack_enabled) {
    const r = await sendDigestSlack(digest, profileSettings);
    const status = r.ok ? "sent" : "failed";
    results.push({ channel: "slack", status, error: r.error });
    await logNotification({
      profile_id: profile.id,
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

function getLondonTimeParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    hour: parseInt(get("hour")),
    minute: parseInt(get("minute")),
    dayOfWeek: dayMap[get("weekday")] ?? 0,
  };
}

function shouldRunProfile(profile: NotificationProfile, now: Date, todayStr: string): boolean {
  if (!profile.enabled) return false;
  if (!profile.email_enabled && !profile.slack_enabled) return false;
  if (profile.last_sent_date === todayStr) return false;

  const london = getLondonTimeParts(now);
  const nowMinutes = london.hour * 60 + london.minute;
  const sendMinutes = profile.send_hour * 60 + profile.send_minute;
  if (nowMinutes < sendMinutes) return false;

  if (profile.frequency === "weekdays" && (london.dayOfWeek === 0 || london.dayOfWeek === 6)) return false;
  if (profile.frequency === "weekly" && profile.weekly_day !== london.dayOfWeek) return false;

  return true;
}

export async function runScheduledNotifications(): Promise<DeliveryResult> {
  const profiles = await getNotificationProfiles();
  if (profiles.length === 0) {
    return { ok: false, skipped: "no_profiles", results: [] };
  }

  const now = new Date();
  const todayStr = toLocalDateStr(now);
  const allResults: ChannelResult[] = [];
  let anyOk = false;

  for (const profile of profiles) {
    if (!shouldRunProfile(profile, now, todayStr)) continue;

    console.log(`[notifications] Running profile "${profile.name}" (${profile.id})`);
    try {
      const result = await deliverProfileDigest(profile, "scheduled");
      allResults.push(...result.results);
      if (result.ok) anyOk = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[notifications] Profile "${profile.name}" failed:`, message);
    }
    await markProfileSent(profile.id, todayStr);
  }

  return { ok: anyOk, results: allResults };
}
