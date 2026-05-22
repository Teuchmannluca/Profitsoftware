"use server";

import {
  getNotificationHistory as _getHistory,
  getNotificationSettings as _getSettings,
  saveNotificationSettings,
} from "@/lib/notifications/store";
import { deliverDailyDigest } from "@/lib/notifications/send";
import type {
  DeliveryResult,
  NotificationLogEntry,
  NotificationSettings,
} from "@/lib/notifications/types";

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return _getSettings();
}

export async function updateNotificationSettings(
  patch: Partial<NotificationSettings>
): Promise<{ success: boolean; error?: string }> {
  return saveNotificationSettings(patch);
}

export async function getNotificationHistory(
  limit?: number
): Promise<NotificationLogEntry[]> {
  return _getHistory(limit);
}

/**
 * Sends the digest immediately to whichever channels are toggled on, ignoring
 * the master switch and the daily schedule. Used by the "Send test" button.
 */
export async function sendTestNotification(): Promise<DeliveryResult> {
  const settings = await _getSettings();
  if (!settings.email_enabled && !settings.slack_enabled) {
    return { ok: false, skipped: "no_channels", results: [] };
  }
  return deliverDailyDigest(settings, "manual");
}
