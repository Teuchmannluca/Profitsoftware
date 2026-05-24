"use server";

import { syncReturns as _sync } from "./sync-returns";
import { requireAuth } from "@/lib/auth-guard";

export async function syncReturns() {
  await requireAuth();
  return _sync();
}
