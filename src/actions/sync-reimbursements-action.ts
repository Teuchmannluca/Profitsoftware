"use server";

import { syncReimbursements as _sync } from "./sync-reimbursements";

export async function syncReimbursements() {
  return _sync();
}
