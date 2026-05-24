"use server";

import { syncFinances as _syncFinances } from "./sync-finances";
import { requireAuth } from "@/lib/auth-guard";

export async function syncFinances() {
  await requireAuth();
  return _syncFinances();
}
