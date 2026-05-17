"use server";

import { syncFinances as _syncFinances } from "./sync-finances";

export async function syncFinances() {
  return _syncFinances();
}
