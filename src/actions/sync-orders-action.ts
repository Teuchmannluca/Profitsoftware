"use server";

import { syncOrders as _syncOrders } from "./sync-orders";
import { requireAuth } from "@/lib/auth-guard";

export async function syncOrders(sinceOverride?: string) {
  await requireAuth();
  return _syncOrders(sinceOverride);
}
