"use server";

import {
  getNotificationProfiles as _getProfiles,
  getNotificationProfile as _getProfile,
  createNotificationProfile as _createProfile,
  updateNotificationProfile as _updateProfile,
  deleteNotificationProfile as _deleteProfile,
  getNotificationHistory as _getHistory,
} from "@/lib/notifications/store";
import { deliverProfileDigest } from "@/lib/notifications/send";
import type {
  DeliveryResult,
  NotificationLogEntry,
  NotificationProfile,
} from "@/lib/notifications/types";
import { requireAuth } from "@/lib/auth-guard";

export async function getNotificationProfiles(): Promise<NotificationProfile[]> {
  await requireAuth();
  return _getProfiles();
}

export async function getNotificationProfile(
  id: string
): Promise<NotificationProfile | null> {
  await requireAuth();
  return _getProfile(id);
}

export async function createNotificationProfile(
  data: Omit<NotificationProfile, "id" | "created_at" | "updated_at" | "last_sent_date">
): Promise<{ id: string | null; error?: string }> {
  await requireAuth();
  return _createProfile(data);
}

export async function updateNotificationProfile(
  id: string,
  patch: Partial<Omit<NotificationProfile, "id" | "created_at" | "updated_at">>
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  return _updateProfile(id, patch);
}

export async function deleteNotificationProfile(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  return _deleteProfile(id);
}

export async function getNotificationHistory(
  limit?: number,
  profileId?: string
): Promise<NotificationLogEntry[]> {
  await requireAuth();
  return _getHistory(limit, profileId);
}

export async function sendTestNotification(
  profileId: string
): Promise<DeliveryResult> {
  await requireAuth();
  const profile = await _getProfile(profileId);
  if (!profile) {
    return { ok: false, skipped: "profile_not_found", results: [] };
  }
  if (!profile.email_enabled && !profile.slack_enabled) {
    return { ok: false, skipped: "no_channels", results: [] };
  }
  return deliverProfileDigest(profile, "manual");
}
