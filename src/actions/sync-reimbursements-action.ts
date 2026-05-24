"use server";

import { syncReimbursements as _sync } from "./sync-reimbursements";
import { requireAuth } from "@/lib/auth-guard";

export async function syncReimbursements() {
  await requireAuth();
  return _sync();
}
