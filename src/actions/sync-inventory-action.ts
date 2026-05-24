"use server";

import { syncInventory as _syncInventory } from "./sync-inventory";
import { requireAuth } from "@/lib/auth-guard";

export async function syncInventory() {
  await requireAuth();
  return _syncInventory();
}
