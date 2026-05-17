"use server";

import { syncInventory as _syncInventory } from "./sync-inventory";

export async function syncInventory() {
  return _syncInventory();
}
