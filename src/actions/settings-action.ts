"use server";

import {
  getSettings as _get,
  updateSettings as _update,
} from "./settings";
import { requireAuth } from "@/lib/auth-guard";

export async function getSettings() {
  await requireAuth();
  return _get();
}

export async function updateSettings(
  ...args: Parameters<typeof _update>
) {
  await requireAuth();
  return _update(...args);
}
